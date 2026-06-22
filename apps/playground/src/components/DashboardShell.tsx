import type { RowWithCost, UsageSummary } from '@cu/data';
import { useShortcut, useT } from '@cu/ui';
import { Suspense, lazy, useMemo, useRef } from 'react';
import { useBudgetReporter } from '../hooks/useBudgetReporter';
import { useFocusMode } from '../hooks/useFocusMode';
import { useSettings } from '../hooks/useSettings';
import { type AppRoute, useRoute } from '../router/useRoute';
import { reportRoutePaint } from '../utils/perf';
import { CommandPaletteProvider, useExtraPaletteActions } from './CommandPalette';
import { type DesktopActions, FileToolbar } from './FileToolbar';
import { KeyboardCheatsheet } from './KeyboardCheatsheet';
import { OverviewPage } from './OverviewPage';
import { SideNav } from './SideNav';

// Route chunk loaders, shared between React.lazy (click-time) and the
// SideNav intent prefetch (hover/focus-time). Calling these early warms
// the module cache so the subsequent lazy render resolves with no network
// wait — import() is idempotent, so repeated hovers cost nothing.
const importYearReview = () => import('./YearReviewPage');
const importAnomalies = () => import('./AnomaliesPage');
const importModels = () => import('./ModelsPage');
const importDetails = () => import('./DetailsPage');
const importDay = () => import('./HoursPage');

const YearReviewPage = lazy(() =>
  importYearReview().then((mod) => ({ default: mod.YearReviewPage })),
);
const AnomaliesPage = lazy(() => importAnomalies().then((mod) => ({ default: mod.AnomaliesPage })));
const ModelsPage = lazy(() => importModels().then((mod) => ({ default: mod.ModelsPage })));
const DetailsPage = lazy(() => importDetails().then((mod) => ({ default: mod.DetailsPage })));
const DayPage = lazy(() => importDay().then((mod) => ({ default: mod.DayPage })));

// `overview` ships in the entry bundle (landing route) so it has no chunk
// to prefetch. The rest map to their loader above.
const ROUTE_PREFETCHERS: Partial<Record<AppRoute, () => Promise<unknown>>> = {
  year: importYearReview,
  anomalies: importAnomalies,
  models: importModels,
  details: importDetails,
  day: importDay,
};
const prefetched = new Set<AppRoute>();

function prefetchRoute(route: AppRoute) {
  if (prefetched.has(route)) return;
  const load = ROUTE_PREFETCHERS[route];
  if (!load) return;
  prefetched.add(route);
  // Swallow rejections: a failed prefetch must never surface as an
  // unhandled rejection; the real click-time import will retry + report.
  void load().catch(() => prefetched.delete(route));
}

interface DashboardShellProps {
  summary: UsageSummary;
  rows: ReadonlyArray<RowWithCost>;
  fileName: string;
  sourceFiles: ReadonlyArray<string>;
  rowsSeen: number;
  failures: number;
  elapsedMs: number;
  lastIngestedAt: number;
  /** Wires the toolbar buttons (Import / History) to the desktop shell. */
  desktopActions: DesktopActions;
  onOpenSettings: () => void;
}

/**
 * Post-upload application shell:
 *
 *   ┌──────────────────────────────────────────────┐
 *   │   FileToolbar — what data you're looking at  │
 *   │   NavTabs — Overview · Year · Models · …     │
 *   │                                              │
 *   │   <active route>                             │
 *   └──────────────────────────────────────────────┘
 *
 * Routing is hash-based (no react-router dep). Page switches are intentionally
 * static: the year heatmap and trend tables already carry hundreds of SVG
 * nodes, so route-level animation only adds jank without adding meaning.
 *
 * The Cmd/Ctrl+K command palette provider is mounted here (not at the app
 * root) so the kbar core ships in this lazy chunk instead of the first-paint
 * bundle — the palette only ever drives dashboard navigation/actions, all of
 * which live in this subtree.
 */
export function DashboardShell(props: DashboardShellProps) {
  return (
    <CommandPaletteProvider>
      <DashboardShellInner {...props} />
    </CommandPaletteProvider>
  );
}

function DashboardShellInner({
  summary,
  rows,
  fileName,
  sourceFiles,
  rowsSeen,
  failures,
  elapsedMs,
  lastIngestedAt,
  desktopActions,
  onOpenSettings,
}: DashboardShellProps) {
  const { route, navigate } = useRoute('overview');
  const lastRouteRef = useRef<string | null>(null);
  // Dev-only: logs "route a→b painted in Xms" so navigation jank is measurable.
  reportRoutePaint(route, lastRouteRef);
  const [focusMode, setFocusMode] = useFocusMode();
  const { settings } = useSettings();
  // Resolve the user's saved nav layout (Settings → Navigation). When the
  // hidden list is empty and the order matches the static default, fall
  // through to `undefined` so SideNav can render the curated Analyze /
  // Investigate group split instead of one flat "Sections" list.
  const navLayout = useMemo(() => {
    const order = settings.navigation.order;
    const hidden = new Set(settings.navigation.hidden);
    const visible = order.filter((r) => !hidden.has(r));
    const isDefault =
      hidden.size === 0 &&
      visible.length === 6 &&
      visible[0] === 'overview' &&
      visible[1] === 'year' &&
      visible[2] === 'anomalies' &&
      visible[3] === 'models' &&
      visible[4] === 'details' &&
      visible[5] === 'day';
    return isDefault ? undefined : visible;
  }, [settings.navigation]);
  const desktopPaletteActions = useMemo(
    () => [
      {
        id: 'desktop-import-csv',
        name: 'Import CSV',
        subtitle: 'Preview and merge another usage export',
        keywords: 'upload add file merge csv usage',
        section: 'Desktop',
        perform: desktopActions.onOpenImport,
      },
      {
        id: 'desktop-import-history',
        name: 'Open Import History',
        subtitle: 'Review batches and undo imports',
        keywords: 'history batch undo restore previous imports',
        section: 'Desktop',
        perform: desktopActions.onOpenHistory,
      },
      {
        id: 'desktop-settings',
        name: 'Open Settings',
        subtitle: 'Theme, density, goals, backup, updates',
        keywords: 'preferences options backup restore goals density update',
        section: 'Desktop',
        perform: onOpenSettings,
      },
      {
        id: 'desktop-toggle-focus',
        name: focusMode ? 'Disable Focus Mode' : 'Enable Focus Mode',
        subtitle: 'Hide or restore context panels on Overview',
        keywords: 'focus mode simplify hide panels',
        section: 'Desktop',
        perform: () => setFocusMode(!focusMode),
      },
    ],
    [
      desktopActions.onOpenImport,
      desktopActions.onOpenHistory,
      focusMode,
      onOpenSettings,
      setFocusMode,
    ],
  );

  // Keeps the tray label fresh and fires budget-cross toasts. No-op in
  // web mode (bridge absent) and idempotent — the hook diffs the
  // payload internally before crossing the IPC boundary.
  useBudgetReporter({ summary });
  useExtraPaletteActions(desktopPaletteActions);

  // Navigation shortcuts: g + first letter of the section. Mirrors
  // Vim / Gmail muscle memory. `?` is wired in KeyboardCheatsheet,
  // Cmd/Ctrl+K stays owned by the command palette.
  useNavigationShortcuts(navigate);
  // Cmd/Ctrl+, opens Settings — convention shared with VS Code / Cursor.
  const t = useT();
  useShortcut(
    {
      id: 'open-settings',
      combo: { mod: true, key: ',' },
      description: t('settings.title'),
      group: 'global',
      handler: () => onOpenSettings(),
    },
    [onOpenSettings, t],
  );

  return (
    <div className="flex gap-5">
      <KeyboardCheatsheet />
      <SideNav
        current={route}
        onNavigate={navigate}
        onPrefetch={prefetchRoute}
        routeLayout={navLayout}
      />

      <div className="flex min-w-0 flex-1 flex-col gap-5">
        <FileToolbar
          fileName={fileName}
          sourceFiles={sourceFiles}
          rowsSeen={rowsSeen}
          failures={failures}
          elapsedMs={elapsedMs}
          lastIngestedAt={lastIngestedAt}
          summary={summary}
          rows={rows}
          desktopActions={desktopActions}
          onOpenSettings={onOpenSettings}
        />

        <Suspense fallback={<RouteLoadingSkeleton />}>
          {/* No key={route} — the conditionals below already unmount the old
              page; keying the wrapper only forced an extra DOM teardown. */}
          <div>
            {route === 'overview' ? <OverviewPage summary={summary} rows={rows} /> : null}
            {route === 'year' ? <YearReviewPage rows={rows} /> : null}
            {route === 'anomalies' ? <AnomaliesPage summary={summary} rows={rows} /> : null}
            {route === 'models' ? <ModelsPage summary={summary} rows={rows} /> : null}
            {route === 'details' ? (
              <DetailsPage summary={summary} rows={rows} onJumpToDay={() => navigate('day')} />
            ) : null}
            {route === 'day' ? <DayPage summary={summary} rows={rows} /> : null}
          </div>
        </Suspense>
      </div>
    </div>
  );
}

/**
 * Registers six "g + letter" combos as global shortcuts so power users
 * can flick between routes without the mouse. Letters are chosen to
 * disambiguate (o = overview, y = year, a = anomalies, m = models,
 * d = details, h = day audit — `d` is taken). `g` as a prefix matches
 * Vim / Gmail muscle memory but here we just bind the second key
 * directly because a true sequence handler would need a small state
 * machine — out of scope.
 */
function useNavigationShortcuts(navigate: (r: AppRoute) => void) {
  const t = useT();
  const mappings: Array<{ key: string; route: AppRoute; description: string }> = [
    { key: 'o', route: 'overview', description: t('nav.overview') },
    { key: 'y', route: 'year', description: t('nav.year') },
    { key: 'a', route: 'anomalies', description: t('nav.anomalies') },
    { key: 'm', route: 'models', description: t('nav.models') },
    { key: 'r', route: 'details', description: t('nav.details') },
    { key: 'h', route: 'day', description: t('nav.day') },
  ];
  for (const m of mappings) {
    // The mappings array is a stable module-level constant, so this
    // loop registers a fixed set of shortcuts on every render — the
    // hook order is deterministic even though it's wrapped in a
    // `for` loop.
    useShortcut(
      {
        id: `nav-${m.route}`,
        combo: { key: m.key },
        description: m.description,
        group: 'navigation',
        handler: () => navigate(m.route),
      },
      [navigate],
    );
  }
}

function RouteLoadingSkeleton() {
  return (
    <div
      className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
      role="status"
      aria-live="polite"
      aria-label="Loading dashboard route"
    >
      <div className="cu-shimmer h-3 w-32 rounded-full" />
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <div className="cu-shimmer h-24 rounded-[12px]" />
        <div className="cu-shimmer h-24 rounded-[12px]" style={{ animationDelay: '120ms' }} />
        <div className="cu-shimmer h-24 rounded-[12px]" style={{ animationDelay: '240ms' }} />
      </div>
    </div>
  );
}
