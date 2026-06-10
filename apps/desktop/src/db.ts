import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { UsageDb as UsageDbType } from '@cu/storage';
import { app, dialog, ipcMain, shell } from 'electron';

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

  // Rows + aggregate in one round-trip (perf plan 3.1). Aggregating here
  // keeps the O(rows) summarization off the renderer's UI thread — at
  // 100k rows that's the difference between a blocked first paint and a
  // background hiccup. `topBurns` ships date-less like every other row
  // over this bridge; the renderer rehydrates from `dateISO`.
  ipcMain.handle('db:summaryCosted', () => {
    // Lazy-require like @cu/storage above so cold start stays lean.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { aggregate } = require('@cu/data') as typeof import('@cu/data');
    const serialized = getDb().allRowsCosted();
    const rows = serialized.map((r) => ({
      ...r,
      date: new Date(r.dateISO),
    })) as import('@cu/data').RowWithCost[];
    const summary = aggregate(rows, { topBurnsCount: 10 });
    return {
      rows: serialized,
      summary: {
        ...summary,
        topBurns: summary.topBurns.map(({ date: _date, ...rest }) => rest),
      },
    };
  });

  ipcMain.handle('db:listBatches', () => getDb().listBatches());

  ipcMain.handle('db:undoBatch', (_event, id: number) => getDb().undoBatch(id));

  ipcMain.handle('db:batchStats', (_event, id: number) => getDb().batchStats(id));

  ipcMain.handle(
    'db:query',
    (_event, name: import('@cu/storage').QueryName, params?: Record<string, unknown>) =>
      getDb().query(name, params),
  );

  // Backup flow — opens a native save dialog so the user picks where
  // the .json lands. Returning `{ canceled: true }` lets the renderer
  // distinguish "user cancelled" from "no batches to export"; both are
  // legitimate non-error outcomes.
  ipcMain.handle(
    'db:exportToFile',
    async (_event): Promise<{ canceled: boolean; path?: string; bytesWritten?: number }> => {
      const result = await dialog.showSaveDialog({
        title: 'Export Cursor Usage backup',
        defaultPath: `cursor-usage-backup-${new Date().toISOString().slice(0, 10)}.json`,
        filters: [{ name: 'JSON backup', extensions: ['json'] }],
      });
      if (result.canceled || !result.filePath) return { canceled: true };

      const snapshot = getDb().exportSnapshot();
      const payload = JSON.stringify(snapshot, null, 2);
      writeFileSync(result.filePath, payload, 'utf-8');
      return {
        canceled: false,
        path: result.filePath,
        bytesWritten: Buffer.byteLength(payload, 'utf-8'),
      };
    },
  );

  // Restore flow — same shape, but `replaced` reports how much landed
  // so the renderer can pop a toast like "Restored 4 batches · 2,341
  // rows". A two-step confirm sits *above* this in the UI; by the time
  // we get here the user has agreed to overwrite their DB.
  ipcMain.handle(
    'db:importFromFile',
    async (
      _event,
    ): Promise<{
      canceled: boolean;
      path?: string;
      batchesRestored?: number;
      rowsRestored?: number;
      error?: string;
    }> => {
      const result = await dialog.showOpenDialog({
        title: 'Restore Cursor Usage backup',
        filters: [{ name: 'JSON backup', extensions: ['json'] }],
        properties: ['openFile'],
      });
      const filePath = result.filePaths[0];
      if (result.canceled || !filePath) return { canceled: true };

      try {
        const raw = readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(raw) as import('@cu/storage').DbSnapshot;
        const outcome = getDb().importSnapshot(parsed);
        return {
          canceled: false,
          path: filePath,
          batchesRestored: outcome.batchesRestored,
          rowsRestored: outcome.rowsRestored,
        };
      } catch (err) {
        return {
          canceled: false,
          path: filePath,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  );

  ipcMain.handle('db:revealDbInFolder', () => {
    const dbPath = path.join(app.getPath('userData'), 'cursor-usage.db');
    shell.showItemInFolder(dbPath);
  });

  ipcMain.handle('db:getDbPath', () => path.join(app.getPath('userData'), 'cursor-usage.db'));
}
