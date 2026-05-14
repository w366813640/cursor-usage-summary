import Papa from 'papaparse';
import { CSV_HEADERS } from './csvParser';
import type { UsageRow } from './types';

/**
 * Lightweight non-cryptographic alias for any GUID-like opaque id. Two
 * properties matter:
 *
 *   - Same input always maps to same alias (stable across the export).
 *   - Different inputs map to different aliases with high probability.
 *
 * Not collision-proof — but acceptable for "I want to share a screenshot
 * without leaking my workspace's internal ids". If the input is empty, the
 * output is empty too — we don't want to invent aliases for absent fields.
 */
export function shortAlias(value: string, prefix: string): string {
  if (!value) return '';
  // djb2 — well-known small hash that's adequate for ~6-char aliases.
  let h = 5381;
  for (let i = 0; i < value.length; i++) {
    h = ((h << 5) + h) ^ value.charCodeAt(i);
  }
  // Keep absolute value to dodge sign, base36 to keep it dense.
  const tail = Math.abs(h).toString(36).padStart(6, '0').slice(0, 6);
  return `${prefix}-${tail}`;
}

/**
 * Serialize `UsageRow`s back into a CSV string that matches the *exact*
 * Cursor export header order. Sensitive identifiers (Cloud Agent ID,
 * Automation ID) are replaced with deterministic short aliases so the file
 * is safe to share with the community / paste into a bug report.
 *
 * Token counts, costs, dates, and model names are preserved verbatim —
 * those are what makes the data analytically interesting.
 */
export function redactRowsToCsv(rows: ReadonlyArray<UsageRow>): string {
  const data = rows.map((r) => ({
    Date: r.dateISO,
    'Cloud Agent ID': r.cloudAgentId ? shortAlias(r.cloudAgentId, 'agent') : '',
    'Automation ID': r.automationId ? shortAlias(r.automationId, 'auto') : '',
    Kind: r.kind,
    Model: r.model,
    'Max Mode': r.maxMode ? 'Yes' : 'No',
    'Input (w/ Cache Write)':
      r.tokens.inputWithCacheWrite > 0 ? String(r.tokens.inputWithCacheWrite) : '',
    'Input (w/o Cache Write)':
      r.tokens.inputWithoutCacheWrite > 0 ? String(r.tokens.inputWithoutCacheWrite) : '',
    'Cache Read': r.tokens.cacheRead > 0 ? String(r.tokens.cacheRead) : '',
    'Output Tokens': r.tokens.output > 0 ? String(r.tokens.output) : '',
    'Total Tokens': r.tokens.total > 0 ? String(r.tokens.total) : '',
    Requests:
      r.requests.kind === 'units'
        ? String(r.requests.value)
        : r.requests.kind === 'free'
          ? 'Free'
          : '-',
  }));

  return Papa.unparse(data, {
    columns: CSV_HEADERS as unknown as string[],
    newline: '\r\n',
  });
}

/**
 * Build a redacted file name that signals to humans (and future-you) that
 * this is the safe-to-share variant. Adds `-redacted` before the `.csv`.
 */
export function redactedFileName(original: string): string {
  if (!original) return 'usage-events-redacted.csv';
  if (original.endsWith('.csv')) {
    return `${original.slice(0, -'.csv'.length)}-redacted.csv`;
  }
  return `${original}-redacted.csv`;
}
