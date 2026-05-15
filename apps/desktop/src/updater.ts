import { type BrowserWindow, app, ipcMain } from 'electron';

/**
 * Auto-updater integration — gated behind `CU_AUTO_UPDATE=1` so dev
 * sessions never reach out to a release server.
 *
 * Wiring:
 *
 *   1. `maybeRegisterAutoUpdater(getWindow)` lazy-loads `electron-updater`
 *      (it's an optional dep at runtime — the app still boots without it)
 *      and registers event listeners that forward `checking-for-update`,
 *      `update-available`, `update-not-available`, `download-progress`,
 *      `update-downloaded`, and `error` to the renderer via the
 *      `update:status` channel. The renderer's `useUpdater` hook
 *      reflects these in a small badge.
 *
 *   2. `registerUpdateIpc()` mounts three manual triggers the renderer
 *      can invoke from the settings drawer:
 *        - `update:check`    → forces a check now
 *        - `update:install`  → quits + installs the downloaded update
 *        - `update:status`   → returns the last-known status object
 *      Each guard against the autoUpdater being absent (when
 *      CU_AUTO_UPDATE != 1).
 *
 * The `CU_UPDATE_FEED_URL` env var (set at runtime, not build time)
 * overrides whatever `publish` provider was baked into
 * `electron-builder.yml`. Useful for staging vs prod channels without
 * shipping two installers.
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

interface AutoUpdater {
  checkForUpdates: () => Promise<unknown>;
  quitAndInstall: (isSilent?: boolean, isForceRunAfter?: boolean) => void;
  on: (event: string, cb: (...args: unknown[]) => void) => void;
  setFeedURL?: (url: string | { provider: 'generic'; url: string }) => void;
  autoDownload?: boolean;
  logger?: unknown;
}

let updater: AutoUpdater | null = null;
let lastStatus: UpdateStatus = { kind: 'idle' };
let getMainWindow: (() => BrowserWindow | null) | null = null;

function broadcast(status: UpdateStatus): void {
  lastStatus = status;
  const win = getMainWindow?.();
  if (!win || win.isDestroyed()) return;
  try {
    win.webContents.send('update:status', status);
  } catch {
    /* renderer might be tearing down; safe to drop */
  }
}

function disabledReason(): string | null {
  if (!app.isPackaged) return 'dev mode';
  if (process.env.CU_AUTO_UPDATE !== '1') return 'CU_AUTO_UPDATE not set';
  return null;
}

export async function maybeRegisterAutoUpdater(
  getWindow: () => BrowserWindow | null,
): Promise<void> {
  getMainWindow = getWindow;

  const reason = disabledReason();
  if (reason) {
    lastStatus = { kind: 'disabled', reason };
    return;
  }

  try {
    const mod = await import('electron-updater');
    const candidate = (mod as { autoUpdater?: AutoUpdater }).autoUpdater;
    if (!candidate) {
      lastStatus = { kind: 'disabled', reason: 'electron-updater missing' };
      return;
    }
    updater = candidate;

    if (process.env.CU_UPDATE_FEED_URL && updater.setFeedURL) {
      updater.setFeedURL({ provider: 'generic', url: process.env.CU_UPDATE_FEED_URL });
    }

    updater.on('checking-for-update', () => broadcast({ kind: 'checking' }));

    updater.on('update-available', (info: unknown) => {
      const i = info as { version?: string; releaseDate?: string } | undefined;
      broadcast({
        kind: 'available',
        version: i?.version ?? 'unknown',
        releaseDate: i?.releaseDate,
      });
    });

    updater.on('update-not-available', (info: unknown) => {
      const i = info as { version?: string } | undefined;
      broadcast({ kind: 'not-available', version: i?.version ?? app.getVersion() });
    });

    updater.on('download-progress', (progress: unknown) => {
      const p = progress as { percent?: number; transferred?: number; total?: number } | undefined;
      broadcast({
        kind: 'downloading',
        percent: p?.percent ?? 0,
        transferred: p?.transferred ?? 0,
        total: p?.total ?? 0,
      });
    });

    updater.on('update-downloaded', (info: unknown) => {
      const i = info as { version?: string; releaseNotes?: string } | undefined;
      broadcast({
        kind: 'downloaded',
        version: i?.version ?? 'unknown',
        releaseNotes: i?.releaseNotes,
      });
    });

    updater.on('error', (err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      broadcast({ kind: 'error', message });
    });

    void updater.checkForUpdates().catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      broadcast({ kind: 'error', message });
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    lastStatus = { kind: 'disabled', reason: `import failed: ${message}` };
    console.warn('[updater] electron-updater not available:', err);
  }
}

export function registerUpdateIpc(): void {
  ipcMain.handle('update:status', () => lastStatus);

  ipcMain.handle('update:check', async () => {
    if (!updater) {
      return {
        ok: false,
        reason: lastStatus.kind === 'disabled' ? lastStatus.reason : 'not-ready',
      };
    }
    try {
      await updater.checkForUpdates();
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      broadcast({ kind: 'error', message });
      return { ok: false, reason: message };
    }
  });

  ipcMain.handle('update:install', () => {
    if (!updater) return { ok: false, reason: 'not-ready' };
    if (lastStatus.kind !== 'downloaded') {
      return { ok: false, reason: `nothing-downloaded (${lastStatus.kind})` };
    }
    try {
      updater.quitAndInstall(false, true);
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, reason: message };
    }
  });
}
