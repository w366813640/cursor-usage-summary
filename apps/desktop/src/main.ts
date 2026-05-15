import path from 'node:path';
import { BrowserWindow, app, ipcMain, nativeTheme, shell } from 'electron';
import { closeDb, registerDbIpc } from './db';
import { type SplashHandle, showSplash } from './splash';
import { maybeRegisterAutoUpdater } from './updater';

const isDev = !app.isPackaged;
const RENDERER_DEV_URL = process.env.RENDERER_DEV_URL ?? 'http://localhost:5173';

const baseDir = __dirname;

let mainWindow: BrowserWindow | null = null;
let splash: SplashHandle | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 880,
    minWidth: 960,
    minHeight: 600,
    show: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1F1E1B' : '#F7F3EA',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: nativeTheme.shouldUseDarkColors ? '#1F1E1B' : '#F7F3EA',
      symbolColor: nativeTheme.shouldUseDarkColors ? '#F1ECE2' : '#2B2926',
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
    mainWindow.setTitleBarOverlay({
      color: dark ? '#1F1E1B' : '#F7F3EA',
      symbolColor: dark ? '#F1ECE2' : '#2B2926',
      height: 36,
    });
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
    nativeTheme.themeSource = mode;
  });

  // Tells the renderer whether the desktop bridge is wired up. PR16 will
  // graft database calls (`db:*`) onto this same surface; renderer code
  // can ask `bridge.app.isDesktop` to branch between IDB (web) and SQLite
  // (desktop) without sniffing UA strings.
  ipcMain.handle('app:get-info', () => ({
    platform: process.platform,
    isDesktop: true,
    version: app.getVersion(),
    appName: app.getName(),
  }));
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
  // Show the splash first so the user gets immediate visual feedback
  // while the renderer's bundle parses; createWindow opens the main
  // window hidden and surfaces it once it's painted.
  splash = showSplash();
  createWindow();
  void maybeRegisterAutoUpdater();

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
});
