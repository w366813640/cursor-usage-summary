import { useCallback, useEffect, useState } from 'react';
import { LATEST_VERSION } from '../utils/changelog';

const STORAGE_KEY = 'cu:lastSeenChangelogVersion';

/**
 * Tracks whether the user has acknowledged the most recent changelog
 * entry. The Quick Tips floating button reads `hasUnread` to draw a
 * red dot, the What's new panel calls `markAllSeen` when the user
 * opens it.
 *
 * Simple string equality keeps the contract loose — when we bump
 * LATEST_VERSION on each release the badge automatically reappears
 * for everyone whose stored marker is stale, no migration logic
 * needed.
 */
export function useUnreadChangelog() {
  const [lastSeen, setLastSeen] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      return window.localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setLastSeen(e.newValue);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const markAllSeen = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_KEY, LATEST_VERSION);
    } catch {
      // ignore quota / privacy-mode failures — the in-memory copy is
      // still correct for the current session
    }
    setLastSeen(LATEST_VERSION);
  }, []);

  return {
    hasUnread: lastSeen !== LATEST_VERSION,
    markAllSeen,
    latestVersion: LATEST_VERSION,
  };
}
