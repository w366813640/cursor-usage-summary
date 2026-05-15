import { type BrowserWindow, Notification, app, ipcMain } from 'electron';
import {
  type BudgetNotifierState,
  type BudgetReport,
  decideBudgetNotification,
  makeInitialState,
  prune,
  recordNotification,
} from './budgetNotifier';
import { type BudgetState, readBudgetState, readSettings, writeBudgetState } from './settingsStore';
import { type BudgetSnapshot, updateTrayBudget } from './tray';

/**
 * Budget IPC + toast bridge.
 *
 *   - Renderer pushes a `BudgetReport` every time the monthly aggregate
 *     changes (after an import, after a settings save, on initial
 *     hydrate). We forward the headline numbers to the tray menu and
 *     run them past `decideBudgetNotification` to figure out whether
 *     to fire a toast.
 *   - Notification state (`thresholdsHit`) is persisted via
 *     `settingsStore.{readBudgetState,writeBudgetState}` so quitting +
 *     relaunching doesn't re-fire toasts the user already saw.
 *   - `resetBudgetGuard()` is called on startup; it prunes stale months
 *     and re-validates the on-disk file so a corrupt entry can't keep
 *     us from notifying.
 */

let guard: BudgetNotifierState = makeInitialState();

export function resetBudgetGuard(): void {
  const persisted = readBudgetState();
  guard = persisted ? { thresholdsHit: persisted.thresholdsHit } : makeInitialState();
}

function persistGuard(monthKey: string): void {
  guard = prune(guard, monthKey);
  const payload: BudgetState = { thresholdsHit: guard.thresholdsHit };
  writeBudgetState(payload);
}

function applyTraySnapshot(report: BudgetReport): void {
  const snapshot: BudgetSnapshot = {
    monthLabel: report.monthLabel,
    spendUSD: report.spendUSD,
    requestUnits: report.requestUnits,
    budgetRequests: report.budgetRequests,
    projectedRequests: report.projectedRequests,
    over: report.budgetRequests > 0 && report.requestUnits >= report.budgetRequests,
  };
  try {
    updateTrayBudget(snapshot);
  } catch {
    /* tray may be disabled by CU_NO_TRAY or absent on Linux headless */
  }
}

function maybeFire(report: BudgetReport): { fired: boolean; threshold?: number } {
  if (!Notification.isSupported()) return { fired: false };
  const decision = decideBudgetNotification(guard, report);
  if (!decision) return { fired: false };

  try {
    const n = new Notification({
      title: decision.title,
      body: decision.body,
      silent: false,
    });
    n.show();
  } catch (err) {
    console.warn('[budget] notification failed:', err);
    return { fired: false };
  }

  guard = recordNotification(guard, decision.monthKey, decision.threshold);
  persistGuard(decision.monthKey);
  return { fired: true, threshold: decision.threshold };
}

export function registerBudgetIpc(_getWindow: () => BrowserWindow | null): void {
  ipcMain.handle('budget:report', (_event, report: BudgetReport) => {
    if (!report || typeof report !== 'object' || typeof report.monthKey !== 'string') {
      return { ok: false, reason: 'invalid-report' };
    }
    applyTraySnapshot(report);
    const out = maybeFire(report);
    return { ok: true, fired: out.fired, threshold: out.threshold };
  });

  ipcMain.handle('budget:resetGuard', () => {
    guard = makeInitialState();
    writeBudgetState({ thresholdsHit: {} });
    return { ok: true };
  });

  ipcMain.handle('budget:getGuardState', () => ({
    thresholdsHit: guard.thresholdsHit,
    settings: readSettings(),
    appVersion: app.getVersion(),
  }));
}
