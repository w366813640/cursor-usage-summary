import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { app } from 'electron';

/**
 * Main-process settings store — a flat JSON file at
 * `userData/cursor-usage-settings.json`. Theme already persists via the
 * renderer's localStorage (handy for instant boot styling), so we
 * deliberately keep it out of here to avoid two sources of truth.
 *
 * The store is intentionally tiny:
 *
 *   - monthlyRequestBudget : Cursor plan cap displayed on the Monthly
 *     panel. Defaults to 500 (the documented Cursor Pro tier).
 *   - currency             : display-only override (USD remains the
 *     source of truth from cursor.com pricing). PR22 exposes the
 *     fields and persists them; downstream UI uses them to render
 *     fmtUSD when `code !== 'USD'`.
 *   - lastBackupAt         : informational only — shown in the
 *     Settings drawer so the user knows when they last exported.
 *
 * On read errors / first launch, we hand back the defaults instead of
 * crashing so the user always sees a usable settings panel.
 */

export interface CurrencyPreference {
  /** ISO 4217 code (display only, e.g. "USD" / "CNY" / "EUR"). */
  code: string;
  /** Symbol used in fmt — `$` / `¥` / `€`. */
  symbol: string;
  /** Conversion multiplier applied to underlying USD figures. 1 = no conversion. */
  multiplier: number;
}

export interface UserSettings {
  monthlyRequestBudget: number;
  currency: CurrencyPreference;
  lastBackupAt: string | null;
  displayDensity: 'comfortable' | 'dense' | 'presentation';
  personalGoals: {
    monthlyRequestTarget: number | null;
    habitFocus: 'cache' | 'top-burn' | 'volume' | null;
  };
}

const DEFAULT_SETTINGS: UserSettings = {
  monthlyRequestBudget: 500,
  currency: { code: 'USD', symbol: '$', multiplier: 1 },
  lastBackupAt: null,
  displayDensity: 'comfortable',
  personalGoals: { monthlyRequestTarget: null, habitFocus: null },
};

const SETTINGS_FILENAME = 'cursor-usage-settings.json';

function settingsPath(): string {
  return path.join(app.getPath('userData'), SETTINGS_FILENAME);
}

let cached: UserSettings | null = null;

function clamp(n: unknown, min: number, max: number, fallback: number): number {
  const value = typeof n === 'number' && Number.isFinite(n) ? n : fallback;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function normalize(raw: unknown): UserSettings {
  const obj = (raw ?? {}) as Partial<UserSettings>;
  const currency = (obj.currency ?? {}) as Partial<CurrencyPreference>;
  const goals = (obj.personalGoals ?? {}) as Partial<UserSettings['personalGoals']>;
  const displayDensity =
    obj.displayDensity === 'dense' || obj.displayDensity === 'presentation'
      ? obj.displayDensity
      : 'comfortable';
  const habitFocus =
    goals.habitFocus === 'cache' || goals.habitFocus === 'top-burn' || goals.habitFocus === 'volume'
      ? goals.habitFocus
      : null;
  return {
    monthlyRequestBudget: clamp(obj.monthlyRequestBudget, 1, 1_000_000, 500),
    currency: {
      code: typeof currency.code === 'string' && currency.code.trim() ? currency.code : 'USD',
      symbol: typeof currency.symbol === 'string' && currency.symbol.trim() ? currency.symbol : '$',
      multiplier: clamp(currency.multiplier, 0.0001, 10_000, 1),
    },
    lastBackupAt: typeof obj.lastBackupAt === 'string' ? obj.lastBackupAt : null,
    displayDensity,
    personalGoals: {
      monthlyRequestTarget:
        typeof goals.monthlyRequestTarget === 'number' &&
        Number.isFinite(goals.monthlyRequestTarget)
          ? clamp(goals.monthlyRequestTarget, 1, 1_000_000, 500)
          : null,
      habitFocus,
    },
  };
}

export function readSettings(): UserSettings {
  if (cached) return cached;
  const p = settingsPath();
  if (!existsSync(p)) {
    cached = { ...DEFAULT_SETTINGS, currency: { ...DEFAULT_SETTINGS.currency } };
    return cached;
  }
  try {
    const parsed = JSON.parse(readFileSync(p, 'utf-8')) as unknown;
    cached = normalize(parsed);
    return cached;
  } catch {
    // Corrupt file → fall back to defaults instead of crashing the app.
    // Caller code that wants a noisier failure should validate before
    // writing.
    cached = { ...DEFAULT_SETTINGS, currency: { ...DEFAULT_SETTINGS.currency } };
    return cached;
  }
}

export function writeSettings(partial: Partial<UserSettings>): UserSettings {
  const current = readSettings();
  const merged: UserSettings = normalize({
    ...current,
    ...partial,
    currency: { ...current.currency, ...(partial.currency ?? {}) },
    personalGoals: { ...current.personalGoals, ...(partial.personalGoals ?? {}) },
  });
  const p = settingsPath();
  const dir = path.dirname(p);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(p, `${JSON.stringify(merged, null, 2)}\n`, 'utf-8');
  cached = merged;
  return merged;
}

export function getSettingsPath(): string {
  return settingsPath();
}

/**
 * Test seam — primarily used by the IPC handler so the renderer always
 * gets a fresh read (in case the file was edited externally between
 * launches).
 */
export function invalidateCache(): void {
  cached = null;
}

/**
 * Budget-notification guard state (PR25). Kept in its own JSON file so
 * the *user-tunable* settings (`UserSettings` above) stay clean and we
 * can wipe the notification history independently — e.g. via the
 * `budget:resetGuard` IPC — without touching budget / currency.
 */

export interface BudgetState {
  /** Map from `YYYY-MM` to thresholds already notified (0.8 / 1.0). */
  thresholdsHit: Record<string, number[]>;
}

const BUDGET_STATE_FILENAME = 'cursor-usage-budget-state.json';

function budgetStatePath(): string {
  return path.join(app.getPath('userData'), BUDGET_STATE_FILENAME);
}

export function readBudgetState(): BudgetState | null {
  const p = budgetStatePath();
  if (!existsSync(p)) return null;
  try {
    const parsed = JSON.parse(readFileSync(p, 'utf-8')) as unknown;
    const obj = (parsed ?? {}) as Partial<BudgetState>;
    const hits: Record<string, number[]> = {};
    if (obj.thresholdsHit && typeof obj.thresholdsHit === 'object') {
      for (const [key, vals] of Object.entries(obj.thresholdsHit)) {
        if (!/^\d{4}-\d{2}$/.test(key)) continue;
        if (!Array.isArray(vals)) continue;
        hits[key] = vals
          .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
          .filter((v) => v === 0.8 || v === 1.0)
          .sort((a, b) => a - b);
      }
    }
    return { thresholdsHit: hits };
  } catch {
    return null;
  }
}

export function writeBudgetState(state: BudgetState): void {
  const p = budgetStatePath();
  const dir = path.dirname(p);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(p, `${JSON.stringify(state, null, 2)}\n`, 'utf-8');
}
