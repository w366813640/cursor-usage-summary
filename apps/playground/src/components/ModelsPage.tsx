import { Sparkline, fmtTokens, fmtUSD } from '@cu/charts';
import type { RowWithCost, UsageSummary } from '@cu/data';
import { ChevronRight } from '@cu/icons';
import { motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { SectionHeader } from './SectionHeader';

interface ModelsPageProps {
  summary: UsageSummary;
  rows: ReadonlyArray<RowWithCost>;
}

type SortKey = 'cost' | 'rows' | 'avg' | 'tokens';

interface ModelStats {
  model: string;
  cost: number;
  rows: number;
  shareOfCost: number;
  costEstimated: boolean;
  totalTokens: number;
  cacheReadTokens: number;
  inputTokens: number;
  cacheHitRatio: number;
  avgCost: number;
  trend: { date: string; value: number }[];
  /** YYYY-MM-DD of the most recent usage row for this model. */
  lastSeenISO: string;
  /** Days since `lastSeenISO`, using `Date.now()` as the clock. */
  daysSinceLastSeen: number;
}

/**
 * Rules that classify a model as "low activity" and hide it from the
 * default table view. The user can flip them on with the "show all"
 * toggle when they actually want to audit deprecated models.
 *
 *   - LOW_ROW_THRESHOLD  — fewer than N requests against this model
 *     across the whole dataset
 *   - STALE_DAYS         — last call was more than N days ago AND the
 *     model isn't carrying material spend (>$1 keeps it visible even
 *     when stale, so an expensive forgotten run doesn't disappear)
 */
const LOW_ROW_THRESHOLD = 10;
const STALE_DAYS = 30;
const STALE_KEEP_IF_COST_OVER = 1;

/**
 * Per-model drill-down. Shows every model as a row with its cost share,
 * token mix, cache hit ratio, daily-cost sparkline, and badges. Click a
 * row to expand into a detail card with broken-out token buckets.
 */
export function ModelsPage({ summary, rows }: ModelsPageProps) {
  const [sortKey, setSortKey] = useState<SortKey>('cost');
  const [expanded, setExpanded] = useState<string | null>(null);
  // Default-on filter that hides deprecated / barely-used models. Power
  // users flip it off via the "show all" toggle below the section header
  // when they want to audit the long tail (e.g. confirming a deprecated
  // model is actually gone). Off-by-default would re-introduce the
  // 30-row noisy table the user just asked us to clean up.
  const [hideLowActivity, setHideLowActivity] = useState(true);

  // Per-model aggregates derived from RowWithCost — byModel only has totals,
  // not the per-row token detail or daily trend we need for the cards.
  const stats: ModelStats[] = useMemo(() => {
    const grand = summary.totalCost;
    const byModelRows = new Map<string, RowWithCost[]>();
    for (const r of rows) {
      const list = byModelRows.get(r.model) ?? [];
      list.push(r);
      byModelRows.set(r.model, list);
    }

    const now = Date.now();
    const out: ModelStats[] = [];
    for (const m of summary.byModel) {
      const list = byModelRows.get(m.model) ?? [];
      let cacheRead = 0;
      let inputNoCache = 0;
      let inputWithCache = 0;
      let output = 0;
      let lastSeenMs = 0;
      const dayMap = new Map<string, number>();
      for (const r of list) {
        if (r.requests.kind !== 'units') continue;
        cacheRead += r.tokens.cacheRead;
        inputNoCache += r.tokens.inputWithoutCacheWrite;
        inputWithCache += r.tokens.inputWithCacheWrite;
        output += r.tokens.output;
        const ts = r.date.getTime();
        if (ts > lastSeenMs) lastSeenMs = ts;
        const ymd = r.date.toISOString().slice(0, 10);
        dayMap.set(ymd, (dayMap.get(ymd) ?? 0) + r.cost);
      }
      const totalInput = cacheRead + inputNoCache + inputWithCache;
      const totalTokens = totalInput + output;
      const trend = Array.from(dayMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, value]) => ({ date, value }));
      const lastSeenISO = lastSeenMs > 0 ? new Date(lastSeenMs).toISOString().slice(0, 10) : '';
      const daysSinceLastSeen =
        lastSeenMs > 0
          ? Math.floor((now - lastSeenMs) / (24 * 60 * 60 * 1000))
          : Number.POSITIVE_INFINITY;
      out.push({
        model: m.model,
        cost: m.cost,
        rows: m.rows,
        shareOfCost: grand > 0 ? m.cost / grand : 0,
        costEstimated: m.costEstimated,
        totalTokens,
        cacheReadTokens: cacheRead,
        inputTokens: inputNoCache + inputWithCache,
        cacheHitRatio: totalInput > 0 ? cacheRead / totalInput : 0,
        avgCost: m.rows > 0 ? m.cost / m.rows : 0,
        trend,
        lastSeenISO,
        daysSinceLastSeen,
      });
    }
    return out;
  }, [rows, summary.byModel, summary.totalCost]);

  // Partition into "active" and "hidden". A model lands in `hidden`
  // when it's both rarely used AND has no recent activity — both
  // conditions matter so a brand-new model with only 2 calls survives
  // the cut. We never hide models that carry material recent spend,
  // even if rows are low.
  const partition = useMemo(() => {
    const low: ModelStats[] = [];
    const visible: ModelStats[] = [];
    for (const s of stats) {
      const isLowRows = s.rows < LOW_ROW_THRESHOLD;
      const isStale = s.daysSinceLastSeen > STALE_DAYS && s.cost < STALE_KEEP_IF_COST_OVER;
      if (isLowRows || isStale) low.push(s);
      else visible.push(s);
    }
    return { visible, low };
  }, [stats]);

  const sorted = useMemo(() => {
    const base = hideLowActivity ? partition.visible : stats;
    const arr = [...base];
    arr.sort((a, b) => {
      switch (sortKey) {
        case 'rows':
          return b.rows - a.rows;
        case 'avg':
          return b.avgCost - a.avgCost;
        case 'tokens':
          return b.totalTokens - a.totalTokens;
        default:
          return b.cost - a.cost;
      }
    });
    return arr;
  }, [stats, partition.visible, sortKey, hideLowActivity]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.42, ease: [0.2, 0, 0, 1] }}
      className="flex flex-col gap-4"
    >
      <SectionHeader
        sticky
        title="Models"
        subtitle={`${sorted.length} / ${stats.length} models · click a row to expand token mix + daily-cost`}
        action={
          <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
            <span>sort by</span>
            <div className="flex items-center gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-0.5 shadow-[inset_0_1px_0_color-mix(in_oklab,var(--color-text)_2%,transparent)]">
              {(
                [
                  ['cost', 'cost'],
                  ['rows', 'rows'],
                  ['avg', 'avg'],
                  ['tokens', 'tokens'],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setSortKey(k)}
                  className={[
                    'rounded-sm px-2 py-1 transition-all duration-[160ms]',
                    sortKey === k
                      ? 'bg-[var(--color-surface-raised)] text-[var(--color-accent)] shadow-[inset_0_-1px_0_color-mix(in_oklab,var(--color-accent)_60%,transparent)]'
                      : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]',
                  ].join(' ')}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        }
      />

      {partition.low.length > 0 ? (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-dashed border-[var(--color-border)] bg-[var(--color-surface-muted)]/40 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]"
          aria-live="polite"
        >
          <span>
            {hideLowActivity ? (
              <>
                Hiding <span className="text-[var(--color-text)]">{partition.low.length}</span>{' '}
                low-activity model{partition.low.length === 1 ? '' : 's'} (&lt; {LOW_ROW_THRESHOLD}{' '}
                requests or stale &gt; {STALE_DAYS}d).
              </>
            ) : (
              <>
                Showing all <span className="text-[var(--color-text)]">{stats.length}</span> models
                — including {partition.low.length} flagged as low-activity.
              </>
            )}
          </span>
          <button
            type="button"
            onClick={() => setHideLowActivity((v) => !v)}
            className="rounded-md border border-[var(--color-border)] px-2 py-1 transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
          >
            {hideLowActivity ? 'show all' : 'hide low-activity'}
          </button>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[inset_0_1px_0_color-mix(in_oklab,var(--color-text)_3%,transparent),0_10px_28px_-22px_rgba(0,0,0,0.55)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead className="sticky top-0 z-[1] bg-[var(--color-surface-muted)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--color-surface-muted)]/80">
              <tr className="border-b border-[var(--color-border)]">
                {(
                  [
                    { key: 'Model', align: 'left' },
                    { key: 'Cost', align: 'right' },
                    { key: 'Share', align: 'right' },
                    { key: 'Rows', align: 'right' },
                    { key: 'Avg', align: 'right' },
                    { key: 'Tokens', align: 'right' },
                    { key: 'Cache hit', align: 'right' },
                    { key: 'Trend', align: 'left' },
                  ] as const
                ).map((h) => (
                  <th
                    key={h.key}
                    className={`px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)] text-${h.align}`}
                  >
                    {h.key}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((s, i) => {
                const isOpen = expanded === s.model;
                return (
                  <ModelRow
                    key={s.model}
                    stats={s}
                    isOpen={isOpen}
                    rowIndex={i}
                    onToggle={() => setExpanded(isOpen ? null : s.model)}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}

interface ModelRowProps {
  stats: ModelStats;
  isOpen: boolean;
  rowIndex: number;
  onToggle: () => void;
}

function ModelRow({ stats: s, isOpen, rowIndex, onToggle }: ModelRowProps) {
  // The #1 model (by current sort) gets a slightly heavier name treatment.
  // It's a soft hierarchy hint — not a big chrome change.
  const isLeader = rowIndex === 0;
  // Cost cell scales with magnitude — same logic as Details so cost reads
  // consistently across both pages.
  const costIsHero = s.cost >= 50;
  // Zebra via color-mix (Tailwind opacity modifier doesn't apply to vars).
  const zebraStyle: React.CSSProperties =
    rowIndex % 2 === 1 && !isOpen
      ? { background: 'color-mix(in oklab, var(--color-surface-muted) 35%, transparent)' }
      : {};
  return (
    <>
      <tr
        onClick={onToggle}
        className={[
          'group/row cursor-pointer border-b border-[var(--color-border)]/40 transition-colors',
          isOpen
            ? 'bg-[var(--color-surface-raised)] shadow-[inset_3px_0_0_var(--color-accent)]'
            : 'hover:bg-[var(--color-surface-raised)]',
        ].join(' ')}
        style={zebraStyle}
      >
        <td className="relative px-3 py-2.5 align-middle">
          {/* Accent rail on hover — only when the row isn't already open */}
          {!isOpen ? (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-1 left-0 w-px scale-y-0 bg-[var(--color-accent)] opacity-0 transition-all duration-[200ms] ease-out group-hover/row:scale-y-100 group-hover/row:opacity-100"
            />
          ) : null}
          <div className="flex items-center gap-2">
            <ChevronRight
              size={12}
              className={[
                'shrink-0 text-[var(--color-text-subtle)] transition-transform duration-[200ms]',
                isOpen ? 'rotate-90 text-[var(--color-accent)]' : '',
              ].join(' ')}
              aria-hidden="true"
            />
            <span
              className={[
                'font-mono text-[12px]',
                isLeader ? 'font-medium text-[var(--color-text)]' : 'text-[var(--color-text)]',
              ].join(' ')}
            >
              {s.model}
            </span>
            {s.costEstimated ? (
              <span
                className="rounded-sm border border-[var(--color-border)] px-1 py-px font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--color-text-subtle)]"
                title="Not in the official pricing table — estimated against the Auto pool rate"
              >
                est
              </span>
            ) : null}
          </div>
        </td>
        <td
          className={[
            'px-3 py-2.5 text-right align-middle font-mono tabular-nums',
            costIsHero ? 'text-[13px] font-medium' : 'text-[12px]',
          ].join(' ')}
        >
          <span style={{ color: 'var(--color-accent)' }}>{fmtUSD(s.cost)}</span>
        </td>
        <td className="px-3 py-2.5 text-right align-middle font-mono text-[11px] tabular-nums text-[var(--color-text-muted)]">
          {/* Tiny share-of-cost bar behind the % so the eye can compare across rows
              without a separate chart column. */}
          <div className="relative inline-flex w-[60px] justify-end">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-1 right-0 rounded-sm"
              style={{
                width: `${Math.max(2, s.shareOfCost * 100)}%`,
                background: 'color-mix(in oklab, var(--color-accent) 22%, transparent)',
              }}
            />
            <span className="relative">{(s.shareOfCost * 100).toFixed(1)}%</span>
          </div>
        </td>
        <td className="px-3 py-2.5 text-right align-middle font-mono text-[11px] tabular-nums text-[var(--color-text-muted)]">
          {s.rows.toLocaleString()}
        </td>
        <td className="px-3 py-2.5 text-right align-middle font-mono text-[11px] tabular-nums text-[var(--color-text-muted)]">
          {fmtUSD(s.avgCost)}
        </td>
        <td className="px-3 py-2.5 text-right align-middle font-mono text-[11px] tabular-nums text-[var(--color-text-muted)]">
          {fmtTokens(s.totalTokens)}
        </td>
        <td className="px-3 py-2.5 text-right align-middle font-mono text-[11px] tabular-nums">
          <span
            style={{
              color:
                s.cacheHitRatio >= 0.8
                  ? 'var(--color-accent)'
                  : s.cacheHitRatio >= 0.4
                    ? 'var(--color-text)'
                    : 'var(--color-text-subtle)',
            }}
          >
            {(s.cacheHitRatio * 100).toFixed(0)}%
          </span>
        </td>
        <td className="px-3 py-2 align-middle">
          {s.trend.length > 0 ? (
            <Sparkline
              data={s.trend}
              width={120}
              height={24}
              showLastPoint={false}
              showPeak={false}
              fillArea
            />
          ) : (
            <span className="font-mono text-[11px] text-[var(--color-text-subtle)]">—</span>
          )}
        </td>
      </tr>
      {isOpen ? <ModelExpansion stats={s} /> : null}
    </>
  );
}

function ModelExpansion({ stats: s }: { stats: ModelStats }) {
  const tokenSegments = [
    { id: 'input', label: 'Input', value: s.inputTokens, color: 'var(--cu-cat-1)' },
    { id: 'cache-r', label: 'Cache-R', value: s.cacheReadTokens, color: 'var(--cu-cat-3)' },
    {
      id: 'output',
      label: 'Output',
      value: s.totalTokens - s.inputTokens - s.cacheReadTokens,
      color: 'var(--cu-cat-4)',
    },
  ];
  const tokenTotal = tokenSegments.reduce((acc, x) => acc + x.value, 0);
  return (
    <tr className="border-b border-[var(--color-border)]">
      <td
        colSpan={8}
        className="px-5 py-5"
        style={{
          background:
            'linear-gradient(180deg, color-mix(in oklab, var(--color-accent) 6%, transparent) 0%, transparent 60%), var(--color-surface)',
          boxShadow: 'inset 3px 0 0 var(--color-accent)',
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
          className="flex flex-col gap-4 lg:flex-row lg:items-stretch lg:gap-6"
        >
          <div className="flex flex-1 flex-col gap-2">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
                Token mix
              </span>
              <span className="font-mono text-[11px] text-[var(--color-text-muted)]">
                {fmtTokens(tokenTotal)} total
              </span>
            </div>
            <div className="flex h-[8px] overflow-hidden rounded-sm border border-[var(--color-border)]/60">
              {tokenSegments.map((seg) => {
                const pct = tokenTotal > 0 ? seg.value / tokenTotal : 0;
                if (pct === 0) return null;
                return (
                  <motion.div
                    key={seg.id}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct * 100}%` }}
                    transition={{ duration: 0.42, ease: [0.2, 0, 0, 1] }}
                    style={{ background: seg.color }}
                    title={`${seg.label} · ${fmtTokens(seg.value)} · ${(pct * 100).toFixed(1)}%`}
                  />
                );
              })}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-[var(--color-text-muted)]">
              {tokenSegments.map((seg) => {
                const pct = tokenTotal > 0 ? seg.value / tokenTotal : 0;
                return (
                  <span key={seg.id} className="inline-flex items-center gap-1">
                    <span
                      className="inline-block size-1.5 rounded-[1px]"
                      style={{ background: seg.color }}
                    />
                    <span className="uppercase tracking-[0.06em]">{seg.label}</span>
                    <span className="tabular-nums text-[var(--color-text-subtle)]">
                      {fmtTokens(seg.value)}
                    </span>
                    <span className="tabular-nums text-[var(--color-text-subtle)]/70">
                      ({(pct * 100).toFixed(0)}%)
                    </span>
                  </span>
                );
              })}
            </div>
          </div>
          <div className="flex flex-1 items-stretch">
            <div className="flex w-full flex-col gap-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
                  Daily cost
                </span>
                <span className="font-mono text-[11px] text-[var(--color-text-muted)]">
                  {s.trend.length} {s.trend.length === 1 ? 'day' : 'days'}
                </span>
              </div>
              <Sparkline data={s.trend} width={520} height={48} strokeVar="--color-accent" />
            </div>
          </div>
        </motion.div>
      </td>
    </tr>
  );
}
