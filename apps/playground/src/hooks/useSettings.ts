import { useCallback, useEffect, useState } from 'react';
import { getSettings, updateSettings } from '../electron/desktopStorage';
import type { UserSettings } from '../electron/types';

/**
 * Hook around `bridge.settings.{get,set}`. Loads once on mount, exposes
 * an updater that persists on the main side, and keeps local state in
 * sync so renderers re-render on save without a round-trip refetch.
 *
 * Default value matches `apps/desktop/src/settingsStore.ts:DEFAULT_SETTINGS`
 * so first paint can render the form before the IPC resolves.
 */
const FALLBACK: UserSettings = {
  monthlyRequestBudget: 500,
  currency: { code: 'USD', symbol: '$', multiplier: 1 },
  lastBackupAt: null,
  displayDensity: 'comfortable',
};

const SETTINGS_EVENT = 'cu:settings-change';

export interface UseSettings {
  settings: UserSettings;
  /** True while the initial IPC fetch is in flight. */
  loading: boolean;
  /** Last save error, if any — UI can surface it inline. */
  error: string | null;
  /** Patches the persisted settings and updates local state. */
  save: (partial: Partial<UserSettings>) => Promise<void>;
  /** Force-reload from disk; useful after a backup restore that mutated things externally. */
  reload: () => Promise<void>;
}

export function useSettings(): UseSettings {
  const [settings, setSettings] = useState<UserSettings>(FALLBACK);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const next = await getSettings();
      setSettings(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const onSettingsChange = () => {
      void reload();
    };
    window.addEventListener(SETTINGS_EVENT, onSettingsChange);
    return () => window.removeEventListener(SETTINGS_EVENT, onSettingsChange);
  }, [reload]);

  const save = useCallback(async (partial: Partial<UserSettings>) => {
    try {
      const next = await updateSettings(partial);
      setSettings(next);
      setError(null);
      window.dispatchEvent(new CustomEvent(SETTINGS_EVENT));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    }
  }, []);

  return { settings, loading, error, save, reload };
}
