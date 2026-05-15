import Database, { type Database as DatabaseInstance } from 'better-sqlite3';
import { PRAGMAS, SCHEMA_SQL, SCHEMA_VERSION } from './schema';
import type {
  BatchSummary,
  DayRow,
  DbCounts,
  HourWeekdayRow,
  ImportBatchInfo,
  ImportResult,
  ModelRow,
  MonthRow,
  PersistableRow,
  QueryName,
  TopBurnRow,
} from './types';

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
  query(name: QueryName, params?: Record<string, unknown>): unknown;
  query(name: QueryName, params?: Record<string, unknown>): unknown {
    switch (name) {
      case 'counts':
        return this.counts();
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
