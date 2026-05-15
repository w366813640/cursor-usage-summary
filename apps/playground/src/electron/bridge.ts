import type { DesktopBridge } from './types';

/**
 * Read-only accessor for the Electron preload bridge.
 *
 * Returns `null` whenever we're running in plain web mode — the
 * renderer's storage and ingest layers branch on this to either talk
 * to better-sqlite3 via IPC (Electron) or fall back to IndexedDB
 * (browser).
 *
 * The bridge is set up synchronously by `apps/desktop/src/preload.ts`
 * before any module code runs, so the result of `getBridge()` is
 * stable across the page's lifetime.
 */
export function getBridge(): DesktopBridge | null {
  if (typeof window === 'undefined') return null;
  const candidate = (window as unknown as { bridge?: DesktopBridge }).bridge;
  if (!candidate || typeof candidate !== 'object') return null;
  if (!candidate.db || typeof candidate.db.counts !== 'function') return null;
  return candidate;
}

/** Convenience predicate so callsites stay readable. */
export function isDesktop(): boolean {
  return getBridge() !== null;
}
