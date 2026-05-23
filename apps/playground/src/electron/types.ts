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

/**
 * Mirror of `BatchStats` in @cu/storage — drives the compare-batches modal.
 * Keep in sync with `packages/storage/src/types.ts`.
 */
export interface BatchStats {
  batch: BatchSummary;
  totals: {
    rowCount: number;
    totalCost: number;
    totalRequests: number;
    totalTokens: number;
    cacheReadTokens: number;
    inputTokens: number;
    outputTokens: number;
    maxModeRows: number;
    cacheHitRatio: number;
    estimatedRows: number;
  };
  topModels: Array<{ model: string; cost: number; rows: number; share: number }>;
  byDay: Array<{ date: string; cost: number; rows: number }>;
  topAgents: Array<{
    id: string;
    kind: 'cloud-agent' | 'automation';
    cost: number;
    rows: number;
  }>;
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

export interface CurrencyPreference {
  code: string;
  symbol: string;
  /** Multiplier vs. underlying USD. 1 = no conversion. */
  multiplier: number;
}

export interface UserSettings {
  monthlyRequestBudget: number;
  currency: CurrencyPreference;
  lastBackupAt: string | null;
  displayDensity: 'comfortable' | 'dense' | 'presentation';
}

export interface ExportToFileResult {
  canceled: boolean;
  path?: string;
  bytesWritten?: number;
}

export interface ImportFromFileResult {
  canceled: boolean;
  path?: string;
  batchesRestored?: number;
  rowsRestored?: number;
  error?: string;
}

/**
 * Snapshot of the current month the renderer pushes to the main
 * process. Main uses it to update the tray label and to decide whether
 * to fire a budget-cross toast.
 */
export interface BudgetReportPayload {
  /** YYYY-MM. */
  monthKey: string;
  /** Human-friendly month label, e.g. "May 2026". */
  monthLabel: string;
  /** Cumulative $ spent in the current month. */
  spendUSD: number;
  /** Cumulative request units consumed this month. */
  requestUnits: number;
  /** Budget cap in request units. 0 disables notifications. */
  budgetRequests: number;
  /** Linear end-of-month projection in request units, or null. */
  projectedRequests: number | null;
}

export interface BudgetReportResult {
  ok: boolean;
  /** True when the report actually triggered a fresh toast. */
  fired?: boolean;
  /** 0.8 / 1.0 when fired — the threshold that was crossed. */
  threshold?: number;
  reason?: string;
}

/**
 * Mirror of `UpdateStatus` in `apps/desktop/src/updater.ts`.
 * Renderer's `useUpdater` hook renders a small badge based on this.
 */
export type UpdateStatus =
  | { kind: 'idle' }
  | { kind: 'disabled'; reason: string }
  | { kind: 'checking' }
  | { kind: 'available'; version: string; releaseDate?: string }
  | { kind: 'not-available'; version: string }
  | { kind: 'downloading'; percent: number; transferred: number; total: number }
  | { kind: 'downloaded'; version: string; releaseNotes?: string }
  | { kind: 'error'; message: string };

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
  settings: {
    get: () => Promise<UserSettings>;
    set: (partial: Partial<UserSettings>) => Promise<UserSettings>;
    getPath: () => Promise<string>;
  };
  db: {
    counts: () => Promise<DbCounts>;
    importRows: (rows: RowWithCost[], info: ImportBatchInfo) => Promise<ImportResult>;
    previewImport: (rows: RowWithCost[], info: ImportBatchInfo) => Promise<PreviewResult>;
    allRowsCosted: () => Promise<SerializedRowWithCost[]>;
    listBatches: () => Promise<BatchSummary[]>;
    undoBatch: (id: number) => Promise<{ removedRows: number }>;
    batchStats: (id: number) => Promise<BatchStats | null>;
    query: <T = unknown>(name: QueryName, params?: Record<string, unknown>) => Promise<T>;
    exportToFile: () => Promise<ExportToFileResult>;
    importFromFile: () => Promise<ImportFromFileResult>;
    getDbPath: () => Promise<string>;
    revealDbInFolder: () => Promise<void>;
  };
  budget: {
    report: (payload: BudgetReportPayload) => Promise<BudgetReportResult>;
    resetGuard: () => Promise<{ ok: boolean }>;
    getGuardState: () => Promise<{
      thresholdsHit: Record<string, number[]>;
      settings: UserSettings;
      appVersion: string;
    }>;
  };
  update: {
    status: () => Promise<UpdateStatus>;
    check: () => Promise<{ ok: boolean; reason?: string }>;
    install: () => Promise<{ ok: boolean; reason?: string }>;
    onStatus: (cb: (status: UpdateStatus) => void) => () => void;
  };
  platform: string;
}
