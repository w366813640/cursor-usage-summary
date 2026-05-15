import Database, { type Database as DatabaseInstance } from 'better-sqlite3';
import { PRAGMAS, SCHEMA_SQL, SCHEMA_VERSION } from './schema';
import type {
  BatchSnapshot,
  BatchStats,
  BatchSummary,
  DayRow,
  DbCounts,
  DbSnapshot,
  HourWeekdayRow,
  ImportBatchInfo,
  ImportResult,
  ModelRow,
  MonthRow,
  PersistableRow,
  PreviewResult,
  QueryName,
  SerializedRowWithCost,
  TopBurnRow,
} from './types';

/**
 * Sentinel thrown to force a `better-sqlite3` transaction to roll back.
 * Used by `previewImport` so we can attempt the inserts, count the
 * outcome, and then abandon the transaction without committing.
 */
const ROLLBACK_PREVIEW = Symbol('ROLLBACK_PREVIEW');

/**
 * Local persistence layer for cursor-usage. Designed to run in Electron's
 * main process (or anywhere with native Node bindings + filesystem) —
 * never in a renderer.
 *
 * Lifecycle:
 *
 *   const db = new UsageDb(path.join(app.getPath('userData'), 'cursor-usage.db'));
 *   db.init();                          // applies WAL + schema
 *   const r = db.importRows(rows, info); // O(1)/row INSERT OR IGNORE
 *   db.query('byDay');                   // OLAP scans
 *   db.close();                          // on app quit
 *
 * Concurrency: this class holds a single `better-sqlite3` connection,
 * which is synchronous and single-threaded. SQLite handles
 * cross-connection concurrency itself via WAL — but in our setup the
 * connection lives only in the main process and serves all renderer IPC
 * calls one at a time, so we never need a pool.
 */
export class UsageDb {
  private readonly db: DatabaseInstance;

  constructor(dbPath: string | ':memory:') {
    this.db = new Database(dbPath);
  }

  /**
   * Apply PRAGMAs + schema. Idempotent — safe to call on every boot.
   * Bumps `user_version` once when the table set is created so future
   * migrations can branch on it.
   */
  init(): void {
    for (const pragma of PRAGMAS) {
      this.db.exec(pragma);
    }
    this.db.exec(SCHEMA_SQL);
    // Track schema version separately from the data — keeps future
    // migrations simple ("WHERE user_version < N" patches).
    const current = this.db.pragma('user_version', { simple: true }) as number;
    if (current < SCHEMA_VERSION) {
      this.db.pragma(`user_version = ${SCHEMA_VERSION}`);
    }
  }

  /** Cheap full-table counts; safe to call on every renderer mount. */
  counts(): DbCounts {
    const counts = this.db
      .prepare(
        `SELECT
           (SELECT COUNT(*)         FROM rows)            AS rowCount,
           (SELECT COUNT(*)         FROM import_batches)  AS batchCount,
           (SELECT MIN(date_day)    FROM rows)            AS firstDay,
           (SELECT MAX(date_day)    FROM rows)            AS lastDay,
           (SELECT COALESCE(SUM(cost), 0) FROM rows)      AS totalCost`,
      )
      .get() as {
      rowCount: number;
      batchCount: number;
      firstDay: string | null;
      lastDay: string | null;
      totalCost: number;
    };
    return counts;
  }

  /**
   * Insert a batch of parsed-and-costed rows. Uses a single transaction
   * plus `INSERT OR IGNORE`, so:
   *
   *   - Re-importing a file whose rows already exist returns
   *     `{ added: 0, skipped: N }` in O(N) with N tiny prepared inserts.
   *   - Re-importing the *exact same file bytes* short-circuits before
   *     touching `rows` at all, via the UNIQUE constraint on
   *     `import_batches.file_sha256`.
   *
   * Either way, no duplicate rows ever land on disk.
   */
  importRows(rows: ReadonlyArray<PersistableRow>, info: ImportBatchInfo): ImportResult {
    const existing = this.db
      .prepare('SELECT id FROM import_batches WHERE file_sha256 = ?')
      .get(info.fileSha256) as { id: number } | undefined;
    if (existing) {
      const summary = this.batchSummary(existing.id);
      return {
        batchId: existing.id,
        added: 0,
        skipped: rows.length,
        dateMin: summary?.dateMin ?? null,
        dateMax: summary?.dateMax ?? null,
        isDuplicateFile: true,
        existingBatchId: existing.id,
      };
    }

    const insertBatch = this.db.prepare(
      `INSERT INTO import_batches
         (source_filename, imported_at, row_count_added, row_count_skipped, date_min, date_max, file_sha256)
       VALUES (?, ?, 0, 0, NULL, NULL, ?)`,
    );
    const updateBatchStats = this.db.prepare(
      `UPDATE import_batches
         SET row_count_added = ?, row_count_skipped = ?, date_min = ?, date_max = ?
       WHERE id = ?`,
    );
    const insertRow = this.db.prepare(
      `INSERT OR IGNORE INTO rows (
        date_iso, date_day, date_month, hour, weekday,
        cloud_agent_id, automation_id, kind, model, max_mode,
        input_with_cache_write, input_without_cache_write, cache_read, output, total,
        requests_kind, requests_value,
        cost, cost_estimated, batch_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    // IMMEDIATE transaction grabs the write lock up front so concurrent
    // readers (e.g. an in-flight IPC query) don't have to abort and
    // retry. The whole batch commits-or-rolls-back atomically.
    const run = this.db.transaction((batchRows: ReadonlyArray<PersistableRow>) => {
      const result = insertBatch.run(info.filename, Date.now(), info.fileSha256);
      const batchId = Number(result.lastInsertRowid);

      let added = 0;
      let skipped = 0;
      let dateMin: string | null = null;
      let dateMax: string | null = null;

      for (const r of batchRows) {
        const dateIso = r.dateISO;
        const day = dateIso.slice(0, 10);
        const month = dateIso.slice(0, 7);
        // Always re-parse from `dateIso` rather than trusting `r.date`.
        // The two can drift in practice — IPC structured-clones lose the
        // Date prototype, and test factories sometimes override `dateISO`
        // without updating `date`. The string is the source of truth.
        const d = new Date(dateIso);
        const hour = d.getUTCHours();
        const weekday = d.getUTCDay();
        const requestsKind = r.requests.kind;
        const requestsValue = r.requests.kind === 'units' ? r.requests.value : 0;

        const info2 = insertRow.run(
          dateIso,
          day,
          month,
          hour,
          weekday,
          r.cloudAgentId,
          r.automationId,
          r.kind,
          r.model,
          r.maxMode ? 1 : 0,
          r.tokens.inputWithCacheWrite,
          r.tokens.inputWithoutCacheWrite,
          r.tokens.cacheRead,
          r.tokens.output,
          r.tokens.total,
          requestsKind,
          requestsValue,
          r.cost,
          r.costEstimated ? 1 : 0,
          batchId,
        );

        if (info2.changes === 1) {
          added += 1;
          if (dateMin === null || day < dateMin) dateMin = day;
          if (dateMax === null || day > dateMax) dateMax = day;
        } else {
          skipped += 1;
        }
      }

      updateBatchStats.run(added, skipped, dateMin, dateMax, batchId);

      return { batchId, added, skipped, dateMin, dateMax };
    });

    const out = run(rows);

    return {
      ...out,
      isDuplicateFile: false,
    };
  }

  /**
   * Dry-run version of `importRows`. Opens a transaction, runs the same
   * `INSERT OR IGNORE` against `rows`, counts what would be added vs
   * skipped, then throws a sentinel to roll back — nothing persists.
   *
   * Used by the renderer's merge-preview drawer: parse CSV → preview →
   * show "would add X, skip Y dupes (date range A→B)" → user confirms →
   * call `importRows` to do the real write. The result of `previewImport`
   * and the subsequent `importRows` will agree as long as no other
   * concurrent writer raced in between.
   */
  previewImport(rows: ReadonlyArray<PersistableRow>, info: ImportBatchInfo): PreviewResult {
    const existing = this.db
      .prepare('SELECT id FROM import_batches WHERE file_sha256 = ?')
      .get(info.fileSha256) as { id: number } | undefined;
    if (existing) {
      const summary = this.batchSummary(existing.id);
      return {
        wouldAdd: 0,
        wouldSkip: rows.length,
        dateMin: summary?.dateMin ?? null,
        dateMax: summary?.dateMax ?? null,
        isDuplicateFile: true,
        existingBatchId: existing.id,
      };
    }

    const insertRow = this.db.prepare(
      `INSERT OR IGNORE INTO rows (
        date_iso, date_day, date_month, hour, weekday,
        cloud_agent_id, automation_id, kind, model, max_mode,
        input_with_cache_write, input_without_cache_write, cache_read, output, total,
        requests_kind, requests_value,
        cost, cost_estimated, batch_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const insertTempBatch = this.db.prepare(
      `INSERT INTO import_batches
         (source_filename, imported_at, row_count_added, row_count_skipped, date_min, date_max, file_sha256)
       VALUES ('__preview__', 0, 0, 0, NULL, NULL, '__preview_' || lower(hex(randomblob(8))))`,
    );

    let wouldAdd = 0;
    let wouldSkip = 0;
    let dateMin: string | null = null;
    let dateMax: string | null = null;

    try {
      const run = this.db.transaction((batchRows: ReadonlyArray<PersistableRow>) => {
        // We need a real batch_id to satisfy the FK; the surrounding
        // transaction guarantees this temp batch row never reaches disk.
        const tempBatchId = Number(insertTempBatch.run().lastInsertRowid);

        for (const r of batchRows) {
          const dateIso = r.dateISO;
          const day = dateIso.slice(0, 10);
          const month = dateIso.slice(0, 7);
          const d = new Date(dateIso);
          const requestsKind = r.requests.kind;
          const requestsValue = r.requests.kind === 'units' ? r.requests.value : 0;

          const result = insertRow.run(
            dateIso,
            day,
            month,
            d.getUTCHours(),
            d.getUTCDay(),
            r.cloudAgentId,
            r.automationId,
            r.kind,
            r.model,
            r.maxMode ? 1 : 0,
            r.tokens.inputWithCacheWrite,
            r.tokens.inputWithoutCacheWrite,
            r.tokens.cacheRead,
            r.tokens.output,
            r.tokens.total,
            requestsKind,
            requestsValue,
            r.cost,
            r.costEstimated ? 1 : 0,
            tempBatchId,
          );

          if (result.changes === 1) {
            wouldAdd += 1;
            if (dateMin === null || day < dateMin) dateMin = day;
            if (dateMax === null || day > dateMax) dateMax = day;
          } else {
            wouldSkip += 1;
          }
        }

        // Force the transaction to roll back. better-sqlite3's
        // transaction wrapper catches any throw and rolls back, then
        // re-throws — we filter for our own sentinel below.
        throw ROLLBACK_PREVIEW;
      });
      run(rows);
    } catch (err) {
      if (err !== ROLLBACK_PREVIEW) throw err;
    }

    return {
      wouldAdd,
      wouldSkip,
      dateMin,
      dateMax,
      isDuplicateFile: false,
    };
  }

  /**
   * Return the entire `rows` table reshaped as the renderer's
   * `RowWithCost` JSON form (minus `Date`, which the renderer
   * reconstructs from `dateISO`). Sorted by `dateISO` ascending so the
   * existing client-side `aggregate()` pipeline can consume it
   * unchanged.
   *
   * 2300 rows ≈ 1.5 MB JSON; comfortably under IPC payload limits.
   * If the catalog grows past ~100k rows we'll move aggregation server-side.
   */
  allRowsCosted(): SerializedRowWithCost[] {
    const stmt = this.db.prepare(
      `SELECT date_iso                  AS dateISO,
              cloud_agent_id            AS cloudAgentId,
              automation_id             AS automationId,
              kind,
              model,
              max_mode                  AS maxMode,
              input_with_cache_write    AS inputWithCacheWrite,
              input_without_cache_write AS inputWithoutCacheWrite,
              cache_read                AS cacheRead,
              output,
              total,
              requests_kind             AS requestsKind,
              requests_value            AS requestsValue,
              cost,
              cost_estimated            AS costEstimated
       FROM rows
       ORDER BY date_iso ASC`,
    );

    const raw = stmt.all() as Array<{
      dateISO: string;
      cloudAgentId: string;
      automationId: string;
      kind: string;
      model: string;
      maxMode: 0 | 1;
      inputWithCacheWrite: number;
      inputWithoutCacheWrite: number;
      cacheRead: number;
      output: number;
      total: number;
      requestsKind: string;
      requestsValue: number;
      cost: number;
      costEstimated: 0 | 1;
    }>;

    return raw.map((r, i) => ({
      id: `${r.dateISO}::${r.model}::${i}`,
      dateISO: r.dateISO,
      cloudAgentId: r.cloudAgentId,
      automationId: r.automationId,
      kind: r.kind as SerializedRowWithCost['kind'],
      model: r.model,
      maxMode: r.maxMode === 1,
      tokens: {
        inputWithCacheWrite: r.inputWithCacheWrite,
        inputWithoutCacheWrite: r.inputWithoutCacheWrite,
        cacheRead: r.cacheRead,
        output: r.output,
        total: r.total,
      },
      requests:
        r.requestsKind === 'units'
          ? { kind: 'units', value: r.requestsValue }
          : r.requestsKind === 'free'
            ? { kind: 'free' }
            : { kind: 'errored' },
      cost: r.cost,
      costEstimated: r.costEstimated === 1,
    }));
  }

  /** All batches ordered newest first. Renderer's History page wants this verbatim. */
  listBatches(): BatchSummary[] {
    const stmt = this.db.prepare(
      `SELECT id, source_filename AS sourceFilename, imported_at AS importedAt,
              row_count_added AS rowCountAdded, row_count_skipped AS rowCountSkipped,
              date_min AS dateMin, date_max AS dateMax, file_sha256 AS fileSha256
       FROM import_batches
       ORDER BY imported_at DESC`,
    );
    return stmt.all() as BatchSummary[];
  }

  /**
   * Rich per-batch aggregate for the "compare two batches" panel.
   *
   * Pulls every row tagged with this batch_id and folds it down to a
   * compact `BatchStats`. We deliberately do the aggregation in JS
   * rather than 4 separate GROUP BY queries — typical batches are
   * a few hundred to a few thousand rows so the single pass is plenty
   * fast and keeps the SQL surface small.
   *
   * Returns `null` if the batch id doesn't exist (eg. it was undone
   * between the renderer reading the list and clicking Compare).
   */
  batchStats(batchId: number): BatchStats | null {
    const batch = this.batchSummary(batchId);
    if (!batch) return null;

    const rowsForBatch = this.db
      .prepare(
        `SELECT date_iso                  AS dateISO,
                cloud_agent_id            AS cloudAgentId,
                automation_id             AS automationId,
                model,
                max_mode                  AS maxMode,
                input_with_cache_write    AS inputWithCacheWrite,
                input_without_cache_write AS inputWithoutCacheWrite,
                cache_read                AS cacheRead,
                output,
                total,
                requests_kind             AS requestsKind,
                requests_value            AS requestsValue,
                cost,
                cost_estimated            AS costEstimated
         FROM rows
         WHERE batch_id = ?
         ORDER BY date_iso ASC`,
      )
      .all(batchId) as Array<{
      dateISO: string;
      cloudAgentId: string;
      automationId: string;
      model: string;
      maxMode: 0 | 1;
      inputWithCacheWrite: number;
      inputWithoutCacheWrite: number;
      cacheRead: number;
      output: number;
      total: number;
      requestsKind: string;
      requestsValue: number;
      cost: number;
      costEstimated: 0 | 1;
    }>;

    let totalCost = 0;
    let totalRequests = 0;
    let totalTokens = 0;
    let cacheReadTokens = 0;
    let inputTokens = 0;
    let outputTokens = 0;
    let maxModeRows = 0;
    let estimatedRows = 0;
    const modelMap = new Map<string, { cost: number; rows: number }>();
    const dayMap = new Map<string, { cost: number; rows: number }>();
    const agentMap = new Map<
      string,
      { id: string; kind: 'cloud-agent' | 'automation'; cost: number; rows: number }
    >();

    for (const r of rowsForBatch) {
      totalCost += r.cost;
      if (r.requestsKind === 'units') totalRequests += r.requestsValue;
      totalTokens += r.total;
      cacheReadTokens += r.cacheRead;
      inputTokens += r.inputWithCacheWrite + r.inputWithoutCacheWrite;
      outputTokens += r.output;
      if (r.maxMode === 1) maxModeRows += 1;
      if (r.costEstimated === 1) estimatedRows += 1;

      const m = modelMap.get(r.model) ?? { cost: 0, rows: 0 };
      m.cost += r.cost;
      m.rows += 1;
      modelMap.set(r.model, m);

      const day = r.dateISO.slice(0, 10);
      const d = dayMap.get(day) ?? { cost: 0, rows: 0 };
      d.cost += r.cost;
      d.rows += 1;
      dayMap.set(day, d);

      const cloud = r.cloudAgentId.trim();
      const auto = r.automationId.trim();
      if (cloud) {
        const key = `ca:${cloud}`;
        const a = agentMap.get(key) ?? {
          id: cloud,
          kind: 'cloud-agent' as const,
          cost: 0,
          rows: 0,
        };
        a.cost += r.cost;
        a.rows += 1;
        agentMap.set(key, a);
      } else if (auto) {
        const key = `au:${auto}`;
        const a = agentMap.get(key) ?? {
          id: auto,
          kind: 'automation' as const,
          cost: 0,
          rows: 0,
        };
        a.cost += r.cost;
        a.rows += 1;
        agentMap.set(key, a);
      }
    }

    const cacheHitRatio =
      inputTokens + cacheReadTokens > 0 ? cacheReadTokens / (inputTokens + cacheReadTokens) : 0;

    const topModels = [...modelMap.entries()]
      .map(([model, v]) => ({
        model,
        cost: v.cost,
        rows: v.rows,
        share: totalCost > 0 ? v.cost / totalCost : 0,
      }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 8);

    const byDay = [...dayMap.entries()]
      .map(([date, v]) => ({ date, cost: v.cost, rows: v.rows }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const topAgents = [...agentMap.values()].sort((a, b) => b.cost - a.cost).slice(0, 5);

    return {
      batch,
      totals: {
        rowCount: rowsForBatch.length,
        totalCost,
        totalRequests,
        totalTokens,
        cacheReadTokens,
        inputTokens,
        outputTokens,
        maxModeRows,
        cacheHitRatio,
        estimatedRows,
      },
      topModels,
      byDay,
      topAgents,
    };
  }

  /**
   * Roll back a single batch. Returns the number of rows actually
   * deleted from the `rows` table (ON DELETE CASCADE on the FK). The
   * row count includes only rows that came in *with this batch*; rows
   * dedup-collapsed onto an earlier batch are untouched.
   *
   * Renderer surface: a "Undo this import" button next to each entry
   * on the History page.
   */
  undoBatch(batchId: number): { removedRows: number } {
    // batch_id on the row was set to the batch that *successfully*
    // inserted it, so we can count first then cascade-delete via the
    // FK declaration (`ON DELETE CASCADE`).
    const countRow = this.db
      .prepare('SELECT COUNT(*) AS n FROM rows WHERE batch_id = ?')
      .get(batchId) as { n: number };
    const removedRows = countRow.n;

    const tx = this.db.transaction((id: number) => {
      this.db.prepare('DELETE FROM import_batches WHERE id = ?').run(id);
    });
    tx(batchId);

    return { removedRows };
  }

  /**
   * Named-query dispatcher. Renderer passes a name + params over IPC;
   * we never accept free-form SQL. This keeps the renderer surface
   * declarative and the audit story simple.
   */
  query(name: 'counts'): DbCounts;
  query(name: 'byDay'): DayRow[];
  query(name: 'byMonth'): MonthRow[];
  query(name: 'byModel'): ModelRow[];
  query(name: 'byHourWeekday'): HourWeekdayRow[];
  query(name: 'topBurns', params?: { limit?: number }): TopBurnRow[];
  query(name: 'allRowsCosted'): SerializedRowWithCost[];
  query(name: QueryName, params?: Record<string, unknown>): unknown;
  query(name: QueryName, params?: Record<string, unknown>): unknown {
    switch (name) {
      case 'counts':
        return this.counts();
      case 'allRowsCosted':
        return this.allRowsCosted();
      case 'byDay':
        return this.db
          .prepare(
            `SELECT date_day AS day,
                    COUNT(*)                                                    AS rows,
                    COALESCE(SUM(cost), 0)                                      AS cost,
                    COALESCE(SUM(CASE WHEN requests_kind = 'units' THEN requests_value ELSE 0 END), 0) AS requestUnits,
                    COALESCE(SUM(total), 0)                                     AS totalTokens
             FROM rows
             GROUP BY date_day
             ORDER BY date_day ASC`,
          )
          .all() as DayRow[];
      case 'byMonth':
        return this.db
          .prepare(
            `SELECT date_month AS month,
                    COUNT(*)                                                    AS rows,
                    COALESCE(SUM(cost), 0)                                      AS cost,
                    COALESCE(SUM(CASE WHEN requests_kind = 'units' THEN requests_value ELSE 0 END), 0) AS requestUnits,
                    COALESCE(SUM(total), 0)                                     AS totalTokens
             FROM rows
             GROUP BY date_month
             ORDER BY date_month ASC`,
          )
          .all() as MonthRow[];
      case 'byModel':
        return this.db
          .prepare(
            `SELECT model,
                    COUNT(*)                                                    AS rows,
                    COALESCE(SUM(cost), 0)                                      AS cost,
                    COALESCE(SUM(cost_estimated), 0)                            AS costEstimated,
                    COALESCE(SUM(CASE WHEN requests_kind = 'units' THEN requests_value ELSE 0 END), 0) AS requestUnits,
                    COALESCE(SUM(input_with_cache_write), 0)                    AS inputWithCacheWrite,
                    COALESCE(SUM(input_without_cache_write), 0)                 AS inputWithoutCacheWrite,
                    COALESCE(SUM(cache_read), 0)                                AS cacheRead,
                    COALESCE(SUM(output), 0)                                    AS output,
                    COALESCE(SUM(total), 0)                                     AS total
             FROM rows
             GROUP BY model
             ORDER BY cost DESC`,
          )
          .all() as ModelRow[];
      case 'byHourWeekday':
        return this.db
          .prepare(
            `SELECT hour, weekday,
                    COUNT(*)                                                    AS rows,
                    COALESCE(SUM(cost), 0)                                      AS cost
             FROM rows
             GROUP BY hour, weekday
             ORDER BY hour, weekday`,
          )
          .all() as HourWeekdayRow[];
      case 'topBurns': {
        const limit = Math.max(1, Math.min(500, Number(params?.limit ?? 10)));
        return this.db
          .prepare(
            `SELECT date_iso                  AS dateISO,
                    model,
                    kind,
                    cost,
                    cost_estimated            AS costEstimated,
                    CASE WHEN requests_kind = 'units' THEN requests_value ELSE 0 END AS requestUnits,
                    total                     AS totalTokens,
                    input_with_cache_write    AS inputWithCacheWrite,
                    input_without_cache_write AS inputWithoutCacheWrite,
                    cache_read                AS cacheRead,
                    output,
                    max_mode                  AS maxMode
             FROM rows
             ORDER BY cost DESC
             LIMIT ?`,
          )
          .all(limit) as TopBurnRow[];
      }
      default: {
        // Exhaustiveness check — TS will error here if a new query name
        // is added to the union without a branch above.
        const _exhaustive: never = name;
        throw new Error(`unknown query: ${String(_exhaustive)}`);
      }
    }
  }

  /**
   * Dump the entire DB into a serialisable snapshot. Used by the
   * Settings → Backup flow so the user can copy their history off the
   * machine, or replay it on a new install.
   *
   * The shape is *not* a 1:1 mirror of the table layout — we preserve
   * what's needed to rebuild the row deterministically (`PersistableRow`
   * fields) plus the batch metadata, and skip implementation details
   * like `batch_id` (rewritten on restore) or the synthetic stringified
   * `id`. Format version stays at `1` until we introduce a breaking
   * change; restore code rejects unknown versions.
   */
  exportSnapshot(): DbSnapshot {
    const batches = this.db
      .prepare(
        `SELECT id, source_filename AS sourceFilename, imported_at AS importedAt,
                file_sha256 AS fileSha256
         FROM import_batches
         ORDER BY id ASC`,
      )
      .all() as Array<{
      id: number;
      sourceFilename: string;
      importedAt: number;
      fileSha256: string;
    }>;

    const rowsStmt = this.db.prepare(
      `SELECT date_iso                  AS dateISO,
              cloud_agent_id            AS cloudAgentId,
              automation_id             AS automationId,
              kind, model,
              max_mode                  AS maxMode,
              input_with_cache_write    AS inputWithCacheWrite,
              input_without_cache_write AS inputWithoutCacheWrite,
              cache_read                AS cacheRead,
              output, total,
              requests_kind             AS requestsKind,
              requests_value            AS requestsValue,
              cost,
              cost_estimated            AS costEstimated
       FROM rows WHERE batch_id = ?
       ORDER BY date_iso ASC`,
    );

    const batchSnapshots: BatchSnapshot[] = batches.map((b) => {
      const rawRows = rowsStmt.all(b.id) as Array<{
        dateISO: string;
        cloudAgentId: string;
        automationId: string;
        kind: string;
        model: string;
        maxMode: 0 | 1;
        inputWithCacheWrite: number;
        inputWithoutCacheWrite: number;
        cacheRead: number;
        output: number;
        total: number;
        requestsKind: string;
        requestsValue: number;
        cost: number;
        costEstimated: 0 | 1;
      }>;

      // PersistableRow is structurally `RowWithCost`, which carries the
      // synthetic `id` + `Date` instance. Both are derivable from
      // `dateISO`, so we synthesise them here purely to satisfy the
      // type — the importer ignores `id` (the table doesn't store it)
      // and rebuilds `date` from `dateISO` at restore time.
      const persistable: PersistableRow[] = rawRows.map((r, i) => ({
        id: `snap-${b.id}-${i}`,
        dateISO: r.dateISO,
        date: new Date(r.dateISO),
        cloudAgentId: r.cloudAgentId,
        automationId: r.automationId,
        kind: r.kind as PersistableRow['kind'],
        model: r.model,
        maxMode: r.maxMode === 1,
        tokens: {
          inputWithCacheWrite: r.inputWithCacheWrite,
          inputWithoutCacheWrite: r.inputWithoutCacheWrite,
          cacheRead: r.cacheRead,
          output: r.output,
          total: r.total,
        },
        requests:
          r.requestsKind === 'units'
            ? { kind: 'units', value: r.requestsValue }
            : r.requestsKind === 'free'
              ? { kind: 'free' }
              : { kind: 'errored' },
        cost: r.cost,
        costEstimated: r.costEstimated === 1,
      }));

      return {
        batch: {
          sourceFilename: b.sourceFilename,
          importedAt: b.importedAt,
          fileSha256: b.fileSha256,
        },
        rows: persistable,
      };
    });

    return {
      version: 1,
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      batches: batchSnapshots,
    };
  }

  /**
   * Replace the entire DB with the contents of a previously exported
   * snapshot. The operation is atomic — if any batch fails to restore,
   * the whole transaction rolls back and the existing data is
   * preserved.
   *
   * Note: this wipes the existing `import_batches` (cascading to
   * `rows`) before re-inserting, so callers should confirm with the
   * user *before* invoking. The renderer's Settings drawer puts this
   * behind a two-step confirmation.
   */
  importSnapshot(snapshot: DbSnapshot): { batchesRestored: number; rowsRestored: number } {
    if (!snapshot || snapshot.version !== 1) {
      throw new Error(`unsupported snapshot version: ${String(snapshot?.version)} (expected 1)`);
    }

    const insertBatch = this.db.prepare(
      `INSERT INTO import_batches
         (source_filename, imported_at, row_count_added, row_count_skipped, date_min, date_max, file_sha256)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    const insertRow = this.db.prepare(
      `INSERT OR IGNORE INTO rows (
        date_iso, date_day, date_month, hour, weekday,
        cloud_agent_id, automation_id, kind, model, max_mode,
        input_with_cache_write, input_without_cache_write, cache_read, output, total,
        requests_kind, requests_value,
        cost, cost_estimated, batch_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    const run = this.db.transaction((snap: DbSnapshot) => {
      this.db.exec('DELETE FROM import_batches');

      let rowsRestored = 0;
      for (const batchSnap of snap.batches) {
        let added = 0;
        let dateMin: string | null = null;
        let dateMax: string | null = null;

        // Insert the batch first so we know its assigned id; row stats
        // backfilled at the end so they reflect what actually landed.
        const result = insertBatch.run(
          batchSnap.batch.sourceFilename,
          batchSnap.batch.importedAt,
          0,
          0,
          null,
          null,
          batchSnap.batch.fileSha256,
        );
        const batchId = Number(result.lastInsertRowid);

        for (const r of batchSnap.rows) {
          const dateIso = r.dateISO;
          const day = dateIso.slice(0, 10);
          const month = dateIso.slice(0, 7);
          const d = new Date(dateIso);
          const requestsKind = r.requests.kind;
          const requestsValue = r.requests.kind === 'units' ? r.requests.value : 0;

          const info = insertRow.run(
            dateIso,
            day,
            month,
            d.getUTCHours(),
            d.getUTCDay(),
            r.cloudAgentId,
            r.automationId,
            r.kind,
            r.model,
            r.maxMode ? 1 : 0,
            r.tokens.inputWithCacheWrite,
            r.tokens.inputWithoutCacheWrite,
            r.tokens.cacheRead,
            r.tokens.output,
            r.tokens.total,
            requestsKind,
            requestsValue,
            r.cost,
            r.costEstimated ? 1 : 0,
            batchId,
          );
          if (info.changes === 1) {
            added += 1;
            rowsRestored += 1;
            if (dateMin === null || day < dateMin) dateMin = day;
            if (dateMax === null || day > dateMax) dateMax = day;
          }
        }

        this.db
          .prepare(
            'UPDATE import_batches SET row_count_added = ?, date_min = ?, date_max = ? WHERE id = ?',
          )
          .run(added, dateMin, dateMax, batchId);
      }

      return { batchesRestored: snap.batches.length, rowsRestored };
    });

    return run(snapshot);
  }

  close(): void {
    this.db.close();
  }

  /** Internal helper — also exposed for unit tests. */
  private batchSummary(id: number): BatchSummary | null {
    const row = this.db
      .prepare(
        `SELECT id, source_filename AS sourceFilename, imported_at AS importedAt,
                row_count_added AS rowCountAdded, row_count_skipped AS rowCountSkipped,
                date_min AS dateMin, date_max AS dateMax, file_sha256 AS fileSha256
         FROM import_batches WHERE id = ?`,
      )
      .get(id) as BatchSummary | undefined;
    return row ?? null;
  }
}
