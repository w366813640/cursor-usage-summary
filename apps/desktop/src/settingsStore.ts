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
}

const DEFAULT_SETTINGS: UserSettings = {
  monthlyRequestBudget: 500,
  currency: { code: 'USD', symbol: '$', multiplier: 1 },
  lastBackupAt: null,
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
  return {
    monthlyRequestBudget: clamp(obj.monthlyRequestBudget, 1, 1_000_000, 500),
    currency: {
      code: typeof currency.code === 'string' && currency.code.trim() ? currency.code : 'USD',
      symbol: typeof currency.symbol === 'string' && currency.symbol.trim() ? currency.symbol : '$',
      multiplier: clamp(currency.multiplier, 0.0001, 10_000, 1),
    },
    lastBackupAt: typeof obj.lastBackupAt === 'string' ? obj.lastBackupAt : null,
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
