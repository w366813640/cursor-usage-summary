import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'cu:auditedRows';
const CAP = 5000; // ceiling on how many ids we ever keep locally

interface AuditedState {
  ids: Set<string>;
}

/**
 * Persistent set of row ids the user has marked as "audited" on the
 * Day audit page. Wraps localStorage with a stable contract:
 *
 *   - `isAudited(id)` — O(1) lookup
 *   - `toggle(id)` — flip + persist + broadcast to other hook callers
 *   - `clearAll()` — wipes the local store, useful when the dataset
 *     changes drastically and stale ids would just be noise
 *
 * A simple custom event keeps multiple drawers / tabs in lockstep
 * without dragging in a state library. The cap exists so a power user
 * who marks thousands of rows over months doesn't bloat localStorage
 * into a quota violation; once exceeded we drop the oldest entries.
 */
export interface UseAuditedRows {
  audited: ReadonlySet<string>;
  isAudited: (id: string) => boolean;
  toggle: (id: string) => void;
  clearAll: () => void;
  count: number;
}

function readInitial(): AuditedState {
  if (typeof window === 'undefined') return { ids: new Set() };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ids: new Set() };
    const parsed = JSON.parse(raw) as { ids?: string[] };
    const arr = Array.isArray(parsed.ids) ? parsed.ids : [];
    return { ids: new Set(arr.slice(-CAP)) };
  } catch {
    return { ids: new Set() };
  }
}

const CHANGE_EVENT = 'cu:audited-change';

export function useAuditedRows(): UseAuditedRows {
  const [state, setState] = useState<AuditedState>(() => readInitial());

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onChange = () => setState(readInitial());
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => window.removeEventListener(CHANGE_EVENT, onChange);
  }, []);

  const persist = useCallback((next: Set<string>) => {
    const ids = Array.from(next).slice(-CAP);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ids }));
      } catch {
        // Quota exhausted or storage unavailable — ignore; the in-memory
        // copy still works for the current session.
      }
    }
    setState({ ids: new Set(ids) });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
    }
  }, []);

  const toggle = useCallback(
    (id: string) => {
      const next = new Set(state.ids);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      persist(next);
    },
    [state.ids, persist],
  );

  const clearAll = useCallback(() => {
    persist(new Set<string>());
  }, [persist]);

  const isAudited = useCallback((id: string) => state.ids.has(id), [state.ids]);

  return {
    audited: state.ids,
    isAudited,
    toggle,
    clearAll,
    count: state.ids.size,
  };
}
