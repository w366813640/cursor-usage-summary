import { useCallback, useEffect, useState } from 'react';

/**
 * Tiny hash-based router. We don't need react-router for four sibling tabs
 * with no nesting / no params — `window.location.hash` + `hashchange` covers
 * back-button support, deep-linking, and reload-restore in ~20 lines.
 *
 * Routes are kebab-case strings starting with `#/`:
 *
 *   #/overview · #/models · #/details · #/hours
 *
 * Anything else (including no hash at all) resolves to `defaultRoute`.
 */
export type AppRoute = 'overview' | 'models' | 'details' | 'hours' | 'year';

export const ALL_ROUTES: ReadonlyArray<AppRoute> = [
  'overview',
  'year',
  'models',
  'details',
  'hours',
];

function parseHash(hash: string, fallback: AppRoute): AppRoute {
  const trimmed = hash.replace(/^#\/?/, '');
  return (ALL_ROUTES as ReadonlyArray<string>).includes(trimmed) ? (trimmed as AppRoute) : fallback;
}

export function useRoute(defaultRoute: AppRoute = 'overview') {
  const [route, setRoute] = useState<AppRoute>(() =>
    typeof window === 'undefined' ? defaultRoute : parseHash(window.location.hash, defaultRoute),
  );

  useEffect(() => {
    const onHashChange = () => setRoute(parseHash(window.location.hash, defaultRoute));
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [defaultRoute]);

  const navigate = useCallback((next: AppRoute) => {
    // Use replaceState when going to default to keep history clean.
    window.location.hash = `/${next}`;
  }, []);

  return { route, navigate } as const;
}
