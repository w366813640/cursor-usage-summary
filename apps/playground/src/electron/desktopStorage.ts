import type { RowWithCost, UsageSummary } from '@cu/data';
import { getBridge } from './bridge';
import type {
  BatchStats,
  BatchSummary,
  BudgetReportPayload,
  BudgetReportResult,
  DbCounts,
  DiagnosticsExportResult,
  ExportToFileResult,
  ImportBatchInfo,
  ImportFromFileResult,
  ImportResult,
  PreviewResult,
  SerializedRowWithCost,
  UpdateStatus,
  UserSettings,
} from './types';

/**
 * Thin wrapper around `window.bridge.db.*` that handles the bits the
 * renderer always needs (Date rehydration, SHA-256 hashing, error
 * normalization), so individual pages don't repeat that plumbing.
 *
 * Everything in here throws synchronously if called in pure web mode —
 * callers are expected to gate behind `isDesktop()` from `./bridge`.
 */

function bridge() {
  const b = getBridge();
  if (!b) throw new Error('desktopStorage called outside of the Electron renderer');
  return b;
}

/**
 * Rehydrate a `Date` field that contextBridge stripped during IPC.
 * The renderer's downstream code (aggregate, charts) expects
 * `RowWithCost.date` to be a `Date` instance, so we restore it here
 * from the canonical `dateISO` string.
 */
export function hydrateRows(rows: SerializedRowWithCost[]): RowWithCost[] {
  return rows.map((r) => ({
    ...r,
    date: new Date(r.dateISO),
  })) as RowWithCost[];
}

export async function getCounts(): Promise<DbCounts> {
  return bridge().db.counts();
}

export async function loadAllRows(): Promise<RowWithCost[]> {
  const serialized = await bridge().db.allRowsCosted();
  return hydrateRows(serialized);
}

export interface SummaryCostedPayload {
  rows: RowWithCost[];
  summary: UsageSummary;
}

/**
 * Full hydrate in one IPC round-trip: every costed row plus the
 * `aggregate()` summary computed in the *main* process (perf plan 3.1),
 * so the renderer thread never blocks on the O(rows) summarization.
 * Falls back to renderer-side aggregation when the running main process
 * predates `db:summaryCosted` (dev-time version skew) — that path
 * dynamically imports `aggregate` so the aggregator (only otherwise
 * reached from the lazy Day route) stays off the first-paint chunk.
 */
export async function loadSummaryCosted(): Promise<SummaryCostedPayload> {
  const db = bridge().db;
  if (typeof db.summaryCosted !== 'function') {
    const [{ aggregate }, rows] = await Promise.all([import('@cu/data'), loadAllRows()]);
    return { rows, summary: aggregate(rows, { topBurnsCount: 10 }) };
  }
  const payload = await db.summaryCosted();
  return {
    rows: hydrateRows(payload.rows),
    summary: { ...payload.summary, topBurns: hydrateRows(payload.summary.topBurns) },
  };
}

export async function previewImport(
  rows: ReadonlyArray<RowWithCost>,
  info: ImportBatchInfo,
): Promise<PreviewResult> {
  return bridge().db.previewImport([...rows], info);
}

export async function commitImport(
  rows: ReadonlyArray<RowWithCost>,
  info: ImportBatchInfo,
): Promise<ImportResult> {
  return bridge().db.importRows([...rows], info);
}

export async function listBatches(): Promise<BatchSummary[]> {
  return bridge().db.listBatches();
}

export async function undoBatch(id: number): Promise<{ removedRows: number }> {
  return bridge().db.undoBatch(id);
}

export async function loadBatchStats(id: number): Promise<BatchStats | null> {
  return bridge().db.batchStats(id);
}

/**
 * Hex SHA-256 of the given file bytes. Cheap (≤16 MB CSV → ~50 ms)
 * and runs entirely in the renderer process via Web Crypto, so the
 * main process never sees the raw bytes.
 */
export async function sha256File(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function getSettings(): Promise<UserSettings> {
  return bridge().settings.get();
}

export async function exportDiagnosticsToFile(): Promise<DiagnosticsExportResult> {
  return bridge().app.exportDiagnostics();
}

export async function updateSettings(partial: Partial<UserSettings>): Promise<UserSettings> {
  return bridge().settings.set(partial);
}

export async function getSettingsPath(): Promise<string> {
  return bridge().settings.getPath();
}

export async function exportDbToFile(): Promise<ExportToFileResult> {
  return bridge().db.exportToFile();
}

export async function importDbFromFile(): Promise<ImportFromFileResult> {
  return bridge().db.importFromFile();
}

export async function getDbPath(): Promise<string> {
  return bridge().db.getDbPath();
}

export async function revealDbInFolder(): Promise<void> {
  return bridge().db.revealDbInFolder();
}

/**
 * Push the current month's budget snapshot to the main process so the
 * tray label refreshes and a toast can fire if the user just crossed
 * the 80 % or 100 % threshold. `bridge.budget` is always present in
 * Electron mode — main no-ops when `budgetRequests <= 0`.
 */
export async function reportBudget(payload: BudgetReportPayload): Promise<BudgetReportResult> {
  return bridge().budget.report(payload);
}

export async function resetBudgetGuardState(): Promise<{ ok: boolean }> {
  return bridge().budget.resetGuard();
}

export async function getUpdateStatus(): Promise<UpdateStatus> {
  return bridge().update.status();
}

export async function checkForUpdates(): Promise<{ ok: boolean; reason?: string }> {
  return bridge().update.check();
}

export async function installUpdateAndRestart(): Promise<{ ok: boolean; reason?: string }> {
  return bridge().update.install();
}

export function onUpdateStatus(cb: (status: UpdateStatus) => void): () => void {
  return bridge().update.onStatus(cb);
}
