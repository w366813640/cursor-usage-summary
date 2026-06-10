import { createContext, useContext, useState } from 'react';

/**
 * Entrance-animation gate (perf plan 1.4).
 *
 * Route switches remount the whole page tree, so every `motion.*`
 * entrance (fade/slide/stagger) and every KPI count-up replayed on each
 * navigation — each replay costs main-thread animation frames on top of
 * the page's real render work, and reads as "the app re-loads itself".
 *
 * `useEntranceOnce(key)` returns true exactly once per session for a
 * given key (decided at mount). Pages put the result into
 * `EntranceContext`; animated children read `useEntrance()` and pass
 * `initial={entrance ? … : false}` — framer-motion's `initial={false}`
 * renders elements directly in their settled state with zero animation.
 */
const played = new Set<string>();

export function useEntranceOnce(key: string): boolean {
  // Decided once per mount (lazy useState init) so a mid-life re-render
  // of the page can't flip an in-flight animation off.
  const [shouldAnimate] = useState(() => {
    if (played.has(key)) return false;
    played.add(key);
    return true;
  });
  return shouldAnimate;
}

/** Default true: components animate normally outside a gated page. */
export const EntranceContext = createContext(true);

/** Whether entrance animations should play for the current page mount. */
export function useEntrance(): boolean {
  return useContext(EntranceContext);
}
