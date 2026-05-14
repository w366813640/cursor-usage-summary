import { extent, max } from 'd3-array';
import { scaleLinear, scaleTime } from 'd3-scale';
import { area, curveMonotoneX, line } from 'd3-shape';
import { motion } from 'framer-motion';
import { useMemo } from 'react';

export interface SparkPoint {
  date: string;
  value: number;
}

export interface SparklineProps {
  data: ReadonlyArray<SparkPoint>;
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
}

/**
 * Tiny inline-trend chart. No axes, no labels — meant to be embedded in
 * KPI cards / dense tables. Curve is `monotoneX` so peaks don't overshoot
 * baseline.
 */
export function Sparkline({
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
}: SparklineProps) {
  const { linePath, areaPath, peak, last, refY } = useMemo(() => {
    if (data.length === 0) {
      return { linePath: '', areaPath: '', peak: null, last: null, refY: null };
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
      .range([2, width - 2]);
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
    return {
      linePath: lineGen(data as SparkPoint[]) ?? '',
      areaPath: areaGen(data as SparkPoint[]) ?? '',
      peak: { x: x(new Date(`${peakPt.date}T00:00:00Z`)), y: y(peakPt.value), v: peakPt },
      last: { x: x(new Date(`${lastPt.date}T00:00:00Z`)), y: y(lastPt.value), v: lastPt },
      refY:
        typeof referenceValue === 'number' && Number.isFinite(referenceValue) && referenceValue > 0
          ? y(referenceValue)
          : null,
    };
  }, [data, width, height, referenceValue]);

  if (data.length === 0) {
    return (
      <svg width={width} height={height} role="img" aria-label="Empty trend">
        <title>Empty trend</title>
        <line
          x1={2}
          x2={width - 2}
          y1={height - 2}
          y2={height - 2}
          stroke="var(--color-border)"
          strokeDasharray="2 2"
        />
      </svg>
    );
  }

  return (
    <svg width={width} height={height} role="img" aria-label="Trend sparkline">
      <title>Trend sparkline</title>
      {fillArea ? (
        <motion.path
          d={areaPath}
          fill={`var(${strokeVar})`}
          fillOpacity={0.12}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.45, ease: [0.2, 0, 0, 1] }}
        />
      ) : null}
      {refY !== null ? (
        <g>
          <line
            x1={2}
            x2={width - 2}
            y1={refY}
            y2={refY}
            stroke="var(--color-text-subtle)"
            strokeOpacity={0.55}
            strokeWidth={1}
            strokeDasharray="2 3"
          />
          {referenceLabel ? (
            <text
              x={width - 4}
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
      <motion.path
        d={linePath}
        fill="none"
        stroke={`var(${strokeVar})`}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{
          pathLength: { duration: 1.1, ease: [0.2, 0, 0, 1] },
          opacity: { duration: 0.3, ease: [0.2, 0, 0, 1] },
        }}
      />
      {showPeak && peak ? (
        <motion.circle
          cx={peak.x}
          cy={peak.y}
          r={2.2}
          fill="var(--color-bg)"
          stroke={`var(${strokeVar})`}
          strokeWidth={1}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.95, duration: 0.34, ease: [0.2, 0, 0, 1] }}
        />
      ) : null}
      {showLastPoint && last ? (
        <motion.circle
          cx={last.x}
          cy={last.y}
          r={2.5}
          fill={`var(${strokeVar})`}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 1.1, duration: 0.32, ease: [0.2, 0, 0, 1] }}
        />
      ) : null}
    </svg>
  );
}
