import { useId, useMemo, useRef, useState } from 'react';

export interface StackedAreaSeries {
  id: string;
  label: string;
  /** CSS color (usually `var(--cu-cat-N)`). */
  color: string;
  /** One value per entry in `dates`, aligned by index. */
  values: ReadonlyArray<number>;
}

export interface StackedAreaChartProps {
  /** X axis — ISO `YYYY-MM-DD` strings, uniform daily spacing. */
  dates: ReadonlyArray<string>;
  /** Stack order: first series renders at the bottom. */
  series: ReadonlyArray<StackedAreaSeries>;
  height?: number;
  /** Fixed width; when omitted the chart stretches to its container. */
  width?: number;
  formatValue?: (n: number) => string;
  /** Click a day → drill. Enables the pointer cursor. */
  onSelectDate?: (date: string) => void;
  /** Hide series ids (legend toggles call back into the host). */
  hiddenIds?: ReadonlySet<string>;
  onToggleSeries?: (id: string) => void;
  /** Y axis gridline count. Default 4. */
  ticks?: number;
  ariaLabel?: string;
}

interface Geometry {
  /** Cumulative stack: layers[s][i] = { y0, y1 } in value space. */
  areaPaths: string[];
  linePath: string | null;
  xs: number[];
  totals: number[];
  yMax: number;
  gridYs: Array<{ y: number; value: number }>;
  visible: StackedAreaSeries[];
}

const PAD_TOP = 12;
const PAD_BOTTOM = 22;
const PAD_LEFT = 8;
const PAD_RIGHT = 8;

/**
 * Hero chart — multi-series stacked area with gradient fills, hover
 * crosshair + tooltip, and an optional glowing topline. Geometry is a
 * single memo; hover state only moves a lightweight overlay layer, so
 * mouse-tracking never re-tessellates paths.
 *
 * The SVG scales to its container width via viewBox + preserveAspectRatio
 * "none" on a fixed internal coordinate system — cheaper than a
 * ResizeObserver re-render per frame during window drags.
 */
export function StackedAreaChart({
  dates,
  series,
  height = 260,
  width = 960,
  formatValue = (n) => n.toFixed(2),
  onSelectDate,
  hiddenIds,
  onToggleSeries,
  ticks = 4,
  ariaLabel = 'Stacked area chart',
}: StackedAreaChartProps) {
  const gradPrefix = useId().replace(/[:]/g, '');
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const geo: Geometry = useMemo(() => {
    const visible = series.filter((s) => !hiddenIds?.has(s.id));
    const n = dates.length;
    if (n === 0 || visible.length === 0) {
      return {
        areaPaths: [],
        linePath: null,
        xs: [],
        totals: [],
        yMax: 1,
        gridYs: [],
        visible: [],
      };
    }
    const totals: number[] = new Array(n).fill(0);
    for (const s of visible) {
      for (let i = 0; i < n; i++) totals[i]! += s.values[i] ?? 0;
    }
    const yMax = Math.max(1e-6, ...totals);
    const innerW = width - PAD_LEFT - PAD_RIGHT;
    const innerH = height - PAD_TOP - PAD_BOTTOM;
    const xs = dates.map((_, i) => PAD_LEFT + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW));
    const yOf = (v: number) => PAD_TOP + innerH - (v / yMax) * innerH;

    // Cumulative stacking, bottom-up. Each layer's path = upper edge
    // forward + lower edge backward.
    const cumBelow: number[] = new Array(n).fill(0);
    const areaPaths: string[] = [];
    let topEdge: string | null = null;
    for (const s of visible) {
      const upper: string[] = [];
      const lower: string[] = [];
      for (let i = 0; i < n; i++) {
        const y1 = cumBelow[i]! + (s.values[i] ?? 0);
        upper.push(`${i === 0 ? 'M' : 'L'}${xs[i]!.toFixed(2)},${yOf(y1).toFixed(2)}`);
        lower.push(`L${xs[n - 1 - i]!.toFixed(2)},${yOf(cumBelow[n - 1 - i]!).toFixed(2)}`);
        cumBelow[i] = y1;
      }
      areaPaths.push(`${upper.join('')}${lower.join('')}Z`);
      topEdge = upper.join('');
    }

    const gridYs = Array.from({ length: ticks }, (_, i) => {
      const v = (yMax / ticks) * (i + 1);
      return { y: yOf(v), value: v };
    });

    return { areaPaths, linePath: topEdge, xs, totals, yMax, gridYs, visible };
  }, [dates, series, hiddenIds, width, height, ticks]);

  /** Pointer → nearest day index (uniform spacing ⇒ O(1) math). */
  function idxFromClientX(clientX: number): number | null {
    const el = wrapRef.current;
    if (!el || dates.length === 0) return null;
    const rect = el.getBoundingClientRect();
    const frac = (clientX - rect.left) / rect.width;
    const innerFrac = (frac * width - PAD_LEFT) / (width - PAD_LEFT - PAD_RIGHT);
    const idx = Math.round(innerFrac * (dates.length - 1));
    return Math.max(0, Math.min(dates.length - 1, idx));
  }

  const hover = hoverIdx !== null && geo.xs[hoverIdx] !== undefined ? hoverIdx : null;

  // Tooltip rows: per-series value at the hovered day, largest first.
  const tooltipRows = useMemo(() => {
    if (hover === null) return [];
    return geo.visible
      .map((s) => ({ id: s.id, label: s.label, color: s.color, value: s.values[hover] ?? 0 }))
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [hover, geo.visible]);

  const hoverXFrac = hover !== null ? geo.xs[hover]! / width : 0;

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={wrapRef}
        className="relative w-full"
        style={{ height, cursor: onSelectDate ? 'pointer' : 'crosshair' }}
        onPointerMove={(e) => {
          const idx = idxFromClientX(e.clientX);
          if (idx !== hoverIdx) setHoverIdx(idx);
        }}
        onPointerLeave={() => setHoverIdx(null)}
        onClick={() => {
          if (onSelectDate && hover !== null) onSelectDate(dates[hover]!);
        }}
      >
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={ariaLabel}
        >
          <title>{ariaLabel}</title>
          <defs>
            {geo.visible.map((s, i) => (
              <linearGradient
                key={s.id}
                id={`${gradPrefix}-g${i}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor={s.color} stopOpacity={0.5} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0.06} />
              </linearGradient>
            ))}
          </defs>

          {geo.gridYs.map((g) => (
            <line
              key={g.value}
              x1={PAD_LEFT}
              x2={width - PAD_RIGHT}
              y1={g.y}
              y2={g.y}
              stroke="var(--color-border)"
              strokeOpacity={0.6}
              strokeWidth={1}
            />
          ))}

          {geo.areaPaths.map((d, i) => (
            <path
              key={geo.visible[i]!.id}
              d={d}
              fill={`url(#${gradPrefix}-g${i})`}
              stroke={geo.visible[i]!.color}
              strokeOpacity={0.5}
              strokeWidth={1}
            />
          ))}

          {/* Glowing total line — duplicated stroke, blurred underneath. */}
          {geo.linePath ? (
            <g>
              <path
                d={geo.linePath}
                fill="none"
                stroke="var(--color-accent)"
                strokeWidth={4}
                strokeOpacity={0.28}
                style={{ filter: 'blur(4px)' }}
              />
              <path
                d={geo.linePath}
                fill="none"
                stroke="var(--color-accent)"
                strokeWidth={1.8}
                strokeLinejoin="round"
              />
            </g>
          ) : null}

          {hover !== null ? (
            <g pointerEvents="none">
              <line
                x1={geo.xs[hover]}
                x2={geo.xs[hover]}
                y1={PAD_TOP - 4}
                y2={height - PAD_BOTTOM}
                stroke="var(--color-text-muted)"
                strokeWidth={1}
                strokeDasharray="3 3"
                opacity={0.7}
              />
              <circle
                cx={geo.xs[hover]}
                cy={
                  PAD_TOP +
                  (height - PAD_TOP - PAD_BOTTOM) * (1 - geo.totals[hover]! / geo.yMax)
                }
                r={3.5}
                fill="var(--color-accent)"
                stroke="var(--color-bg)"
                strokeWidth={1.5}
              />
            </g>
          ) : null}
        </svg>

        {/* X labels — first / middle / last keeps it readable at any width. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-between px-1 font-mono text-[10px] text-[var(--color-text-subtle)]">
          <span>{dates[0] ?? ''}</span>
          <span>{dates[Math.floor((dates.length - 1) / 2)] ?? ''}</span>
          <span>{dates[dates.length - 1] ?? ''}</span>
        </div>

        {/* Y max label. */}
        <div className="pointer-events-none absolute top-0 right-1 font-mono text-[10px] text-[var(--color-text-subtle)]">
          {formatValue(geo.yMax)}
        </div>

        {hover !== null && tooltipRows.length > 0 ? (
          <div
            className="pointer-events-none absolute z-10 min-w-[168px] rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-2 shadow-[var(--shadow-popover)]"
            style={{
              top: 8,
              ...(hoverXFrac > 0.62 ? { right: `${(1 - hoverXFrac) * 100}%`, marginRight: 12 } : { left: `${hoverXFrac * 100}%`, marginLeft: 12 }),
            }}
          >
            <div className="mb-1.5 flex items-baseline justify-between gap-4">
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
                {dates[hover]}
              </span>
              <span className="font-mono text-[11px] font-semibold text-[var(--color-text)]">
                {formatValue(geo.totals[hover] ?? 0)}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              {tooltipRows.slice(0, 7).map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span
                      aria-hidden="true"
                      className="size-2 shrink-0 rounded-[3px]"
                      style={{ background: r.color }}
                    />
                    <span className="truncate font-mono text-[10.5px] text-[var(--color-text-muted)]">
                      {r.label}
                    </span>
                  </span>
                  <span className="font-mono text-[10.5px] tabular-nums text-[var(--color-text)]">
                    {formatValue(r.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* Legend — chips double as visibility toggles. */}
      <div className="flex flex-wrap items-center gap-1.5">
        {series.map((s) => {
          const off = hiddenIds?.has(s.id) ?? false;
          return (
            <button
              key={s.id}
              type="button"
              onClick={onToggleSeries ? () => onToggleSeries(s.id) : undefined}
              aria-pressed={!off}
              className={[
                'flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10.5px] transition-all duration-150',
                off
                  ? 'border-[var(--color-border)] text-[var(--color-text-subtle)] opacity-55'
                  : 'border-[var(--color-border)] bg-[var(--color-surface-muted)]/50 text-[var(--color-text-muted)] hover:text-[var(--color-text)]',
                onToggleSeries ? 'cursor-pointer' : 'cursor-default',
              ].join(' ')}
            >
              <span
                aria-hidden="true"
                className="size-2 rounded-[3px]"
                style={{ background: off ? 'var(--color-border-strong)' : s.color }}
              />
              {s.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
