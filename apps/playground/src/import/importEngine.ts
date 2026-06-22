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

/**
 * Parse raw CSV text and attach per-row cost in one shot.
 *
 * This is the renderer's only consumer of the heavy import pipeline —
 * `parseUsageCsv` drags in papaparse and `costRows` pulls the full
 * pricing table + model matcher. None of it is needed to paint the
 * upload hero or hydrate an existing DB (the dashboard aggregate runs
 * main-side), so this module is loaded behind a dynamic import
 * (`useDesktopIngest.startImport`) and only fetched once the user
 * actually picks a file. Keeping it as a dedicated module gives Rollup a
 * single clean async-chunk boundary and a trivial prefetch target.
 */
export function parseAndCost(text: string): ParseAndCostResult {
  const { rows, failures, rowsSeen } = parseUsageCsv(text);
  return { rows: costRows(rows), failures: failures.length, rowsSeen };
}
