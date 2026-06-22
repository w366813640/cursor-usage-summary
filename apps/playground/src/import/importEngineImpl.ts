import { type RowWithCost, parseUsageCsv } from '@cu/data';
import { costRows } from '@cu/pricing';

export interface ParseAndCostResult {
  /** Parsed rows with per-row USD cost attached. */
  rows: RowWithCost[];
  /** How many CSV rows failed to parse (malformed / rejected). */
  failures: number;
  /** Total data rows seen in the file (excludes the header). */
  rowsSeen: number;
}

/** Worker request: raw CSV text plus a correlation id. */
export interface ParseWorkerRequest {
  id: number;
  text: string;
}

/** Worker reply, correlated back to its request by `id`. */
export type ParseWorkerResponse =
  | { id: number; ok: true; result: ParseAndCostResult }
  | { id: number; ok: false; error: string };

/**
 * Parse raw CSV text and attach per-row cost in one pass.
 *
 * This is the renderer's only consumer of the heavy import pipeline:
 * `parseUsageCsv` drags in papaparse and `costRows` pulls the full
 * pricing table + model matcher. It runs in two places — the parse
 * worker (the hot path, off the main thread) and, if the worker can't
 * spawn, a main-thread fallback. Either way it's reached only through a
 * dynamic boundary, so papaparse + pricing never touch the first-paint
 * graph.
 */
export function parseAndCost(text: string): ParseAndCostResult {
  const { rows, failures, rowsSeen } = parseUsageCsv(text);
  return { rows: costRows(rows), failures: failures.length, rowsSeen };
}
