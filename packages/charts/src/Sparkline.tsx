import { extent, max } from 'd3-array';
import { scaleLinear, scaleTime } from 'd3-scale';
import { area, curveMonotoneX, line } from 'd3-shape';
import { memo, useMemo, useState } from 'react';
import { useContainerWidth } from './useContainerWidth';

export interface SparkPoint {
  date: string;
  value: number;
}

export interface SparklineProps {
  data: ReadonlyArray<SparkPoint>;
  /**
   * Width in px. In `responsive` mode this is only the pre-measurement
   * fallback — the chart re-lays out at its container's measured width.
   */
  width?: number;
  height?: number;
  strokeWidth?: number;
  /** Show last-point dot. Default true. */
  showLastPoint?: boolean;
  /** Highlight peak with a dot. Default true. */
  showPeak?: boolean;
  /** Stroke color CSS variable. Default --color-accent. */
  strokeVar?: string;
  /** Optional fill area gradient. Default true for non-tiny sparks. */
  fillArea?: boolean;
  /**
   * Optional horizontal dashed reference line drawn at this y-value (in the
   * same units as `data[].value`). Useful for showing a rolling average or
   * budget baseline behind the series. Hidden if `null` or `undefined`.
   */
  referenceValue?: number | null;
  /** Label rendered above the reference line, right-aligned. */
  referenceLabel?: string;
  /**
   * When provided, the chart enables hover crosshair + click-to-drill.
   * Mouse-move tracks the nearest data point and shows a vertical guide
   * + a floating tooltip with the value; click invokes this callback.
   *
   * When omitted, the chart is read-only (legacy KPI card behaviour).
   */
  onPointClick?: (point: SparkPoint) => void;
  /**
   * Optional value formatter for the hover tooltip. Defaults to a compact
   * "1.23K" style so callers don't have to wire fmtUSD just to get a tooltip.
   */
  formatValue?: (n: number) => string;
  /**
   * Master switch for the hover crosshair. Enabled automatically when
   * `onPointClick` is set; can also be enabled standalone via `showHover`.
   */
  showHover?: boolean;
  /**
   * Fill the container width instead of using a fixed `width`. The chart
   * re-lays out at the measured pixel width (crisp dots/text, hover stays
   * accurate since there's no `viewBox` scaling) and never overflows its
   * parent. Use this whenever the sparkline lives in a flexible/`1fr`/`w-full`
   * container; leave it off for fixed-size cells. Defaults to false.
   */
  responsive?: boolean;
}

/**
 * Tiny inline-trend chart. No axes, no labels — meant to be embedded in
 * KPI cards / dense tables. Curve is `monotoneX` so peaks don't overshoot
 * baseline.
 *
 * Wrapped in `memo`: it's rendered N-up (one per model in `SmallMultiples`,
 * one per KPI card on the Overview hero), so a parent re-render with stable
 * props should skip the whole grid instead of re-walking every path.
 */
export const Sparkline = memo(function Sparkline({
  data,
  width = 160,
  height = 40,
  strokeWidth = 1.5,
  showLastPoint = true,
  showPeak = true,
  strokeVar = '--color-accent',
  fillArea = true,
  referenceValue = null,
  referenceLabel,
  onPointClick,
  formatValue,
  showHover,
  responsive = false,
}: SparklineProps) {
  const interactive = !!onPointClick || !!showHover;
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  // In responsive mode we lay out at the container's measured width so the
  // sparkline fills (and never overflows) its parent; `width` is the fallback
  // for the single pre-measurement render.
  const { ref: wrapRef, width: measuredWidth } = useContainerWidth<HTMLDivElement>();
  const renderWidth = responsive ? (measuredWidth ?? width) : width;

  const { linePath, areaPath, peak, last, refY, points } = useMemo(() => {
    if (data.length === 0) {
      return { linePath: '', areaPath: '', peak: null, last: null, refY: null, points: [] };
    }
    const dates = data.map((d) => new Date(`${d.date}T00:00:00Z`));
    const xExt = extent(dates) as [Date, Date];
    const seriesMax = max(data, (d) => d.value) ?? 1;
    // Domain has to include the reference value too — otherwise a baseline
    // that sits above the data peak (rare but possible: small spike + high
    // budget) would render off-canvas.
    const yMax = Math.max(
      seriesMax || 1,
      typeof referenceValue === 'number' && Number.isFinite(referenceValue) ? referenceValue : 0,
    );
    const x = scaleTime()
      .domain(xExt)
      .range([2, renderWidth - 2]);
    const y = scaleLinear()
      .domain([0, yMax])
      .range([height - 2, 2]);
    const lineGen = line<SparkPoint>()
      .curve(curveMonotoneX)
      .x((d) => x(new Date(`${d.date}T00:00:00Z`)))
      .y((d) => y(d.value));
    const areaGen = area<SparkPoint>()
      .curve(curveMonotoneX)
      .x((d) => x(new Date(`${d.date}T00:00:00Z`)))
      .y0(height - 2)
      .y1((d) => y(d.value));
    const peakIdx = data.reduce((acc, d, idx) => (d.value > data[acc]!.value ? idx : acc), 0);
    const peakPt = data[peakIdx]!;
    const lastPt = data[data.length - 1]!;
    // Pre-compute pixel positions for every point so hover lookup is O(n)
    // single-pass without re-running d3 scales on every mouse-move.
    const pts = data.map((d) => ({
      x: x(new Date(`${d.date}T00:00:00Z`)),
      y: y(d.value),
      v: d,
    }));
    return {
      linePath: lineGen(data as SparkPoint[]) ?? '',
      areaPath: areaGen(data as SparkPoint[]) ?? '',
      peak: { x: x(new Date(`${peakPt.date}T00:00:00Z`)), y: y(peakPt.value), v: peakPt },
      last: { x: x(new Date(`${lastPt.date}T00:00:00Z`)), y: y(lastPt.value), v: lastPt },
      refY:
        typeof referenceValue === 'number' && Number.isFinite(referenceValue) && referenceValue > 0
          ? y(referenceValue)
          : null,
      points: pts,
    };
  }, [data, renderWidth, height, referenceValue]);

  /** Map a mouse X coordinate to the nearest data-point index. */
  function nearestIdx(clientX: number, rect: DOMRect): number | null {
    if (points.length === 0) return null;
    const localX = clientX - rect.left;
    let best = 0;
    let bestDist = Number.POSITIVE_INFINITY;
    for (let i = 0; i < points.length; i++) {
      const dx = Math.abs(points[i]!.x - localX);
      if (dx < bestDist) {
        best = i;
        bestDist = dx;
      }
    }
    return best;
  }

  const hoverPt = hoverIdx !== null ? points[hoverIdx] : null;
  const fmt = formatValue ?? defaultFmt;

  if (data.length === 0) {
    return (
      <div
        ref={responsive ? wrapRef : undefined}
        className={responsive ? 'block' : 'inline-block'}
        style={{ width: responsive ? '100%' : width, height }}
      >
        <svg
          className="block"
          width={renderWidth}
          height={height}
          role="img"
          aria-label="Empty trend"
        >
          <title>Empty trend</title>
          <line
            x1={2}
            x2={renderWidth - 2}
            y1={height - 2}
            y2={height - 2}
            stroke="var(--color-border)"
            strokeDasharray="2 2"
          />
        </svg>
      </div>
    );
  }

  return (
    <div
      ref={responsive ? wrapRef : undefined}
      className={responsive ? 'relative block' : 'relative inline-block'}
      style={{ width: responsive ? '100%' : width, height }}
    >
      <svg
        className="block"
        width={renderWidth}
        height={height}
        role={interactive ? 'button' : 'img'}
        aria-label={interactive ? 'Interactive trend sparkline' : 'Trend sparkline'}
        style={{ cursor: interactive ? 'crosshair' : 'default' }}
        onMouseMove={
          interactive
            ? (e) => {
                const idx = nearestIdx(e.clientX, e.currentTarget.getBoundingClientRect());
                if (idx !== hoverIdx) setHoverIdx(idx);
              }
            : undefined
        }
        onMouseLeave={interactive ? () => setHoverIdx(null) : undefined}
        onClick={
          interactive && onPointClick
            ? () => {
                if (hoverIdx !== null && points[hoverIdx]) {
                  onPointClick(points[hoverIdx]!.v);
                }
              }
            : undefined
        }
      >
        <title>Trend sparkline</title>
        {fillArea ? (
          <path
            className="cu-sparkline-area"
            d={areaPath}
            fill={`var(${strokeVar})`}
            fillOpacity={0.12}
          />
        ) : null}
        {refY !== null ? (
          <g>
            <line
              x1={2}
              x2={renderWidth - 2}
              y1={refY}
              y2={refY}
              stroke="var(--color-text-subtle)"
              strokeOpacity={0.55}
              strokeWidth={1}
              strokeDasharray="2 3"
            />
            {referenceLabel ? (
              <text
                x={renderWidth - 4}
                y={Math.max(8, refY - 3)}
                textAnchor="end"
                fontSize={8}
                fontFamily="ui-monospace, SFMono-Regular, monospace"
                fill="var(--color-text-subtle)"
              >
                {referenceLabel}
              </text>
            ) : null}
          </g>
        ) : null}
        <path
          className="cu-sparkline-line"
          d={linePath}
          fill="none"
          stroke={`var(${strokeVar})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
        />
        {showPeak && peak ? (
          <circle
            className="cu-sparkline-dot cu-sparkline-dot--peak"
            cx={peak.x}
            cy={peak.y}
            r={2.2}
            fill="var(--color-bg)"
            stroke={`var(${strokeVar})`}
            strokeWidth={1}
          />
        ) : null}
        {showLastPoint && last ? (
          <circle
            className="cu-sparkline-dot cu-sparkline-dot--last"
            cx={last.x}
            cy={last.y}
            r={2.5}
            fill={`var(${strokeVar})`}
          />
        ) : null}
        {interactive && hoverPt ? (
          <g pointerEvents="none">
            <line
              x1={hoverPt.x}
              x2={hoverPt.x}
              y1={0}
              y2={height}
              stroke="var(--color-text-subtle)"
              strokeWidth={1}
              strokeDasharray="2 2"
              opacity={0.65}
            />
            <circle
              cx={hoverPt.x}
              cy={hoverPt.y}
              r={3.2}
              fill="var(--color-bg)"
              stroke={`var(${strokeVar})`}
              strokeWidth={1.6}
            />
          </g>
        ) : null}
      </svg>
      {interactive && hoverPt ? (
        <div
          className="pointer-events-none absolute z-10 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-1.5 py-1 font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--color-text)] shadow-md whitespace-nowrap"
          style={{
            left: Math.min(renderWidth - 90, Math.max(0, hoverPt.x + 6)),
            top: Math.max(0, hoverPt.y - 26),
          }}
        >
          <span className="text-[var(--color-text-subtle)]">{hoverPt.v.date}</span>
          <span className="px-1 text-[var(--color-text-subtle)]">·</span>
          <span style={{ color: `var(${strokeVar})` }}>{fmt(hoverPt.v.value)}</span>
        </div>
      ) : null}
    </div>
  );
});

function defaultFmt(n: number): string {
  if (!Number.isFinite(n)) return '0';
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  if (Math.abs(n) >= 100) return n.toFixed(0);
  if (Math.abs(n) >= 1) return n.toFixed(2);
  return n.toFixed(2);
}
