import type {
  BatchStats,
  BatchSummary,
  DbCounts,
  ImportBatchInfo,
  ImportResult,
  PersistableRow,
  PreviewResult,
  QueryName,
  SerializedRowWithCost,
} from '@cu/storage';
import { contextBridge, ipcRenderer } from 'electron';

type ThemeMode = 'light' | 'dark' | 'system';

interface AppInfo {
  platform: NodeJS.Platform;
  isDesktop: boolean;
  version: string;
  appName: string;
}

interface UserSettings {
  monthlyRequestBudget: number;
  currency: { code: string; symbol: string; multiplier: number };
  lastBackupAt: string | null;
}

interface ExportToFileResult {
  canceled: boolean;
  path?: string;
  bytesWritten?: number;
}

interface ImportFromFileResult {
  canceled: boolean;
  path?: string;
  batchesRestored?: number;
  rowsRestored?: number;
  error?: string;
}

// The renderer talks to the main process exclusively through this
// bridge — never via direct ipcRenderer access (sandbox is on). PR16
// will extend this with `bridge.db.*`; keep the shape additive so the
// renderer can ship a single union type that always reflects the
// latest capabilities.
const bridge = {
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    toggleMaximize: () => ipcRenderer.invoke('window:toggleMaximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized') as Promise<boolean>,
  },
  theme: {
    getSystem: () => ipcRenderer.invoke('theme:get-system') as Promise<'light' | 'dark'>,
    set: (mode: ThemeMode) => ipcRenderer.invoke('theme:set', mode),
    onSystemChanged: (cb: (mode: 'light' | 'dark') => void) => {
      const handler = (_event: unknown, mode: 'light' | 'dark') => cb(mode);
      ipcRenderer.on('theme:system-changed', handler);
      return () => ipcRenderer.removeListener('theme:system-changed', handler);
    },
  },
  app: {
    getInfo: () => ipcRenderer.invoke('app:get-info') as Promise<AppInfo>,
  },
  /**
   * User settings — a flat JSON file at
   * userData/cursor-usage-settings.json. Theme persistence lives in
   * the renderer's localStorage (handier for first-paint), so it's
   * intentionally absent from this surface.
   */
  settings: {
    get: () => ipcRenderer.invoke('settings:get') as Promise<UserSettings>,
    set: (partial: Partial<UserSettings>) =>
      ipcRenderer.invoke('settings:set', partial) as Promise<UserSettings>,
    getPath: () => ipcRenderer.invoke('settings:getPath') as Promise<string>,
  },
  /**
   * Local SQLite persistence. Main process owns the only connection;
   * renderer always goes through these handles. `importRows` accepts the
   * already-parsed + costed rows (cheaper than shipping CSV bytes both
   * ways), and the response always describes the dedup outcome so the
   * renderer can render the "+N new / Y skipped" preview banner.
   */
  db: {
    counts: () => ipcRenderer.invoke('db:counts') as Promise<DbCounts>,
    importRows: (rows: PersistableRow[], info: ImportBatchInfo) =>
      ipcRenderer.invoke('db:importRows', rows, info) as Promise<ImportResult>,
    /**
     * Dry-run version of `importRows`. Same dedup pass, but wrapped in
     * a transaction that's deliberately rolled back so the renderer can
     * pop a merge-preview drawer before committing.
     */
    previewImport: (rows: PersistableRow[], info: ImportBatchInfo) =>
      ipcRenderer.invoke('db:previewImport', rows, info) as Promise<PreviewResult>,
    /**
     * Return the entire `rows` table reshaped for the renderer's existing
     * `aggregate()` pipeline. Note: `Date` is stripped (contextBridge
     * can't carry it); rehydrate via `new Date(dateISO)` on the renderer.
     */
    allRowsCosted: () => ipcRenderer.invoke('db:allRowsCosted') as Promise<SerializedRowWithCost[]>,
    listBatches: () => ipcRenderer.invoke('db:listBatches') as Promise<BatchSummary[]>,
    undoBatch: (id: number) =>
      ipcRenderer.invoke('db:undoBatch', id) as Promise<{ removedRows: number }>,
    /**
     * Rich per-batch stats for the "compare two batches" panel. Returns
     * `null` when the batch id no longer exists (e.g. the user undid it
     * in another tab between the renderer's listBatches() and the
     * compare click).
     */
    batchStats: (id: number) =>
      ipcRenderer.invoke('db:batchStats', id) as Promise<BatchStats | null>,
    query: <T = unknown>(name: QueryName, params?: Record<string, unknown>) =>
      ipcRenderer.invoke('db:query', name, params) as Promise<T>,
    /**
     * Backup helpers — main process owns the file dialogs + reads the
     * DbSnapshot, so the renderer never touches disk. Useful for
     * cross-machine sync without going through cursor.com again.
     */
    exportToFile: () => ipcRenderer.invoke('db:exportToFile') as Promise<ExportToFileResult>,
    importFromFile: () => ipcRenderer.invoke('db:importFromFile') as Promise<ImportFromFileResult>,
    getDbPath: () => ipcRenderer.invoke('db:getDbPath') as Promise<string>,
    revealDbInFolder: () => ipcRenderer.invoke('db:revealDbInFolder') as Promise<void>,
  },
  platform: process.platform,
} as const;

contextBridge.exposeInMainWorld('bridge', bridge);

export type Bridge = typeof bridge;
