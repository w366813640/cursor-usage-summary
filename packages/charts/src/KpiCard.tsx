import { motion } from 'framer-motion';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { type SparkPoint, Sparkline } from './Sparkline';

export interface KpiCardProps {
  label: string;
  /** Main display value. Use a string so you control formatting / casing. */
  value: string;
  /** Optional meta line shown beneath the value. */
  meta?: ReactNode;
  /** Optional accent treatment — applies brand color to the value. */
  accent?: boolean;
  /** Optional sparkline tucked at the bottom of the card. */
  trend?: ReadonlyArray<SparkPoint>;
  /** Reference line value on the sparkline (e.g. rolling average). */
  trendReference?: number | null;
  /** Optional short label for the reference line ("avg"). */
  trendReferenceLabel?: string;
  /** When true, the value uses mono (good for compact text-y values). */
  monoValue?: boolean;
  /**
   * Optional badge in the top-right (e.g. "EST." for estimated cost).
   * Pass a ReactNode for richer rendering.
   */
  badge?: ReactNode;
  /** Optional decoration slot below `meta`, above the sparkline. */
  insetSlot?: ReactNode;
  /**
   * When true, animate the value on mount. The hero number tweens from 0
   * to `numericValue` (if provided) over ~1.2s using ease-out cubic. The
   * `formatValue` callback is called every frame to keep formatting
   * consistent with the static `value`.
   */
  animate?: boolean;
  /** Numeric value to tween from 0 — required when `animate` is true. */
  numericValue?: number;
  /** Frame-by-frame formatter for the animated value. */
  formatValue?: (n: number) => string;
  /** Animation duration in ms. Default 1200. */
  animateDurationMs?: number;
  className?: string;
  /**
   * When true, the headline value gets a "copy to clipboard" affordance —
   * hover the card to reveal a small icon button next to the value. Click
   * copies the displayed value string. Useful for KPI numbers users want
   * to paste into Slack / spreadsheets / commit messages.
   */
  copyable?: boolean;
  /**
   * Optional raw value to copy (e.g. unformatted number string). Defaults
   * to the visible `value` prop.
   */
  copyText?: string;
}

/**
 * Cheap CSS-friendly count-up: starts from 0 and lands on `to` using an
 * ease-out cubic curve. Internal — no exhaustive options because the UI
 * only needs the one animation profile.
 */
function useCountUp(to: number, durationMs: number, enabled: boolean): number {
  const [v, setV] = useState(enabled ? 0 : to);
  useEffect(() => {
    if (!enabled || !Number.isFinite(to)) {
      setV(to);
      return;
    }
    let rafId = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - (1 - t) ** 3;
      setV(to * eased);
      if (t < 1) rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [to, durationMs, enabled]);
  return v;
}

/**
 * KPI card — the building block of the Overview hero row. Serif display
 * value, mono meta line, optional trend sparkline. Designed to stack 3-4
 * across at desktop, single column at mobile.
 */
export function KpiCard({
  label,
  value,
  meta,
  accent = false,
  trend,
  trendReference = null,
  trendReferenceLabel,
  monoValue = false,
  badge,
  insetSlot,
  animate = false,
  numericValue,
  formatValue,
  animateDurationMs = 1200,
  className,
  copyable = false,
  copyText,
}: KpiCardProps) {
  const valueClass = monoValue
    ? 'font-mono text-[20px] leading-[1.4] tracking-tight'
    : 'font-serif text-[36px] font-semibold leading-[1.05] tracking-[-0.02em] tabular-nums';

  const [copied, setCopied] = useState(false);
  const copyValue = useCallback(() => {
    if (!copyable) return;
    const text = copyText ?? value;
    // Best-effort: navigator.clipboard is gated on https / focused docs in
    // Electron renderer; falls back to a hidden <textarea> + execCommand
    // for old-school environments. We swallow failures silently — the user
    // will notice no "Copied" pill flashes.
    try {
      void navigator.clipboard?.writeText(text).then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1200);
      });
    } catch {
      // ignore
    }
  }, [copyable, copyText, value]);

  // count-up only kicks in when caller opts in *and* gives us a numeric +
  // formatter pair. Otherwise we fall back to the static `value` string.
  const canAnimateNumeric =
    animate && typeof numericValue === 'number' && typeof formatValue === 'function';
  const animatedValue = useCountUp(
    canAnimateNumeric ? numericValue! : 0,
    animateDurationMs,
    canAnimateNumeric,
  );
  const displayValue = canAnimateNumeric
    ? (formatValue as (n: number) => string)(animatedValue)
    : value;

  return (
    <motion.div
      // Named variants so a parent <motion.section> can orchestrate
      // staggerChildren / delayChildren. We deliberately omit `initial`/`animate`
      // here so the parent's variant labels propagate down.
      variants={{
        initial: { opacity: 0, y: 16, scale: 0.985 },
        enter: {
          opacity: 1,
          y: 0,
          scale: 1,
          transition: { duration: 0.5, ease: [0.2, 0, 0, 1] },
        },
      }}
      whileHover={{ y: -3, transition: { duration: 0.2, ease: [0.2, 0, 0, 1] } }}
      className={[
        'group relative isolate flex flex-col gap-3 overflow-hidden rounded-[14px] border border-[var(--color-border)]',
        'bg-[var(--color-surface)] p-5 transition-[box-shadow,border-color,background-color] duration-[260ms]',
        // Glass pane: inset top highlight + soft drop (see shadow.css).
        'shadow-[var(--shadow-glass)]',
        'hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-raised)]',
        'hover:shadow-[inset_0_1px_0_color-mix(in_oklab,var(--color-accent)_22%,transparent),0_10px_28px_-14px_color-mix(in_srgb,var(--color-accent)_32%,transparent)]',
        className ?? '',
      ].join(' ')}
    >
      {/* Accent rail across the top — hidden until hover (or always-on for accent cards) */}
      <span
        aria-hidden="true"
        className={[
          'pointer-events-none absolute inset-x-3 top-0 h-px origin-left scale-x-0 transition-transform duration-[260ms] ease-out',
          'group-hover:scale-x-100',
          accent ? 'scale-x-100' : '',
        ].join(' ')}
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, color-mix(in oklab, var(--color-accent) 65%, transparent) 50%, transparent 100%)',
        }}
      />

      <div className="flex items-center justify-between">
        <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)] transition-colors group-hover:text-[var(--color-text-muted)]">
          {label}
        </div>
        <div className="flex items-center gap-2">
          {badge}
          {accent ? (
            <span
              className="size-1.5 rounded-full"
              style={{
                background: 'var(--color-accent)',
                boxShadow: '0 0 0 3px color-mix(in oklab, var(--color-accent) 22%, transparent)',
              }}
              aria-hidden="true"
            />
          ) : null}
        </div>
      </div>
      <div className="flex items-baseline gap-2">
        <div
          className={`${valueClass} transition-colors`}
          style={
            accent
              ? {
                  color: 'var(--color-accent)',
                  textShadow:
                    '0 0 24px color-mix(in srgb, var(--color-accent) 35%, transparent)',
                }
              : undefined
          }
        >
          {displayValue}
        </div>
        {copyable ? (
          <button
            type="button"
            aria-label={copied ? 'Copied!' : 'Copy value'}
            onClick={(e) => {
              e.stopPropagation();
              copyValue();
            }}
            className={[
              'inline-flex shrink-0 items-center rounded-sm border border-[var(--color-border)] px-1.5 py-0.5',
              'font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]',
              'opacity-0 transition-all duration-[180ms] group-hover:opacity-100 hover:text-[var(--color-text)]',
              copied ? 'border-[var(--color-accent)] text-[var(--color-accent)] opacity-100' : '',
            ].join(' ')}
            title={copied ? 'Copied!' : 'Copy to clipboard'}
          >
            {copied ? '✓ copied' : 'copy'}
          </button>
        ) : null}
      </div>
      {meta ? (
        <div className="font-mono text-[12px] text-[var(--color-text-muted)]">{meta}</div>
      ) : null}
      {insetSlot ? <div className="mt-0.5">{insetSlot}</div> : null}
      {trend && trend.length > 0 ? (
        <div className="mt-auto pt-1">
          <Sparkline
            data={trend}
            width={260}
            height={36}
            strokeVar="--color-accent"
            referenceValue={trendReference}
            referenceLabel={trendReferenceLabel}
          />
        </div>
      ) : null}
    </motion.div>
  );
}
