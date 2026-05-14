import { WeekHourHeatmap, fmtTokens, fmtUSD, hourWeekdayToCells } from '@cu/charts';
import { type RowWithCost, type UsageSummary, aggregate } from '@cu/data';
import { motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { type DateFilter, DateRangeFilter, applyDateFilter } from './DateRangeFilter';
import { MetricToggle, Panel } from './Panel';
import { SectionHeader } from './SectionHeader';

interface HoursPageProps {
  summary: UsageSummary;
  rows: ReadonlyArray<RowWithCost>;
}

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/**
 * "When did the money burn?" page. Splits the hour-weekday grid three ways:
 *
 *   - hour-only bar (24 bars)             — answers "morning vs evening"
 *   - weekday-only bar (7 bars)           — answers "weekend vs weekday"
 *   - big 7×24 heatmap                    — answers "which slot specifically"
 *   - top 5 hot slots as a leaderboard    — answers "what should I avoid"
 *
 * A date filter on top lets the user narrow to a single day, a few days, or
 * a custom range — useful for comparing "this week vs last week" or
 * inspecting a specific burn day in isolation.
 */
export function HoursPage({ summary, rows }: HoursPageProps) {
  const [metric, setMetric] = useState<'cost' | 'rows'>('cost');
  const [filter, setFilter] = useState<DateFilter>({ kind: 'all' });

  // Re-aggregate when the date filter changes. `aggregate` is cheap enough that
  // we don't bother memoising the filtering step separately — the inner loop
  // over rows is the dominant cost and we already cap typical CSV size.
  const filteredRows = useMemo<RowWithCost[]>(() => {
    if (filter.kind === 'all') return rows.slice();
    return applyDateFilter(rows, filter);
  }, [rows, filter]);

  const filteredSummary = useMemo<UsageSummary>(() => {
    if (filter.kind === 'all') return summary;
    return aggregate(filteredRows);
  }, [summary, filteredRows, filter]);

  const cells = useMemo(
    () => hourWeekdayToCells(filteredSummary, metric),
    [filteredSummary, metric],
  );

  const hourTotals = useMemo(() => {
    const arr = Array.from({ length: 24 }, (_, h) => ({ hour: h, value: 0 }));
    for (const c of filteredSummary.hourWeekday) {
      const v = metric === 'cost' ? c.cost : c.rows;
      arr[c.hour]!.value += v;
    }
    return arr;
  }, [filteredSummary.hourWeekday, metric]);

  const weekdayTotals = useMemo(() => {
    const arr = Array.from({ length: 7 }, (_, d) => ({ weekday: d, value: 0 }));
    for (const c of filteredSummary.hourWeekday) {
      const v = metric === 'cost' ? c.cost : c.rows;
      arr[c.weekday]!.value += v;
    }
    return arr;
  }, [filteredSummary.hourWeekday, metric]);

  const hotSlots = useMemo(() => {
    return [...filteredSummary.hourWeekday]
      .map((c) => ({ ...c, value: metric === 'cost' ? c.cost : c.rows }))
      .filter((c) => c.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [filteredSummary.hourWeekday, metric]);

  const maxHour = Math.max(...hourTotals.map((h) => h.value), 1);
  const maxDay = Math.max(...weekdayTotals.map((d) => d.value), 1);
  // Track peak slot for an "act-break" highlight on the small bar charts —
  // gives an at-a-glance "your burn is here" reading without reading the labels.
  const peakHour = hourTotals.reduce(
    (best, cur, idx) => (cur.value > hourTotals[best]!.value ? idx : best),
    0,
  );
  const peakWeekday = weekdayTotals.reduce(
    (best, cur, idx) => (cur.value > weekdayTotals[best]!.value ? idx : best),
    0,
  );

  const grandTotal = metric === 'cost' ? filteredSummary.totalCost : filteredSummary.totalRows;
  const grandLabel = metric === 'cost' ? fmtUSD(grandTotal) : `${grandTotal} rows`;
  const filterSummary = filterSummaryText(filter, rows.length, filteredSummary.totalRows);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.42, ease: [0.2, 0, 0, 1] }}
      className="flex flex-col gap-4"
    >
      <SectionHeader
        title="Hours · when the money burns"
        subtitle={`UTC · ${grandLabel}${filterSummary ? ` · ${filterSummary}` : ''}`}
        action={<MetricToggle value={metric} options={['cost', 'rows']} onChange={setMetric} />}
      />

      <DateRangeFilter rows={rows} value={filter} onChange={setFilter} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel
          title="By hour of day"
          subtitle={`24 hours (UTC) · peak ${String(peakHour).padStart(2, '0')}:00 (${metric === 'cost' ? fmtUSD(maxHour) : `${Math.round(maxHour)} req`})`}
        >
          <div className="relative flex h-[140px] items-end gap-[2px]">
            {/* Faint baseline so bars don't float */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute right-0 bottom-0 left-0 h-px bg-[var(--color-border)]/60"
            />
            {hourTotals.map((h, i) => {
              const ratio = h.value / maxHour;
              const isPeak = i === peakHour;
              return (
                <div
                  key={h.hour}
                  className="group/hr relative flex-1"
                  style={{ height: '100%' }}
                  title={`${String(h.hour).padStart(2, '0')}:00 · ${
                    metric === 'cost' ? fmtUSD(h.value) : `${h.value.toFixed(0)} rows`
                  }`}
                >
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{
                      height: `${Math.max(ratio * 100, h.value > 0 ? 1 : 0)}%`,
                    }}
                    transition={{
                      duration: 0.55,
                      delay: 0.08 + i * 0.018,
                      ease: [0.2, 0, 0, 1],
                    }}
                    className="rounded-t-[2px] transition-opacity duration-[160ms] group-hover/hr:opacity-100"
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      background: isPeak ? 'var(--color-accent)' : 'var(--cu-cat-1)',
                      opacity: isPeak ? 0.95 : 0.78,
                    }}
                  />
                  {isPeak ? (
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute right-0 left-0 text-center font-mono text-[8px] uppercase tracking-[0.06em] text-[var(--color-accent)]"
                      style={{ bottom: `calc(${Math.max(ratio * 100, 1)}% + 3px)` }}
                    >
                      peak
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex justify-between font-mono text-[9px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
            {[0, 6, 12, 18, 23].map((h) => (
              <span key={h}>{String(h).padStart(2, '0')}h</span>
            ))}
          </div>
        </Panel>

        <Panel
          title="By weekday"
          subtitle={`Sun → Sat (UTC) · peak ${WEEKDAY_NAMES[peakWeekday]} (${metric === 'cost' ? fmtUSD(maxDay) : `${Math.round(maxDay)} req`})`}
        >
          <div className="relative flex h-[140px] items-end gap-[6px]">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute right-0 bottom-0 left-0 h-px bg-[var(--color-border)]/60"
            />
            {weekdayTotals.map((d, i) => {
              const ratio = d.value / maxDay;
              const isPeak = i === peakWeekday;
              const isWeekend = i === 0 || i === 6;
              return (
                <div
                  key={d.weekday}
                  className="group/wd relative flex-1"
                  style={{ height: '100%' }}
                  title={`${WEEKDAY_NAMES[d.weekday]} · ${
                    metric === 'cost' ? fmtUSD(d.value) : `${d.value.toFixed(0)} rows`
                  }`}
                >
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{
                      height: `${Math.max(ratio * 100, d.value > 0 ? 1 : 0)}%`,
                    }}
                    transition={{
                      duration: 0.55,
                      delay: 0.12 + i * 0.06,
                      ease: [0.2, 0, 0, 1],
                    }}
                    className="rounded-t-[3px] transition-opacity duration-[160ms]"
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      background: isPeak
                        ? 'var(--color-accent)'
                        : isWeekend
                          ? 'var(--cu-cat-2)'
                          : 'var(--cu-cat-1)',
                      opacity: isPeak ? 0.95 : 0.82,
                    }}
                  />
                  {isPeak ? (
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute right-0 left-0 text-center font-mono text-[8px] uppercase tracking-[0.06em] text-[var(--color-accent)]"
                      style={{ bottom: `calc(${Math.max(ratio * 100, 1)}% + 3px)` }}
                    >
                      peak
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex justify-between font-mono text-[9px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
            {WEEKDAY_NAMES.map((n, i) => (
              <span
                key={n}
                className={[
                  'flex-1 text-center',
                  i === 0 || i === 6 ? 'text-[var(--color-text-muted)]' : '',
                  i === peakWeekday ? 'text-[var(--color-accent)]' : '',
                ].join(' ')}
              >
                {n}
              </span>
            ))}
          </div>
        </Panel>
      </div>

      <Panel
        title="7 × 24 heatmap"
        subtitle={`rows = weekday · cols = hour (UTC) · ${metric === 'cost' ? 'USD per cell' : 'requests per cell'}`}
      >
        <div className="overflow-x-auto">
          <WeekHourHeatmap
            cells={cells}
            metricLabel={metric === 'cost' ? 'USD' : 'requests'}
            responsive
          />
        </div>
      </Panel>

      <Panel
        title="Top 5 hot slots"
        subtitle="single highest cost / requests cells across the hour × weekday grid"
      >
        <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
          {hotSlots.length === 0 ? (
            <div className="col-span-full py-4 text-center font-mono text-[11px] text-[var(--color-text-subtle)]">
              No hot slots — your burn is evenly distributed.
            </div>
          ) : (
            hotSlots.map((s, i) => {
              const isHero = i === 0;
              const heroRatio = s.value / hotSlots[0]!.value;
              return (
                <motion.div
                  key={`${s.weekday}-${s.hour}`}
                  initial={{ opacity: 0, y: 12, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{
                    duration: 0.4,
                    delay: 0.2 + i * 0.07,
                    ease: [0.2, 0, 0, 1],
                  }}
                  whileHover={{ y: -2 }}
                  className={[
                    'group/slot relative flex flex-col gap-1 overflow-hidden rounded-md border p-3 transition-shadow duration-[220ms]',
                    isHero
                      ? 'border-[color:color-mix(in_oklab,var(--color-accent)_55%,var(--color-border))] bg-[var(--color-surface-raised)] shadow-[inset_0_1px_0_color-mix(in_oklab,var(--color-accent)_25%,transparent)]'
                      : 'border-[var(--color-border)] bg-[var(--color-surface-raised)]',
                  ].join(' ')}
                >
                  {/* Magnitude bar at the bottom — shows each slot's value relative to #1. */}
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute right-0 bottom-0 left-0 h-[3px] origin-left"
                    style={{
                      transform: `scaleX(${Math.max(heroRatio, 0.05)})`,
                      background:
                        'linear-gradient(90deg, var(--color-accent), color-mix(in oklab, var(--color-accent) 50%, transparent))',
                      transition: 'transform 220ms ease-out',
                    }}
                  />
                  <div className="flex items-baseline justify-between">
                    <span
                      className={[
                        'font-mono uppercase tracking-[0.1em]',
                        isHero
                          ? 'text-[10px] text-[var(--color-accent)]'
                          : 'text-[9px] text-[var(--color-text-subtle)]',
                      ].join(' ')}
                    >
                      #{i + 1}
                    </span>
                    <span className="font-mono text-[10px] text-[var(--color-text-subtle)]">
                      {WEEKDAY_NAMES[s.weekday]} {String(s.hour).padStart(2, '0')}:00
                    </span>
                  </div>
                  <div
                    className={[
                      'font-serif leading-tight tabular-nums',
                      isHero ? 'text-[26px]' : 'text-[22px]',
                    ].join(' ')}
                    style={{ color: 'var(--color-accent)' }}
                  >
                    {metric === 'cost' ? fmtUSD(s.value) : `${s.value.toFixed(0)}`}
                  </div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--color-text-muted)]">
                    {metric === 'cost' ? `${s.rows} ${s.rows === 1 ? 'row' : 'rows'}` : 'requests'}
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </Panel>

      <SelectionDetailPanel
        filter={filter}
        rows={filteredRows}
        onClear={() => setFilter({ kind: 'all' })}
      />
    </motion.div>
  );
}

interface SelectionDetailPanelProps {
  filter: DateFilter;
  rows: ReadonlyArray<RowWithCost>;
  onClear: () => void;
}

const DETAIL_CAP = 500;

/**
 * Per-row drill-down for the current date filter. Hidden when "All days" is
 * selected — at that scope the full Details route is the better tool. Once
 * the user narrows down (single day / multi / range) every request inside
 * the selection is listed, sorted by cost desc so the worst offenders rise
 * to the top.
 *
 * Capped to 500 rows so a wide range doesn't blow up the DOM; the cap pretty
 * much never bites for the single-day path that motivated this panel.
 */
function SelectionDetailPanel({ filter, rows, onClear }: SelectionDetailPanelProps) {
  // Hooks must run unconditionally — even when the panel is hidden — so React's
  // hook-order invariant is preserved across renders.
  const sorted = useMemoSorted(rows);

  // The user explicitly asked for "click a day → list every request from that
  // day at the bottom". For 'all' we still hide the panel; the dedicated
  // Details route is the right tool when nothing is filtered.
  if (filter.kind === 'all') return null;

  const capped = sorted.slice(0, DETAIL_CAP);
  const scopeLabel = describeScope(filter);

  if (sorted.length === 0) {
    return (
      <Panel title="Requests in selection" subtitle={`${scopeLabel} · 0 requests`}>
        <div className="flex flex-col items-center gap-2 py-6 text-center font-mono text-[11px] text-[var(--color-text-subtle)]">
          <span className="font-serif text-[16px] text-[var(--color-text)]">
            No requests in this date selection
          </span>
          <span>The day(s) you picked don’t contain any rows from your dataset.</span>
          <button
            type="button"
            onClick={onClear}
            className="mt-1 rounded-sm border border-[var(--color-border)] px-2 py-1 uppercase tracking-[0.08em] text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
          >
            Clear selection
          </button>
        </div>
      </Panel>
    );
  }

  // Inline summary stats for the selection — feels like a fact-sheet header
  // above the list of rows.
  const totalCost = sorted.reduce((acc, r) => acc + r.cost, 0);
  const totalTokens = sorted.reduce((acc, r) => acc + r.tokens.total, 0);
  return (
    <Panel
      title="Requests in selection"
      subtitle={`${scopeLabel} · ${sorted.length} requests · sorted by cost ↓${
        sorted.length > DETAIL_CAP ? ` · showing first ${DETAIL_CAP}` : ''
      }`}
    >
      <div className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <SelectionStat label="Requests" value={sorted.length.toLocaleString()} />
        <SelectionStat label="Total cost" value={fmtUSD(totalCost)} accent={totalCost > 0} />
        <SelectionStat label="Total tokens" value={fmtTokens(totalTokens)} />
        <SelectionStat
          label="Avg / request"
          value={fmtUSD(sorted.length > 0 ? totalCost / sorted.length : 0)}
        />
      </div>
      <div className="overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[inset_0_1px_0_color-mix(in_oklab,var(--color-text)_3%,transparent)]">
        <div className="max-h-[420px] overflow-auto">
          <table className="w-full min-w-[640px] border-collapse text-left font-mono text-[11px]">
            <thead className="sticky top-0 z-[1] bg-[var(--color-surface-muted)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--color-surface-muted)]/80">
              <tr className="border-b border-[var(--color-border)]">
                {(
                  [
                    { key: 'Time (UTC)', align: 'left' },
                    { key: 'Model', align: 'left' },
                    { key: 'Kind', align: 'left' },
                    { key: 'Cost', align: 'right' },
                    { key: 'Tokens', align: 'right' },
                    { key: 'Cache hit', align: 'right' },
                    { key: 'Max', align: 'center' },
                  ] as const
                ).map((h) => (
                  <th
                    key={h.key}
                    className={`px-3 py-2 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)] text-${h.align}`}
                  >
                    {h.key}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {capped.map((r, i) => {
                const tokensTotal = r.tokens.total;
                const cacheRatio = tokensTotal > 0 ? r.tokens.cacheRead / tokensTotal : 0;
                const time = r.date.toISOString().slice(11, 16);
                const costIsHero = r.cost >= 1;
                const zebraStyle: React.CSSProperties =
                  i % 2 === 1
                    ? {
                        background:
                          'color-mix(in oklab, var(--color-surface-muted) 35%, transparent)',
                      }
                    : {};
                return (
                  <tr
                    key={r.id}
                    className="group/row border-b border-[var(--color-border)]/40 transition-colors last:border-b-0 hover:bg-[var(--color-surface-raised)]"
                    style={zebraStyle}
                  >
                    <td className="relative px-3 py-1.5 align-middle text-[var(--color-text-muted)]">
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-y-1 left-0 w-px scale-y-0 bg-[var(--color-accent)] opacity-0 transition-all duration-[200ms] ease-out group-hover/row:scale-y-100 group-hover/row:opacity-100"
                      />
                      <span className="text-[var(--color-text)]">{r.dateISO.slice(0, 10)}</span>{' '}
                      <span className="text-[var(--color-text-subtle)]">{time}</span>
                    </td>
                    <td className="px-3 py-1.5 align-middle">
                      <span className="text-[var(--color-text)]">{r.model}</span>
                      {r.costEstimated ? (
                        <span
                          className="ml-1.5 rounded-sm border border-[var(--color-border)] px-1 py-0 font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--color-text-subtle)]"
                          title="Cost estimated (model not in official table)"
                        >
                          est
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-1.5 align-middle text-[var(--color-text-subtle)] uppercase tracking-[0.06em]">
                      {r.kind}
                    </td>
                    <td
                      className={[
                        'px-3 py-1.5 text-right align-middle tabular-nums',
                        costIsHero ? 'text-[12px] font-medium' : 'text-[11px]',
                      ].join(' ')}
                      style={{ color: r.cost > 0 ? 'var(--color-accent)' : undefined }}
                    >
                      {fmtUSD(r.cost)}
                    </td>
                    <td className="px-3 py-1.5 text-right align-middle tabular-nums text-[var(--color-text-muted)]">
                      {fmtTokens(tokensTotal)}
                    </td>
                    <td className="px-3 py-1.5 text-right align-middle tabular-nums text-[var(--color-text-muted)]">
                      {tokensTotal > 0 ? `${(cacheRatio * 100).toFixed(0)}%` : '—'}
                    </td>
                    <td className="px-3 py-1.5 text-center align-middle">
                      {r.maxMode ? (
                        <span
                          className="rounded-sm px-1.5 py-0.5 text-[9px] uppercase tracking-[0.08em]"
                          style={{
                            background: 'color-mix(in oklab, var(--color-accent) 18%, transparent)',
                            color: 'var(--color-accent)',
                            border:
                              '1px solid color-mix(in oklab, var(--color-accent) 32%, transparent)',
                          }}
                        >
                          max
                        </span>
                      ) : (
                        <span className="text-[var(--color-text-subtle)]">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Panel>
  );
}

function SelectionStat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-2.5">
      <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--color-text-subtle)]">
        {label}
      </div>
      <div
        className="mt-0.5 font-serif text-[18px] leading-tight tabular-nums"
        style={accent ? { color: 'var(--color-accent)' } : undefined}
      >
        {value}
      </div>
    </div>
  );
}

function useMemoSorted(rows: ReadonlyArray<RowWithCost>): RowWithCost[] {
  return useMemo(
    () => [...rows].sort((a, b) => b.cost - a.cost || b.tokens.total - a.tokens.total),
    [rows],
  );
}

function describeScope(filter: DateFilter): string {
  if (filter.kind === 'single') return filter.date;
  if (filter.kind === 'multi') return `${filter.dates.length} days`;
  if (filter.kind === 'range') {
    if (filter.start === filter.end) return filter.start;
    return `${filter.start} → ${filter.end}`;
  }
  return 'all days';
}

function filterSummaryText(
  filter: DateFilter,
  totalRows: number,
  filteredRows: number,
): string | null {
  if (filter.kind === 'all') return null;
  if (filteredRows === 0) return `0 / ${totalRows} rows · empty selection`;
  return `${filteredRows} / ${totalRows} rows`;
}
