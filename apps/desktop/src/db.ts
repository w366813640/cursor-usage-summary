import path from 'node:path';
import type { UsageDb as UsageDbType } from '@cu/storage';
import { app, ipcMain } from 'electron';

/**
 * Main-process database bootstrap + IPC surface.
 *
 * Lifecycle:
 *
 *   1. `getDb()` lazy-instantiates a single UsageDb on the first call,
 *      pointing at `userData/cursor-usage.db`. The renderer never sees
 *      the path or holds a handle.
 *   2. `registerDbIpc()` mounts five IPC handles (`db:*`) on the same
 *      ipcMain that main.ts already uses. Renderer talks to it through
 *      the preload bridge — never via `ipcRenderer` directly.
 *   3. `closeDb()` runs on `before-quit` so WAL pages flush cleanly.
 */

let dbInstance: UsageDbType | null = null;

export function getDb(): UsageDbType {
  if (dbInstance) return dbInstance;
  // Lazy-load @cu/storage so the module's better-sqlite3 require doesn't
  // fire on every cold start (e.g. when the renderer never asks for it).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { UsageDb } = require('@cu/storage') as typeof import('@cu/storage');
  const dbPath = path.join(app.getPath('userData'), 'cursor-usage.db');
  const inst = new UsageDb(dbPath);
  inst.init();
  dbInstance = inst;
  return inst;
}

export function closeDb(): void {
  if (!dbInstance) return;
  try {
    dbInstance.close();
  } catch {
    /* best effort on shutdown */
  }
  dbInstance = null;
}

/**
 * IPC contract — kept narrow on purpose. Renderer never sends raw SQL;
 * it picks from a fixed `QueryName` union, plus three high-level
 * mutators (`importRows` / `undoBatch`, and `listBatches` for reads).
 */
export function registerDbIpc(): void {
  ipcMain.handle('db:counts', () => getDb().counts());

  ipcMain.handle(
    'db:importRows',
    (
      _event,
      rows: import('@cu/storage').PersistableRow[],
      info: import('@cu/storage').ImportBatchInfo,
    ) => getDb().importRows(rows, info),
  );

  ipcMain.handle(
    'db:previewImport',
    (
      _event,
      rows: import('@cu/storage').PersistableRow[],
      info: import('@cu/storage').ImportBatchInfo,
    ) => getDb().previewImport(rows, info),
  );

  ipcMain.handle('db:allRowsCosted', () => getDb().allRowsCosted());

  ipcMain.handle('db:listBatches', () => getDb().listBatches());

  ipcMain.handle('db:undoBatch', (_event, id: number) => getDb().undoBatch(id));

  ipcMain.handle(
    'db:query',
    (_event, name: import('@cu/storage').QueryName, params?: Record<string, unknown>) =>
      getDb().query(name, params),
  );
}
