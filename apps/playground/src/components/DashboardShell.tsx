import type { RowWithCost, UsageSummary } from '@cu/data';
import { useState } from 'react';
import { useBudgetReporter } from '../hooks/useBudgetReporter';
import { useRoute } from '../router/useRoute';
import { AnomaliesPage } from './AnomaliesPage';
import { DetailsPage } from './DetailsPage';
import { type DesktopActions, FileToolbar } from './FileToolbar';
import { DayPage } from './HoursPage';
import { ModelsPage } from './ModelsPage';
import { OverviewPage } from './OverviewPage';
import { SideNav } from './SideNav';
import { YearReviewPage } from './YearReviewPage';

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
}: DashboardShellProps) {
  const { route, navigate } = useRoute('overview');
  const [navExpanded, setNavExpanded] = useState(false);

  // Keeps the tray label fresh and fires budget-cross toasts. No-op in
  // web mode (bridge absent) and idempotent — the hook diffs the
  // payload internally before crossing the IPC boundary.
  useBudgetReporter({ summary });

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

        <div key={route}>
          {route === 'overview' ? <OverviewPage summary={summary} rows={rows} /> : null}
          {route === 'year' ? <YearReviewPage rows={rows} /> : null}
          {route === 'anomalies' ? <AnomaliesPage summary={summary} rows={rows} /> : null}
          {route === 'models' ? <ModelsPage summary={summary} rows={rows} /> : null}
          {route === 'details' ? <DetailsPage summary={summary} rows={rows} /> : null}
          {route === 'day' ? <DayPage summary={summary} rows={rows} /> : null}
        </div>
      </div>
    </div>
  );
}
