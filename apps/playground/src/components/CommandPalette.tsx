// kbar ships as CommonJS with no `sideEffects: false`, so importing anything
// from the package barrel (`'kbar'`) drags its entire module graph — including
// the heavy results UI plus `fuse.js` (fuzzy match) and `react-virtual` — onto
// the first-paint critical path. We import only the lightweight *core* (the
// provider, the `mod+k` handler and action registration) from deep module
// paths here, and load the heavy UI from its own deep paths inside the lazy
// `CommandPaletteUI` chunk. Deep paths are safe: kbar exposes no `exports`
// map and the version is pinned.
import { KBarProvider } from 'kbar/lib/KBarContextProvider';
import { type Action, VisualState } from 'kbar/lib/types';
import { useKBar } from 'kbar/lib/useKBar';
import { useRegisterActions } from 'kbar/lib/useRegisterActions';
import { type ReactNode, Suspense, lazy, useEffect, useMemo } from 'react';
import { ALL_ROUTES, type AppRoute } from '../router/useRoute';

/**
 * The palette's portal/animator/search/results — and its `fuse.js` +
 * `react-virtual` dependencies — are split into a chunk that only loads
 * once the palette is first opened. See `PaletteMount` below.
 */
const PaletteUI = lazy(() => import('./CommandPaletteUI'));

/**
 * Global Cmd/Ctrl-K command palette. Powers:
 *
 *   - Route jumps (g o / g y / g n / g m / g r / g d)
 *   - Quick actions (Import CSV, Export PNG, Open History, …)
 *   - Settings drawer toggle
 *
 * The palette is mounted at the top of the app tree (WelcomePage) so it
 * works across the welcome screen AND the dashboard. Route actions resolve
 * via `window.location.hash` directly because the kbar `<KBarProvider>`
 * needs `actions` at construction time, while `useRoute` is a hook that
 * only exists inside the dashboard subtree.
 *
 * Style is hand-rolled in design tokens so the palette feels native to the
 * Bloomberg/Tufte aesthetic — kbar's stock theme is too "marketing-y".
 */
export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const baseActions = useMemo<Action[]>(() => {
    const navAction = (
      route: AppRoute,
      shortcut: string[],
      label: string,
      hint: string,
    ): Action => ({
      id: `nav-${route}`,
      name: `Go to ${label}`,
      keywords: `${route} navigate jump open ${hint}`,
      shortcut,
      section: 'Navigate',
      perform: () => {
        window.location.hash = `/${route}`;
      },
    });

    return [
      // Navigation
      navAction('overview', ['g', 'o'], 'Overview', 'home dashboard kpi actions coach'),
      navAction('year', ['g', 'y'], 'Year', 'annual review heatmap calendar trends'),
      navAction('anomalies', ['g', 'n'], 'Anomalies', 'outlier spike z-score explain why'),
      navAction('models', ['g', 'm'], 'Models', 'per model breakdown table substitution'),
      navAction('details', ['g', 'r'], 'Requests', 'every row request table audit log'),
      navAction('day', ['g', 'd'], 'Day audit', 'single day request timeline hour burn schedule'),
    ];
  }, []);

  return (
    <KBarProvider
      actions={baseActions}
      options={{
        enableHistory: false,
        // Default keybinding `mod+k` already works — kbar handles
        // both `Cmd+K` on mac and `Ctrl+K` on win/linux.
      }}
    >
      {children}
      <PaletteMount />
    </KBarProvider>
  );
}

/**
 * Gates the heavy palette UI behind kbar's visual state so the chunk only
 * loads when the palette is actually opened — keeping ~30 kB of kbar UI +
 * fuse.js + react-virtual off the first-paint critical path.
 *
 * To keep the *first* open instant (and its entrance animation smooth), the
 * chunk is prefetched during browser idle time after mount, well off the
 * critical path. By the time the user reaches for Cmd/Ctrl+K it is warm.
 */
function PaletteMount() {
  const { showing } = useKBar((state) => ({
    showing: state.visualState !== VisualState.hidden,
  }));

  useEffect(() => {
    const w = window as typeof window & {
      requestIdleCallback?: (cb: () => void) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    const prefetch = () => {
      void import('./CommandPaletteUI');
    };
    if (typeof w.requestIdleCallback === 'function') {
      const handle = w.requestIdleCallback(prefetch);
      return () => w.cancelIdleCallback?.(handle);
    }
    const timer = window.setTimeout(prefetch, 1500);
    return () => window.clearTimeout(timer);
  }, []);

  if (!showing) return null;
  return (
    <Suspense fallback={null}>
      <PaletteUI />
    </Suspense>
  );
}

/**
 * Inside-the-provider helper hook for child components that want to
 * register additional contextual actions (e.g. desktop actions like
 * Import CSV / History / Settings appear only inside the dashboard).
 */
export function useExtraPaletteActions(actions: Action[]) {
  useRegisterActions(actions, [actions]);
}

// Re-export for ergonomics — callers shouldn't have to import ALL_ROUTES separately.
export { ALL_ROUTES };
