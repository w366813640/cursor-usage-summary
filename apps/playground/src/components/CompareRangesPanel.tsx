import { fmtTokens, fmtUSD } from '@cu/charts';
import type { RowWithCost } from '@cu/data';
import { ArrowDownRight, ArrowRight, ArrowUpRight } from '@cu/icons';
import { motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { Panel } from './Panel';

interface CompareRangesPanelProps {
  rows: ReadonlyArray<RowWithCost>;
  /** Default window size in days for each range (recent vs prior). */
  defaultWindow?: number;
}

type WindowMode = '7d' | '14d' | '30d' | 'mtd';

interface RangeSummary {
  label: string;
  start: string;
  end: string;
  rows: number;
  cost: number;
  tokens: number;
  requestUnits: number;
  avgCostPerRequest: number;
  /** Daily totals (cost) inside the range, sorted ASC for the inline sparkline. */
  daily: ReadonlyArray<{ iso: string; value: number }>;
}

/**
 * "This 7d vs prior 7d" comparison card.
 *
 * Sits on Overview between the monthly-budget panel and Act 2 so the user
 * gets a quick "am I burning more or less than the trailing window?" read
 * without leaving the home screen. Four-stat strip with delta arrows plus
 * a side-by-side daily mini bar chart.
 */
export function CompareRangesPanel({ rows, defaultWindow = 7 }: CompareRangesPanelProps) {
  const [mode, setMode] = useState<WindowMode>(modeFromWindow(defaultWindow));

  const { recent, prior } = useMemo(() => {
    return computeRanges(rows, mode);
  }, [rows, mode]);

  if (!recent || !prior) {
    return (
      <Panel title="Compare ranges" subtitle="Not enough data to compare yet">
        <div className="py-6 text-center font-mono text-[11px] text-[var(--color-text-subtle)]">
          Need at least two full windows of data to compare. Try uploading more days.
        </div>
      </Panel>
    );
  }

  const deltas = {
    cost: relDelta(recent.cost, prior.cost),
    rows: relDelta(recent.rows, prior.rows),
    requests: relDelta(recent.requestUnits, prior.requestUnits),
    avg: relDelta(recent.avgCostPerRequest, prior.avgCostPerRequest),
  };

  return (
    <Panel
      title="Compare ranges"
      subtitle={`${recent.label} (${recent.start} → ${recent.end}) vs ${prior.label} (${prior.start} → ${prior.end})`}
      action={
        <div className="flex items-center gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-0.5 font-mono text-[10px] uppercase tracking-[0.08em] shadow-[inset_0_1px_0_color-mix(in_oklab,var(--color-text)_2%,transparent)]">
          {(
            [
              ['7d', 'last 7d'],
              ['14d', 'last 14d'],
              ['30d', 'last 30d'],
              ['mtd', 'mtd vs prev'],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setMode(k)}
              className={[
                'rounded-sm px-2 py-1 transition-all duration-[160ms]',
                mode === k
                  ? 'bg-[var(--color-surface-raised)] text-[var(--color-accent)] shadow-[inset_0_-1px_0_color-mix(in_oklab,var(--color-accent)_60%,transparent)]'
                  : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-raised)]/60 hover:text-[var(--color-text)]',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <DeltaStat
          label="Total cost"
          recentValue={fmtUSD(recent.cost)}
          priorValue={fmtUSD(prior.cost)}
          delta={deltas.cost}
          isMoneyMetric
        />
        <DeltaStat
          label="Rows"
          recentValue={recent.rows.toLocaleString()}
          priorValue={prior.rows.toLocaleString()}
          delta={deltas.rows}
        />
        <DeltaStat
          label="Request units"
          recentValue={Math.round(recent.requestUnits).toLocaleString()}
          priorValue={Math.round(prior.requestUnits).toLocaleString()}
          delta={deltas.requests}
        />
        <DeltaStat
          label="Avg / request"
          recentValue={fmtUSD(recent.avgCostPerRequest)}
          priorValue={fmtUSD(prior.avgCostPerRequest)}
          delta={deltas.avg}
          isMoneyMetric
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <DailyMiniBars range={recent} tone="accent" maxValue={maxValueAcross(recent, prior)} />
        <DailyMiniBars range={prior} tone="muted" maxValue={maxValueAcross(recent, prior)} />
      </div>

      <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--color-text-subtle)]">
        Tip · arrows show change relative to the prior window. Spend going up while request-count
        holds flat means a more expensive model mix.
      </div>
    </Panel>
  );
}

interface DeltaStatProps {
  label: string;
  recentValue: string;
  priorValue: string;
  delta: number;
  /** When true, "up" is bad (you're spending more); flip the arrow tone. */
  isMoneyMetric?: boolean;
}

function DeltaStat({ label, recentValue, priorValue, delta, isMoneyMetric }: DeltaStatProps) {
  const tone = deltaTone(delta, isMoneyMetric);
  const Arrow = delta > 0 ? ArrowUpRight : delta < 0 ? ArrowDownRight : ArrowRight;
  const sign = delta > 0 ? '+' : delta < 0 ? '−' : '';
  const pct = Math.abs(delta);
  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-3">
      <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--color-text-subtle)]">
        {label}
      </div>
      <div className="mt-1 font-serif text-[20px] leading-tight tabular-nums">{recentValue}</div>
      <div className="mt-1 flex items-center gap-2 font-mono text-[10px] tabular-nums">
        <span
          className="inline-flex items-center gap-1"
          style={{ color: toneColor(tone) }}
          title={`vs prior · ${pct === Number.POSITIVE_INFINITY ? '∞' : `${(pct * 100).toFixed(1)}%`}`}
        >
          <Arrow size={11} aria-hidden="true" />
          <span>
            {sign}
            {Number.isFinite(pct) ? `${(pct * 100).toFixed(1)}%` : '∞'}
          </span>
        </span>
        <span className="text-[var(--color-text-subtle)]">
          vs <span className="tabular-nums text-[var(--color-text-muted)]">{priorValue}</span>
        </span>
      </div>
    </div>
  );
}

interface DailyMiniBarsProps {
  range: RangeSummary;
  tone: 'accent' | 'muted';
  maxValue: number;
}

function DailyMiniBars({ range, tone, maxValue }: DailyMiniBarsProps) {
  // Even if the range itself has all-zero days, render a faint baseline rather
  // than a flat empty stripe so the user knows the panel is alive.
  const safeMax = Math.max(maxValue, 1);
  const totalLabel = fmtUSD(range.cost);
  return (
    <div className="flex flex-col gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
          {range.label}
        </span>
        <span className="font-mono text-[10px] text-[var(--color-text-muted)] tabular-nums">
          {totalLabel}
        </span>
      </div>
      <div className="relative flex h-[42px] items-end gap-[3px]">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-0 bottom-0 left-0 h-px bg-[var(--color-border)]/60"
        />
        {range.daily.map((d, i) => {
          const ratio = d.value / safeMax;
          return (
            <div
              key={d.iso}
              className="group relative flex-1"
              title={`${d.iso} · ${fmtUSD(d.value)}`}
            >
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${Math.max(ratio * 100, d.value > 0 ? 2 : 0)}%` }}
                transition={{
                  duration: 0.45,
                  delay: 0.06 + i * 0.02,
                  ease: [0.2, 0, 0, 1],
                }}
                className="rounded-t-[2px]"
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  background:
                    tone === 'accent'
                      ? 'var(--color-accent)'
                      : 'color-mix(in oklab, var(--color-text-muted) 35%, transparent)',
                  opacity: tone === 'accent' ? 0.88 : 0.7,
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between font-mono text-[9px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
        <span>{range.start}</span>
        <span>{range.end}</span>
      </div>
    </div>
  );
}

type DeltaTone = 'up-good' | 'up-bad' | 'down-good' | 'down-bad' | 'flat';

function deltaTone(delta: number, isMoneyMetric: boolean | undefined): DeltaTone {
  if (!Number.isFinite(delta) || Math.abs(delta) < 0.01) return 'flat';
  if (delta > 0) return isMoneyMetric ? 'up-bad' : 'up-good';
  return isMoneyMetric ? 'down-good' : 'down-bad';
}

function toneColor(tone: DeltaTone): string {
  switch (tone) {
    case 'up-good':
      return 'var(--cu-cat-1)';
    case 'up-bad':
      return 'var(--color-destructive, #c0533d)';
    case 'down-good':
      return 'var(--cu-cat-1)';
    case 'down-bad':
      return 'var(--color-warning, #d8a04a)';
    default:
      return 'var(--color-text-muted)';
  }
}

function relDelta(now: number, prior: number): number {
  if (!Number.isFinite(now) || !Number.isFinite(prior)) return 0;
  if (prior <= 0) {
    if (now <= 0) return 0;
    return Number.POSITIVE_INFINITY;
  }
  return (now - prior) / prior;
}

function maxValueAcross(recent: RangeSummary, prior: RangeSummary): number {
  let max = 0;
  for (const d of recent.daily) if (d.value > max) max = d.value;
  for (const d of prior.daily) if (d.value > max) max = d.value;
  return max;
}

function modeFromWindow(window: number): WindowMode {
  if (window >= 30) return '30d';
  if (window >= 14) return '14d';
  return '7d';
}

/**
 * Compute the "recent" and "prior" range summaries from a row stream and a
 * mode. The data's most recent day is the reference point, not "today" —
 * that keeps the panel meaningful even when the user uploads stale CSVs.
 */
function computeRanges(
  rows: ReadonlyArray<RowWithCost>,
  mode: WindowMode,
): { recent: RangeSummary | null; prior: RangeSummary | null } {
  if (rows.length === 0) return { recent: null, prior: null };

  // Index rows by date (UTC, day-only).
  const byDay = new Map<string, RowWithCost[]>();
  let maxDay = '';
  for (const r of rows) {
    const day = r.dateISO.slice(0, 10);
    const list = byDay.get(day) ?? [];
    list.push(r);
    byDay.set(day, list);
    if (day > maxDay) maxDay = day;
  }
  if (!maxDay) return { recent: null, prior: null };

  let recentStart: string;
  let recentEnd: string;
  let priorStart: string;
  let priorEnd: string;
  let labelRecent: string;
  let labelPrior: string;

  if (mode === 'mtd') {
    const [y, m] = maxDay.split('-').map(Number) as [number, number];
    const firstOfMonth = new Date(Date.UTC(y, m - 1, 1));
    recentStart = toIso(firstOfMonth);
    recentEnd = maxDay;
    // Same day-of-month window in the prior month, capped at month length.
    const prevMonthFirst = new Date(Date.UTC(y, m - 2, 1));
    const dayOfMonth = Number(maxDay.split('-')[2]);
    const prevMonthLastDay = new Date(Date.UTC(y, m - 1, 0)).getUTCDate();
    const sameDay = Math.min(dayOfMonth, prevMonthLastDay);
    priorStart = toIso(prevMonthFirst);
    priorEnd = toIso(new Date(Date.UTC(y, m - 2, sameDay)));
    labelRecent = 'MTD';
    labelPrior = 'Prev MTD';
  } else {
    const span = mode === '7d' ? 6 : mode === '14d' ? 13 : 29;
    const maxDate = new Date(`${maxDay}T00:00:00Z`);
    const recentStartDate = new Date(maxDate);
    recentStartDate.setUTCDate(recentStartDate.getUTCDate() - span);
    recentStart = toIso(recentStartDate);
    recentEnd = maxDay;
    const priorEndDate = new Date(recentStartDate);
    priorEndDate.setUTCDate(priorEndDate.getUTCDate() - 1);
    const priorStartDate = new Date(priorEndDate);
    priorStartDate.setUTCDate(priorStartDate.getUTCDate() - span);
    priorStart = toIso(priorStartDate);
    priorEnd = toIso(priorEndDate);
    labelRecent = `Last ${mode}`;
    labelPrior = `Prior ${mode}`;
  }

  const recent = summarise(byDay, recentStart, recentEnd, labelRecent);
  const prior = summarise(byDay, priorStart, priorEnd, labelPrior);
  return { recent, prior };
}

function summarise(
  byDay: Map<string, RowWithCost[]>,
  start: string,
  end: string,
  label: string,
): RangeSummary {
  let cost = 0;
  let rows = 0;
  let tokens = 0;
  let requestUnits = 0;
  const daily: { iso: string; value: number }[] = [];
  // Walk every day in [start, end] inclusively so missing days still draw a
  // zero-height bar (and the bar count stays comparable across ranges).
  let cursor = new Date(`${start}T00:00:00Z`);
  const endDate = new Date(`${end}T00:00:00Z`);
  while (cursor.getTime() <= endDate.getTime()) {
    const iso = toIso(cursor);
    const list = byDay.get(iso);
    let dayCost = 0;
    if (list) {
      for (const r of list) {
        cost += r.cost;
        dayCost += r.cost;
        tokens += r.tokens.total;
        rows++;
        if (r.requests.kind === 'units') requestUnits += r.requests.value;
      }
    }
    daily.push({ iso, value: dayCost });
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
  }
  return {
    label,
    start,
    end,
    rows,
    cost,
    tokens,
    requestUnits,
    avgCostPerRequest: requestUnits > 0 ? cost / requestUnits : 0,
    daily,
  };
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}
