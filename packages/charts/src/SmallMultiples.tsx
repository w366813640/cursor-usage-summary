import type { ReactNode } from 'react';
import { type SparkPoint, Sparkline } from './Sparkline';
import { fmtUSD } from './utils';

export interface SmallMultiplesItem {
  id: string;
  label: string;
  total: number;
  trend: ReadonlyArray<SparkPoint>;
  /** Optional sublabel: provider, tier, ratio… */
  sub?: ReactNode;
  /** Optional accent override (CSS var). */
  strokeVar?: string;
}

export interface SmallMultiplesProps {
  items: ReadonlyArray<SmallMultiplesItem>;
  /** Grid columns. Default 4. */
  columns?: number;
  /** Click handler — emits the item id. */
  onSelect?: (id: string) => void;
  /** Optional value formatter. Defaults to fmtUSD. */
  formatTotal?: (n: number) => string;
}

/**
 * Edward Tufte's "small multiples": a grid of tiny same-shaped charts so
 * the eye can compare shapes (not just totals). Used here to show one
 * sparkline per model.
 */
export function SmallMultiples({
  items,
  columns = 4,
  onSelect,
  formatTotal = fmtUSD,
}: SmallMultiplesProps) {
  return (
    <div
      className="grid gap-3"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onSelect?.(item.id)}
          className="group flex flex-col gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-3 text-left transition-colors hover:border-[var(--color-accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
        >
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--color-text-subtle)]">
              {item.label}
            </span>
            <span className="font-mono text-xs text-[var(--color-text)]">
              {formatTotal(item.total)}
            </span>
          </div>
          <Sparkline
            data={item.trend}
            width={220}
            height={36}
            responsive
            strokeVar={item.strokeVar ?? '--color-accent'}
          />
          {item.sub ? (
            <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
              {item.sub}
            </div>
          ) : null}
        </button>
      ))}
    </div>
  );
}
