import { WeekHourHeatmap, fmtTokens, fmtUSD, hourWeekdayToCells } from '@cu/charts';
import { type RowWithCost, type UsageSummary, aggregate } from '@cu/data';
import { ArrowDown, ArrowRight, ArrowUp, Check, ChevronRight, Flame } from '@cu/icons';
import { useT } from '@cu/ui';
import { motion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuditedRows } from '../hooks/useAuditedRows';
import { useEntranceOnce } from '../hooks/useEntranceOnce';
import {
  type DayAnswer,
  type DayComparison,
  buildDayAnswer,
  buildDayComparisons,
  composeDayNarrative,
} from '../utils/dayAudit';
import { type DateFilter, DateRangeFilter, applyDateFilter } from './DateRangeFilter';
import { MetricToggle, Panel } from './Panel';
import { SectionHeader } from './SectionHeader';
import { TrustHint } from './TrustHint';

interface DayPageProps {
  summary: UsageSummary;
  rows: ReadonlyArray<RowWithCost>;
}

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const DETAIL_CAP = 500;

/**
 * Day audit page — post UI polish rewrite.
 *
 * Note on the file/export name mismatch: the file is `HoursPage.tsx`
 * for git-history continuity (was a 24h+weekday breakdown), the export
 * is `DayPage` because the product surface is now the single-day audit.
 * Renaming the file would lose blame; the cost is one moment of
 * confusion. If you're new here: this file owns route `#day`.
 *
 * Layout (single column, top-to-bottom):
 *
 *   1. SectionHeader + DateRangeFilter
 *   2. Answer hero (cost · share of week · biggest request + Jump button +
 *      narrative paragraph)
 *   3. Day-over-day comparison strip (yesterday + same weekday a week ago)
 *   4. By-hour bar + 7×24 heatmap (two-up on lg)
 *   5. Per-request audit table — mark each row as audited; audited rows
 *      dim out and the header shows the running count.
 *
 * Compared to the previous version we cut the "weekday bar" + "Top 5 hot
 * slots" panels (both redundant on a single-day audit) and the bottom
 * "Request chart" (the actual table is where users click anyway).
 *
 * State that needs to live outside the component:
 *   - sessionStorage `cu:pendingDayDate` — drill-down hint from other
 *     pages
 *   - localStorage `cu:auditedRows` — persisted audited row ids (via
 *     useAuditedRows)
 */
export function DayPage({ summary, rows }: DayPageProps) {
  const t = useT();
  const entrance = useEntranceOnce('day');
  const [metric, setMetric] = useState<'cost' | 'rows'>('cost');
  const [filter, setFilter] = useState<DateFilter>(() => {
    const today = new Date().toISOString().slice(0, 10);
    if (typeof window === 'undefined') return { kind: 'single', date: today };
    try {
      const pending = sessionStorage.getItem('cu:pendingDayDate');
      if (pending) {
        sessionStorage.removeItem('cu:pendingDayDate');
        return { kind: 'single', date: pending };
      }
    } catch {
      // sessionStorage can throw in private-mode sandboxes — fall through.
    }
    return { kind: 'single', date: today };
  });

  useEffect(() => {
    function pickUpPending() {
      try {
        const pending = sessionStorage.getItem('cu:pendingDayDate');
        if (pending) {
          sessionStorage.removeItem('cu:pendingDayDate');
          setFilter({ kind: 'single', date: pending });
        }
      } catch {
        // ignore — best-effort.
      }
    }
    window.addEventListener('hashchange', pickUpPending);
    return () => window.removeEventListener('hashchange', pickUpPending);
  }, []);

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

  const maxHour = Math.max(...hourTotals.map((h) => h.value), 1);
  const peakHour = hourTotals.reduce(
    (best, cur, idx) => (cur.value > hourTotals[best]!.value ? idx : best),
    0,
  );

  // Resolve the "target date" the answer hero / comparison strip work
  // against. For multi-day / range filters we focus on the most recent
  // included day — that's the day the user is most likely auditing.
  const targetDate = useMemo(() => resolveTargetDate(filter), [filter]);
  const answer = useMemo(
    () => (targetDate ? buildDayAnswer(rows, targetDate, t) : null),
    [rows, targetDate, t],
  );
  const comparisons = useMemo(
    () => (targetDate ? buildDayComparisons(rows, targetDate, t) : null),
    [rows, targetDate, t],
  );

  // Ref into the audit table so the hero "Jump to row" button can scroll
  // the biggest request into view + flash the row briefly.
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Map<string, HTMLTableRowElement | null>>(new Map());
  const jumpToRow = useCallback((id: string) => {
    const row = rowRefs.current.get(id);
    if (!row) return;
    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    row.setAttribute('data-history-flash', 'true');
    window.setTimeout(() => row.removeAttribute('data-history-flash'), 1200);
  }, []);

  const grandTotal = metric === 'cost' ? filteredSummary.totalCost : filteredSummary.totalRows;
  const grandLabel = metric === 'cost' ? fmtUSD(grandTotal) : `${grandTotal} rows`;
  const filterSummary = filterSummaryText(filter, rows.length, filteredSummary.totalRows);

  return (
    <motion.div
      initial={entrance ? { opacity: 0, y: 12 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.42, ease: [0.2, 0, 0, 1] }}
      className={`flex flex-col gap-4${entrance ? '' : ' cu-charts-no-anim'}`}
    >
      <SectionHeader
        sticky
        title="Day audit"
        subtitle={`UTC · ${grandLabel}${filterSummary ? ` · ${filterSummary}` : ''}`}
        action={<MetricToggle value={metric} options={['cost', 'rows']} onChange={setMetric} />}
      />

      <DateRangeFilter rows={rows} value={filter} onChange={setFilter} />

      {answer && comparisons ? (
        <DayAnswerHero
          answer={answer}
          comparison={comparisons.yesterday}
          sameWeekday={comparisons.sameWeekday}
          onJumpToBiggest={jumpToRow}
          partiallyEstimated={summary.costPartiallyEstimated}
        />
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel
          title="By hour of day"
          subtitle={`24 hours (UTC) · peak ${String(peakHour).padStart(2, '0')}:00 (${metric === 'cost' ? fmtUSD(maxHour) : `${Math.round(maxHour)} req`})`}
        >
          <div className="relative flex h-[140px] items-end gap-[2px]">
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
                    initial={entrance ? { height: 0 } : false}
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
                      className="pointer-events-none absolute right-0 left-0 text-center font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--color-accent)]"
                      style={{ bottom: `calc(${Math.max(ratio * 100, 1)}% + 3px)` }}
                    >
                      peak
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex justify-between font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
            {[0, 6, 12, 18, 23].map((h) => (
              <span key={h}>{String(h).padStart(2, '0')}h</span>
            ))}
          </div>
        </Panel>

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
      </div>

      <SelectionDetailPanel
        filter={filter}
        rows={filteredRows}
        onClear={() => setFilter({ kind: 'all' })}
        scrollRef={tableScrollRef}
        rowRefs={rowRefs}
      />
    </motion.div>
  );
}

/* ----------------------------------------------------------------
 * Answer hero — single combined card.
 *
 * Post-feedback rewrite: collapses what used to be three separate
 * UI strips (cost hero · biggest request card · two-day comparison
 * strip · top-driver card) into ONE card with three vertical zones:
 *
 *   1. Top stat strip   — cost / requests / share / Δ vs yesterday
 *   2. Narrative line   — one short sentence pulled from
 *                          composeDayNarrative()
 *   3. Highlight row    — single biggest request + "Jump to row"
 *
 * The same-weekday-last-week baseline gets a faint footer chip when
 * present. Top-driver model is intentionally dropped here because the
 * narrative already names it; doubling it added noise the user called
 * out as "too much information layered".
 * ---------------------------------------------------------------- */

interface DayAnswerHeroProps {
  partiallyEstimated: boolean;
  answer: DayAnswer;
  comparison: DayComparison;
  sameWeekday: DayComparison;
  onJumpToBiggest: (rowId: string) => void;
}

function DayAnswerHero({
  answer,
  comparison,
  sameWeekday,
  onJumpToBiggest,
  partiallyEstimated,
}: DayAnswerHeroProps) {
  const t = useT();
  const narrative = useMemo(
    () => composeDayNarrative(answer, comparison, t),
    [answer, comparison, t],
  );
  const sharePct = Math.round(answer.shareOfWeek * 100);
  const biggestTime = answer.biggest ? answer.biggest.date.toISOString().slice(11, 16) : null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.36, ease: [0.2, 0, 0, 1] }}
      aria-label="Day answer"
      className="relative overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface)]"
      style={{
        borderRadius: 'var(--cu-density-panel-radius)',
        padding: 'var(--cu-density-panel-padding)',
      }}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-3 top-0 h-px"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, color-mix(in oklab, var(--color-accent) 65%, transparent) 50%, transparent 100%)',
        }}
      />

      <header className="flex items-baseline justify-between gap-2 pb-3">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="inline-block size-1.5 rounded-full"
            style={{
              background: 'var(--color-accent)',
              boxShadow: '0 0 0 3px color-mix(in oklab, var(--color-accent) 22%, transparent)',
            }}
          />
          <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
            Day answer
          </span>
        </div>
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
          {answer.dateLabel}
        </span>
      </header>

      <div className="flex items-baseline gap-4">
        <p
          className="flex items-baseline font-serif text-[36px] leading-[1.05] tracking-[-0.01em] tabular-nums text-[var(--color-text)]"
          style={{ fontFeatureSettings: '"tnum" 1' }}
        >
          {fmtUSD(answer.totalCost)}
          <TrustHint partiallyEstimated={partiallyEstimated} side="bottom" />
        </p>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
          <span>
            {answer.totalRows.toLocaleString()} request{answer.totalRows === 1 ? '' : 's'}
          </span>
          <span>·</span>
          <span>{sharePct}% of 7-day window</span>
          <DeltaChip comparison={comparison} label="vs yesterday" />
        </div>
      </div>

      {narrative ? (
        <p className="mt-3 font-mono text-[12px] leading-relaxed text-[var(--color-text-muted)]">
          {narrative}
        </p>
      ) : null}

      {answer.biggest ? (
        <div className="mt-4 flex items-center gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-2.5">
          <Flame
            size={14}
            aria-hidden="true"
            className="shrink-0"
            style={{ color: 'var(--color-accent)' }}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span
                className="font-serif text-[18px] tabular-nums leading-none"
                style={{ color: 'var(--color-accent)' }}
              >
                {fmtUSD(answer.biggest.cost)}
              </span>
              <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
                single biggest
              </span>
            </div>
            <div className="mt-1 truncate font-mono text-[11px] text-[var(--color-text-muted)]">
              {answer.biggest.model} · {biggestTime} UTC · {fmtTokens(answer.biggest.tokens.total)}{' '}
              tokens
            </div>
          </div>
          <button
            type="button"
            onClick={() => onJumpToBiggest(answer.biggest!.id)}
            className="flex shrink-0 items-center gap-1 rounded-sm border border-[var(--color-border)] px-2 py-1 font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
          >
            Jump
            <ArrowRight size={11} aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {sameWeekday.hasReferenceData ? (
        <p className="mt-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--color-text-subtle)]">
          <DeltaChip comparison={sameWeekday} label="vs same weekday last week" inline />
          <span className="truncate">{sameWeekday.referenceLabel}</span>
        </p>
      ) : null}
    </motion.section>
  );
}

/**
 * Tiny up/down/flat chip used inside the hero stat strip and the
 * same-weekday footer. Pulls styling tokens directly so changes to
 * the design system propagate without prop drilling.
 */
function DeltaChip({
  comparison,
  label,
  inline = false,
}: {
  comparison: DayComparison;
  label: string;
  inline?: boolean;
}) {
  if (!comparison.hasReferenceData || !Number.isFinite(comparison.pctDelta)) {
    if (inline) {
      return (
        <span className="font-mono text-[11px] text-[var(--color-text-subtle)]">no baseline</span>
      );
    }
    return null;
  }
  const delta = comparison.pctDelta;
  const isFlat = Math.abs(delta) < 0.05;
  const isUp = delta > 0;
  const tone = isFlat
    ? 'var(--color-text-subtle)'
    : isUp
      ? 'var(--color-warning)'
      : 'var(--color-success, #4ade80)';
  const arrow = isFlat ? null : isUp ? (
    <ArrowUp size={11} aria-hidden="true" />
  ) : (
    <ArrowDown size={11} aria-hidden="true" />
  );
  const pctText = `${isUp ? '+' : ''}${(delta * 100).toFixed(0)}%`;
  return (
    <span
      className="flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.08em]"
      style={{ color: tone }}
    >
      {arrow}
      {pctText}
      {!inline ? (
        <span className="text-[var(--color-text-subtle)] normal-case tracking-normal">
          {' '}
          {label}
        </span>
      ) : null}
    </span>
  );
}

/* ----------------------------------------------------------------
 * Per-request audit table
 *
 * Replaces the simpler "Requests in selection" table. Adds a mark-as-
 * audited checkbox column, dims audited rows, persists state via
 * useAuditedRows, and exposes refs back to the hero so "Jump to row"
 * can scroll a specific id into view.
 * ---------------------------------------------------------------- */

interface SelectionDetailPanelProps {
  filter: DateFilter;
  rows: ReadonlyArray<RowWithCost>;
  onClear: () => void;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  rowRefs: React.MutableRefObject<Map<string, HTMLTableRowElement | null>>;
}

function SelectionDetailPanel({
  filter,
  rows,
  onClear,
  scrollRef,
  rowRefs,
}: SelectionDetailPanelProps) {
  const sorted = useMemoSorted(rows);
  const audit = useAuditedRows();

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

  const totalCost = sorted.reduce((acc, r) => acc + r.cost, 0);
  const totalTokens = sorted.reduce((acc, r) => acc + r.tokens.total, 0);
  const auditedInSelection = capped.filter((r) => audit.isAudited(r.id)).length;

  return (
    <Panel
      title="Requests in selection"
      subtitle={`${scopeLabel} · ${sorted.length} requests · newest first${
        sorted.length > DETAIL_CAP ? ` · showing first ${DETAIL_CAP}` : ''
      } · ${auditedInSelection}/${capped.length} audited`}
      action={
        auditedInSelection > 0 ? (
          <button
            type="button"
            onClick={() => {
              for (const r of capped) {
                if (audit.isAudited(r.id)) audit.toggle(r.id);
              }
            }}
            className="rounded-md border border-[var(--color-border)] px-2 py-1 font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
            title="Reset the audited flag for every row currently shown"
          >
            clear audited
          </button>
        ) : null
      }
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
        <div ref={scrollRef} className="max-h-[460px] overflow-auto">
          <table className="w-full min-w-[680px] border-collapse text-left font-mono text-[11px]">
            <thead className="sticky top-0 z-[1] bg-[var(--color-surface-muted)]">
              <tr className="border-b border-[var(--color-border)]">
                {(
                  [
                    { key: 'Audit', align: 'left' },
                    { key: 'Time (UTC)', align: 'left' },
                    { key: 'Model', align: 'left' },
                    { key: 'Cost', align: 'right' },
                    { key: 'Tokens', align: 'right' },
                    { key: 'Cache', align: 'right' },
                    { key: 'Max', align: 'center' },
                  ] as const
                ).map((h) => (
                  <th
                    key={h.key}
                    className={`px-3 py-2 font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)] text-${h.align}`}
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
                const isAudited = audit.isAudited(r.id);
                const zebraStyle: React.CSSProperties =
                  i % 2 === 1
                    ? {
                        background:
                          'color-mix(in oklab, var(--color-surface-muted) 35%, transparent)',
                      }
                    : {};
                const auditedStyle: React.CSSProperties = isAudited
                  ? {
                      opacity: 0.55,
                      filter: 'grayscale(40%)',
                    }
                  : {};
                return (
                  <tr
                    key={r.id}
                    ref={(node) => {
                      rowRefs.current.set(r.id, node);
                    }}
                    className="group/row border-b border-[var(--color-border)]/40 transition-colors last:border-b-0 hover:bg-[var(--color-surface-raised)]"
                    style={{ ...zebraStyle, ...auditedStyle }}
                  >
                    <td className="px-3 py-1.5 align-middle">
                      <button
                        type="button"
                        onClick={() => audit.toggle(r.id)}
                        aria-pressed={isAudited}
                        title={isAudited ? 'Mark as not audited' : 'Mark as audited'}
                        className={[
                          'flex h-5 w-5 items-center justify-center rounded-sm border transition-colors',
                          isAudited
                            ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-accent-text,white)]'
                            : 'border-[var(--color-border)] text-transparent hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]',
                        ].join(' ')}
                      >
                        <Check size={11} aria-hidden="true" />
                      </button>
                    </td>
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
                          className="ml-1.5 rounded-sm border border-[var(--color-border)] px-1 py-0 font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--color-text-subtle)]"
                          title="Cost estimated (model not in official table)"
                        >
                          est
                        </span>
                      ) : null}
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
                          className="rounded-sm px-1.5 py-0.5 text-[11px] uppercase tracking-[0.08em]"
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
      <p className="mt-2 flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
        <ChevronRight size={11} aria-hidden="true" />
        Marking rows as audited dims them and counts toward the header total. Stored locally, never
        synced.
      </p>
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
      <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--color-text-subtle)]">
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
    () =>
      [...rows].sort(
        (a, b) =>
          b.date.getTime() - a.date.getTime() || b.cost - a.cost || b.tokens.total - a.tokens.total,
      ),
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

function resolveTargetDate(filter: DateFilter): string | null {
  if (filter.kind === 'single') return filter.date;
  if (filter.kind === 'range') return filter.end;
  if (filter.kind === 'multi') {
    if (filter.dates.length === 0) return null;
    return [...filter.dates].sort().at(-1) ?? null;
  }
  return null;
}

// Silence unused-import lint when only a subset of WEEKDAY_NAMES is
// consumed by callers; the constant is still exported by reference
// from anywhere that needs the canonical day labels.
export { WEEKDAY_NAMES };
