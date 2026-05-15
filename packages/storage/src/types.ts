import type { EventKind, RequestsValue, RowWithCost, TokenCounts } from '@cu/data';

/**
 * Information the caller must supply about the source CSV file. We hash
 * the raw bytes ourselves (renderer-side or main-side, doesn't matter)
 * so the storage layer can detect re-imports of an identical file
 * before doing any per-row work.
 */
export interface ImportBatchInfo {
  /** Display name shown in the History panel — usually the user-visible CSV filename. */
  filename: string;
  /** SHA-256 of the raw CSV bytes, lowercase hex. Used for "you already imported this file" detection. */
  fileSha256: string;
}

/**
 * Outcome of a single `importRows()` call.
 *
 * - `isDuplicateFile: true` means a previous batch had the same SHA-256;
 *   no new rows were inserted and `existingBatchId` points at the earlier
 *   batch. The renderer should show "this file was already imported at
 *   {imported_at}" rather than the usual diff preview.
 *
 * - Otherwise, `added` / `skipped` describe how many of the supplied rows
 *   were actually written vs. skipped by the natural-key dedup.
 */
export interface ImportResult {
  /** Newly inserted batch id, or the *existing* batch id if `isDuplicateFile`. */
  batchId: number;
  added: number;
  skipped: number;
  dateMin: string | null;
  dateMax: string | null;
  isDuplicateFile: boolean;
  existingBatchId?: number;
}

/** Compact view of one row in the `import_batches` table. */
export interface BatchSummary {
  id: number;
  sourceFilename: string;
  importedAt: number;
  rowCountAdded: number;
  rowCountSkipped: number;
  dateMin: string | null;
  dateMax: string | null;
  fileSha256: string;
}

/**
 * Rich per-batch aggregate used by the "compare two batches" panel.
 *
 * `batch` is the same record `listBatches()` returns. The rest is a single
 * in-memory pass over rows WHERE batch_id = ?, kept cheap by SQLite's
 * b-tree index on (batch_id) — even a million-row DB returns in <50ms.
 */
export interface BatchStats {
  batch: BatchSummary;
  totals: {
    rowCount: number;
    totalCost: number;
    totalRequests: number;
    totalTokens: number;
    cacheReadTokens: number;
    inputTokens: number;
    outputTokens: number;
    maxModeRows: number;
    cacheHitRatio: number;
    estimatedRows: number;
  };
  topModels: Array<{ model: string; cost: number; rows: number; share: number }>;
  byDay: Array<{ date: string; cost: number; rows: number }>;
  topAgents: Array<{
    id: string;
    kind: 'cloud-agent' | 'automation';
    cost: number;
    rows: number;
  }>;
}

/** Cheap aggregate over the whole rows table. */
export interface DbCounts {
  /** Number of rows in the `rows` table. */
  rowCount: number;
  /** Number of import batches recorded. */
  batchCount: number;
  /** First seen day across the whole DB, YYYY-MM-DD. */
  firstDay: string | null;
  /** Last seen day across the whole DB, YYYY-MM-DD. */
  lastDay: string | null;
  /** Sum of cost across all rows. */
  totalCost: number;
}

/**
 * Outcome of a "would this import add anything" preview. Mirrors
 * `ImportResult` semantically but never touches disk — we open a
 * SAVEPOINT, run the same `INSERT OR IGNORE`s, then deliberately
 * roll back so nothing persists.
 *
 * The renderer uses this to populate the merge-preview drawer that
 * pops up after the user drops a CSV but before they confirm the import.
 */
export interface PreviewResult {
  wouldAdd: number;
  wouldSkip: number;
  dateMin: string | null;
  dateMax: string | null;
  /**
   * The file hash matches a previous import batch. The drawer should
   * surface "this exact CSV was imported on {date}" instead of the
   * usual add/skip KPIs.
   */
  isDuplicateFile: boolean;
  existingBatchId?: number;
}

/**
 * Row shape returned by `allRowsCosted()` over IPC. We omit `date`
 * because contextBridge can't survive a `Date` round-trip (it gets
 * stringified); callers should rebuild it from `dateISO`.
 */
export interface SerializedRowWithCost {
  id: string;
  dateISO: string;
  cloudAgentId: string;
  automationId: string;
  kind: EventKind;
  model: string;
  maxMode: boolean;
  tokens: TokenCounts;
  requests: RequestsValue;
  cost: number;
  costEstimated: boolean;
}

/**
 * Named query catalog. Keeping this as a union — instead of free-form SQL
 * — lets the renderer pass *only* a name + params over IPC, never raw SQL.
 * That keeps the attack surface narrow and the query set auditable from
 * the UI side.
 */
export type QueryName =
  | 'counts'
  | 'byDay'
  | 'byMonth'
  | 'byModel'
  | 'byHourWeekday'
  | 'topBurns'
  | 'allRowsCosted';

/** Row from `byDay` — one entry per calendar day with usage. */
export interface DayRow {
  day: string; // YYYY-MM-DD
  rows: number;
  cost: number;
  requestUnits: number;
  totalTokens: number;
}

/** Row from `byMonth` — one entry per calendar month with usage. */
export interface MonthRow {
  month: string; // YYYY-MM
  rows: number;
  cost: number;
  requestUnits: number;
  totalTokens: number;
}

/** Row from `byModel` — aggregated cost / tokens / requests by model name. */
export interface ModelRow {
  model: string;
  rows: number;
  cost: number;
  costEstimated: number; // count of rows whose cost was estimated
  requestUnits: number;
  inputWithCacheWrite: number;
  inputWithoutCacheWrite: number;
  cacheRead: number;
  output: number;
  total: number;
}

/** Row from `byHourWeekday` — 0..23 × 0..6 (Sun) bucket. */
export interface HourWeekdayRow {
  hour: number;
  weekday: number;
  rows: number;
  cost: number;
}

/** Row from `topBurns` — single CSV rows sorted by cost desc. */
export interface TopBurnRow {
  dateISO: string;
  model: string;
  kind: string;
  cost: number;
  costEstimated: boolean;
  requestUnits: number;
  totalTokens: number;
  inputWithCacheWrite: number;
  inputWithoutCacheWrite: number;
  cacheRead: number;
  output: number;
  maxMode: boolean;
}

/**
 * The exact subset of `RowWithCost` we persist. We *don't* persist the
 * derived `id` (which embeds a CSV row number), because it's only useful
 * inside the original parse pass; deduped rows would have ambiguous ids.
 */
export type PersistableRow = RowWithCost;

/**
 * Backup snapshot format. PR22 introduced this as v1; bumping requires
 * a migration path on import. Wraps every batch + its restorable rows
 * so a backup can be replayed onto a clean DB without losing history.
 */
export interface BatchSnapshot {
  batch: {
    sourceFilename: string;
    /** Original `import_batches.imported_at` (ms epoch). Preserved on restore. */
    importedAt: number;
    fileSha256: string;
  };
  rows: PersistableRow[];
}

export interface DbSnapshot {
  version: 1;
  /** UsageDb schema version at export time, copied from PRAGMA user_version. */
  schemaVersion: number;
  exportedAt: string;
  batches: BatchSnapshot[];
}
