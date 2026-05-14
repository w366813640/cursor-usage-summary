import { useMemo } from 'react';
import { fmtPercent } from './utils';

export interface StatGridItem {
  id: string;
  label: string;
  value: number;
  /** CSS var or hex. */
  color?: string;
  /** Optional sub-line, e.g. provider tag or unit suffix. */
  sub?: string;
}

export interface StatGridProps {
  items: ReadonlyArray<StatGridItem>;
  /** Format a single value (e.g. fmtTokens / fmtUSD). */
  formatValue: (n: number) => string;
  /** Columns. Default 4. */
  columns?: number;
  /** Compute share against total. Default true. */
  showShare?: boolean;
  /**
   * When showShare is true, the bar grows relative to the local item's
   * share of the *maximum* item value, not of the total. This way an item
   * at 93.5% renders as a full bar while a 0.7% item renders as a sliver
   * — preserving the "this one is bigger" signal without compressing the
   * small ones into invisibility.
   *
   * Set false to use share-of-total (which makes tail items disappear).
   * Default true.
   */
  scaleAgainstMax?: boolean;
}

/**
 * "Micro stat grid". A better choice than a stacked bar when one segment
 * dominates the total (e.g. cacheRead at 93.5% with cacheWrite at 3.9%):
 * the stacked bar collapses the tail to a hair-line; the grid keeps each
 * stat readable.
 *
 * Layout: N columns, each cell stacks
 *   [LABEL]
 *   [BIG VALUE]
 *   [share % · sub]
 *   [horizontal bar — relative to max(items.value)]
 */
export function StatGrid({
  items,
  formatValue,
  columns = 4,
  showShare = true,
  scaleAgainstMax = true,
}: StatGridProps) {
  const { total, max } = useMemo(() => {
    let total = 0;
    let max = 0;
    for (const it of items) {
      total += it.value;
      if (it.value > max) max = it.value;
    }
    return { total, max };
  }, [items]);

  return (
    <div
      className="grid gap-3"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {items.map((it) => {
        const share = total > 0 ? it.value / total : 0;
        const scale = scaleAgainstMax ? max : total;
        const barPct = scale > 0 ? it.value / scale : 0;
        return (
          <div
            key={it.id}
            className="flex flex-col gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-2.5"
          >
            <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
              {it.label}
            </div>
            <div className="font-mono text-[16px] leading-tight text-[var(--color-text)]">
              {formatValue(it.value)}
            </div>
            {showShare ? (
              <div className="font-mono text-[10px] text-[var(--color-text-muted)]">
                {fmtPercent(share, 1)}
                {it.sub ? (
                  <span className="pl-1 text-[var(--color-text-subtle)]">· {it.sub}</span>
                ) : null}
              </div>
            ) : it.sub ? (
              <div className="font-mono text-[10px] text-[var(--color-text-subtle)]">{it.sub}</div>
            ) : null}
            <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-[var(--color-surface-sunken)]">
              <div
                style={{
                  width: `${barPct * 100}%`,
                  height: '100%',
                  background: it.color ?? 'var(--cu-cat-1)',
                  transition: 'width 240ms ease',
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
