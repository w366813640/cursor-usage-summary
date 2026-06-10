import { useEffect, useSyncExternalStore } from 'react';
import { getSettings, updateSettings } from '../electron/desktopStorage';
import type { UserSettings } from '../electron/types';

/**
 * Singleton settings store behind `bridge.settings.{get,set}` (perf plan 3.3).
 *
 * Previously each `useSettings()` call owned its own state + IPC fetch, so
 * six consumers meant six `settings:get` round-trips on startup and six
 * refetches after every save (via a window event). Now there is one
 * module-level store shared through `useSyncExternalStore`: one fetch,
 * one in-memory update per save, and every consumer re-renders from the
 * same snapshot.
 *
 * Default value matches `apps/desktop/src/settingsStore.ts:DEFAULT_SETTINGS`
 * so first paint can render the form before the IPC resolves.
 */
const FALLBACK: UserSettings = {
  monthlyRequestBudget: 500,
  currency: { code: 'USD', symbol: '$', multiplier: 1 },
  lastBackupAt: null,
  displayDensity: 'comfortable',
  personalGoals: { monthlyRequestTarget: null, habitFocus: null },
  navigation: {
    order: ['overview', 'year', 'anomalies', 'models', 'details', 'day'],
    hidden: [],
  },
  budgetNotificationsMuted: false,
};

interface SettingsState {
  settings: UserSettings;
  loading: boolean;
  error: string | null;
}

let state: SettingsState = { settings: FALLBACK, loading: true, error: null };
const listeners = new Set<() => void>();
let initialFetchStarted = false;

function setState(partial: Partial<SettingsState>): void {
  state = { ...state, ...partial };
  for (const cb of listeners) cb();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot(): SettingsState {
  return state;
}

async function reloadSettings(): Promise<void> {
  setState({ loading: true });
  try {
    const next = await getSettings();
    setState({ settings: next, loading: false, error: null });
  } catch (err) {
    setState({ loading: false, error: err instanceof Error ? err.message : String(err) });
  }
}

async function saveSettings(partial: Partial<UserSettings>): Promise<void> {
  try {
    const next = await updateSettings(partial);
    setState({ settings: next, error: null });
  } catch (err) {
    setState({ error: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}

export interface UseSettings {
  settings: UserSettings;
  /** True while the initial IPC fetch is in flight. */
  loading: boolean;
  /** Last save error, if any — UI can surface it inline. */
  error: string | null;
  /** Patches the persisted settings and updates the shared store. */
  save: (partial: Partial<UserSettings>) => Promise<void>;
  /** Force-reload from disk; useful after a backup restore that mutated things externally. */
  reload: () => Promise<void>;
}

export function useSettings(): UseSettings {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    if (initialFetchStarted) return;
    initialFetchStarted = true;
    void reloadSettings();
  }, []);

  return {
    settings: snap.settings,
    loading: snap.loading,
    error: snap.error,
    save: saveSettings,
    reload: reloadSettings,
  };
}
