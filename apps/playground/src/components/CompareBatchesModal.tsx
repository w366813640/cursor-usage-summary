import { Sparkline, fmtTokens, fmtUSD, fmtUSDCompact } from '@cu/charts';
import {
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  FileSpreadsheet,
  Loader2,
  Minus,
  X,
  Zap,
} from '@cu/icons';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { loadBatchStats } from '../electron/desktopStorage';
import type { BatchStats, BatchSummary } from '../electron/types';
import { describeLastUpdate } from '../utils/relativeTime';

interface CompareBatchesModalProps {
  open: boolean;
  batches: BatchSummary[];
  /**
   * Optional pre-selected batch ids — usually the most recent two are
   * pre-filled so the panel renders something interesting immediately
   * after the user clicks "Compare".
   */
  initialLeftId?: number;
  initialRightId?: number;
  onClose: () => void;
}

/**
 * Side-by-side "diff" panel for any two import batches.
 *
 * Lays out as:
 *
 *   ┌─────────────────────────────────────────────────────────────┐
 *   │  Compare batches                                       [×]  │
 *   │  [ Pick left ▾ ]   vs   [ Pick right ▾ ]                    │
 *   │                                                             │
 *   │  ┌─ batch A ────┐   ┌─ Δ ─┐   ┌─ batch B ────┐              │
 *   │  │ filename     │   │ Δ$  │   │ filename     │              │
 *   │  │ KPI strip    │   │ Δrq │   │ KPI strip    │              │
 *   │  │ top models   │   │ Δrw │   │ top models   │              │
 *   │  │ sparkline    │   │     │   │ sparkline    │              │
 *   │  └──────────────┘   └─────┘   └──────────────┘              │
 *   └─────────────────────────────────────────────────────────────┘
 *
 * Both stats panels load via `bridge.db.batchStats(id)` and the deltas
 * are computed client-side (cheap; both inputs are already aggregated).
 */
export function CompareBatchesModal({
  open,
  batches,
  initialLeftId,
  initialRightId,
  onClose,
}: CompareBatchesModalProps) {
  // Default to the two most recent batches if the caller didn't specify.
  const [leftId, setLeftId] = useState<number | null>(initialLeftId ?? null);
  const [rightId, setRightId] = useState<number | null>(initialRightId ?? null);

  useEffect(() => {
    if (!open) return;
    setLeftId((current) => current ?? initialLeftId ?? batches[0]?.id ?? null);
    setRightId((current) => current ?? initialRightId ?? batches[1]?.id ?? batches[0]?.id ?? null);
  }, [open, initialLeftId, initialRightId, batches]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(0,0,0,0.55)] p-6"
          role="presentation"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.24, ease: [0.2, 0, 0, 1] }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Compare batches"
            className="flex max-h-[90vh] w-full max-w-[1080px] flex-col gap-5 overflow-y-auto rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface)] px-6 pb-6 pt-5 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.65)]"
          >
            <header className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet
                  size={16}
                  className="text-[var(--color-accent)]"
                  aria-hidden="true"
                />
                <div className="flex flex-col gap-0.5">
                  <span className="font-serif text-[18px] leading-tight tracking-tight">
                    Compare batches
                  </span>
                  <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--color-text-subtle)]">
                    side-by-side stats · delta column highlights what moved
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close compare"
                className="rounded-md border border-[var(--color-border)] p-1.5 text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-text)] hover:text-[var(--color-text)]"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </header>

            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <BatchPicker
                batches={batches}
                value={leftId}
                otherValue={rightId}
                onChange={setLeftId}
                label="Left"
              />
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--color-text-subtle)]">
                vs
              </span>
              <BatchPicker
                batches={batches}
                value={rightId}
                otherValue={leftId}
                onChange={setRightId}
                label="Right"
              />
            </div>

            {leftId !== null && rightId !== null ? (
              <CompareBody key={`${leftId}-${rightId}`} leftId={leftId} rightId={rightId} />
            ) : (
              <div className="flex h-[280px] flex-col items-center justify-center gap-2 rounded-md border border-dashed border-[var(--color-border)] text-center font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
                Pick two batches to compare.
              </div>
            )}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

/* -------------------------------------------------------------- *
 *  Body — loads both stats, renders the diff
 * -------------------------------------------------------------- */

function CompareBody({ leftId, rightId }: { leftId: number; rightId: number }) {
  const [left, setLeft] = useState<BatchStats | null>(null);
  const [right, setRight] = useState<BatchStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setLeft(null);
    setRight(null);

    (async () => {
      try {
        const [l, r] = await Promise.all([loadBatchStats(leftId), loadBatchStats(rightId)]);
        if (!active) return;
        setLeft(l);
        setRight(r);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [leftId, rightId]);

  if (loading) {
    return (
      <div className="flex h-[280px] items-center justify-center text-[var(--color-text-subtle)]">
        <Loader2 size={18} aria-hidden="true" className="animate-spin" />
        <span className="ml-3 font-mono text-[11px] uppercase tracking-[0.08em]">
          Loading batch stats…
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="rounded-md border px-3.5 py-3 font-mono text-[11px]"
        style={{
          borderColor: 'color-mix(in oklab, var(--color-destructive) 55%, var(--color-border))',
          background: 'color-mix(in oklab, var(--color-destructive) 8%, transparent)',
          color: 'var(--color-destructive)',
        }}
      >
        {error}
      </div>
    );
  }

  if (!left || !right) {
    return (
      <div className="rounded-md border border-dashed border-[var(--color-border)] px-3.5 py-6 text-center font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
        One of the batches no longer exists. Close + reopen to refresh the list.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_220px_1fr]">
      <BatchCard side="left" stats={left} />
      <DeltaCard left={left} right={right} />
      <BatchCard side="right" stats={right} />
    </div>
  );
}

function BatchCard({ side, stats }: { side: 'left' | 'right'; stats: BatchStats }) {
  const dateRange =
    stats.batch.dateMin === stats.batch.dateMax
      ? (stats.batch.dateMin ?? '—')
      : `${stats.batch.dateMin ?? '—'} → ${stats.batch.dateMax ?? '—'}`;
  return (
    <motion.section
      initial={{ opacity: 0, x: side === 'left' ? -6 : 6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.28, ease: [0.2, 0, 0, 1] }}
      className="flex flex-col gap-3 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4"
    >
      <header className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between gap-2">
          <span
            className="truncate font-mono text-[12px] text-[var(--color-text)]"
            title={stats.batch.sourceFilename}
          >
            {stats.batch.sourceFilename}
          </span>
          <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
            {side === 'left' ? 'A' : 'B'}
          </span>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--color-text-subtle)]">
          {describeLastUpdate(stats.batch.importedAt) ?? 'just now'} · {dateRange}
        </span>
      </header>

      <div className="grid grid-cols-2 gap-2">
        <Metric label="Cost" value={fmtUSD(stats.totals.totalCost)} accent />
        <Metric label="Requests" value={stats.totals.totalRequests.toLocaleString()} />
        <Metric label="Rows" value={stats.totals.rowCount.toLocaleString()} />
        <Metric label="Tokens" value={fmtTokens(stats.totals.totalTokens)} small />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <MiniStat label="Cache hit" value={`${(stats.totals.cacheHitRatio * 100).toFixed(0)}%`} />
        <MiniStat label="Max-mode" value={`${stats.totals.maxModeRows}`} />
        <MiniStat label="Estimated" value={`${stats.totals.estimatedRows}`} />
      </div>

      <div className="flex flex-col gap-1">
        <SubTitle>Top models</SubTitle>
        {stats.topModels.slice(0, 4).map((m) => (
          <div key={m.model} className="flex items-center gap-2 font-mono text-[10px]">
            <span className="w-32 truncate text-[var(--color-text)]" title={m.model}>
              {m.model}
            </span>
            <div className="flex-1 rounded-sm bg-[var(--color-surface)]">
              <div
                className="h-1 rounded-sm"
                style={{
                  width: `${Math.max(2, m.share * 100)}%`,
                  background: 'var(--color-accent)',
                }}
              />
            </div>
            <span className="w-12 text-right tabular-nums text-[var(--color-text-muted)]">
              {fmtUSDCompact(m.cost)}
            </span>
          </div>
        ))}
      </div>

      {stats.byDay.length > 1 ? (
        <div className="flex flex-col gap-1">
          <SubTitle>Daily cost trend</SubTitle>
          <Sparkline
            data={stats.byDay.map((d) => ({ date: d.date, value: d.cost }))}
            width={280}
            height={36}
            strokeWidth={1.2}
            fillArea
            showLastPoint
            showPeak={false}
          />
        </div>
      ) : null}

      {stats.topAgents.length > 0 ? (
        <div className="flex flex-col gap-1">
          <SubTitle>Top agents</SubTitle>
          {stats.topAgents.slice(0, 3).map((a) => (
            <div
              key={`${a.kind}-${a.id}`}
              className="flex items-center justify-between gap-2 font-mono text-[10px]"
            >
              <span className="flex items-center gap-1.5">
                <span
                  className="inline-block size-1.5 rounded-[1px]"
                  style={{
                    background: a.kind === 'cloud-agent' ? 'var(--cu-cat-2)' : 'var(--cu-cat-3)',
                  }}
                />
                <span className="truncate text-[var(--color-text-muted)]" title={a.id}>
                  {truncateId(a.id)}
                </span>
              </span>
              <span className="tabular-nums text-[var(--color-text-muted)]">
                {fmtUSDCompact(a.cost)}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </motion.section>
  );
}

function DeltaCard({ left, right }: { left: BatchStats; right: BatchStats }) {
  const deltas = [
    { label: 'Cost', value: right.totals.totalCost - left.totals.totalCost, fmt: 'usd' as const },
    {
      label: 'Requests',
      value: right.totals.totalRequests - left.totals.totalRequests,
      fmt: 'num' as const,
    },
    { label: 'Rows', value: right.totals.rowCount - left.totals.rowCount, fmt: 'num' as const },
    {
      label: 'Tokens',
      value: right.totals.totalTokens - left.totals.totalTokens,
      fmt: 'tokens' as const,
    },
    {
      label: 'Cache hit',
      value: right.totals.cacheHitRatio - left.totals.cacheHitRatio,
      fmt: 'pct' as const,
    },
  ];

  // Top-model intersection — calls out models present in both buckets, since
  // that's usually the more interesting overlap question than "which models
  // only appear on one side".
  const leftModels = new Set(left.topModels.map((m) => m.model));
  const intersection = right.topModels.filter((m) => leftModels.has(m.model)).slice(0, 3);

  return (
    <motion.section
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.2, 0, 0, 1], delay: 0.08 }}
      className="flex flex-col gap-3 self-start rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
    >
      <SubTitle>Δ B − A</SubTitle>
      <div className="flex flex-col gap-1.5">
        {deltas.map((d) => (
          <DeltaRow key={d.label} {...d} />
        ))}
      </div>
      <div className="border-t border-[var(--color-border)] pt-2">
        <SubTitle>Common top models</SubTitle>
        {intersection.length > 0 ? (
          <ul className="mt-1 flex flex-col gap-0.5 font-mono text-[10px] text-[var(--color-text)]">
            {intersection.map((m) => (
              <li key={m.model} className="truncate" title={m.model}>
                · {m.model}
              </li>
            ))}
          </ul>
        ) : (
          <span className="font-mono text-[10px] text-[var(--color-text-subtle)]">
            no overlap — totally different model mixes
          </span>
        )}
      </div>
      <div className="border-t border-[var(--color-border)] pt-2 text-center font-mono text-[9px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
        <Calendar size={9} className="mr-1 inline-block" aria-hidden="true" />
        {left.batch.importedAt < right.batch.importedAt ? 'A is older' : 'A is newer'}
      </div>
    </motion.section>
  );
}

function DeltaRow({
  label,
  value,
  fmt,
}: {
  label: string;
  value: number;
  fmt: 'usd' | 'num' | 'tokens' | 'pct';
}) {
  const formatted = formatDelta(value, fmt);
  const positive = value > Number.EPSILON;
  const negative = value < -Number.EPSILON;
  const color = positive
    ? 'var(--color-warning)'
    : negative
      ? 'var(--color-accent)'
      : 'var(--color-text-muted)';

  return (
    <div className="flex items-center justify-between gap-2 font-mono text-[11px]">
      <span className="text-[var(--color-text-subtle)]">{label}</span>
      <span className="flex items-center gap-1 tabular-nums" style={{ color }}>
        {positive ? (
          <ArrowUpRight size={10} aria-hidden="true" />
        ) : negative ? (
          <ArrowDownRight size={10} aria-hidden="true" />
        ) : (
          <Minus size={10} aria-hidden="true" />
        )}
        {formatted}
      </span>
    </div>
  );
}

function formatDelta(v: number, fmt: 'usd' | 'num' | 'tokens' | 'pct'): string {
  const sign = v > 0 ? '+' : v < 0 ? '−' : '';
  const abs = Math.abs(v);
  if (fmt === 'usd') return `${sign}${fmtUSDCompact(abs)}`;
  if (fmt === 'tokens') return `${sign}${fmtTokens(abs)}`;
  if (fmt === 'pct') return `${sign}${(abs * 100).toFixed(1)} pp`;
  return `${sign}${abs.toLocaleString(undefined, { maximumFractionDigits: 1 })}`;
}

function truncateId(id: string): string {
  if (id.length <= 14) return id;
  return `${id.slice(0, 6)}…${id.slice(-5)}`;
}

/* -------------------------------------------------------------- *
 *  Sub-components
 * -------------------------------------------------------------- */

function BatchPicker({
  batches,
  value,
  otherValue,
  onChange,
  label,
}: {
  batches: BatchSummary[];
  value: number | null;
  otherValue: number | null;
  onChange: (id: number) => void;
  label: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
        {label}
      </span>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(Number(e.target.value))}
        className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 font-mono text-[12px] text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
      >
        {batches.map((b) => (
          <option key={b.id} value={b.id} disabled={b.id === otherValue}>
            {b.sourceFilename} · {b.dateMin ?? '—'} → {b.dateMax ?? '—'}
          </option>
        ))}
      </select>
    </label>
  );
}

function Metric({
  label,
  value,
  accent,
  small,
}: {
  label: string;
  value: string;
  accent?: boolean;
  small?: boolean;
}) {
  return (
    <div className="rounded-sm border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-2">
      <div className="font-mono text-[9px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
        {label}
      </div>
      <div
        className={['mt-0.5 font-mono tabular-nums', small ? 'text-[12px]' : 'text-[15px]'].join(
          ' ',
        )}
        style={accent ? { color: 'var(--color-accent)' } : undefined}
        title={value}
      >
        {value}
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm bg-[var(--color-surface)] px-2 py-1.5">
      <div className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
        <Zap size={9} aria-hidden="true" />
        {label}
      </div>
      <div className="mt-0.5 font-mono text-[11px] tabular-nums text-[var(--color-text)]">
        {value}
      </div>
    </div>
  );
}

function SubTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-[9px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
      {children}
    </div>
  );
}
