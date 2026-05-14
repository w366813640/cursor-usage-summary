import { useEffect, useMemo, useRef, useState } from 'react';
import { bucketize, fmtUSD, quantileBreakpoints } from './utils';

export interface WeekHourCell {
  /** 0 = Sun, 6 = Sat (UTC). */
  weekday: number;
  /** 0..23. */
  hour: number;
  value: number;
  meta?: string | number;
}

export interface WeekHourHeatmapProps {
  cells: ReadonlyArray<WeekHourCell>;
  levels?: number;
  cellSize?: number;
  cellGap?: number;
  /** Label for axis title. */
  metricLabel?: string;
  /**
   * Scale cell size to the available container width. When enabled the
   * component watches its parent with a ResizeObserver and recomputes
   * `cellSize` so the grid never overflows. Defaults to false to preserve
   * the previous fixed-width behaviour.
   */
  responsive?: boolean;
  /** Lower bound for the auto-computed cell size in responsive mode. */
  minCellSize?: number;
  /** Upper bound for the auto-computed cell size in responsive mode. */
  maxCellSize?: number;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/**
 * 7 × 24 mini-heatmap. Useful for spotting "Tuesday 23:00 binges" or
 * weekend nothing-burgers.
 *
 * Densities are per-cell from `cells`; missing (weekday, hour) pairs are
 * treated as zero (level 0).
 *
 * Pass `responsive` when embedding inside a narrow column — the grid will
 * scale down to fit instead of overflowing horizontally.
 */
export function WeekHourHeatmap({
  cells,
  levels = 5,
  cellSize: cellSizeProp = 14,
  cellGap = 2,
  metricLabel = 'USD',
  responsive = false,
  minCellSize = 8,
  maxCellSize = 18,
}: WeekHourHeatmapProps) {
  const lookup = useMemo(() => {
    const m = new Map<string, WeekHourCell>();
    for (const c of cells) m.set(`${c.weekday}:${c.hour}`, c);
    return m;
  }, [cells]);

  const breakpoints = useMemo(
    () =>
      quantileBreakpoints(
        cells.map((c) => c.value),
        levels,
      ),
    [cells, levels],
  );

  const [hover, setHover] = useState<WeekHourCell | null>(null);

  // Container width tracking for responsive sizing. We track in pixels and
  // recompute cell size, but cap to [minCellSize, maxCellSize] so the grid
  // never collapses to unreadable specks or balloons absurdly wide.
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);

  useEffect(() => {
    if (!responsive) return;
    const el = wrapRef.current;
    if (!el) return;
    setContainerWidth(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        if (w > 0) setContainerWidth(w);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [responsive]);

  const labelW = 28;
  const headerH = 16;

  // In responsive mode, derive cellSize from the available width. In fixed
  // mode we use the prop verbatim — preserves the existing v1 contract.
  let cellSize = cellSizeProp;
  if (responsive && containerWidth && containerWidth > 0) {
    const usable = containerWidth - labelW;
    const fitted = (usable - 24 * cellGap) / 24;
    cellSize = Math.max(minCellSize, Math.min(maxCellSize, Math.floor(fitted)));
  }

  const width = labelW + 24 * (cellSize + cellGap);
  const height = headerH + 7 * (cellSize + cellGap);

  return (
    <div ref={wrapRef} style={{ width: '100%' }}>
      <svg
        width={responsive ? '100%' : width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMinYMin meet"
        role="img"
        aria-label="Hour-of-day × weekday heatmap"
      >
        {Array.from({ length: 24 }, (_, h) => (h % 6 === 0 ? h : null)).map((h) => {
          if (h === null) return null;
          return (
            <text
              key={h}
              x={labelW + h * (cellSize + cellGap)}
              y={12}
              fill="var(--color-text-subtle)"
              fontSize={10}
              fontFamily="var(--font-mono)"
            >
              {String(h).padStart(2, '0')}
            </text>
          );
        })}
        {WEEKDAYS.map((label, wd) => (
          <text
            key={label}
            x={0}
            y={headerH + wd * (cellSize + cellGap) + cellSize - 3}
            fill="var(--color-text-subtle)"
            fontSize={10}
            fontFamily="var(--font-mono)"
          >
            {label}
          </text>
        ))}
        {Array.from({ length: 7 }, (_, wd) =>
          Array.from({ length: 24 }, (_, h) => {
            const c = lookup.get(`${wd}:${h}`);
            const value = c?.value ?? 0;
            const level = value > 0 ? bucketize(value, breakpoints) : 0;
            const x = labelW + h * (cellSize + cellGap);
            const y = headerH + wd * (cellSize + cellGap);
            const datum: WeekHourCell = c ?? { weekday: wd, hour: h, value: 0 };
            const isHover = hover && hover.weekday === wd && hover.hour === h;
            return (
              <rect
                // 7×24 fixed grid — wd/h are semantic identifiers, not list indexes.
                // biome-ignore lint/suspicious/noArrayIndexKey: stable weekday × hour key
                key={`wd${wd}h${h}`}
                x={x}
                y={y}
                width={cellSize}
                height={cellSize}
                rx={2}
                ry={2}
                fill={`var(--cu-heat-${level})`}
                stroke={isHover ? 'var(--color-accent)' : 'transparent'}
                strokeWidth={1}
                onMouseEnter={() => setHover(datum)}
                onMouseLeave={() => setHover(null)}
              >
                <title>
                  {WEEKDAYS[wd]} {String(h).padStart(2, '0')}:00 · {fmtUSD(value)}
                  {c?.meta ? ` · ${c.meta}` : ''}
                </title>
              </rect>
            );
          }),
        )}
      </svg>
      <div className="flex items-center gap-3 pt-2 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
        <span>{metricLabel}</span>
        {hover ? (
          <span>
            {WEEKDAYS[hover.weekday]} {String(hover.hour).padStart(2, '0')}:00 ·{' '}
            {fmtUSD(hover.value)}
            {hover.meta ? ` · ${hover.meta}` : ''}
          </span>
        ) : (
          <span>Hover a cell to inspect</span>
        )}
      </div>
    </div>
  );
}
