import type { RowWithCost } from '@cu/data';
import { getBridge } from './bridge';
import type {
  BatchSummary,
  DbCounts,
  ImportBatchInfo,
  ImportResult,
  PreviewResult,
  SerializedRowWithCost,
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
