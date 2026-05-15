import type { RowWithCost, UsageSummary } from '@cu/data';
import { AnimatePresence, motion } from 'framer-motion';
import { useRoute } from '../router/useRoute';
import { DetailsPage } from './DetailsPage';
import { type DesktopActions, FileToolbar } from './FileToolbar';
import { HoursPage } from './HoursPage';
import { ModelsPage } from './ModelsPage';
import { NavTabs } from './NavTabs';
import { OverviewPage } from './OverviewPage';
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
 * Routing is hash-based (no react-router dep). Page switches use a cross-fade
 * via `AnimatePresence`, so the user always knows the route changed.
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

  return (
    <div className="flex flex-col gap-5">
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

      <NavTabs current={route} onNavigate={navigate} />

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={route}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.24, ease: [0.2, 0, 0, 1] }}
        >
          {route === 'overview' ? <OverviewPage summary={summary} rows={rows} /> : null}
          {route === 'year' ? <YearReviewPage rows={rows} /> : null}
          {route === 'models' ? <ModelsPage summary={summary} rows={rows} /> : null}
          {route === 'details' ? <DetailsPage summary={summary} rows={rows} /> : null}
          {route === 'hours' ? <HoursPage summary={summary} rows={rows} /> : null}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
