import { timeDay, timeSunday } from 'd3-time';
import { timeFormat } from 'd3-time-format';
import { motion } from 'framer-motion';
import { type ReactNode, useMemo, useState } from 'react';
import { bucketize, fmtUSD, quantileBreakpoints } from './utils';

export interface HeatmapDatum {
  /** YYYY-MM-DD in UTC. */
  date: string;
  /** Cost in USD (or any positive metric). */
  value: number;
  /** Optional secondary metric for tooltip — rows / requests / etc. */
  meta?: string | number;
}

export interface HeatmapProps {
  data: ReadonlyArray<HeatmapDatum>;
  /** Number of color steps. 5 mirrors GitHub. */
  levels?: number;
  /** Cell side length in px. Default 12. */
  cellSize?: number;
  /** Gap between cells in px. Default 3. */
  cellGap?: number;
  /** Optional explicit start date (UTC). Defaults to earliest in `data`. */
  startDate?: Date;
  /** Optional explicit end date (UTC). Defaults to latest in `data`. */
  endDate?: Date;
  /** Tooltip rendered above the hovered cell. */
  renderTooltip?: (d: HeatmapDatum | null) => ReactNode;
  /** Click handler on a single day cell. */
  onSelectDate?: (date: string) => void;
  /**
   * Optional set of ISO dates (`YYYY-MM-DD`) that should be highlighted with
   * an accent outline ring — used to surface anomaly days on the overview
   * calendar without changing the underlying value-driven heat colour.
   */
  outlierDates?: ReadonlySet<string>;
}

const monthLabel = timeFormat('%b');

/**
 * GitHub-style activity calendar. Y-axis = weekday (Sun → Sat), X-axis = week.
 *
 *  - Uses D3 only for scales / time math; all DOM nodes are React-rendered SVG.
 *  - Colors come from CSS vars (`--cu-heat-0` … `--cu-heat-N`) so theme
 *    switching just works.
 *  - Tooltip is positioned in *screen* coordinates relative to the SVG.
 */
export function Heatmap({
  data,
  levels = 5,
  cellSize = 12,
  cellGap = 3,
  startDate,
  endDate,
  renderTooltip,
  onSelectDate,
  outlierDates,
}: HeatmapProps) {
  const byDate = useMemo(() => {
    const m = new Map<string, HeatmapDatum>();
    for (const d of data) m.set(d.date, d);
    return m;
  }, [data]);

  const { days, weekStart, monthTicks } = useMemo(() => {
    const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
    const fallbackStart = sorted[0]?.date ? new Date(`${sorted[0].date}T00:00:00Z`) : new Date();
    const fallbackEnd = sorted[sorted.length - 1]?.date
      ? new Date(`${sorted[sorted.length - 1]!.date}T00:00:00Z`)
      : new Date();
    const start = timeSunday.floor(startDate ?? fallbackStart);
    const end = timeDay.offset(endDate ?? fallbackEnd, 1);
    const days = timeDay.range(start, end);
    const monthTicks: Array<{ week: number; label: string }> = [];
    let lastMonth = -1;
    for (let i = 0; i < days.length; i++) {
      const d = days[i]!;
      if (d.getUTCDay() !== 0) continue;
      if (d.getUTCMonth() !== lastMonth) {
        monthTicks.push({ week: Math.floor(i / 7), label: monthLabel(d) });
        lastMonth = d.getUTCMonth();
      }
    }
    return { days, weekStart: start, monthTicks };
  }, [data, startDate, endDate]);

  const breakpoints = useMemo(
    () =>
      quantileBreakpoints(
        data.map((d) => d.value),
        levels,
      ),
    [data, levels],
  );

  const [hover, setHover] = useState<{ key: string; x: number; y: number } | null>(null);

  const totalWeeks = Math.ceil(days.length / 7);
  const labelW = 22;
  const headerH = 14;
  const width = labelW + totalWeeks * (cellSize + cellGap);
  const height = headerH + 7 * (cellSize + cellGap);

  return (
    <div className="relative">
      <svg width={width} height={height} role="img" aria-label="Daily activity heatmap">
        {monthTicks.map((m) => (
          <text
            key={`${m.label}-${m.week}`}
            x={labelW + m.week * (cellSize + cellGap)}
            y={10}
            fill="var(--color-text-subtle)"
            fontSize={10}
            fontFamily="var(--font-mono)"
          >
            {m.label}
          </text>
        ))}
        {['Mon', 'Wed', 'Fri'].map((label, idx) => {
          const row = idx * 2 + 1;
          return (
            <text
              key={label}
              x={0}
              y={headerH + row * (cellSize + cellGap) + cellSize - 2}
              fill="var(--color-text-subtle)"
              fontSize={9}
              fontFamily="var(--font-mono)"
            >
              {label}
            </text>
          );
        })}
        {days.map((day, i) => {
          const iso = day.toISOString().slice(0, 10);
          const entry = byDate.get(iso);
          const value = entry?.value ?? 0;
          const level = value > 0 ? bucketize(value, breakpoints) : 0;
          const week = Math.floor(i / 7);
          const weekday = day.getUTCDay();
          const x = labelW + week * (cellSize + cellGap);
          const y = headerH + weekday * (cellSize + cellGap);
          const isHover = hover?.key === iso;
          // Wave by week so the eye reads left → right rather than dot-by-dot.
          // Capped so very long ranges still complete in ~1.1s.
          const waveDelay = Math.min(0.001 * i + week * 0.012, 1.1);
          return (
            <motion.rect
              key={iso}
              x={x}
              y={y}
              width={cellSize}
              height={cellSize}
              rx={2}
              ry={2}
              fill={`var(--cu-heat-${level})`}
              stroke={isHover ? 'var(--color-accent)' : 'transparent'}
              strokeWidth={1}
              style={{
                cursor: onSelectDate ? 'pointer' : 'default',
                originX: '50%',
                originY: '50%',
              }}
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: waveDelay, duration: 0.28, ease: [0.2, 0, 0, 1] }}
              onMouseEnter={() => setHover({ key: iso, x: x + cellSize / 2, y })}
              onMouseLeave={() => setHover(null)}
              onClick={() => onSelectDate?.(iso)}
            >
              <title>
                {iso} · {entry ? fmtUSD(entry.value) : '$0.00'}
                {entry?.meta ? ` · ${entry.meta}` : ''}
              </title>
            </motion.rect>
          );
        })}
        {outlierDates && outlierDates.size > 0
          ? days.map((day, i) => {
              const iso = day.toISOString().slice(0, 10);
              if (!outlierDates.has(iso)) return null;
              const week = Math.floor(i / 7);
              const weekday = day.getUTCDay();
              const x = labelW + week * (cellSize + cellGap);
              const y = headerH + weekday * (cellSize + cellGap);
              return (
                <rect
                  key={`outlier-${iso}`}
                  x={x - 1.25}
                  y={y - 1.25}
                  width={cellSize + 2.5}
                  height={cellSize + 2.5}
                  rx={3}
                  ry={3}
                  fill="none"
                  stroke="var(--color-accent)"
                  strokeWidth={1.5}
                  pointerEvents="none"
                />
              );
            })
          : null}
      </svg>
      {hover && renderTooltip ? (
        <div
          className="pointer-events-none absolute z-10 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-2 py-1.5 shadow-lg"
          style={{
            left: hover.x + 4,
            top: Math.max(0, hover.y - 36),
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            whiteSpace: 'nowrap',
          }}
        >
          {renderTooltip(byDate.get(hover.key) ?? { date: hover.key, value: 0 })}
        </div>
      ) : null}
      <div className="flex items-center gap-2 pt-3 text-[10px] font-mono uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
        <span>less</span>
        {Array.from({ length: levels + 1 }).map((_, i) => (
          <span
            // Legend swatches are a fixed-length sequence ordered low → high;
            // the index *is* the identifier.
            // biome-ignore lint/suspicious/noArrayIndexKey: legend ordering is the key
            key={`heat-swatch-${i}`}
            className="inline-block rounded-[2px]"
            style={{
              width: cellSize,
              height: cellSize,
              background: `var(--cu-heat-${i})`,
              border: '1px solid var(--color-border)',
            }}
          />
        ))}
        <span>more</span>
        <span className="ml-auto">
          {weekStart.toISOString().slice(0, 10)} → {days.at(-1)?.toISOString().slice(0, 10)}
        </span>
      </div>
    </div>
  );
}
