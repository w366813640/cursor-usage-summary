import type { DetectAllResult, ForecastResult, RowWithCost, UsageSummary } from '@cu/data';
import { m } from 'framer-motion';
import { CompareRangesPanel } from '../CompareRangesPanel';
import { ForecastPanel } from '../ForecastPanel';
import { MonthlyBudgetPanel } from '../MonthlyBudgetPanel';
import { OverviewActivity } from './OverviewActivity';
import { OverviewBurns } from './OverviewBurns';
import { ScenarioPlannerPanel } from './ScenarioPlannerPanel';

export interface OverviewSecondaryPanelsProps {
  summary: UsageSummary;
  rows: ReadonlyArray<RowWithCost>;
  daysSpan: number;
  entrance: boolean;
  monthlyRequestBudget: number;
  forecast: ForecastResult;
  anomalies: DetectAllResult;
}

/**
 * The Overview's below-the-fold "context" panels: plan budget, range compare,
 * forecast, scenario planner, activity (Act 2) and burn stories (Act 3).
 *
 * These render only outside focus mode and sit beneath the KPI hero, so they
 * are split into their own chunk (lazy-loaded by `OverviewPage`) and kept off
 * the first-paint critical path. Their heavy chart/analysis code therefore
 * loads after the hero is interactive, and an idle prefetch in `OverviewPage`
 * keeps the scroll-in seamless.
 *
 * Entrance animations are preserved exactly as they were inline: the same
 * stagger delays, so a first Overview visit still cascades. `entrance` is
 * threaded as a prop (rather than read from context) because the boolean also
 * gates the `m.section` `initial` values here.
 */
export default function OverviewSecondaryPanels({
  summary,
  rows,
  daysSpan,
  entrance,
  monthlyRequestBudget,
  forecast,
  anomalies,
}: OverviewSecondaryPanelsProps) {
  return (
    <>
      {/* Plan budget — sits between hero and system view because it's the
          single most actionable "are you about to overspend?" question. */}
      <m.section
        initial={entrance ? { opacity: 0, y: 8 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.42, delay: 0.1, ease: [0.2, 0, 0, 1] }}
      >
        <MonthlyBudgetPanel summary={summary} planCap={monthlyRequestBudget} />
      </m.section>

      <m.section
        initial={entrance ? { opacity: 0, y: 12 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.42, delay: 0.14, ease: [0.2, 0, 0, 1] }}
      >
        <CompareRangesPanel rows={rows} />
      </m.section>

      {/* Forecast (PR24) — sits right after Compare Ranges because once
          you've seen the "how am I doing today vs the last 30 days"
          comparison, the next instinct is "where am I heading?". */}
      <m.section
        initial={entrance ? { opacity: 0, y: 12 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.42, delay: 0.16, ease: [0.2, 0, 0, 1] }}
      >
        <ForecastPanel forecast={forecast} />
      </m.section>

      <m.section
        initial={entrance ? { opacity: 0, y: 12 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.42, delay: 0.18, ease: [0.2, 0, 0, 1] }}
      >
        <ScenarioPlannerPanel
          summary={summary}
          rows={rows}
          monthlyRequestBudget={monthlyRequestBudget}
        />
      </m.section>

      <OverviewActivity summary={summary} rows={rows} daysSpan={daysSpan} anomalies={anomalies} />
      <OverviewBurns summary={summary} rows={rows} daysSpan={daysSpan} />
    </>
  );
}
