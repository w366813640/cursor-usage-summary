/**
 * SQLite schema for cursor-usage's local persistence layer.
 *
 * Design notes:
 *
 *  - `rows` is a *wide* OLAP-friendly table — one row per CSV event,
 *    no normalization of models/days/hours. At individual-user scale
 *    (≤ 500k rows for a year of heavy use) the disk overhead is tiny
 *    and queries are simpler / faster than a star-schema split.
 *
 *  - The PRIMARY KEY is the natural composite that uniquely identifies
 *    a real Cursor event. It enforces dedup at the SQLite level — repeat
 *    imports of overlapping CSVs collapse to a single row via
 *    `INSERT OR IGNORE`, O(1) per row. Includes every observable field
 *    that a same-second different-event might differ on. dateISO + model
 *    + IDs alone would *not* be unique: a single second can host
 *    multiple cache-only completions for the same model.
 *
 *  - `WITHOUT ROWID` shrinks the on-disk size (the PK *is* the row
 *    address) and makes PK-driven lookups faster for our access pattern,
 *    which is overwhelmingly "scan by date or model, aggregate", not
 *    "fetch by integer rowid".
 *
 *  - `date_day` / `date_month` / `hour` / `weekday` are *materialized*
 *    from `dateISO` at insert time. This keeps GROUP BY queries free of
 *    `strftime()` calls (which can't use indexes) — they pay for the
 *    extra disk in exchange for big query wins.
 *
 *  - `import_batches.file_sha256` is UNIQUE so the renderer can early-
 *    return "this exact file was already imported on YYYY-MM-DD HH:MM"
 *    without touching `rows` at all.
 *
 *  - `ON DELETE CASCADE` on rows.batch_id powers the History Undo flow
 *    (Q3.B in the PRD) — a single `DELETE FROM import_batches WHERE
 *    id = ?` rolls back every row that came in with that batch.
 *
 *  - `user_version` tracks migrations. PR16 is schema v1; if/when we
 *    add new columns we'll bump this and rewrite the table.
 */

export const SCHEMA_VERSION = 1;

export const PRAGMAS = [
  'PRAGMA journal_mode = WAL',
  'PRAGMA synchronous = NORMAL',
  'PRAGMA foreign_keys = ON',
  // Larger cache + mmap helps OLAP scans on bigger DBs (~50k+ rows). Both
  // are advisory; SQLite silently shrinks if it can't honor them.
  'PRAGMA cache_size = -20000', // 20 MB negative = "kibibytes of memory"
  'PRAGMA mmap_size = 268435456', // 256 MB
] as const;

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS import_batches (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  source_filename   TEXT    NOT NULL,
  imported_at       INTEGER NOT NULL,
  row_count_added   INTEGER NOT NULL,
  row_count_skipped INTEGER NOT NULL,
  date_min          TEXT,
  date_max          TEXT,
  file_sha256       TEXT    NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS rows (
  date_iso                  TEXT    NOT NULL,
  date_day                  TEXT    NOT NULL,
  date_month                TEXT    NOT NULL,
  hour                      INTEGER NOT NULL,
  weekday                   INTEGER NOT NULL,
  cloud_agent_id            TEXT    NOT NULL DEFAULT '',
  automation_id             TEXT    NOT NULL DEFAULT '',
  kind                      TEXT    NOT NULL,
  model                     TEXT    NOT NULL,
  max_mode                  INTEGER NOT NULL,
  input_with_cache_write    INTEGER NOT NULL DEFAULT 0,
  input_without_cache_write INTEGER NOT NULL DEFAULT 0,
  cache_read                INTEGER NOT NULL DEFAULT 0,
  output                    INTEGER NOT NULL DEFAULT 0,
  total                     INTEGER NOT NULL DEFAULT 0,
  requests_kind             TEXT    NOT NULL,
  requests_value            REAL    NOT NULL DEFAULT 0,
  cost                      REAL    NOT NULL DEFAULT 0,
  cost_estimated            INTEGER NOT NULL DEFAULT 0,
  batch_id                  INTEGER NOT NULL,
  PRIMARY KEY (
    date_iso, model, cloud_agent_id, automation_id, max_mode,
    input_with_cache_write, input_without_cache_write, cache_read,
    output, total, requests_kind, requests_value
  ),
  FOREIGN KEY (batch_id) REFERENCES import_batches(id) ON DELETE CASCADE
) WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS idx_rows_day        ON rows(date_day);
CREATE INDEX IF NOT EXISTS idx_rows_month      ON rows(date_month);
CREATE INDEX IF NOT EXISTS idx_rows_model      ON rows(model);
CREATE INDEX IF NOT EXISTS idx_rows_hour_wday  ON rows(hour, weekday);
CREATE INDEX IF NOT EXISTS idx_rows_cost_desc  ON rows(cost DESC);
CREATE INDEX IF NOT EXISTS idx_rows_batch      ON rows(batch_id);
`;
