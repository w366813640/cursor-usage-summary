import {
  Heatmap,
  SmallMultiples,
  StatGrid,
  Treemap,
  WeekHourHeatmap,
  daysToHeatmap,
  fmtTokens,
  fmtUSD,
  hourWeekdayToCells,
  modelsToSmallMultiples,
  modelsToTreemap,
  providersToStackSegments,
  tokensToStackSegments,
} from '@cu/charts';
import type { RowWithCost, UsageSummary } from '@cu/data';
import { motion } from 'framer-motion';
import { type RefObject, useMemo, useRef, useState } from 'react';
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

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.42, delay: 0.12 }}
      className="flex flex-col gap-4"
    >
      <SectionHeader title="Activity rhythm" subtitle="When and how intensely" />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Panel
          title="Daily activity"
          subtitle={`${daysSpan} days · ${heatMetric === 'cost' ? 'USD' : 'request count'}`}
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
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel
          title="Token mix"
          subtitle={`${fmtTokens(summary.totalTokens.total)} tokens · cache hit ${(summary.cacheHitStats.hitRatio * 100).toFixed(1)}%`}
        >
          <StatGrid items={tokenStats} formatValue={fmtTokens} columns={2} />
        </Panel>
        <Panel
          title="Spend by provider"
          subtitle={`${fmtUSD(summary.totalCost)} · ${providerStats.length} providers`}
        >
          <StatGrid items={providerStats} formatValue={fmtUSD} columns={2} />
        </Panel>
      </div>

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
