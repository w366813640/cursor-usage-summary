import { Sparkline, fmtUSD } from '@cu/charts';
import type { UsageSummary } from '@cu/data';
import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { Panel } from './Panel';

interface MonthlyBudgetPanelProps {
  summary: UsageSummary;
  /**
   * Monthly request-units allowance for the user's plan. Defaults to 500 —
   * Cursor's "Pro" tier as of 2026. Pass a different value to model another
   * plan; the panel scales bars and KPIs against this number.
   */
  planCap?: number;
}

interface MonthlyBucket {
  /** YYYY-MM */
  ym: string;
  /** Human-friendly label, e.g. "May 2026". */
  label: string;
  rows: number;
  requestUnits: number;
  cost: number;
  /** True if the user's request quota was exceeded this month. */
  overCap: boolean;
  /** Days that have data this month — used for partial-month projection. */
  daysCovered: number;
  /** $/request units this month (0 when no billable requests). */
  costPerRequest: number;
}

/**
 * Per-month "did I bust my request budget?" panel.
 *
 *  - 4 KPI strip:    months tracked / avg requests / months over plan /
 *                    current-month progress (with simple linear projection).
 *  - Alert banner:   surfaces the "what should you actually do?" headline —
 *                    on-pace warning, over-cap alert, healthy-looking line.
 *  - Bar chart:      one bar per month vs `planCap`; cap line (dashed),
 *                    historical avg line (dotted, secondary tone).
 *  - Trend strip:    cost-per-request sparkline below the chart, so the
 *                    user can see if their per-request unit cost is drifting.
 *  - Per-bar tips:   rows, requests, cost, % of cap on hover.
 */
export function MonthlyBudgetPanel({ summary, planCap = 500 }: MonthlyBudgetPanelProps) {
  const monthly = useMemo<MonthlyBucket[]>(() => {
    const map = new Map<
      string,
      { rows: number; requestUnits: number; cost: number; daysCovered: number }
    >();
    for (const d of summary.byDay) {
      const ym = d.date.slice(0, 7);
      const prev = map.get(ym) ?? { rows: 0, requestUnits: 0, cost: 0, daysCovered: 0 };
      map.set(ym, {
        rows: prev.rows + d.rows,
        requestUnits: prev.requestUnits + d.requestUnits,
        cost: prev.cost + d.cost,
        daysCovered: prev.daysCovered + 1,
      });
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([ym, agg]) => ({
        ym,
        label: monthLabel(ym),
        rows: agg.rows,
        requestUnits: agg.requestUnits,
        cost: agg.cost,
        overCap: agg.requestUnits > planCap,
        daysCovered: agg.daysCovered,
        costPerRequest: agg.requestUnits > 0 ? agg.cost / agg.requestUnits : 0,
      }));
  }, [summary.byDay, planCap]);

  const stats = useMemo(
    () => computeStats(monthly, planCap, summary.dateRange.lastISO),
    [monthly, planCap, summary.dateRange.lastISO],
  );

  // Sparkline expects ISO date strings; map each month to its mid-day so the
  // x-axis spaces months evenly without us having to teach the chart about months.
  const cprTrend = useMemo(
    () => monthly.map((m) => ({ date: `${m.ym}-15`, value: m.costPerRequest })),
    [monthly],
  );

  if (monthly.length === 0) {
    return (
      <Panel title="Monthly request budget" subtitle={`${planCap}-request plan · no data yet`}>
        <div className="py-6 text-center font-mono text-[11px] text-[var(--color-text-subtle)]">
          Upload usage data to see how your months track against the plan.
        </div>
      </Panel>
    );
  }

  // Scale the bars against the larger of "biggest month" or "plan cap" so
  // both stay comparable visually. The cap line lands at `planCap / domainMax`.
  const domainMax = Math.max(planCap, ...monthly.map((m) => m.requestUnits)) * 1.06 || 1;
  const capPercent = (planCap / domainMax) * 100;
  const avgPercent = (stats.avgRequests / domainMax) * 100;
  const alert = computeAlert(stats, planCap, monthly);

  return (
    <Panel
      title="Monthly request budget"
      subtitle={`${planCap}-request / month plan · ${monthly.length} ${
        monthly.length === 1 ? 'month' : 'months'
      } tracked · avg ${Math.round(stats.avgRequests)} req/mo · CPR trend ${describeCprTrend(stats.cprDelta)}`}
    >
      {/* KPI strip */}
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <BudgetStat
          label="Average / month"
          value={`${Math.round(stats.avgRequests).toLocaleString()}`}
          meta={
            stats.avgRequests > 0
              ? `${pct(stats.avgRequests / planCap)} of cap · ${fmtUSD(stats.avgCost)} / mo`
              : 'no months yet'
          }
        />
        <BudgetStat
          label="Months over plan"
          value={`${stats.monthsOver} / ${monthly.length}`}
          meta={stats.monthsOver === 0 ? 'never exceeded' : `worst ${pct(stats.worstUtil)}`}
          tone={stats.monthsOver > 0 ? 'warn' : 'good'}
        />
        <BudgetStat
          label="Current month"
          value={`${Math.round(stats.currentRequests).toLocaleString()}`}
          meta={
            stats.currentMonth
              ? `${pct(stats.currentRequests / planCap)} of cap · day ${stats.dayOfMonth} / ${stats.daysInMonth}`
              : 'no current month data'
          }
          tone={
            stats.currentRequests > planCap
              ? 'over'
              : stats.currentRequests / planCap >= 0.8
                ? 'warn'
                : 'default'
          }
        />
        <BudgetStat
          label="Projected end of month"
          value={
            stats.projectedRequests ? Math.round(stats.projectedRequests).toLocaleString() : '—'
          }
          meta={
            stats.projectedRequests
              ? `${pct(stats.projectedRequests / planCap)} of cap · linear pace`
              : ''
          }
          tone={
            stats.projectedRequests && stats.projectedRequests > planCap
              ? 'over'
              : stats.projectedRequests && stats.projectedRequests / planCap >= 0.8
                ? 'warn'
                : 'default'
          }
        />
      </div>

      {/* Alert banner — surfaces the actionable headline ahead of the chart. */}
      <AlertStrip alert={alert} />

      {/* Bar chart with cap + avg reference lines */}
      <div className="relative h-[200px] rounded-md border border-[var(--color-border)]/60 bg-[var(--color-surface-muted)] p-3">
        {/* Avg line (dotted, secondary tone) — placed first so cap renders on top. */}
        {stats.avgRequests > 0 ? (
          <>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute right-3 left-3"
              style={{
                bottom: `calc(0.75rem + ${avgPercent}% * (100% - 1.5rem) / 100)`,
                borderTop:
                  '1px dotted color-mix(in oklab, var(--color-text-muted) 70%, transparent)',
              }}
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-3 font-mono text-[9px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]"
              style={{ bottom: `calc(0.75rem + ${avgPercent}% * (100% - 1.5rem) / 100 + 3px)` }}
            >
              avg · {Math.round(stats.avgRequests)}
            </div>
          </>
        ) : null}

        {/* Cap line (dashed, slightly stronger). */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-3 left-3 border-t border-dashed border-[var(--color-text-subtle)]/70"
          style={{ bottom: `calc(0.75rem + ${capPercent}% * (100% - 1.5rem) / 100)` }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-3 font-mono text-[9px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]"
          style={{ bottom: `calc(0.75rem + ${capPercent}% * (100% - 1.5rem) / 100 + 3px)` }}
        >
          cap · {planCap}
        </div>

        <div className="flex h-full items-end gap-[6px]">
          {monthly.map((m, i) => {
            const ratio = m.requestUnits / domainMax;
            const tone =
              m.requestUnits > planCap
                ? 'over'
                : m.requestUnits / planCap >= 0.8
                  ? 'warn'
                  : 'default';
            return (
              <div
                key={m.ym}
                className="group relative flex h-full flex-1 flex-col items-center justify-end"
                title={`${m.label} · ${m.requestUnits.toLocaleString()} requests (${pct(
                  m.requestUnits / planCap,
                )} of cap) · ${fmtUSD(m.cost)} · $${m.costPerRequest.toFixed(3)} / req`}
              >
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max(ratio * 100, 1)}%` }}
                  transition={{
                    duration: 0.6,
                    delay: 0.06 + i * 0.04,
                    ease: [0.2, 0, 0, 1],
                  }}
                  className="w-full rounded-t-sm"
                  style={{ background: barColor(tone), opacity: 0.92 }}
                />
                <span
                  className="pointer-events-none mt-1 truncate font-mono text-[9px] uppercase tracking-[0.06em] text-[var(--color-text-subtle)]"
                  style={{ maxWidth: '100%' }}
                >
                  {m.label.split(' ')[0]?.slice(0, 3)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cost-per-request trend sparkline — secondary insight strip. */}
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-2">
          <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
            <span>Cost / request · monthly</span>
            <span style={{ color: cprToneText(stats.cprDelta) }}>
              {describeCprTrend(stats.cprDelta)}{' '}
              {Number.isFinite(stats.cprDelta) && stats.cprDelta !== 0
                ? `(${stats.cprDelta > 0 ? '+' : ''}${(stats.cprDelta * 100).toFixed(0)} %)`
                : ''}
            </span>
          </div>
          <div className="mt-1 flex items-baseline gap-3">
            <span className="font-serif text-[18px] tracking-tight">
              {stats.currentMonth && stats.currentMonth.costPerRequest > 0
                ? `$${stats.currentMonth.costPerRequest.toFixed(3)}`
                : '—'}
            </span>
            <span className="font-mono text-[10px] text-[var(--color-text-muted)]">
              {stats.currentMonth ? `now · ${stats.currentMonth.label}` : 'no data'}
            </span>
            <span className="ml-auto inline-block" style={{ width: 160, height: 28 }}>
              {cprTrend.length >= 2 ? (
                <Sparkline data={cprTrend} width={160} height={28} fillArea />
              ) : null}
            </span>
          </div>
        </div>

        {/* Legend strip on the right (or stacked below on mobile). */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 self-center font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
          <span>
            <LegendDot tone="default" /> under cap
          </span>
          <span>
            <LegendDot tone="warn" /> 80–100 %
          </span>
          <span>
            <LegendDot tone="over" /> over cap
          </span>
        </div>
      </div>
    </Panel>
  );
}

interface BudgetAlert {
  tone: Tone;
  headline: string;
  detail: string;
}

function AlertStrip({ alert }: { alert: BudgetAlert | null }) {
  if (!alert) return null;
  return (
    <div
      className="mb-4 flex items-start gap-3 rounded-md border px-3 py-2"
      style={{
        borderColor: alertBorderColor(alert.tone),
        background: alertBackground(alert.tone),
      }}
    >
      <span
        aria-hidden="true"
        className="mt-[6px] inline-block h-[8px] w-[8px] flex-shrink-0 rounded-full"
        style={{ background: barColor(alert.tone) }}
      />
      <div className="flex flex-col">
        <span
          className="font-serif text-[14px] leading-tight"
          style={{ color: toneText(alert.tone) }}
        >
          {alert.headline}
        </span>
        <span className="mt-0.5 font-mono text-[10px] tracking-[0.04em] text-[var(--color-text-muted)]">
          {alert.detail}
        </span>
      </div>
    </div>
  );
}

type Tone = 'default' | 'warn' | 'over' | 'good';

function BudgetStat({
  label,
  value,
  meta,
  tone = 'default',
}: {
  label: string;
  value: string;
  meta?: string;
  tone?: Tone;
}) {
  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-3 transition-colors hover:border-[var(--color-border-strong)]">
      <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--color-text-subtle)]">
        {label}
      </div>
      <div
        className="mt-1 font-serif text-[22px] leading-tight tracking-tight"
        style={{ color: toneText(tone) }}
      >
        {value}
      </div>
      {meta ? (
        <div className="mt-0.5 font-mono text-[10px] tracking-[0.06em] text-[var(--color-text-muted)]">
          {meta}
        </div>
      ) : null}
    </div>
  );
}

function LegendDot({ tone }: { tone: Tone }) {
  return (
    <span
      aria-hidden="true"
      className="mr-1 inline-block h-2 w-2 rounded-full align-baseline"
      style={{ background: barColor(tone) }}
    />
  );
}

function barColor(tone: Tone): string {
  switch (tone) {
    case 'over':
      return 'var(--color-destructive, #c0533d)';
    case 'warn':
      return 'var(--color-warning, #d8a04a)';
    case 'good':
      return 'var(--cu-cat-1)';
    default:
      return 'var(--color-accent)';
  }
}

function toneText(tone: Tone): string {
  if (tone === 'over') return 'var(--color-destructive, #c0533d)';
  if (tone === 'warn') return 'var(--color-warning, #d8a04a)';
  return 'var(--color-text)';
}

function alertBorderColor(tone: Tone): string {
  if (tone === 'over')
    return 'color-mix(in oklab, var(--color-destructive) 55%, var(--color-border))';
  if (tone === 'warn') return 'color-mix(in oklab, var(--color-warning) 55%, var(--color-border))';
  if (tone === 'good') return 'color-mix(in oklab, var(--cu-cat-1) 50%, var(--color-border))';
  return 'color-mix(in oklab, var(--color-accent) 50%, var(--color-border))';
}

function alertBackground(tone: Tone): string {
  if (tone === 'over') return 'color-mix(in oklab, var(--color-destructive) 12%, transparent)';
  if (tone === 'warn') return 'color-mix(in oklab, var(--color-warning) 12%, transparent)';
  if (tone === 'good') return 'color-mix(in oklab, var(--cu-cat-1) 10%, transparent)';
  return 'color-mix(in oklab, var(--color-accent) 10%, transparent)';
}

function cprToneText(delta: number): string {
  if (!Number.isFinite(delta)) return 'var(--color-text-muted)';
  // Rising CPR is bad for the user (paying more per request), so flag red /
  // amber; falling CPR is good (better efficiency), flag green.
  if (delta > 0.12) return 'var(--color-destructive, #c0533d)';
  if (delta > 0.04) return 'var(--color-warning, #d8a04a)';
  if (delta < -0.04) return 'var(--cu-cat-1)';
  return 'var(--color-text-muted)';
}

function describeCprTrend(delta: number): string {
  if (!Number.isFinite(delta) || delta === 0) return 'flat';
  if (delta > 0.12) return 'rising sharply';
  if (delta > 0.04) return 'rising';
  if (delta < -0.12) return 'falling sharply';
  if (delta < -0.04) return 'falling';
  return 'flat';
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m) return ym;
  const date = new Date(Date.UTC(y, m - 1, 1));
  return date.toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function pct(ratio: number): string {
  if (!Number.isFinite(ratio)) return '—';
  return `${(ratio * 100).toFixed(0)} %`;
}

interface MonthlyStats {
  avgRequests: number;
  avgCost: number;
  monthsOver: number;
  /** Worst over-cap utilisation (e.g. 1.42 = 142% of cap). */
  worstUtil: number;
  /** Current month bucket if available. */
  currentMonth: MonthlyBucket | null;
  currentRequests: number;
  /** Linear projection: current pace × days-in-month. Null if not enough data. */
  projectedRequests: number | null;
  /** 1-based day-of-month based on data, used in copy. */
  dayOfMonth: number;
  daysInMonth: number;
  /**
   * Relative change in cost-per-request between (recent 3-month avg) and
   * (prior 3-month avg). Positive = paying more per request lately.
   * Returns 0 when there isn't enough data to compare.
   */
  cprDelta: number;
}

function computeStats(
  monthly: MonthlyBucket[],
  planCap: number,
  lastISO: string | null,
): MonthlyStats {
  if (monthly.length === 0) {
    return {
      avgRequests: 0,
      avgCost: 0,
      monthsOver: 0,
      worstUtil: 0,
      currentMonth: null,
      currentRequests: 0,
      projectedRequests: null,
      dayOfMonth: 0,
      daysInMonth: 0,
      cprDelta: 0,
    };
  }
  const totalRequests = monthly.reduce((acc, m) => acc + m.requestUnits, 0);
  const totalCost = monthly.reduce((acc, m) => acc + m.cost, 0);
  const avgRequests = totalRequests / monthly.length;
  const avgCost = totalCost / monthly.length;
  const monthsOver = monthly.filter((m) => m.overCap).length;
  const worstUtil = Math.max(...monthly.map((m) => m.requestUnits / planCap));

  // CPR delta: compare last 3 months vs the 3 months before that. Smaller
  // windows (e.g. just last vs prior) are too noisy with single big-cost
  // requests skewing things.
  const cprDelta = computeCprDelta(monthly);

  // "Current" = last-data month, since "today" might be ahead of the latest
  // CSV the user has on disk. We project linearly.
  const currentMonth = monthly[monthly.length - 1] ?? null;
  let dayOfMonth = 0;
  let daysInMonth = 0;
  let projectedRequests: number | null = null;
  if (currentMonth) {
    const [y, m] = currentMonth.ym.split('-').map(Number) as [number, number];
    daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const probe = lastISO ? new Date(lastISO) : new Date();
    if (!Number.isNaN(probe.getTime())) {
      dayOfMonth = Math.max(1, Math.min(daysInMonth, probe.getUTCDate()));
    } else {
      dayOfMonth = daysInMonth;
    }
    if (dayOfMonth > 0 && daysInMonth > 0) {
      projectedRequests = (currentMonth.requestUnits / dayOfMonth) * daysInMonth;
    }
  }

  return {
    avgRequests,
    avgCost,
    monthsOver,
    worstUtil,
    currentMonth,
    currentRequests: currentMonth?.requestUnits ?? 0,
    projectedRequests,
    dayOfMonth,
    daysInMonth,
    cprDelta,
  };
}

function computeCprDelta(monthly: MonthlyBucket[]): number {
  if (monthly.length < 4) {
    // Fall back to last-vs-first when there isn't enough room for 3-month windows.
    if (monthly.length < 2) return 0;
    const first = monthly[0]!.costPerRequest;
    const last = monthly[monthly.length - 1]!.costPerRequest;
    if (first <= 0) return 0;
    return (last - first) / first;
  }
  const recent = monthly.slice(-3);
  const prior = monthly.slice(-6, -3).length > 0 ? monthly.slice(-6, -3) : monthly.slice(0, -3);
  const avg = (xs: MonthlyBucket[]) =>
    xs.reduce((acc, x) => acc + x.costPerRequest, 0) / Math.max(1, xs.length);
  const recentAvg = avg(recent);
  const priorAvg = avg(prior);
  if (priorAvg <= 0) return 0;
  return (recentAvg - priorAvg) / priorAvg;
}

function computeAlert(
  stats: MonthlyStats,
  planCap: number,
  monthly: MonthlyBucket[],
): BudgetAlert | null {
  // If we don't have a current month bucket, nothing actionable to say.
  if (!stats.currentMonth) return null;

  // Already over the cap this month → loud.
  if (stats.currentRequests > planCap) {
    return {
      tone: 'over',
      headline: `Over plan: ${Math.round(stats.currentRequests).toLocaleString()} / ${planCap} requests this month`,
      detail: `${pct(stats.currentRequests / planCap)} of cap — overage requests are billed at usage-based rates.`,
    };
  }

  // Projected over cap.
  if (stats.projectedRequests && stats.projectedRequests > planCap) {
    return {
      tone: 'warn',
      headline: `On pace to exceed plan: ~${Math.round(stats.projectedRequests).toLocaleString()} requests projected`,
      detail: `Day ${stats.dayOfMonth} of ${stats.daysInMonth} · linear extrapolation puts you ${pct(stats.projectedRequests / planCap)} of the ${planCap}-request cap.`,
    };
  }

  // CPR rising sharply → the user might want to look at which models are
  // driving cost.
  if (stats.cprDelta > 0.12) {
    return {
      tone: 'warn',
      headline: `Cost per request is up ${(stats.cprDelta * 100).toFixed(0)} % vs the prior 3-month avg`,
      detail: 'Your recent months are skewing toward more expensive models or more max-mode usage.',
    };
  }

  // Worst historical month — useful context if no current alert applies.
  if (stats.monthsOver > 0) {
    return {
      tone: 'warn',
      headline: `${stats.monthsOver} of ${monthly.length} months exceeded plan (worst ${pct(stats.worstUtil)})`,
      detail: 'Watch for repeat over-cap months — overage adds to usage-based billing.',
    };
  }

  // Otherwise, encouraging note.
  return {
    tone: 'good',
    headline: `Comfortably within plan — averaging ${pct(stats.avgRequests / planCap)} of cap`,
    detail: 'No projected overage. Keep an eye on the cost-per-request trend strip below.',
  };
}
