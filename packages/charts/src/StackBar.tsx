import { useMemo, useState } from 'react';
import { fmtPercent } from './utils';

export interface StackBarSegment {
  id: string;
  label: string;
  value: number;
  /** CSS var or hex. Default cycles through provider palette. */
  color?: string;
}

export interface StackBarProps {
  segments: ReadonlyArray<StackBarSegment>;
  width?: number;
  height?: number;
  /** Format absolute value for legend / tooltip. */
  formatValue?: (n: number) => string;
  /** Legend below the bar. Default true. */
  showLegend?: boolean;
  /** Caption shown above the bar. */
  title?: string;
  /**
   * Minimum px width per segment so that tiny slices remain visible / hoverable.
   * When the natural width of a segment falls below this, it's expanded and the
   * remainder is reclaimed from the largest segment. Default 6px.
   *
   * Set to 0 to render true proportions only (useful when you want to dramatize
   * a heavy-tail dominance, but the small segments become unhoverable).
   */
  minSegmentWidth?: number;
}

const DEFAULT_PALETTE = [
  'var(--cu-cat-1)',
  'var(--cu-cat-2)',
  'var(--cu-cat-3)',
  'var(--cu-cat-4)',
  'var(--cu-cat-5)',
  'var(--cu-cat-6)',
];

/**
 * Single horizontal stacked bar — meant for "where did the tokens go"
 * or "where did the cost go" panels.
 *
 * Filters out zero-value segments so the bar doesn't render hairline slivers
 * for things like `cacheWrite=0`.
 */
export function StackBar({
  segments,
  width = 480,
  height = 28,
  formatValue = (n) => n.toLocaleString(),
  showLegend = true,
  title,
  minSegmentWidth = 6,
}: StackBarProps) {
  const total = useMemo(() => segments.reduce((acc, s) => acc + s.value, 0), [segments]);
  const drawable = useMemo(() => segments.filter((s) => s.value > 0), [segments]);
  const [hoverId, setHoverId] = useState<string | null>(null);

  /**
   * Compute rendered widths after enforcing `minSegmentWidth`. Tiny slices
   * grow to the floor; the largest slice pays the difference. This preserves
   * rank order (the heavy one is still visibly heavy) while keeping every
   * legend entry hoverable.
   */
  const renderedPx = useMemo(() => {
    if (drawable.length === 0 || total <= 0) return [];
    const ideal = drawable.map((s) => (s.value / total) * width);
    if (minSegmentWidth <= 0) return ideal;
    const minimumTotalForFloors = drawable.length * minSegmentWidth;
    if (minimumTotalForFloors >= width) {
      return drawable.map(() => width / drawable.length);
    }
    let debt = 0;
    const adjusted = ideal.map((px) => {
      if (px < minSegmentWidth) {
        debt += minSegmentWidth - px;
        return minSegmentWidth;
      }
      return px;
    });
    if (debt === 0) return adjusted;
    const indices = adjusted.map((px, i) => ({ px, i })).sort((a, b) => b.px - a.px);
    for (const { i } of indices) {
      if (debt <= 0.01) break;
      const slack = adjusted[i]! - minSegmentWidth;
      if (slack <= 0) continue;
      const taken = Math.min(slack, debt);
      adjusted[i] = adjusted[i]! - taken;
      debt -= taken;
    }
    return adjusted;
  }, [drawable, total, width, minSegmentWidth]);

  return (
    <div className="flex flex-col gap-2" style={{ width }}>
      {title ? (
        <div className="flex items-baseline justify-between font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
          <span>{title}</span>
          <span>{formatValue(total)}</span>
        </div>
      ) : null}
      <div
        className="overflow-hidden rounded-md border border-[var(--color-border)]"
        style={{ height }}
      >
        <div className="flex h-full" style={{ width }}>
          {drawable.map((seg, idx) => {
            const pct = total > 0 ? seg.value / total : 0;
            const px = renderedPx[idx] ?? pct * width;
            return (
              <div
                key={seg.id}
                style={{
                  width: `${px}px`,
                  flexShrink: 0,
                  background: seg.color ?? DEFAULT_PALETTE[idx % DEFAULT_PALETTE.length],
                  opacity: hoverId === null || hoverId === seg.id ? 1 : 0.45,
                  transition: 'opacity 120ms ease',
                }}
                onMouseEnter={() => setHoverId(seg.id)}
                onMouseLeave={() => setHoverId(null)}
                title={`${seg.label} · ${formatValue(seg.value)} · ${fmtPercent(pct)}`}
              />
            );
          })}
        </div>
      </div>
      {showLegend ? (
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 font-mono text-[11px] text-[var(--color-text-subtle)]">
          {drawable.map((seg, idx) => {
            const pct = total > 0 ? seg.value / total : 0;
            const swatch = seg.color ?? DEFAULT_PALETTE[idx % DEFAULT_PALETTE.length];
            return (
              <button
                key={seg.id}
                type="button"
                onMouseEnter={() => setHoverId(seg.id)}
                onMouseLeave={() => setHoverId(null)}
                className="flex items-center gap-1.5 transition-colors hover:text-[var(--color-text)]"
              >
                <span className="inline-block size-2.5 rounded-sm" style={{ background: swatch }} />
                <span className="uppercase tracking-[0.06em]">{seg.label}</span>
                <span className="text-[var(--color-text)]">{fmtPercent(pct, 1)}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
