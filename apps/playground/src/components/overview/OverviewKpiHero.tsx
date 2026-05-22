import { KpiCard, daysToSparkline, fmtTokens, fmtUSD, fmtUSDCompact } from '@cu/charts';
import type { RowWithCost, UsageSummary } from '@cu/data';
import { calcCacheSavings } from '@cu/pricing';
import { motion } from 'framer-motion';
import { useMemo } from 'react';

interface OverviewKpiHeroProps {
  summary: UsageSummary;
  rows: ReadonlyArray<RowWithCost>;
  daysSpan: number;
}

/**
 * Act 1 of the Overview — four headline KPI cards in a responsive grid:
 *
 *   1. Total cost · USD     — hero card with a 30-day sparkline + projection
 *   2. Hottest single req   — the most expensive row in the dataset
 *   3. Top model by spend   — model name + share / avg-per-request
 *   4. Cache reuse savings  — what cache hits saved you vs fresh input
 *
 * Each card uses the existing <KpiCard> with `animate` so the numbers
 * count up on mount. The first card grows a sparkline trend so the eye
 * lands on the headline number first, then the shape of the spend curve.
 */
export function OverviewKpiHero({ summary, rows, daysSpan }: OverviewKpiHeroProps) {
  const totalSpark = useMemo(() => daysToSparkline(summary, 'cost'), [summary]);

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

  const topModel = summary.byModel[0];
  const hottest = summary.topBurns[0];

  return (
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
        copyable
        copyText={fmtUSD(summary.totalCost)}
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
        copyable={!!hottest}
        copyText={hottest ? fmtUSD(hottest.cost) : undefined}
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
        copyable={!!topModel}
        copyText={topModel?.model}
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
        copyable
        copyText={fmtUSD(cacheSavings.savings)}
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
              <span>tokens reused</span>
              <span className="text-[var(--color-text)]">
                {fmtTokens(cacheSavings.cacheReadTokens)}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span>≈ free compute multiple</span>
              <span style={{ color: 'var(--color-accent)' }}>
                {summary.totalCost > 0
                  ? `${(cacheSavings.savings / Math.max(0.0001, summary.totalCost)).toFixed(1)}× spend`
                  : '—'}
              </span>
            </div>
          </div>
        }
        trend={cacheSavingsSpark}
      />
    </motion.section>
  );
}
