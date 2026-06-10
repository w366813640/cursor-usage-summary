import { useEffect, useState } from 'react';

/**
 * Focus Mode — hide the "context" panels (forecast / monthly budget /
 * compare ranges / activity / burns) so only the high-signal pieces stay
 * on screen: week summary, KPI hero, efficiency card.
 *
 * Stateful enough for a hook (persisted across sessions via localStorage)
 * but not heavyweight enough to deserve a Context — every consumer reads
 * the same key directly and re-renders independently. We use a tiny
 * pub-sub via window storage events + a custom event so toggling from
 * the toolbar reflects everywhere in the same render cycle.
 */
const KEY = 'cu:focus-mode';
const EVENT = 'cu:focus-mode-change';

function readInitial(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function useFocusMode(): [boolean, (next: boolean) => void] {
  const [enabled, setEnabled] = useState<boolean>(() => readInitial());

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleChange = () => setEnabled(readInitial());
    window.addEventListener('storage', handleChange);
    window.addEventListener(EVENT, handleChange);
    return () => {
      window.removeEventListener('storage', handleChange);
      window.removeEventListener(EVENT, handleChange);
    };
  }, []);

  const setExternal = (next: boolean) => {
    setEnabled(next);
    try {
      window.localStorage.setItem(KEY, next ? '1' : '0');
    } catch {
      // localStorage may be disabled — toggle state still flips locally.
    }
    window.dispatchEvent(new CustomEvent(EVENT));
  };

  return [enabled, setExternal];
}
