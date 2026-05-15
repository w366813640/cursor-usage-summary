/**
 * Renderer-local mirrors of the @cu/storage IPC contract.
 *
 * We deliberately *don't* import @cu/storage from the renderer — that
 * package's runtime entry pulls in `better-sqlite3` (native module),
 * which Vite cannot bundle for a browser-style context. Instead, we
 * keep a small typed shadow here and let the preload bridge guarantee
 * the wire format matches.
 *
 * Keep this file in lockstep with `packages/storage/src/types.ts`.
 */

import type { RowWithCost } from '@cu/data';

export interface ImportBatchInfo {
  filename: string;
  fileSha256: string;
}

export interface ImportResult {
  batchId: number;
  added: number;
  skipped: number;
  dateMin: string | null;
  dateMax: string | null;
  isDuplicateFile: boolean;
  existingBatchId?: number;
}

export interface PreviewResult {
  wouldAdd: number;
  wouldSkip: number;
  dateMin: string | null;
  dateMax: string | null;
  isDuplicateFile: boolean;
  existingBatchId?: number;
}

export interface BatchSummary {
  id: number;
  sourceFilename: string;
  importedAt: number;
  rowCountAdded: number;
  rowCountSkipped: number;
  dateMin: string | null;
  dateMax: string | null;
  fileSha256: string;
}

export interface DbCounts {
  rowCount: number;
  batchCount: number;
  firstDay: string | null;
  lastDay: string | null;
  totalCost: number;
}

/** Mirror of `SerializedRowWithCost` from @cu/storage — no `Date` field. */
export type SerializedRowWithCost = Omit<RowWithCost, 'date'>;

export type QueryName =
  | 'counts'
  | 'byDay'
  | 'byMonth'
  | 'byModel'
  | 'byHourWeekday'
  | 'topBurns'
  | 'allRowsCosted';

/**
 * Shape of `window.bridge` exposed by `apps/desktop/src/preload.ts`.
 * The renderer treats this as advisory: a missing or partial bridge
 * just means we're running in pure web mode.
 */
export interface DesktopBridge {
  window: {
    minimize: () => Promise<void>;
    toggleMaximize: () => Promise<void>;
    close: () => Promise<void>;
    isMaximized: () => Promise<boolean>;
  };
  theme: {
    getSystem: () => Promise<'light' | 'dark'>;
    set: (mode: 'light' | 'dark' | 'system') => Promise<void>;
    onSystemChanged: (cb: (mode: 'light' | 'dark') => void) => () => void;
  };
  app: {
    getInfo: () => Promise<{
      platform: string;
      isDesktop: boolean;
      version: string;
      appName: string;
    }>;
  };
  db: {
    counts: () => Promise<DbCounts>;
    importRows: (rows: RowWithCost[], info: ImportBatchInfo) => Promise<ImportResult>;
    previewImport: (rows: RowWithCost[], info: ImportBatchInfo) => Promise<PreviewResult>;
    allRowsCosted: () => Promise<SerializedRowWithCost[]>;
    listBatches: () => Promise<BatchSummary[]>;
    undoBatch: (id: number) => Promise<{ removedRows: number }>;
    query: <T = unknown>(name: QueryName, params?: Record<string, unknown>) => Promise<T>;
  };
  platform: string;
}
