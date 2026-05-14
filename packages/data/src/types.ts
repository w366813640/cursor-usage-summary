/**
 * Domain types for one row of `cursor.com/dashboard/usage` exports.
 *
 * Source CSV header (verbatim, in order):
 *   Date, Cloud Agent ID, Automation ID, Kind, Model, Max Mode,
 *   Input (w/ Cache Write), Input (w/o Cache Write), Cache Read,
 *   Output Tokens, Total Tokens, Requests
 *
 * Quirks observed in real-world CSVs (do NOT remove without re-checking
 * `input/usage-events-*.csv`):
 *  - Token columns can be empty strings → must coerce to 0
 *  - Kind contains a literal comma: "Errored, No Charge" — quoting matters
 *  - Requests column is highly polymorphic (see {@link RequestsValue})
 *  - Date is ISO-8601 in UTC ("Z" suffix) — safe for `new Date(s)`
 *  - Max Mode is "Yes" | "No"
 */

/**
 * Discriminated union for the Requests column.
 *
 * - `{ kind: 'units', value: number }`  · Cursor quota units charged for
 *   this event. Can be a fraction (`0.1`, `47.3`, `141.5`, …) because some
 *   Max Mode calls cost a fractional or large multiple of one "request".
 * - `{ kind: 'free' }`  · The literal string `"Free"` — usage was inside
 *   a free quota window or part of a free model.
 * - `{ kind: 'errored' }`  · The literal `"-"` — request errored out and
 *   was not billed.
 */
export type RequestsValue =
  | { kind: 'units'; value: number }
  | { kind: 'free' }
  | { kind: 'errored' };

/** Verbatim Kind values observed in real CSV exports. */
export type EventKind = 'Included' | 'Errored, No Charge' | 'Aborted, Not Charged' | 'Free';

/**
 * Token counts straight from the CSV. All numeric, with `0` substituted for
 * empty strings — never `null` so downstream code does not need null guards.
 */
export interface TokenCounts {
  /** Input (w/ Cache Write) — fresh prompt tokens that *do* warm the cache. */
  inputWithCacheWrite: number;
  /** Input (w/o Cache Write) — fresh prompt tokens that bypass cache. */
  inputWithoutCacheWrite: number;
  /** Cache Read — tokens served from prompt cache (cheapest). */
  cacheRead: number;
  /** Output Tokens — model-generated tokens. */
  output: number;
  /** Total Tokens — convenience sum reported by Cursor (kept verbatim). */
  total: number;
}

/** A single parsed CSV row, normalized for downstream aggregation. */
export interface UsageRow {
  /** Stable hash-friendly id derived from `${date.toISOString()}::${model}::${index}`. */
  id: string;
  /** Original ISO timestamp (preserved for dedupe / display). */
  dateISO: string;
  /** Parsed Date object (UTC). */
  date: Date;
  /** Cloud Agent ID — empty string if not a cloud agent run. */
  cloudAgentId: string;
  /** Automation ID — empty string if not part of an automation. */
  automationId: string;
  kind: EventKind;
  /** Verbatim model string, e.g. `claude-opus-4-7-thinking-max`. */
  model: string;
  /** Whether Max Mode was on (Yes → true). */
  maxMode: boolean;
  tokens: TokenCounts;
  requests: RequestsValue;
}

/** A row that failed to parse — kept for diagnostic surfaces. */
export interface ParseFailure {
  /** 1-indexed row number in the source CSV (excluding header). */
  rowNumber: number;
  raw: Record<string, string | undefined>;
  reason: string;
}

export interface ParseResult {
  rows: UsageRow[];
  failures: ParseFailure[];
  /** Total CSV body rows seen (excluding header). */
  rowsSeen: number;
}
