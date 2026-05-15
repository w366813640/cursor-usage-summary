import { Heatmap, Sparkline, fmtUSD, fmtUSDCompact } from '@cu/charts';
import type { RowWithCost } from '@cu/data';
import {
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  Flame,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Zap,
} from '@cu/icons';
import { calcCacheSavings } from '@cu/pricing';
import { motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { MetricToggle, Panel } from './Panel';

interface YearReviewPageProps {
  rows: ReadonlyArray<RowWithCost>;
}

/**
 * Year-in-review + cross-month trends.
 *
 * Two stacked panels:
 *   1. <YearReviewPanel> — pick a calendar year (auto-defaults to the
 *      most recent year with data), then show year-bounded big numbers
 *      (cost, requests, top model, cache savings, most expensive day,
 *      active days, longest streak) + a 12-month cost bar chart with
 *      the current month highlighted + a quarter-vs-quarter delta strip.
 *   2. <CrossMonthTrendsPanel> — month-by-month delta table for the
 *      top 5 models + a rolling 30-day cost sparkline for the last 90
 *      days. Helps the user see whether they're accelerating or
 *      decelerating per model, with one row per model.
 */
export function YearReviewPage({ rows }: YearReviewPageProps) {
  const availableYears = useMemo(() => {
    const set = new Set<number>();
    for (const r of rows) set.add(new Date(r.dateISO).getUTCFullYear());
    return Array.from(set).sort((a, b) => b - a);
  }, [rows]);
  const defaultYear = availableYears[0] ?? new Date().getUTCFullYear();
  const [selectedYear, setSelectedYear] = useState(defaultYear);

  return (
    <div className="flex flex-col gap-6">
      <YearReviewPanel
        year={selectedYear}
        availableYears={availableYears}
        onSelectYear={setSelectedYear}
        rows={rows}
      />
      <CrossMonthTrendsPanel rows={rows} />
    </div>
  );
}

/* -------------------------------------------------------------- *
 *  Year-in-review panel
 * -------------------------------------------------------------- */

interface YearReviewPanelProps {
  year: number;
  availableYears: ReadonlyArray<number>;
  onSelectYear: (y: number) => void;
  rows: ReadonlyArray<RowWithCost>;
}

/**
 * Year-bounded roll-up. Filters `rows` to the chosen calendar year
 * client-side (cheap; even 100k rows scans in ms), then derives the
 * KPIs from there — including the cache-savings replay, which now
 * runs `calcCacheSavings` on the year-bounded slice so the number is
 * consistent with the global Overview cache card.
 */
function YearReviewPanel({ year, availableYears, onSelectYear, rows }: YearReviewPanelProps) {
  const review = useMemo(() => computeYearReview(rows, year), [rows, year]);

  return (
    <Panel
      title={`${year} in review`}
      subtitle={
        review.activeDays > 0
          ? `${review.activeDays} active days · ${fmtUSD(review.totalCost)} · ${review.totalRequests.toLocaleString()} requests`
          : 'No usage in this year — try another'
      }
      action={<YearPicker years={availableYears} selected={year} onSelect={onSelectYear} />}
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <YearKpi
          icon={<Sparkles size={12} aria-hidden="true" />}
          label="Year spend"
          value={fmtUSD(review.totalCost)}
          accent
        />
        <YearKpi
          icon={<Zap size={12} aria-hidden="true" />}
          label="Requests"
          value={review.totalRequests.toLocaleString()}
        />
        <YearKpi
          icon={<Flame size={12} aria-hidden="true" />}
          label="Top model"
          value={review.topModel?.model ?? '—'}
          sub={
            review.topModel
              ? `${fmtUSD(review.topModel.cost)} · ${(review.topModel.shareOfYear * 100).toFixed(0)}% of year`
              : null
          }
          valueClass="font-mono text-[14px] leading-[1.25] tracking-tight"
        />
        <YearKpi
          icon={<TrendingDown size={12} aria-hidden="true" />}
          label="Cache savings"
          value={fmtUSDCompact(review.cacheSavings)}
          sub={`${(review.cacheHitRatio * 100).toFixed(0)}% hit ratio · ${year}`}
        />
        <YearKpi
          icon={<Calendar size={12} aria-hidden="true" />}
          label="Most expensive day"
          value={review.peakDay ? fmtUSD(review.peakDay.cost) : '—'}
          sub={review.peakDay?.day ?? null}
        />
        <YearKpi
          icon={<TrendingUp size={12} aria-hidden="true" />}
          label="Longest streak"
          value={`${review.longestStreak} d`}
          sub={review.longestStreakRange ?? null}
        />
      </div>

      <div className="mt-6">
        <YearCalendarHeatmap year={year} byDay={review.byDay} />
      </div>

      <div className="mt-6">
        <SubTitle>Cost by month</SubTitle>
        <YearMonthBars months={review.byMonth} />
      </div>

      {review.quarters.length === 4 ? (
        <div className="mt-6">
          <SubTitle>Quarter-over-quarter</SubTitle>
          <QuarterStrip quarters={review.quarters} />
        </div>
      ) : null}
    </Panel>
  );
}

/* -------------------------------------------------------------- *
 *  Year-bound GitHub-style activity calendar
 * -------------------------------------------------------------- */

type YearMetric = 'cost' | 'requests' | 'tokens';

function YearCalendarHeatmap({
  year,
  byDay,
}: {
  year: number;
  byDay: YearReview['byDay'];
}) {
  const [metric, setMetric] = useState<YearMetric>('cost');

  // Pin to the full calendar year — Heatmap fills in zero-value days so we
  // get a "blank pixel" for every quiet weekend instead of a hole in the grid.
  const startDate = useMemo(() => new Date(Date.UTC(year, 0, 1)), [year]);
  const endDate = useMemo(() => new Date(Date.UTC(year, 11, 31)), [year]);

  const heatmapData = useMemo(() => {
    return byDay.map((d) => {
      const value = metric === 'cost' ? d.cost : metric === 'requests' ? d.requests : d.tokens;
      // Meta line shown in the SVG <title> + custom tooltip; keep the
      // *other* two metrics visible so hover always tells the full story.
      const metaParts: string[] = [];
      if (metric !== 'cost') metaParts.push(fmtUSDCompact(d.cost));
      if (metric !== 'requests') metaParts.push(`${d.requests.toLocaleString()} req`);
      if (metric !== 'tokens') metaParts.push(formatTokensCompact(d.tokens));
      metaParts.push(`${d.rows} rows`);
      return { date: d.date, value, meta: metaParts.join(' · ') };
    });
  }, [byDay, metric]);

  const hasData = byDay.length > 0;
  const subtitle = hasData
    ? `${byDay.length} active days · ${metricLabel(metric)}`
    : `No usage in ${year}`;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <SubTitle>
          {year} activity calendar · {subtitle}
        </SubTitle>
        <MetricToggle
          value={metric}
          options={['cost', 'requests', 'tokens'] as const}
          onChange={(v) => setMetric(v)}
        />
      </div>
      {hasData ? (
        <div className="overflow-x-auto pb-1">
          <Heatmap
            data={heatmapData}
            startDate={startDate}
            endDate={endDate}
            cellSize={11}
            cellGap={2}
            renderTooltip={(d) =>
              d ? (
                <>
                  <span className="text-[var(--color-accent)]">{d.date}</span>
                  <span className="px-1 text-[var(--color-text-subtle)]">·</span>
                  <span>{formatYearMetric(metric, d.value)}</span>
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
      ) : (
        <div className="rounded-md border border-dashed border-[var(--color-border)] px-4 py-10 text-center font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
          no usage recorded in {year}
        </div>
      )}
    </div>
  );
}

function metricLabel(m: YearMetric): string {
  if (m === 'cost') return 'USD per day';
  if (m === 'requests') return 'requests per day';
  return 'tokens per day';
}

function formatYearMetric(m: YearMetric, v: number): string {
  if (m === 'cost') return fmtUSD(v);
  if (m === 'requests') return `${v.toLocaleString()} req`;
  return formatTokensCompact(v);
}

function formatTokensCompact(t: number): string {
  if (!Number.isFinite(t) || t <= 0) return '0 tok';
  if (t >= 1_000_000_000) return `${(t / 1_000_000_000).toFixed(1)}B tok`;
  if (t >= 1_000_000) return `${(t / 1_000_000).toFixed(1)}M tok`;
  if (t >= 1_000) return `${(t / 1_000).toFixed(1)}K tok`;
  return `${t.toLocaleString()} tok`;
}

interface YearReview {
  year: number;
  totalCost: number;
  totalRequests: number;
  totalTokens: number;
  cacheSavings: number;
  cacheHitRatio: number;
  activeDays: number;
  longestStreak: number;
  longestStreakRange: string | null;
  peakDay: { day: string; cost: number } | null;
  topModel: { model: string; cost: number; shareOfYear: number } | null;
  byMonth: Array<{ month: string; cost: number; isCurrent: boolean }>;
  quarters: Array<{ label: string; cost: number }>;
  /**
   * Per-day aggregates for every day with usage in the year. Drives the
   * GitHub-style year heatmap which fills empty days at render time so we
   * don't have to enumerate 366 dates here.
   */
  byDay: Array<{ date: string; cost: number; requests: number; tokens: number; rows: number }>;
}

function computeYearReview(rows: ReadonlyArray<RowWithCost>, year: number): YearReview {
  // Year-bound the rowset once, then run the real cache-savings replay
  // on the year-bounded slice — calcCacheSavings re-runs the per-model
  // pricing engine so we get a number consistent with the global panel
  // instead of a hand-rolled "0.9 × $3/Mtok" guess.
  const yearRows = rows.filter((r) => new Date(r.dateISO).getUTCFullYear() === year);

  let totalCost = 0;
  let totalRequests = 0;
  let totalTokens = 0;
  const peakByDay = new Map<string, number>();
  const costByModel = new Map<string, number>();
  const costByMonth = new Map<string, number>();
  // Roll up cost / requests / tokens / rows per day so the year-heatmap can
  // toggle between three metrics without rewalking `rows`.
  const dayAggregates = new Map<
    string,
    { date: string; cost: number; requests: number; tokens: number; rows: number }
  >();

  for (const r of yearRows) {
    totalCost += r.cost;
    const reqUnits = r.requests.kind === 'units' ? r.requests.value : 0;
    totalRequests += reqUnits;
    totalTokens += r.tokens.total;

    const day = r.dateISO.slice(0, 10);
    peakByDay.set(day, (peakByDay.get(day) ?? 0) + r.cost);

    const month = r.dateISO.slice(0, 7);
    costByMonth.set(month, (costByMonth.get(month) ?? 0) + r.cost);

    costByModel.set(r.model, (costByModel.get(r.model) ?? 0) + r.cost);

    let agg = dayAggregates.get(day);
    if (!agg) {
      agg = { date: day, cost: 0, requests: 0, tokens: 0, rows: 0 };
      dayAggregates.set(day, agg);
    }
    agg.cost += r.cost;
    agg.requests += reqUnits;
    agg.tokens += r.tokens.total;
    agg.rows += 1;
  }

  const peakEntry = [...peakByDay.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;
  const peakDay = peakEntry ? { day: peakEntry[0], cost: peakEntry[1] } : null;

  const topModelEntry = [...costByModel.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;
  const topModel = topModelEntry
    ? {
        model: topModelEntry[0],
        cost: topModelEntry[1],
        shareOfYear: totalCost > 0 ? topModelEntry[1] / totalCost : 0,
      }
    : null;

  // Longest active streak across the year.
  const days = [...peakByDay.keys()].sort();
  let longest = 0;
  let current = 0;
  let runStart: string | null = null;
  let bestStart: string | null = null;
  let bestEnd: string | null = null;
  let prevDay: Date | null = null;
  for (const day of days) {
    const d = new Date(`${day}T00:00:00Z`);
    if (prevDay && (d.getTime() - prevDay.getTime()) / 86_400_000 === 1) {
      current += 1;
    } else {
      runStart = day;
      current = 1;
    }
    if (current > longest) {
      longest = current;
      bestStart = runStart;
      bestEnd = day;
    }
    prevDay = d;
  }

  // 12-month bars — always fill all 12 even if some months are empty.
  const currentMonthISO = new Date().toISOString().slice(0, 7);
  const byMonth: YearReview['byMonth'] = [];
  for (let m = 1; m <= 12; m++) {
    const month = `${year}-${String(m).padStart(2, '0')}`;
    byMonth.push({
      month,
      cost: costByMonth.get(month) ?? 0,
      isCurrent: month === currentMonthISO,
    });
  }

  // Quarter-vs-quarter.
  const quarters: YearReview['quarters'] = [];
  for (let q = 0; q < 4; q++) {
    let qCost = 0;
    for (let m = 1; m <= 3; m++) {
      qCost += costByMonth.get(`${year}-${String(q * 3 + m).padStart(2, '0')}`) ?? 0;
    }
    quarters.push({ label: `Q${q + 1}`, cost: qCost });
  }

  // Real year-bound cache savings — same engine the global Overview cache
  // card uses, just fed a year-bounded slice instead of every row.
  const cacheStats = calcCacheSavings(yearRows);

  const byDay = [...dayAggregates.values()].sort((a, b) => a.date.localeCompare(b.date));

  return {
    year,
    totalCost,
    totalRequests,
    totalTokens,
    cacheSavings: cacheStats.savings,
    cacheHitRatio: cacheStats.hitRatio,
    activeDays: peakByDay.size,
    longestStreak: longest,
    longestStreakRange:
      bestStart && bestEnd && bestStart !== bestEnd
        ? `${bestStart} → ${bestEnd}`
        : (bestStart ?? null),
    peakDay,
    topModel,
    byMonth,
    quarters,
    byDay,
  };
}

function YearPicker({
  years,
  selected,
  onSelect,
}: {
  years: ReadonlyArray<number>;
  selected: number;
  onSelect: (y: number) => void;
}) {
  if (years.length <= 1) return null;
  return (
    <div className="flex items-center gap-1">
      {years.map((y) => {
        const active = y === selected;
        return (
          <button
            key={y}
            type="button"
            onClick={() => onSelect(y)}
            className={[
              'rounded-md border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.08em] transition-colors',
              active
                ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-text)] hover:text-[var(--color-text)]',
            ].join(' ')}
          >
            {y}
          </button>
        );
      })}
    </div>
  );
}

function YearKpi({
  icon,
  label,
  value,
  sub,
  accent,
  valueClass,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string | null;
  accent?: boolean;
  valueClass?: string;
}) {
  return (
    <div
      className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-3"
      style={{
        background: accent
          ? 'color-mix(in oklab, var(--color-accent) 7%, var(--color-surface))'
          : undefined,
      }}
    >
      <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
        {icon}
        {label}
      </div>
      <div
        className={
          valueClass ??
          'mt-1 font-serif text-[24px] leading-[1.1] tracking-tight tabular-nums truncate'
        }
        style={accent ? { color: 'var(--color-accent)' } : undefined}
        title={value}
      >
        {value}
      </div>
      {sub ? (
        <div
          className="mt-1 font-mono text-[10px] text-[var(--color-text-subtle)] truncate"
          title={sub}
        >
          {sub}
        </div>
      ) : null}
    </div>
  );
}

function YearMonthBars({ months }: { months: YearReview['byMonth'] }) {
  const max = Math.max(0.0001, ...months.map((m) => m.cost));
  return (
    <div className="flex items-end gap-1.5 h-[140px] pt-2 px-1">
      {months.map((m) => {
        const heightPct = (m.cost / max) * 100;
        const monthShort = m.month.slice(5);
        return (
          <div key={m.month} className="flex flex-1 flex-col items-center gap-1">
            <div className="relative flex w-full flex-1 items-end">
              <motion.div
                initial={{ height: '0%' }}
                animate={{ height: m.cost > 0 ? `${heightPct}%` : '2%' }}
                transition={{ duration: 0.65, ease: [0.2, 0, 0, 1] }}
                className="w-full rounded-t-sm"
                style={{
                  background: m.isCurrent
                    ? 'var(--color-accent)'
                    : m.cost > 0
                      ? 'color-mix(in oklab, var(--color-accent) 55%, transparent)'
                      : 'var(--color-border)',
                  minHeight: m.cost > 0 ? 4 : 2,
                }}
                title={`${m.month} · ${fmtUSD(m.cost)}`}
              />
            </div>
            <div className="font-mono text-[10px] uppercase tracking-[0.04em] text-[var(--color-text-subtle)]">
              {monthShort}
            </div>
            <div className="font-mono text-[9px] tabular-nums text-[var(--color-text-muted)]">
              {m.cost > 0 ? fmtUSDCompact(m.cost) : '—'}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function QuarterStrip({ quarters }: { quarters: YearReview['quarters'] }) {
  const total = quarters.reduce((acc, q) => acc + q.cost, 0);
  return (
    <div className="grid grid-cols-4 gap-3">
      {quarters.map((q, i) => {
        const prev = i > 0 ? quarters[i - 1]!.cost : 0;
        const delta = i > 0 && prev > 0 ? (q.cost - prev) / prev : 0;
        const share = total > 0 ? q.cost / total : 0;
        return (
          <div
            key={q.label}
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3.5 py-3"
          >
            <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
              {q.label}
            </div>
            <div className="mt-1 font-serif text-[20px] leading-tight tabular-nums">
              {fmtUSDCompact(q.cost)}
            </div>
            <div className="mt-1 flex items-center justify-between font-mono text-[10px] text-[var(--color-text-muted)]">
              <span>{(share * 100).toFixed(0)}% of year</span>
              {i > 0 ? (
                <span
                  className="flex items-center gap-0.5 tabular-nums"
                  style={{
                    color:
                      delta > 0.001
                        ? 'var(--color-warning)'
                        : delta < -0.001
                          ? 'var(--color-accent)'
                          : 'var(--color-text-subtle)',
                  }}
                  title="QoQ delta"
                >
                  {delta > 0.001 ? (
                    <ArrowUpRight size={9} aria-hidden="true" />
                  ) : delta < -0.001 ? (
                    <ArrowDownRight size={9} aria-hidden="true" />
                  ) : null}
                  {(delta * 100).toFixed(0)}%
                </span>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------- *
 *  Cross-month trends panel
 * -------------------------------------------------------------- */

interface CrossMonthTrendsPanelProps {
  rows: ReadonlyArray<RowWithCost>;
}

/**
 * Shows three things, top to bottom:
 *
 *   1. Rolling-30d-cost sparkline for the last 90 days. One line, no
 *      legend — keeps it Bloomberg-dense, you read the trend from the
 *      curve shape.
 *   2. MoM delta table for the top 5 models. Each row shows the
 *      model, last month's cost, the month before, delta in $ and %,
 *      and a 12-month sparkline. Sorted by absolute delta (biggest
 *      mover first) so the most interesting changes lead.
 *   3. Empty-state copy when there's less than two months of data.
 */
function CrossMonthTrendsPanel({ rows }: CrossMonthTrendsPanelProps) {
  const data = useMemo(() => computeCrossMonth(rows), [rows]);

  return (
    <Panel
      title="Cross-month trends"
      subtitle="Where the money is moving · last 90d roll-up + top-5 model MoM"
    >
      {data.hasEnoughHistory ? (
        <>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_280px]">
            <div className="flex flex-col gap-2">
              <SubTitle>Rolling 30-day cost · last 90 days</SubTitle>
              <Sparkline
                data={data.rolling30d}
                width={620}
                height={120}
                showLastPoint
                showPeak
                fillArea
              />
              <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--color-text-subtle)]">
                <span>{data.rolling30d[0]?.date ?? ''}</span>
                <span>Latest 30d total · {fmtUSD(data.rolling30d.at(-1)?.value ?? 0)}</span>
                <span>{data.rolling30d.at(-1)?.date ?? ''}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <SubTitle>Last-month overview</SubTitle>
              <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3.5 py-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
                    {data.lastMonth ?? '—'}
                  </span>
                  <DeltaPill delta={data.totalMoMDelta} />
                </div>
                <div className="mt-1 font-serif text-[24px] leading-tight tabular-nums">
                  {fmtUSD(data.lastMonthCost)}
                </div>
                <div className="mt-1 font-mono text-[10px] text-[var(--color-text-muted)]">
                  vs {data.prevMonth ?? '—'} · {fmtUSD(data.prevMonthCost)}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-2">
            <SubTitle>Top 5 models · MoM</SubTitle>
            <div className="overflow-x-auto rounded-md border border-[var(--color-border)]">
              <table className="w-full border-collapse text-[12px]">
                <thead className="bg-[var(--color-surface-muted)] text-[var(--color-text-subtle)]">
                  <tr>
                    <Th align="left">Model</Th>
                    <Th>This month</Th>
                    <Th>Prev month</Th>
                    <Th>Δ $</Th>
                    <Th>Δ %</Th>
                    <Th align="left">12-month trend</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.topModels.map((m) => (
                    <tr
                      key={m.model}
                      className="border-t border-[var(--color-border)] transition-colors hover:bg-[var(--color-surface-muted)]"
                    >
                      <td className="px-3 py-2 font-mono text-[12px] text-[var(--color-text)]">
                        {m.model}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">
                        {fmtUSD(m.thisMonth)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-[var(--color-text-muted)]">
                        {fmtUSD(m.prevMonth)}
                      </td>
                      <td
                        className="px-3 py-2 text-right font-mono tabular-nums"
                        style={{
                          color:
                            m.deltaAbs > 0
                              ? 'var(--color-warning)'
                              : m.deltaAbs < 0
                                ? 'var(--color-accent)'
                                : 'var(--color-text-muted)',
                        }}
                      >
                        {m.deltaAbs > 0 ? '+' : ''}
                        {fmtUSD(m.deltaAbs)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">
                        <DeltaPill delta={m.deltaPct} />
                      </td>
                      <td className="px-3 py-2">
                        <Sparkline
                          data={m.history}
                          width={180}
                          height={28}
                          strokeWidth={1.2}
                          showLastPoint
                          showPeak={false}
                          fillArea
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <EmptyTrendsCopy />
      )}
    </Panel>
  );
}

interface CrossMonth {
  hasEnoughHistory: boolean;
  rolling30d: Array<{ date: string; value: number }>;
  lastMonth: string | null;
  prevMonth: string | null;
  lastMonthCost: number;
  prevMonthCost: number;
  totalMoMDelta: number;
  topModels: Array<{
    model: string;
    thisMonth: number;
    prevMonth: number;
    deltaAbs: number;
    deltaPct: number;
    history: Array<{ date: string; value: number }>;
  }>;
}

function computeCrossMonth(rows: ReadonlyArray<RowWithCost>): CrossMonth {
  // Group by day-cost and by model-month for the various aggregations.
  const costByDay = new Map<string, number>();
  const costByModelMonth = new Map<string, Map<string, number>>();
  for (const r of rows) {
    const day = r.dateISO.slice(0, 10);
    costByDay.set(day, (costByDay.get(day) ?? 0) + r.cost);
    const month = r.dateISO.slice(0, 7);
    let modelMap = costByModelMonth.get(r.model);
    if (!modelMap) {
      modelMap = new Map();
      costByModelMonth.set(r.model, modelMap);
    }
    modelMap.set(month, (modelMap.get(month) ?? 0) + r.cost);
  }

  const sortedDays = [...costByDay.keys()].sort();
  if (sortedDays.length === 0) {
    return {
      hasEnoughHistory: false,
      rolling30d: [],
      lastMonth: null,
      prevMonth: null,
      lastMonthCost: 0,
      prevMonthCost: 0,
      totalMoMDelta: 0,
      topModels: [],
    };
  }

  // Build the rolling 30d series ending at the last day we have data.
  const lastDayStr = sortedDays.at(-1)!;
  const lastDay = new Date(`${lastDayStr}T00:00:00Z`);
  const startDay = new Date(lastDay);
  startDay.setUTCDate(startDay.getUTCDate() - 89); // 90-day window
  const rolling30d: Array<{ date: string; value: number }> = [];
  for (let i = 0; i < 90; i++) {
    const cur = new Date(startDay);
    cur.setUTCDate(cur.getUTCDate() + i);
    if (cur > lastDay) break;
    const dateStr = cur.toISOString().slice(0, 10);
    let sum = 0;
    for (let j = 0; j < 30; j++) {
      const back = new Date(cur);
      back.setUTCDate(back.getUTCDate() - j);
      sum += costByDay.get(back.toISOString().slice(0, 10)) ?? 0;
    }
    rolling30d.push({ date: dateStr, value: sum });
  }

  // Last + previous month roll-ups, across all rows.
  const months = new Set<string>();
  const costByMonth = new Map<string, number>();
  for (const r of rows) {
    const month = r.dateISO.slice(0, 7);
    months.add(month);
    costByMonth.set(month, (costByMonth.get(month) ?? 0) + r.cost);
  }
  const monthList = [...months].sort();
  const lastMonth = monthList.at(-1) ?? null;
  const prevMonth = monthList.at(-2) ?? null;
  const lastMonthCost = lastMonth ? (costByMonth.get(lastMonth) ?? 0) : 0;
  const prevMonthCost = prevMonth ? (costByMonth.get(prevMonth) ?? 0) : 0;
  const totalMoMDelta = prevMonthCost > 0 ? (lastMonthCost - prevMonthCost) / prevMonthCost : 0;

  // Top-5 models by absolute MoM delta, with a 12-month history per model.
  const allMonths12 = lastMonth ? lastNMonths(lastMonth, 12) : [];
  const modelEntries: CrossMonth['topModels'] = [];
  for (const [model, modelMap] of costByModelMonth) {
    const tm = lastMonth ? (modelMap.get(lastMonth) ?? 0) : 0;
    const pm = prevMonth ? (modelMap.get(prevMonth) ?? 0) : 0;
    const deltaAbs = tm - pm;
    const deltaPct = pm > 0 ? deltaAbs / pm : tm > 0 ? 1 : 0;
    const history = allMonths12.map((month) => ({
      // Sparkline expects a date — use the first of the month.
      date: `${month}-01`,
      value: modelMap.get(month) ?? 0,
    }));
    modelEntries.push({ model, thisMonth: tm, prevMonth: pm, deltaAbs, deltaPct, history });
  }
  modelEntries.sort(
    (a, b) =>
      Math.abs(b.deltaAbs) - Math.abs(a.deltaAbs) ||
      b.thisMonth + b.prevMonth - (a.thisMonth + a.prevMonth),
  );
  const topModels = modelEntries.slice(0, 5);

  return {
    hasEnoughHistory: monthList.length >= 1 && rolling30d.length > 0,
    rolling30d,
    lastMonth,
    prevMonth,
    lastMonthCost,
    prevMonthCost,
    totalMoMDelta,
    topModels,
  };
}

function lastNMonths(endMonth: string, n: number): string[] {
  // endMonth = 'YYYY-MM'
  const [y, m] = endMonth.split('-').map((s) => Number(s));
  if (!y || !m) return [];
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

function DeltaPill({ delta }: { delta: number }) {
  const pct = (delta * 100).toFixed(0);
  const positive = delta > 0.001;
  const negative = delta < -0.001;
  return (
    <span
      className="inline-flex items-center gap-0.5 rounded-sm px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.06em] tabular-nums"
      style={{
        color: positive
          ? 'var(--color-warning)'
          : negative
            ? 'var(--color-accent)'
            : 'var(--color-text-subtle)',
        background: positive
          ? 'color-mix(in oklab, var(--color-warning) 12%, transparent)'
          : negative
            ? 'color-mix(in oklab, var(--color-accent) 12%, transparent)'
            : 'transparent',
      }}
    >
      {positive ? (
        <ArrowUpRight size={9} aria-hidden="true" />
      ) : negative ? (
        <ArrowDownRight size={9} aria-hidden="true" />
      ) : null}
      {pct}%
    </span>
  );
}

function EmptyTrendsCopy() {
  return (
    <div className="mt-5 flex flex-col items-center justify-center gap-2 py-12 text-center">
      <Calendar size={22} className="text-[var(--color-text-subtle)]" aria-hidden="true" />
      <p className="font-serif text-[15px] text-[var(--color-text-muted)] max-w-[440px]">
        Not enough history yet. Import more months of CSVs to see month-over-month deltas and
        per-model trends here.
      </p>
    </div>
  );
}

function SubTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
      {children}
    </div>
  );
}

function Th({
  children,
  align = 'right',
}: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th
      className={`sticky top-0 z-10 px-3 py-2 text-${align} font-mono text-[10px] uppercase tracking-[0.08em] font-normal`}
    >
      {children}
    </th>
  );
}
