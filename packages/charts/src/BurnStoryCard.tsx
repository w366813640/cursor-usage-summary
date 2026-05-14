import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { fmtPercent, fmtTokens, fmtUSD } from './utils';

export interface TokenSplit {
  inputWithoutCacheWrite: number;
  inputWithCacheWrite: number;
  cacheRead: number;
  output: number;
}

export interface BurnStoryCardProps {
  /** 1-based rank — drives the giant "#1" / "#2" sigil top-left. */
  rank: number;
  /** Cost in USD (already paid, not estimated). */
  cost: number;
  /** Display label for the model. */
  model: string;
  /** ISO timestamp; the date-only portion is printed in the byline. */
  dateISO: string;
  /** Whether the row was Max-Mode (we badge it). */
  maxMode?: boolean;
  /** True when cost was inferred via Auto-pool fallback. */
  costEstimated?: boolean;
  /** Token totals, split by cost-bearing buckets. */
  tokens: TokenSplit;
  /** Optional human-readable equivalence chip (e.g. "≈ 1.2K Sonnet calls"). */
  equivalence?: string | null;
  /** Bonus inline copy below the headline — keep it terse, one line. */
  caption?: ReactNode;
}

const TOKEN_PALETTE = {
  input: 'var(--cu-cat-1)',
  cacheWrite: 'var(--cu-cat-2)',
  cacheRead: 'var(--cu-cat-3)',
  output: 'var(--cu-cat-4)',
} as const;

/**
 * "What did this one request cost us?" story card.
 *
 * Reads top → bottom:
 *
 *   #1  $51.01                          MAX MODE · EST.
 *       claude-opus-4-7-thinking-xhigh
 *       2026-04-28
 *
 *   ≈ 1.2K Sonnet calls                           44.27M tokens
 *   ▓▓▓▓▓▓▓▓▓▓░ INPUT 0.4M · CACHE-W 1.1M · CACHE-R 42.8M · OUTPUT 28K
 *
 *   <optional caption>
 */
export function BurnStoryCard({
  rank,
  cost,
  model,
  dateISO,
  maxMode = false,
  costEstimated = false,
  tokens,
  equivalence,
  caption,
}: BurnStoryCardProps) {
  const totalTokens =
    tokens.inputWithoutCacheWrite + tokens.inputWithCacheWrite + tokens.cacheRead + tokens.output;
  const segments = [
    {
      id: 'input',
      label: 'INPUT',
      value: tokens.inputWithoutCacheWrite,
      color: TOKEN_PALETTE.input,
    },
    {
      id: 'cw',
      label: 'CACHE-W',
      value: tokens.inputWithCacheWrite,
      color: TOKEN_PALETTE.cacheWrite,
    },
    { id: 'cr', label: 'CACHE-R', value: tokens.cacheRead, color: TOKEN_PALETTE.cacheRead },
    { id: 'out', label: 'OUTPUT', value: tokens.output, color: TOKEN_PALETTE.output },
  ];

  const isHero = rank === 1;

  return (
    <motion.article
      initial={{ opacity: 0, y: 14, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        // Stagger by rank — #1 lands first, then #2/3/4/5 in sequence so
        // the eye can follow the cards being dealt.
        delay: 0.08 + (rank - 1) * 0.08,
        duration: 0.46,
        ease: [0.2, 0, 0, 1],
      }}
      whileHover={{ y: -2, transition: { duration: 0.18, ease: [0.2, 0, 0, 1] } }}
      className={[
        'group flex flex-col gap-3 rounded-[14px] border bg-[var(--color-surface)] p-5',
        'transition-shadow duration-[220ms]',
        isHero
          ? 'border-[var(--color-accent)]/55 shadow-[0_0_0_1px_var(--color-accent)] shadow-[var(--color-accent)]/10 hover:shadow-[0_18px_42px_-18px_color-mix(in_srgb,var(--color-accent)_45%,transparent)]'
          : 'border-[var(--color-border)] hover:border-[var(--color-border-strong)] hover:shadow-[0_12px_28px_-18px_color-mix(in_srgb,var(--color-accent)_28%,transparent)]',
      ].join(' ')}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <span
            className={[
              'font-mono leading-none',
              isHero
                ? 'text-[32px] font-medium'
                : 'text-[26px] font-light text-[var(--color-text-subtle)]',
            ].join(' ')}
            style={isHero ? { color: 'var(--color-accent)' } : undefined}
            aria-hidden="true"
          >
            #{rank}
          </span>
          <div className="flex flex-col">
            <span
              className={[
                'font-serif leading-none tracking-[-0.01em]',
                isHero ? 'text-[40px]' : 'text-[32px]',
              ].join(' ')}
              style={{ color: 'var(--color-accent)' }}
            >
              {fmtUSD(cost)}
            </span>
            <span className="pt-1.5 font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--color-text-muted)]">
              {model}
              <span className="px-1 text-[var(--color-text-subtle)]">·</span>
              {dateISO.slice(0, 10)}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {maxMode ? (
            <span
              className="rounded-sm border border-[var(--color-accent)]/40 bg-[var(--color-accent-soft)] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em]"
              style={{ color: 'var(--color-accent)' }}
            >
              max mode
            </span>
          ) : null}
          {costEstimated ? (
            <span
              className="rounded-sm border border-[var(--color-border)] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--color-text-subtle)]"
              title="Not in the official pricing table — estimated against the Auto pool rate"
            >
              est.
            </span>
          ) : null}
        </div>
      </header>

      <div className="flex items-baseline justify-between gap-2">
        <span
          className="font-mono text-[12px] text-[var(--color-text)]"
          title="Compared against the median Sonnet-class request cost in your dataset"
        >
          {equivalence ?? '—'}
        </span>
        <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--color-text-subtle)]">
          {fmtTokens(totalTokens)} tokens
        </span>
      </div>

      <div className="flex h-[5px] overflow-hidden rounded-sm">
        {segments.map((seg) => {
          const pct = totalTokens > 0 ? seg.value / totalTokens : 0;
          if (pct === 0) return null;
          return (
            <div
              key={seg.id}
              style={{
                width: `${Math.max(pct * 100, 1.5)}%`,
                background: seg.color,
              }}
              title={`${seg.label} · ${fmtTokens(seg.value)} · ${fmtPercent(pct, 1)}`}
            />
          );
        })}
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] text-[var(--color-text-subtle)]">
        {segments.map((seg) => {
          const pct = totalTokens > 0 ? seg.value / totalTokens : 0;
          if (pct === 0) return null;
          return (
            <span key={seg.id} className="inline-flex items-center gap-1">
              <span
                className="inline-block size-1.5 rounded-[1px]"
                style={{ background: seg.color }}
              />
              <span className="uppercase tracking-[0.06em]">{seg.label}</span>
              <span className="text-[var(--color-text-muted)]">{fmtTokens(seg.value)}</span>
            </span>
          );
        })}
      </div>

      {caption ? (
        <p className="pt-1 font-serif text-[14px] italic leading-snug text-[var(--color-text-muted)]">
          {caption}
        </p>
      ) : null}
    </motion.article>
  );
}
