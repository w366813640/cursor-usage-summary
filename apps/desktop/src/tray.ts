import { type BrowserWindow, Menu, Tray, app, nativeImage, shell } from 'electron';
import { generateTrayPng } from './trayIcon';

/**
 * System-tray integration.
 *
 *   - Icon: the same 5-bar mark splash.ts draws, rasterised to a PNG
 *     at runtime via `generateTrayPng` (no committed binaries).
 *   - Tooltip: short product name + a live snippet of the current
 *     month's spend so the user gets data at a hover.
 *   - Context menu: show / hide window, current-month status (disabled
 *     placeholder unless the renderer has pushed a budget report yet),
 *     open DB folder, open settings file, separator, quit.
 *   - Click behaviour: on Windows / Linux, a left-click toggles the
 *     main window. On macOS the menu is the only target (the
 *     status-item never minimises a Cocoa window).
 *
 * The renderer pushes updates via `bridge.budget.report()` →
 * `updateTrayBudget()`, which rebuilds the menu so the dollar figures
 * stay current without the tray ever polling the DB.
 */

interface BudgetSnapshot {
  monthLabel: string;
  spendUSD: number;
  requestUnits: number;
  budgetRequests: number;
  projectedRequests: number | null;
  /**
   * Convenience flag derived from `requestUnits >= budgetRequests`.
   * Used to colour the tooltip when we have a real Tray instance.
   */
  over: boolean;
}

let tray: Tray | null = null;
let getWindowRef: (() => BrowserWindow | null) | null = null;
let snapshot: BudgetSnapshot | null = null;

function buildIcon() {
  const img = nativeImage.createFromBuffer(generateTrayPng({ size: 32 }));
  if (process.platform === 'darwin') {
    img.setTemplateImage(true);
  }
  return img;
}

function showWindow(): void {
  const win = getWindowRef?.();
  if (!win) return;
  if (win.isMinimized()) win.restore();
  if (!win.isVisible()) win.show();
  win.focus();
}

function toggleWindow(): void {
  const win = getWindowRef?.();
  if (!win) return;
  if (win.isVisible() && !win.isMinimized()) {
    win.hide();
  } else {
    showWindow();
  }
}

function statusLine(): string {
  if (!snapshot) return 'Waiting for usage data…';
  const pct =
    snapshot.budgetRequests > 0
      ? Math.round((snapshot.requestUnits / snapshot.budgetRequests) * 100)
      : 0;
  const usd = snapshot.spendUSD.toFixed(2);
  return `${snapshot.monthLabel}: $${usd} · ${snapshot.requestUnits.toLocaleString()} / ${snapshot.budgetRequests.toLocaleString()} req (${pct}%)`;
}

function projectionLine(): string | null {
  if (!snapshot || snapshot.projectedRequests == null || snapshot.budgetRequests <= 0) return null;
  const projPct = Math.round((snapshot.projectedRequests / snapshot.budgetRequests) * 100);
  return `Projected end-of-month: ${Math.round(snapshot.projectedRequests).toLocaleString()} req (${projPct}%)`;
}

function rebuildMenu(): void {
  if (!tray) return;
  const items: Electron.MenuItemConstructorOptions[] = [
    { label: 'Show Cursor Usage', click: showWindow },
    { label: 'Hide window', click: () => getWindowRef?.()?.hide() },
    { type: 'separator' },
    { label: statusLine(), enabled: false },
  ];

  const proj = projectionLine();
  if (proj) items.push({ label: proj, enabled: false });

  items.push(
    { type: 'separator' },
    {
      label: 'Open database folder',
      click: () => {
        void shell.openPath(app.getPath('userData'));
      },
    },
    { type: 'separator' },
    { label: `Cursor Usage v${app.getVersion()}`, enabled: false },
    { label: 'Quit', role: 'quit' },
  );

  tray.setContextMenu(Menu.buildFromTemplate(items));
  tray.setToolTip(snapshot ? `Cursor Usage — ${statusLine()}` : 'Cursor Usage');
}

export function ensureTray(getWindow: () => BrowserWindow | null): Tray {
  getWindowRef = getWindow;
  if (tray) return tray;
  tray = new Tray(buildIcon());
  tray.on('click', () => {
    if (process.platform === 'darwin') return;
    toggleWindow();
  });
  tray.on('double-click', showWindow);
  rebuildMenu();
  return tray;
}

export function updateTrayBudget(next: BudgetSnapshot): void {
  snapshot = next;
  rebuildMenu();
}

export function destroyTray(): void {
  if (tray && !tray.isDestroyed()) {
    try {
      tray.destroy();
    } catch {
      /* best-effort on shutdown */
    }
  }
  tray = null;
  snapshot = null;
}

export type { BudgetSnapshot };
