import type { RowWithCost, UsageSummary } from '@cu/data';
import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { useFocusMode } from '../hooks/useFocusMode';
import { useSettings } from '../hooks/useSettings';
import { CompareRangesPanel } from './CompareRangesPanel';
import { ForecastPanel } from './ForecastPanel';
import { MonthlyBudgetPanel } from './MonthlyBudgetPanel';
import { ActionFeed } from './overview/ActionFeed';
import { BudgetUrgencyBanner } from './overview/BudgetUrgencyBanner';
import { EfficiencyCard } from './overview/EfficiencyCard';
import { GoalProgressPanel } from './overview/GoalProgressPanel';
import { OverviewActivity } from './overview/OverviewActivity';
import { OverviewBurns } from './overview/OverviewBurns';
import { OverviewKpiHero } from './overview/OverviewKpiHero';
import { ScenarioPlannerPanel } from './overview/ScenarioPlannerPanel';
import { WeekSummaryCard } from './overview/WeekSummaryCard';

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

  // Focus mode hides context panels and keeps only the high-signal acts:
  // week summary, KPI hero, and efficiency. The user toggles it from the
  // FileToolbar; localStorage-persisted (see useFocusMode).
  const [focusMode] = useFocusMode();

  return (
    <div className="flex flex-col gap-8">
      {/* Budget urgency banner (PR6) — auto-hides for safe months and
          when the user dismisses; sits above everything because urgency
          should win the first eye-second on the page. */}
      <BudgetUrgencyBanner summary={summary} rows={rows} />

      <WeekSummaryCard summary={summary} rows={rows} />

      <ActionFeed summary={summary} rows={rows} />

      <GoalProgressPanel summary={summary} settings={settings} />

      <OverviewKpiHero summary={summary} rows={rows} daysSpan={daysSpan} />

      {/* Efficiency (PR3) — placed early in focus mode so the "where can
          I cut" surface stays visible even when context panels collapse. */}
      <EfficiencyCard summary={summary} rows={rows} />

      {focusMode ? null : (
        <>
          {/* Plan budget — sits between hero and system view because it's the
              single most actionable "are you about to overspend?" question. */}
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.42, delay: 0.1, ease: [0.2, 0, 0, 1] }}
          >
            <MonthlyBudgetPanel summary={summary} planCap={settings.monthlyRequestBudget} />
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.42, delay: 0.14, ease: [0.2, 0, 0, 1] }}
          >
            <CompareRangesPanel rows={rows} />
          </motion.section>

          {/* Forecast (PR24) — sits right after Compare Ranges because once
              you've seen the "how am I doing today vs the last 30 days"
              comparison, the next instinct is "where am I heading?". */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.42, delay: 0.16, ease: [0.2, 0, 0, 1] }}
          >
            <ForecastPanel rows={rows} />
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.42, delay: 0.18, ease: [0.2, 0, 0, 1] }}
          >
            <ScenarioPlannerPanel
              summary={summary}
              rows={rows}
              monthlyRequestBudget={settings.monthlyRequestBudget}
            />
          </motion.section>

          <OverviewActivity summary={summary} rows={rows} daysSpan={daysSpan} />
          <OverviewBurns summary={summary} rows={rows} daysSpan={daysSpan} />
        </>
      )}
    </div>
  );
}
