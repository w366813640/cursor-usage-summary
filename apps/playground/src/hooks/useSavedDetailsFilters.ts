import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'cu:savedDetailsFiltersV1';
const CAP = 20;

export interface SavedDetailsFilter {
  id: string;
  name: string;
  query: string;
  modelFilter: string;
  /** ms-since-epoch — used as the chip's secondary sort tie-breaker. */
  createdAt: number;
}

export interface UseSavedDetailsFilters {
  filters: ReadonlyArray<SavedDetailsFilter>;
  /** Returns the saved filter id, or null when name/snapshot was empty. */
  save: (name: string, snapshot: { query: string; modelFilter: string }) => string | null;
  remove: (id: string) => void;
  clearAll: () => void;
}

function load(): SavedDetailsFilter[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSavedFilter).slice(-CAP);
  } catch {
    return [];
  }
}

function isSavedFilter(value: unknown): value is SavedDetailsFilter {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    typeof v.query === 'string' &&
    typeof v.modelFilter === 'string' &&
    typeof v.createdAt === 'number'
  );
}

function persist(next: SavedDetailsFilter[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // quota / privacy mode — keep the in-memory copy alive for the session
  }
}

/**
 * Saved filter chips for the Details page. localStorage-backed, capped
 * at 20 entries so the chip row stays scannable and storage doesn't
 * grow without bound. Save names are not deduped — a user can keep
 * multiple snapshots named "experiments" if that's what they mean.
 */
export function useSavedDetailsFilters(): UseSavedDetailsFilters {
  const [filters, setFilters] = useState<SavedDetailsFilter[]>(() => load());

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setFilters(load());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const save = useCallback(
    (name: string, snapshot: { query: string; modelFilter: string }): string | null => {
      const trimmed = name.trim();
      if (!trimmed) return null;
      if (!snapshot.query && !snapshot.modelFilter) return null;
      const id = `f_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      const next: SavedDetailsFilter = {
        id,
        name: trimmed.slice(0, 32),
        query: snapshot.query,
        modelFilter: snapshot.modelFilter,
        createdAt: Date.now(),
      };
      setFilters((prev) => {
        const merged = [...prev, next].slice(-CAP);
        persist(merged);
        return merged;
      });
      return id;
    },
    [],
  );

  const remove = useCallback((id: string) => {
    setFilters((prev) => {
      const next = prev.filter((f) => f.id !== id);
      persist(next);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setFilters([]);
    persist([]);
  }, []);

  return { filters, save, remove, clearAll };
}
