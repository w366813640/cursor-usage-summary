import type { RowWithCost, UsageSummary } from '@cu/data';
import { AnimatePresence, motion } from 'framer-motion';
import type { IngestDiff } from '../hooks/useCsvIngest';
import { useRoute } from '../router/useRoute';
import { DetailsPage } from './DetailsPage';
import { FileToolbar } from './FileToolbar';
import { HoursPage } from './HoursPage';
import { IngestDiffBanner } from './IngestDiffBanner';
import { ModelsPage } from './ModelsPage';
import { NavTabs } from './NavTabs';
import { OverviewPage } from './OverviewPage';

interface DashboardShellProps {
  summary: UsageSummary;
  rows: ReadonlyArray<RowWithCost>;
  fileName: string;
  sourceFiles: ReadonlyArray<string>;
  rowsSeen: number;
  failures: number;
  elapsedMs: number;
  lastIngestedAt: number;
  diff: IngestDiff | null;
  onReupload: () => void;
  onMergeAnother: () => void;
  onClearStorage: () => void | Promise<void>;
}

/**
 * Post-upload application shell:
 *
 *   ┌──────────────────────────────────────────────┐
 *   │   FileToolbar — what data you're looking at  │
 *   │   NavTabs — Overview · Models · Details · Hours
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
  diff,
  onReupload,
  onMergeAnother,
  onClearStorage,
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
        onReupload={onReupload}
        onMergeAnother={onMergeAnother}
        onClearStorage={onClearStorage}
      />

      <IngestDiffBanner diff={diff} />

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
          {route === 'models' ? <ModelsPage summary={summary} rows={rows} /> : null}
          {route === 'details' ? <DetailsPage summary={summary} rows={rows} /> : null}
          {route === 'hours' ? <HoursPage summary={summary} rows={rows} /> : null}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
