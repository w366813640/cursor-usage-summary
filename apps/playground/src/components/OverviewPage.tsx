import {
  BurnStoryCard,
  Heatmap,
  KpiCard,
  SmallMultiples,
  StatGrid,
  Treemap,
  WeekHourHeatmap,
  daysToHeatmap,
  daysToSparkline,
  fmtTokens,
  fmtUSD,
  fmtUSDCompact,
  hourWeekdayToCells,
  modelsToSmallMultiples,
  modelsToTreemap,
  providersToStackSegments,
  tokensToStackSegments,
} from '@cu/charts';
import type { RowWithCost, UsageSummary } from '@cu/data';
import {
  calcCacheSavings,
  formatSonnetEquivalence,
  medianSonnetCost,
  ratioOver,
} from '@cu/pricing';
import { motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { MonthlyBudgetPanel } from './MonthlyBudgetPanel';
import { MetricToggle, Panel } from './Panel';
import { SectionHeader } from './SectionHeader';

export interface OverviewPageProps {
  summary: UsageSummary;
  rows: ReadonlyArray<RowWithCost>;
}

/**
 * Post-upload main surface. Three "acts":
 *
 *  Act 1 · KPI hero — three serif headline numbers with sparkline / context.
 *  Act 2 · System view — activity, decomposition, model share.
 *  Act 3 · Burn stories — Top 5 cost outliers told as cards with copy.
 *
 * The file toolbar lives in `<DashboardShell>` so it persists across routes;
 * this page is just the Overview content.
 */
export function OverviewPage({ summary, rows }: OverviewPageProps) {
  const [heatMetric, setHeatMetric] = useState<'cost' | 'requests'>('cost');

  const daysSpan = useMemo(() => {
    if (!summary.dateRange.firstISO || !summary.dateRange.lastISO) return summary.byDay.length;
    const first = new Date(summary.dateRange.firstISO).getTime();
    const last = new Date(summary.dateRange.lastISO).getTime();
    return Math.max(1, Math.round((last - first) / (24 * 60 * 60 * 1000)) + 1);
  }, [summary.dateRange.firstISO, summary.dateRange.lastISO, summary.byDay.length]);

  const calendar = useMemo(() => daysToHeatmap(summary, heatMetric), [summary, heatMetric]);
  const weekHour = useMemo(() => hourWeekdayToCells(summary, 'cost'), [summary]);
  const totalSpark = useMemo(() => daysToSparkline(summary, 'cost'), [summary]);
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

  // Top 5 burns + Sonnet equivalence baseline (median Sonnet call cost).
  const top5 = useMemo(() => summary.topBurns.slice(0, 5), [summary.topBurns]);
  const sonnetBaseline = useMemo(() => medianSonnetCost(rows), [rows]);
  const topModel = summary.byModel[0];
  const hottest = summary.topBurns[0];

  // Hottest day, used as a quote in the burns intro.
  const hottestDay = useMemo(() => {
    const max = summary.byDay.reduce(
      (acc, d) => (d.cost > acc.cost ? d : acc),
      summary.byDay[0] ??
        ({ date: '', cost: 0, rows: 0, requestUnits: 0 } as (typeof summary.byDay)[0]),
    );
    return max;
  }, [summary.byDay]);

  // Two projections — keep both so we can show "actual past 30d" vs "if you
  // keep going at that pace for 30 more days". When the dataset is < 30 days
  // we fall back to the lifetime average so the number is still meaningful.
  const { past30dCost, past30dDailyAvg, monthlyProjection } = useMemo(() => {
    const days = summary.byDay;
    if (days.length === 0) {
      return { past30dCost: 0, past30dDailyAvg: 0, monthlyProjection: 0 };
    }
    const window = days.slice(-30);
    const windowCost = window.reduce((acc, d) => acc + d.cost, 0);
    const avg = window.length > 0 ? windowCost / window.length : 0;
    return {
      past30dCost: windowCost,
      past30dDailyAvg: avg,
      monthlyProjection: avg * 30,
    };
  }, [summary.byDay]);

  // Cache reuse savings — replays each row's pricing entry to estimate how
  // much would've been billed if cache hits had been charged at the input
  // rate. Sparkline uses a per-day series so the same shape as totalSpark.
  const cacheSavings = useMemo(() => calcCacheSavings(rows), [rows]);
  const cacheSavingsSpark = useMemo(
    () => cacheSavings.byDay.map((d) => ({ date: d.date, value: d.savings })),
    [cacheSavings.byDay],
  );

  return (
    <div className="flex flex-col gap-8">
      {/* —— Act 1 · KPI hero —— */}
      <motion.section
        initial="initial"
        animate="enter"
        variants={{
          initial: {},
          enter: { transition: { staggerChildren: 0.08, delayChildren: 0.06 } },
        }}
        className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4"
      >
        <KpiCard
          label="Total cost · USD"
          value={fmtUSD(summary.totalCost)}
          numericValue={summary.totalCost}
          formatValue={fmtUSD}
          accent
          animate
          meta={
            <>
              <span>{daysSpan} days · </span>
              <span>{Math.round(summary.totalRequestUnits)} requests · </span>
              <span>{fmtTokens(summary.totalTokens.total)} tokens</span>
            </>
          }
          insetSlot={
            <div className="flex flex-col gap-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
              <div className="flex items-baseline justify-between">
                <span>past 30 days</span>
                <span className="text-[var(--color-text)]">{fmtUSD(past30dCost)}</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span>30d at current pace</span>
                <span style={{ color: 'var(--color-accent)' }}>{fmtUSD(monthlyProjection)}</span>
              </div>
            </div>
          }
          trend={totalSpark}
          trendReference={past30dDailyAvg}
          trendReferenceLabel={`avg ${fmtUSDCompact(past30dDailyAvg)}/d`}
        />
        <KpiCard
          label="Hottest single request"
          value={hottest ? fmtUSD(hottest.cost) : '—'}
          numericValue={hottest?.cost}
          formatValue={fmtUSD}
          animate={!!hottest}
          meta={
            hottest ? (
              <>
                <span className="text-[var(--color-text)]">{hottest.model}</span>
                <span className="px-1 text-[var(--color-text-subtle)]">·</span>
                <span>{hottest.dateISO.slice(0, 10)}</span>
                {hottest.maxMode ? (
                  <span className="pl-1 text-[var(--color-accent)]">· max mode</span>
                ) : null}
              </>
            ) : (
              'No billable requests yet'
            )
          }
          insetSlot={
            hottest ? (
              <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
                <span>tokens</span>
                <span className="text-[var(--color-text)]">{fmtTokens(hottest.tokens.total)}</span>
              </div>
            ) : null
          }
        />
        <KpiCard
          label="Top model by spend"
          value={topModel?.model ?? '—'}
          monoValue
          meta={
            topModel ? (
              <>
                <span className="text-[var(--color-text)]">{fmtUSD(topModel.cost)}</span>
                <span className="px-1 text-[var(--color-text-subtle)]">·</span>
                <span>{topModel.rows} rows</span>
                <span className="px-1 text-[var(--color-text-subtle)]">·</span>
                <span>{(topModel.shareOfCost * 100).toFixed(1)}% of total</span>
              </>
            ) : null
          }
          insetSlot={
            topModel ? (
              <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
                <span>avg per request</span>
                <span className="text-[var(--color-text)]">
                  {fmtUSDCompact(topModel.cost / Math.max(1, topModel.rows))}
                </span>
              </div>
            ) : null
          }
        />
        <KpiCard
          label="Cache reuse savings"
          value={fmtUSD(cacheSavings.savings)}
          numericValue={cacheSavings.savings}
          formatValue={fmtUSD}
          animate
          badge={
            <span
              className="rounded-sm border border-[var(--color-border)] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--color-text-subtle)]"
              title="cache-read tokens repriced at the model's normal input rate"
            >
              est.
            </span>
          }
          meta={
            <>
              <span className="text-[var(--color-text)]">
                hit ratio {(cacheSavings.hitRatio * 100).toFixed(1)}%
              </span>
              <span className="px-1 text-[var(--color-text-subtle)]">·</span>
              <span>{fmtTokens(cacheSavings.cacheReadTokens)} reused</span>
            </>
          }
          insetSlot={
            <div className="flex flex-col gap-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
              <div className="flex items-baseline justify-between">
                <span>if billed as fresh input</span>
                <span className="text-[var(--color-text)]">
                  {fmtUSD(cacheSavings.hypotheticalInputCost)}
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span>actual cache-read cost</span>
                <span className="text-[var(--color-text)]">
                  {fmtUSD(cacheSavings.actualCacheReadCost)}
                </span>
              </div>
            </div>
          }
          trend={cacheSavingsSpark}
        />
      </motion.section>

      {/* —— Plan budget — sits between hero and system view because it's the
           single most actionable "are you about to overspend?" question. —— */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.42, delay: 0.1, ease: [0.2, 0, 0, 1] }}
      >
        <MonthlyBudgetPanel summary={summary} />
      </motion.section>

      {/* —— Act 2 · System view —— */}
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
          <Panel title="Hour × Weekday" subtitle="UTC · cost density">
            <WeekHourHeatmap
              cells={weekHour}
              metricLabel="USD / slot"
              responsive
              minCellSize={9}
              maxCellSize={14}
            />
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

      {/* —— Act 3 · Burn stories —— */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.42, delay: 0.18 }}
        className="flex flex-col gap-4"
      >
        <SectionHeader
          title="Top 5 burns"
          subtitle={
            sonnetBaseline > 0
              ? `Each request ≈ N regular Sonnet calls · baseline ${fmtUSDCompact(sonnetBaseline)} / call (median Sonnet in this dataset)`
              : 'No Sonnet baseline in this dataset'
          }
        />
        {hottestDay.date ? (
          <p className="font-serif text-[15px] italic leading-snug text-[var(--color-text-muted)]">
            The hottest day was <span className="text-[var(--color-text)]">{hottestDay.date}</span>{' '}
            — burned <span className="text-[var(--color-accent)]">{fmtUSD(hottestDay.cost)}</span>{' '}
            across {hottestDay.rows} rows. Below are the five single requests that cost the most in
            the past {daysSpan} days — each one tells its own token-mix story.
          </p>
        ) : null}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {top5.map((r, idx) => {
            const ratio = ratioOver(r.cost, sonnetBaseline);
            const equivalence = formatSonnetEquivalence(ratio);
            const caption = burnCaption({ row: r });
            return (
              <BurnStoryCard
                key={`${r.dateISO}-${idx}`}
                rank={idx + 1}
                cost={r.cost}
                model={r.model}
                dateISO={r.dateISO}
                maxMode={r.maxMode}
                costEstimated={r.costEstimated}
                tokens={{
                  inputWithoutCacheWrite: r.tokens.inputWithoutCacheWrite,
                  inputWithCacheWrite: r.tokens.inputWithCacheWrite,
                  cacheRead: r.tokens.cacheRead,
                  output: r.tokens.output,
                }}
                equivalence={equivalence}
                caption={caption}
              />
            );
          })}
        </div>
      </motion.section>
    </div>
  );
}

interface BurnCaptionArgs {
  row: RowWithCost;
}

/**
 * One sentence of human-readable colour about the dominant token bucket — kept
 * deliberately separate from the Sonnet equivalence chip above so the caption
 * adds information instead of restating it.
 */
function burnCaption({ row }: BurnCaptionArgs): string | null {
  const t = row.tokens;
  const total = t.inputWithoutCacheWrite + t.inputWithCacheWrite + t.cacheRead + t.output;
  if (total === 0) return null;

  const shareCR = t.cacheRead / total;
  const shareCW = t.inputWithCacheWrite / total;
  const shareIn = t.inputWithoutCacheWrite / total;
  const shareOut = t.output / total;

  // The single biggest contributor drives the caption — that's the story.
  const entries: Array<[number, string]> = [
    [shareCR, `${(shareCR * 100).toFixed(0)}% in cache-read — long context replayed`],
    [shareCW, `${(shareCW * 100).toFixed(0)}% in cache-write — first feed of a large context`],
    [shareOut, `${(shareOut * 100).toFixed(0)}% as output — model wrote a lot`],
    [shareIn, `${(shareIn * 100).toFixed(0)}% as fresh input — billed at full rate`],
  ];
  entries.sort((a, b) => b[0] - a[0]);
  const winner = entries[0];
  if (!winner || winner[0] < 0.4) {
    return `${(total / 1_000_000).toFixed(1)}M tokens in one shot — well-balanced mix`;
  }
  return winner[1];
}
