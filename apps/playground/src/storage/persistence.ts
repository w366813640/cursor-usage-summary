import type { RowWithCost } from '@cu/data';
import { clear as idbClear, get as idbGet, set as idbSet } from 'idb-keyval';

/**
 * IndexedDB session shape. We persist *just* enough to rebuild the dashboard
 * after a hard refresh:
 *
 *  - `rows` is the merged, deduped row set (already costed). Re-running
 *    `aggregate(rows)` reconstructs `summary` deterministically, so we don't
 *    serialize that derived blob.
 *  - `sourceFiles` lets us tell the user which CSVs they've already loaded.
 *  - `rowsSeen` / `failures` are kept so toolbar diagnostics survive reload.
 *  - `lastIngestedAt` powers the "last updated 3 days ago" copy on banners /
 *    toolbar.
 *
 * Stored via `idb-keyval`, which uses structured cloning — that means `Date`
 * fields on `RowWithCost` round-trip without our intervention.
 */
export interface StoredSession {
  schemaVersion: 1;
  rows: RowWithCost[];
  sourceFiles: string[];
  rowsSeen: number;
  failures: number;
  lastIngestedAt: number;
}

const STORAGE_KEY = 'cu-usage-session-v1';

/**
 * Read whatever's in IDB. Returns `null` on the first run, on schema mismatch,
 * or if the browser disabled storage. We deliberately swallow read errors so
 * a misbehaving extension can't break the upload flow.
 */
export async function loadSession(): Promise<StoredSession | null> {
  try {
    const raw = (await idbGet(STORAGE_KEY)) as StoredSession | undefined;
    if (!raw) return null;
    if (raw.schemaVersion !== 1) return null;
    if (!Array.isArray(raw.rows) || raw.rows.length === 0) return null;
    // Hydrate any rows where `date` came back as an ISO string instead of a
    // Date (some browser/idb-keyval combos serialize Dates via JSON, which
    // strips the prototype).
    for (const r of raw.rows) {
      if (!(r.date instanceof Date)) {
        r.date = new Date(r.dateISO ?? r.date);
      }
    }
    return raw;
  } catch (err) {
    console.warn('[cu] failed to load stored session', err);
    return null;
  }
}

/** Persist the current row set + bookkeeping. Best-effort — never throws. */
export async function saveSession(s: Omit<StoredSession, 'schemaVersion'>): Promise<void> {
  try {
    const payload: StoredSession = { schemaVersion: 1, ...s };
    await idbSet(STORAGE_KEY, payload);
  } catch (err) {
    console.warn('[cu] failed to persist session', err);
  }
}

/** Wipe everything — used by the "Clear local" affordance. */
export async function clearSession(): Promise<void> {
  try {
    await idbClear();
  } catch (err) {
    console.warn('[cu] failed to clear session', err);
  }
}

/**
 * Human-readable "last updated" copy. Returns null for the (impossible)
 * "in the future" case so callers can render nothing instead of "0m ago".
 */
export function describeLastUpdate(
  lastIngestedAt: number,
  now: number = Date.now(),
): string | null {
  const deltaMs = Math.max(0, now - lastIngestedAt);
  const deltaMin = Math.floor(deltaMs / 60000);
  if (deltaMin < 1) return 'just now';
  if (deltaMin === 1) return '1 minute ago';
  if (deltaMin < 60) return `${deltaMin} minutes ago`;
  const deltaHr = Math.floor(deltaMin / 60);
  if (deltaHr === 1) return '1 hour ago';
  if (deltaHr < 24) return `${deltaHr} hours ago`;
  const deltaDay = Math.floor(deltaHr / 24);
  if (deltaDay === 1) return 'yesterday';
  if (deltaDay < 30) return `${deltaDay} days ago`;
  const deltaMon = Math.floor(deltaDay / 30);
  if (deltaMon === 1) return '1 month ago';
  if (deltaMon < 12) return `${deltaMon} months ago`;
  const years = Math.floor(deltaMon / 12);
  return years === 1 ? '1 year ago' : `${years} years ago`;
}
