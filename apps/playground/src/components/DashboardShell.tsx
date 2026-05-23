import type { RowWithCost, UsageSummary } from '@cu/data';
import { Suspense, lazy, useMemo, useState } from 'react';
import { useBudgetReporter } from '../hooks/useBudgetReporter';
import { useFocusMode } from '../hooks/useFocusMode';
import { useRoute } from '../router/useRoute';
import { useExtraPaletteActions } from './CommandPalette';
import { type DesktopActions, FileToolbar } from './FileToolbar';
import { OverviewPage } from './OverviewPage';
import { SideNav } from './SideNav';

const YearReviewPage = lazy(() =>
  import('./YearReviewPage').then((mod) => ({ default: mod.YearReviewPage })),
);
const AnomaliesPage = lazy(() =>
  import('./AnomaliesPage').then((mod) => ({ default: mod.AnomaliesPage })),
);
const ModelsPage = lazy(() => import('./ModelsPage').then((mod) => ({ default: mod.ModelsPage })));
const DetailsPage = lazy(() =>
  import('./DetailsPage').then((mod) => ({ default: mod.DetailsPage })),
);
const DayPage = lazy(() => import('./HoursPage').then((mod) => ({ default: mod.DayPage })));

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
 */
export function DashboardShell({
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
  const [navExpanded, setNavExpanded] = useState(false);
  const [focusMode, setFocusMode] = useFocusMode();
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

  return (
    <div className="flex gap-5">
      <SideNav
        current={route}
        onNavigate={navigate}
        expanded={navExpanded}
        onSetExpanded={setNavExpanded}
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
        />

        <Suspense fallback={<RouteLoadingSkeleton />}>
          <div key={route}>
            {route === 'overview' ? <OverviewPage summary={summary} rows={rows} /> : null}
            {route === 'year' ? <YearReviewPage rows={rows} /> : null}
            {route === 'anomalies' ? <AnomaliesPage summary={summary} rows={rows} /> : null}
            {route === 'models' ? <ModelsPage summary={summary} rows={rows} /> : null}
            {route === 'details' ? <DetailsPage summary={summary} rows={rows} /> : null}
            {route === 'day' ? <DayPage summary={summary} rows={rows} /> : null}
          </div>
        </Suspense>
      </div>
    </div>
  );
}

function RouteLoadingSkeleton() {
  return (
    <div
      className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
      role="status"
      aria-live="polite"
      aria-label="Loading dashboard route"
    >
      <div className="h-3 w-32 animate-pulse rounded-full bg-[var(--color-border)]" />
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <div className="h-24 animate-pulse rounded-[12px] bg-[var(--color-border)]/70" />
        <div className="h-24 animate-pulse rounded-[12px] bg-[var(--color-border)]/60" />
        <div className="h-24 animate-pulse rounded-[12px] bg-[var(--color-border)]/50" />
      </div>
    </div>
  );
}
