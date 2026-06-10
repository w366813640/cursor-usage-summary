import {
  Heatmap,
  SmallMultiples,
  StackedAreaChart,
  StatGrid,
  Treemap,
  WeekHourHeatmap,
  daysToHeatmap,
  fmtTokens,
  fmtUSD,
  fmtUSDCompact,
  hourWeekdayToCells,
  modelsToSmallMultiples,
  modelsToTreemap,
  providersToStackSegments,
  rowsToDailyStack,
  tokensToStackSegments,
} from '@cu/charts';
import { type RowWithCost, type UsageSummary, detectAllAnomalies } from '@cu/data';
import { motion } from 'framer-motion';
import { type RefObject, useCallback, useMemo, useRef, useState } from 'react';
import { ExportButton } from '../../export/ExportButton';
import { MetricToggle, Panel } from '../Panel';
import { SectionHeader } from '../SectionHeader';

interface OverviewActivityProps {
  summary: UsageSummary;
  rows: ReadonlyArray<RowWithCost>;
  daysSpan: number;
}

/**
 * Act 2 of the Overview — the "system view": activity rhythm + composition.
 *
 *  Activity rhythm
 *    · Daily activity heatmap with a cost/requests toggle
 *    · Hour × Weekday heatmap (UTC, responsive)
 *
 *  Composition
 *    · Token mix StatGrid
 *    · Spend by provider StatGrid
 *    · Spend by model Treemap (slices < 1% rolled into "Other")
 *    · Top 8 models · daily cost SmallMultiples
 *
 * Section is wrapped in a motion.section that fades in with a small delay
 * so the KPI hero settles first; charts then "appear" with a soft pop.
 */
export function OverviewActivity({ summary, rows, daysSpan }: OverviewActivityProps) {
  const [heatMetric, setHeatMetric] = useState<'cost' | 'requests'>('cost');
  // Ref passed to ExportButton so the chosen section can be captured as a
  // PNG without us having to thread DOM IDs through every component.
  const weekHourRef = useRef<HTMLDivElement>(null);

  // Hero stacked-area: per-day cost split across the top-5 models.
  const dailyStack = useMemo(() => rowsToDailyStack(rows, 5), [rows]);
  const [hiddenSeries, setHiddenSeries] = useState<ReadonlySet<string>>(new Set());
  const toggleSeries = useCallback((id: string) => {
    setHiddenSeries((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const drillToDay = useCallback((date: string) => {
    try {
      sessionStorage.setItem('cu:pendingDayDate', date);
    } catch {
      // private-mode sandboxes — the route change still happens
    }
    window.location.hash = '/day';
  }, []);

  const calendar = useMemo(() => daysToHeatmap(summary, heatMetric), [summary, heatMetric]);
  const weekHour = useMemo(() => hourWeekdayToCells(summary, 'cost'), [summary]);
  const tokenStats = useMemo(() => tokensToStackSegments(summary), [summary]);
  const providerStats = useMemo(
    () =>
      providersToStackSegments(summary).map((s) => ({
        id: s.id,
        label: s.label,
        value: s.value,
        color: s.color,
        sub: `${summary.byProvider.find((p) => p.provider === s.label)?.rows ?? 0} rows`,
      })),
    [summary],
  );
  const treemap = useMemo(
    () => modelsToTreemap(summary.byModel, { otherThresholdPct: 0.01 }),
    [summary.byModel],
  );
  const multiples = useMemo(
    () =>
      modelsToSmallMultiples(
        rows.map((r) => ({ date: r.date, model: r.model, cost: r.cost })),
        summary.byModel,
        8,
      ),
    [rows, summary.byModel],
  );
  // Highlight anomaly days on the calendar with an accent outline ring so
  // the eye can find the days the Anomaly inspector flagged without
  // leaving Overview. The Set is small (typically <10 entries) so memo
  // is cheap; re-computed alongside the existing calendar memos.
  const anomalyDates = useMemo(() => {
    const r = detectAllAnomalies(summary, rows);
    return new Set(r.all.map((a) => a.date));
  }, [summary, rows]);

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.42, delay: 0.12 }}
      className="flex flex-col gap-4"
    >
      <SectionHeader title="Activity rhythm" subtitle="When and how intensely" />
      <Panel
        title="Daily cost · by model"
        subtitle={`${daysSpan} days · top 5 models stacked · hover to inspect · click to drill`}
      >
        <StackedAreaChart
          dates={dailyStack.dates}
          series={dailyStack.series}
          height={264}
          formatValue={fmtUSDCompact}
          hiddenIds={hiddenSeries}
          onToggleSeries={toggleSeries}
          onSelectDate={drillToDay}
          ariaLabel="Daily cost stacked by model"
        />
      </Panel>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Panel
          title="Daily activity"
          subtitle={`${daysSpan} days · ${heatMetric === 'cost' ? 'USD' : 'request count'} · click a day to drill${anomalyDates.size > 0 ? ` · ${anomalyDates.size} flagged` : ''}`}
          action={
            <MetricToggle
              value={heatMetric}
              options={['cost', 'requests']}
              onChange={setHeatMetric}
            />
          }
        >
          <div className="overflow-x-auto">
            <Heatmap
              data={calendar}
              outlierDates={anomalyDates}
              renderTooltip={(d) =>
                d ? (
                  <>
                    <span className="text-[var(--color-accent)]">{d.date}</span>
                    <span className="px-1 text-[var(--color-text-subtle)]">·</span>
                    <span>
                      {heatMetric === 'cost' ? fmtUSD(d.value) : `${d.value.toFixed(0)} reqs`}
                    </span>
                    {d.meta ? (
                      <>
                        <span className="px-1 text-[var(--color-text-subtle)]">·</span>
                        <span>{d.meta}</span>
                      </>
                    ) : null}
                  </>
                ) : null
              }
              onSelectDate={(date) => {
                // Hand off to DayPage via session storage — keeps the
                // tiny hash-only router untouched. DayPage reads and
                // clears the key on mount.
                try {
                  sessionStorage.setItem('cu:pendingDayDate', date);
                } catch {
                  // sessionStorage can throw in private-mode sandboxes;
                  // failing silently still lets the route change happen.
                }
                window.location.hash = '/day';
              }}
            />
          </div>
        </Panel>
        <Panel
          title="Hour × Weekday"
          subtitle="UTC · cost density"
          action={
            <ExportButton
              targetRef={weekHourRef as RefObject<HTMLDivElement>}
              fileBase="cursor-usage-heatmap"
            />
          }
        >
          <div ref={weekHourRef} className="bg-[var(--color-surface)]">
            <WeekHourHeatmap
              cells={weekHour}
              metricLabel="USD / slot"
              responsive
              minCellSize={9}
              maxCellSize={14}
            />
          </div>
        </Panel>
      </div>

      <SectionHeader title="Composition" subtitle="What kinds of tokens · which providers" />
      <Panel
        title="Token & provider mix"
        subtitle={`${fmtTokens(summary.totalTokens.total)} tokens · ${fmtUSD(summary.totalCost)} across ${providerStats.length} providers · cache hit ${(summary.cacheHitStats.hitRatio * 100).toFixed(1)}%`}
      >
        <div className="grid grid-cols-1 gap-x-6 gap-y-4 lg:grid-cols-2">
          <div className="flex flex-col gap-2">
            <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
              Token mix
            </div>
            <StatGrid items={tokenStats} formatValue={fmtTokens} columns={2} />
          </div>
          <div className="flex flex-col gap-2">
            <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
              Spend by provider
            </div>
            <StatGrid items={providerStats} formatValue={fmtUSD} columns={2} />
          </div>
        </div>
      </Panel>

      <Panel
        title="Spend by model"
        subtitle={`${summary.byModel.length} models · slices < 1% rolled into "Other"`}
      >
        <Treemap data={treemap} width={1200} height={340} />
      </Panel>

      <Panel title="Top 8 models · daily cost" subtitle="Shared y-axis · easy lateral comparison">
        <SmallMultiples items={multiples} columns={4} />
      </Panel>
    </motion.section>
  );
}
