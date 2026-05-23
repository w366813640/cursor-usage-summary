import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { BrowserWindow, app, dialog, ipcMain, nativeTheme, shell } from 'electron';
import { closeDb, getDb, registerDbIpc } from './db';
import { registerBudgetIpc, resetBudgetGuard } from './notifications';
import { getSettingsPath, readSettings, writeSettings } from './settingsStore';
import { type SplashHandle, showSplash } from './splash';
import { destroyTray, ensureTray } from './tray';
import { getLastUpdateStatus, maybeRegisterAutoUpdater, registerUpdateIpc } from './updater';

const isDev = !app.isPackaged;
const RENDERER_DEV_URL = process.env.RENDERER_DEV_URL ?? 'http://localhost:5173';

const baseDir = __dirname;

let mainWindow: BrowserWindow | null = null;
let splash: SplashHandle | null = null;

interface DiagnosticsExportResult {
  canceled: boolean;
  path?: string;
  bytesWritten?: number;
}

// Tokens consumed by both the BrowserWindow constructor and the
// `setTitleBarOverlay` calls that fire on theme changes. Keeping them in
// one map prevents the right-edge "dark seam" the user reported: the
// overlay used to only refresh on system theme changes, so toggling the
// in-app theme (light → dark while OS stays light) left the title-bar
// strip on the old color and produced a jarring vertical mismatch
// against the body background.
const TITLEBAR_COLORS = {
  light: { bg: '#F7F3EA', symbol: '#2B2926' },
  dark: { bg: '#1F1E1B', symbol: '#F1ECE2' },
} as const;

function applyTitleBarOverlay(window: BrowserWindow, dark: boolean) {
  const tone = dark ? TITLEBAR_COLORS.dark : TITLEBAR_COLORS.light;
  window.setTitleBarOverlay({ color: tone.bg, symbolColor: tone.symbol, height: 36 });
}

function createWindow() {
  const initialDark = nativeTheme.shouldUseDarkColors;
  const initialTone = initialDark ? TITLEBAR_COLORS.dark : TITLEBAR_COLORS.light;
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 880,
    minWidth: 960,
    minHeight: 600,
    show: false,
    backgroundColor: initialTone.bg,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: initialTone.bg,
      symbolColor: initialTone.symbol,
      height: 36,
    },
    webPreferences: {
      preload: path.join(baseDir, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });

  // Defer showing until BOTH ready-to-show AND did-finish-load. The first
  // alone still allows a brief blank flash before the React shell paints;
  // pairing the two events kills the flash. A 5s fallback prevents the
  // splash from stranding the user behind a slow renderer (AV scan, cold
  // disk, ...).
  let readyToShow = false;
  let finishedLoading = false;
  const tryShow = () => {
    if (!readyToShow || !finishedLoading || !mainWindow) return;
    mainWindow.show();
    if (splash) splash.close();
  };
  mainWindow.once('ready-to-show', () => {
    readyToShow = true;
    tryShow();
  });
  mainWindow.webContents.once('did-finish-load', () => {
    finishedLoading = true;
    tryShow();
  });
  setTimeout(() => {
    if (mainWindow && !mainWindow.isVisible()) mainWindow.show();
    if (splash) splash.close();
  }, 5000);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev) {
    mainWindow.loadURL(RENDERER_DEV_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    const rendererIndex = path.join(process.resourcesPath, 'app/renderer/index.html');
    mainWindow.loadFile(rendererIndex);
  }

  nativeTheme.on('updated', () => {
    if (!mainWindow) return;
    const dark = nativeTheme.shouldUseDarkColors;
    applyTitleBarOverlay(mainWindow, dark);
    mainWindow.webContents.send('theme:system-changed', dark ? 'dark' : 'light');
  });
}

function registerIpc() {
  ipcMain.handle('window:minimize', () => mainWindow?.minimize());
  ipcMain.handle('window:toggleMaximize', () => {
    if (!mainWindow) return;
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  });
  ipcMain.handle('window:close', () => mainWindow?.close());
  ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized() ?? false);

  ipcMain.handle('theme:get-system', () => (nativeTheme.shouldUseDarkColors ? 'dark' : 'light'));
  ipcMain.handle('theme:set', (_event, mode: 'light' | 'dark' | 'system') => {
    // Re-paint the title-bar overlay synchronously instead of waiting on
    // `nativeTheme.on('updated')` — that event only reliably fires on
    // OS-level theme changes, so an in-app toggle (light → dark while
    // the OS stays light) would otherwise leave the Windows control
    // strip on the previous tone and produce the right-edge dark seam.
    nativeTheme.themeSource = mode;
    if (mainWindow) applyTitleBarOverlay(mainWindow, nativeTheme.shouldUseDarkColors);
  });

  // Tells the renderer whether the desktop bridge is wired up. The
  // `isDesktop` flag is the renderer's sole branch — after PR20 retired
  // the IndexedDB web path, this is read once at boot to decide
  // between the dashboard and the "open in desktop app" notice.
  ipcMain.handle('app:get-info', () => ({
    platform: process.platform,
    isDesktop: true,
    version: app.getVersion(),
    appName: app.getName(),
  }));

  ipcMain.handle('app:exportDiagnostics', async (): Promise<DiagnosticsExportResult> => {
    const options = {
      title: 'Export Cursor Usage diagnostics',
      defaultPath: `cursor-usage-diagnostics-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: 'Diagnostics JSON', extensions: ['json'] }],
    };
    const result =
      mainWindow && !mainWindow.isDestroyed()
        ? await dialog.showSaveDialog(mainWindow, options)
        : await dialog.showSaveDialog(options);
    if (result.canceled || !result.filePath) return { canceled: true };

    const settings = readSettings();
    const payload = {
      generatedAt: new Date().toISOString(),
      app: {
        name: app.getName(),
        version: app.getVersion(),
        isPackaged: app.isPackaged,
        platform: process.platform,
        arch: process.arch,
        electron: process.versions.electron,
        chrome: process.versions.chrome,
        node: process.versions.node,
      },
      security: {
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
        webSecurity: true,
      },
      settings: {
        monthlyRequestBudget: settings.monthlyRequestBudget,
        currencyCode: settings.currency.code,
        currencyMultiplier: settings.currency.multiplier,
        displayDensity: settings.displayDensity,
        hasBackup: Boolean(settings.lastBackupAt),
      },
      database: {
        counts: getDb().counts(),
        path: path.join(app.getPath('userData'), 'cursor-usage.db'),
        settingsPath: getSettingsPath(),
      },
      update: getLastUpdateStatus(),
    };
    const json = `${JSON.stringify(payload, null, 2)}\n`;
    writeFileSync(result.filePath, json, 'utf-8');
    return {
      canceled: false,
      path: result.filePath,
      bytesWritten: Buffer.byteLength(json, 'utf-8'),
    };
  });

  // Settings surface — small JSON store at
  // userData/cursor-usage-settings.json. Theme persistence still goes
  // through the renderer's localStorage (handier for first-paint
  // styling); we keep budget / currency / lastBackupAt here.
  ipcMain.handle('settings:get', () => readSettings());
  ipcMain.handle('settings:set', (_event, partial: Partial<ReturnType<typeof readSettings>>) =>
    writeSettings(partial),
  );
  ipcMain.handle('settings:getPath', () => getSettingsPath());
}

// Set the AppUserModelID *before* any window is created so Windows groups
// the taskbar entry under our own product identity instead of
// "electron.exe".
if (process.platform === 'win32') {
  app.setAppUserModelId('com.cursorusage.desktop');
}

app.whenReady().then(() => {
  registerIpc();
  registerDbIpc();
  registerUpdateIpc();
  registerBudgetIpc(() => mainWindow);
  resetBudgetGuard();
  // Show the splash first so the user gets immediate visual feedback
  // while the renderer's bundle parses; createWindow opens the main
  // window hidden and surfaces it once it's painted.
  splash = showSplash();
  createWindow();
  void maybeRegisterAutoUpdater(() => mainWindow);
  // Tray sits in the system menu/notification area so the user can
  // peek "where am I on my budget?" without restoring the window.
  // Disabled with `CU_NO_TRAY=1` for headless smoke tests where a
  // floating tray icon adds nothing but noise.
  if (process.env.CU_NO_TRAY !== '1') {
    try {
      ensureTray(() => mainWindow);
    } catch (err) {
      console.warn('[tray] failed to create tray icon:', err);
    }
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  // Windows jumplist placeholder — surfaces "Import CSV" without the
  // user needing to launch the app first. PR17 will wire this through
  // to the actual import IPC.
  if (process.platform === 'win32') {
    try {
      app.setUserTasks([
        {
          program: process.execPath,
          arguments: '--import',
          iconPath: process.execPath,
          iconIndex: 0,
          title: 'Import CSV',
          description: 'Open Cursor Usage and import a usage-events CSV',
        },
      ]);
    } catch {
      // best-effort; not all Windows versions support this and we'd
      // rather lose the jumplist entry than block startup.
    }
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// `before-quit` fires after `window-all-closed` (when applicable) and
// before any window destruction. Closing the DB here flushes WAL pages
// cleanly so the user's usage history is never half-written on shutdown.
app.on('before-quit', () => {
  closeDb();
  destroyTray();
});
