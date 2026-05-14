import Papa from 'papaparse';
import type {
  EventKind,
  ParseFailure,
  ParseResult,
  RequestsValue,
  TokenCounts,
  UsageRow,
} from './types';

/** Verbatim CSV column headers, in source order. */
export const CSV_HEADERS = [
  'Date',
  'Cloud Agent ID',
  'Automation ID',
  'Kind',
  'Model',
  'Max Mode',
  'Input (w/ Cache Write)',
  'Input (w/o Cache Write)',
  'Cache Read',
  'Output Tokens',
  'Total Tokens',
  'Requests',
] as const;

const KNOWN_KINDS: ReadonlySet<string> = new Set<EventKind>([
  'Included',
  'Errored, No Charge',
  'Aborted, Not Charged',
  'Free',
]);

/**
 * Coerce a CSV cell into a non-negative finite number.
 * Empty strings and whitespace-only cells become `0`. Any non-numeric
 * value (e.g. `"-"`) returns `null` so the caller can decide what to do.
 */
function parseTokenCell(raw: string | undefined): number | null {
  if (raw === undefined) return 0;
  const trimmed = raw.trim();
  if (trimmed === '') return 0;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

/**
 * Parse the polymorphic Requests cell. See {@link RequestsValue}.
 * Rules (derived from `input/usage-events-*.csv` reconnaissance):
 *  - `"-"` → `{ kind: 'errored' }`
 *  - `"Free"` (case-insensitive) → `{ kind: 'free' }`
 *  - finite non-negative number string → `{ kind: 'units', value }`
 *  - anything else → `null` (caller should reject the row)
 */
function parseRequestsCell(raw: string | undefined): RequestsValue | null {
  if (raw === undefined) return null;
  const trimmed = raw.trim();
  if (trimmed === '' || trimmed === '-') return { kind: 'errored' };
  if (trimmed.toLowerCase() === 'free') return { kind: 'free' };
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return null;
  return { kind: 'units', value: n };
}

function parseKind(raw: string | undefined): EventKind | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (KNOWN_KINDS.has(trimmed)) return trimmed as EventKind;
  return null;
}

function parseDate(raw: string | undefined): Date | null {
  if (!raw) return null;
  const d = new Date(raw.trim());
  return Number.isNaN(d.getTime()) ? null : d;
}

interface RawRow {
  Date?: string;
  'Cloud Agent ID'?: string;
  'Automation ID'?: string;
  Kind?: string;
  Model?: string;
  'Max Mode'?: string;
  'Input (w/ Cache Write)'?: string;
  'Input (w/o Cache Write)'?: string;
  'Cache Read'?: string;
  'Output Tokens'?: string;
  'Total Tokens'?: string;
  Requests?: string;
}

function rowToFailure(rowNumber: number, raw: RawRow, reason: string): ParseFailure {
  return { rowNumber, raw: raw as Record<string, string | undefined>, reason };
}

function parseSingleRow(
  raw: RawRow,
  rowNumber: number,
): { row: UsageRow } | { failure: ParseFailure } {
  const date = parseDate(raw.Date);
  if (!date) return { failure: rowToFailure(rowNumber, raw, 'invalid Date') };

  const kind = parseKind(raw.Kind);
  if (!kind) return { failure: rowToFailure(rowNumber, raw, `unknown Kind: ${raw.Kind ?? ''}`) };

  const model = (raw.Model ?? '').trim();
  if (!model) return { failure: rowToFailure(rowNumber, raw, 'missing Model') };

  const maxModeRaw = (raw['Max Mode'] ?? '').trim();
  const maxMode = maxModeRaw === 'Yes' ? true : maxModeRaw === 'No' ? false : null;
  if (maxMode === null) {
    return { failure: rowToFailure(rowNumber, raw, `unknown Max Mode: ${maxModeRaw}`) };
  }

  const inputWithCacheWrite = parseTokenCell(raw['Input (w/ Cache Write)']);
  const inputWithoutCacheWrite = parseTokenCell(raw['Input (w/o Cache Write)']);
  const cacheRead = parseTokenCell(raw['Cache Read']);
  const output = parseTokenCell(raw['Output Tokens']);
  const total = parseTokenCell(raw['Total Tokens']);

  if (
    inputWithCacheWrite === null ||
    inputWithoutCacheWrite === null ||
    cacheRead === null ||
    output === null ||
    total === null
  ) {
    return { failure: rowToFailure(rowNumber, raw, 'invalid token cell') };
  }

  const requests = parseRequestsCell(raw.Requests);
  if (!requests) {
    return { failure: rowToFailure(rowNumber, raw, `invalid Requests: ${raw.Requests ?? ''}`) };
  }

  const tokens: TokenCounts = {
    inputWithCacheWrite,
    inputWithoutCacheWrite,
    cacheRead,
    output,
    total,
  };

  const id = `${date.toISOString()}::${model}::${rowNumber}`;
  return {
    row: {
      id,
      dateISO: date.toISOString(),
      date,
      cloudAgentId: (raw['Cloud Agent ID'] ?? '').trim(),
      automationId: (raw['Automation ID'] ?? '').trim(),
      kind,
      model,
      maxMode,
      tokens,
      requests,
    },
  };
}

/**
 * Parse a Cursor `usage-events-*.csv` string (tolerant of `\r\n` and `\n`).
 *
 * Strict guarantees:
 *  - Returns even if rows fail; bad rows are surfaced via `failures` so the
 *    UI can flag them (and so the user knows their export is suspicious).
 *  - Never throws on malformed rows. Throws only if the header is missing
 *    or fundamentally wrong (see `requireExpectedHeader`).
 */
export function parseUsageCsv(
  csvText: string,
  options: { requireExpectedHeader?: boolean } = {},
): ParseResult {
  const requireHeader = options.requireExpectedHeader ?? true;

  const parsed = Papa.parse<RawRow>(csvText, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim(),
  });

  if (requireHeader) {
    const fields = parsed.meta.fields ?? [];
    const missing = CSV_HEADERS.filter((h) => !fields.includes(h));
    if (missing.length > 0) {
      throw new Error(
        `cursor-usage CSV is missing expected columns: ${missing.join(
          ', ',
        )}. Make sure you exported from cursor.com/dashboard/usage.`,
      );
    }
  }

  const rows: UsageRow[] = [];
  const failures: ParseFailure[] = [];
  parsed.data.forEach((raw, idx) => {
    const result = parseSingleRow(raw, idx + 1);
    if ('row' in result) rows.push(result.row);
    else failures.push(result.failure);
  });

  return { rows, failures, rowsSeen: parsed.data.length };
}
