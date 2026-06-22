import type { RowWithCost, UsageSummary } from '@cu/data';
import { Suspense, lazy, useMemo } from 'react';
import { EntranceContext, useEntranceOnce } from '../hooks/useEntranceOnce';
import { useFocusMode } from '../hooks/useFocusMode';
import { useOverviewInsights } from '../hooks/useOverviewInsights';
import { useSettings } from '../hooks/useSettings';
import { ActionFeed } from './overview/ActionFeed';
import { BudgetUrgencyBanner } from './overview/BudgetUrgencyBanner';
import { EfficiencyCard } from './overview/EfficiencyCard';
import { GoalProgressPanel } from './overview/GoalProgressPanel';
import { OverviewKpiHero } from './overview/OverviewKpiHero';
import { WeekSummaryCard } from './overview/WeekSummaryCard';

/**
 * Below-the-fold context panels (plan budget, compare ranges, forecast,
 * scenario planner, activity, burns) are split into their own chunk so their
 * chart/analysis code stays out of the initial dashboard bundle. They render
 * only outside focus mode, beneath the hero — see OverviewSecondaryPanels.
 */
const OverviewSecondaryPanels = lazy(() => import('./overview/OverviewSecondaryPanels'));

export interface OverviewPageProps {
  summary: UsageSummary;
  rows: ReadonlyArray<RowWithCost>;
}

/**
 * Post-upload main surface. Three "acts" + two budget panels:
 *
 *  Act 1 · KPI hero        — <OverviewKpiHero>     four headline numbers
 *  Plan budget             — <MonthlyBudgetPanel>  500-request plan tracker
 *  Compare ranges          — <CompareRangesPanel>  last Nd vs prior Nd
 *  Act 2 · System view     — <OverviewActivity>    activity + composition
 *  Act 3 · Burn stories    — <OverviewBurns>       Top 5 cost outliers
 *
 * Each act lives in its own file under `./overview/` to keep this file
 * a pure layout shell — adding a new panel is now a one-line import,
 * and dense data computations stay local to whichever sub-component
 * actually uses them.
 *
 * The file toolbar lives in `<DashboardShell>` so it persists across routes;
 * this page is just the Overview content.
 */
export function OverviewPage({ summary, rows }: OverviewPageProps) {
  const daysSpan = useMemo(() => {
    if (!summary.dateRange.firstISO || !summary.dateRange.lastISO) return summary.byDay.length;
    const first = new Date(summary.dateRange.firstISO).getTime();
    const last = new Date(summary.dateRange.lastISO).getTime();
    return Math.max(1, Math.round((last - first) / (24 * 60 * 60 * 1000)) + 1);
  }, [summary.dateRange.firstISO, summary.dateRange.lastISO, summary.byDay.length]);

  // Pull the user's plan cap from settings (PR22). The MonthlyBudgetPanel
  // still defaults to 500 internally, so a slow IPC load just yields the
  // historical baseline for one frame before the real value lands.
  const { settings } = useSettings();

  // Every heavy analysis (anomalies, efficiency, week narrative, forecast,
  // action feed) is computed exactly once here and handed down as props —
  // see useOverviewInsights for the dedupe + cross-route cache rationale.
  const insights = useOverviewInsights(summary, rows, settings.monthlyRequestBudget);

  // Focus mode hides context panels and keeps only the high-signal acts:
  // week summary, KPI hero, and efficiency. The user toggles it from the
  // FileToolbar; localStorage-persisted (see useFocusMode).
  const [focusMode] = useFocusMode();

  // Entrance animations play on the first Overview visit per session only;
  // revisits render everything settled (perf plan 1.4 — route switches
  // remount the page, and replaying the full stagger cascade every time
  // both costs frames and reads as a reload).
  const entrance = useEntranceOnce('overview');

  return (
    <EntranceContext.Provider value={entrance}>
      <div
        className={`flex flex-col${entrance ? '' : ' cu-charts-no-anim'}`}
        style={{ gap: 'var(--cu-density-section-gap)' }}
      >
        {/* Budget urgency banner (PR6) — auto-hides for safe months and
            when the user dismisses; sits above everything because urgency
            should win the first eye-second on the page. */}
        <BudgetUrgencyBanner summary={summary} rows={rows} />

        <WeekSummaryCard summary={summary} week={insights.week} />

        <ActionFeed insights={insights.actionInsights} />

        <GoalProgressPanel summary={summary} settings={settings} />

        <OverviewKpiHero summary={summary} rows={rows} daysSpan={daysSpan} />

        {/* Efficiency (PR3) — placed early in focus mode so the "where can
            I cut" surface stays visible even when context panels collapse. */}
        <EfficiencyCard report={insights.efficiency} />

        {focusMode ? null : (
          <Suspense fallback={<SecondaryPanelsSkeleton />}>
            <OverviewSecondaryPanels
              summary={summary}
              rows={rows}
              daysSpan={daysSpan}
              entrance={entrance}
              monthlyRequestBudget={settings.monthlyRequestBudget}
              forecast={insights.forecast}
              anomalies={insights.anomalies}
            />
          </Suspense>
        )}
      </div>
    </EntranceContext.Provider>
  );
}

/**
 * Placeholder while the below-the-fold panel chunk streams in. Reserves a
 * little vertical space (the panels sit under the hero, so this is rarely in
 * view) and matches the route skeleton's shimmer language for continuity.
 */
function SecondaryPanelsSkeleton() {
  return (
    <div
      className="flex flex-col"
      style={{ gap: 'var(--cu-density-section-gap)' }}
      role="status"
      aria-live="polite"
      aria-label="Loading overview panels"
    >
      <div className="cu-shimmer h-40 rounded-[14px]" />
      <div className="cu-shimmer h-40 rounded-[14px]" style={{ animationDelay: '120ms' }} />
    </div>
  );
}
