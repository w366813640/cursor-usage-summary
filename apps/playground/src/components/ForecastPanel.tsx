import { fmtUSD, fmtUSDCompact } from '@cu/charts';
import {
  type ForecastResult,
  type RowWithCost,
  fillMissingDays,
  forecastDailyCost,
} from '@cu/data';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CircleDot,
  Minus,
  TrendingUp,
} from '@cu/icons';
import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { Panel } from './Panel';

interface ForecastPanelProps {
  rows: ReadonlyArray<RowWithCost>;
}

/**
 * Forecast panel — projects the next 30 days of spend by fitting an OLS
 * linear regression over the last 90 days of daily cost and extrapolating
 * the line forward with a 95 % prediction band.
 *
 * Layout:
 *
 *   ┌─ next 30 days · forecast ───────── [ HIGH · rising ] ┐
 *   │  $X.XX projected             (range $A.AA – $B.BB)   │
 *   │  $Y.YY current 30-day avg    Δ vs forecast: +Z %     │
 *   │                                                       │
 *   │  ┌─ chart ──────────────────────────────────────────┐ │
 *   │  │                                                  │ │
 *   │  │  shaded band = 95 % CI · dashed line = mean      │ │
 *   │  │  vertical rule = today                           │ │
 *   │  │                                                  │ │
 *   │  └──────────────────────────────────────────────────┘ │
 *   │                                                       │
 *   │  caption: "If your current pattern holds, …"          │
 *   └───────────────────────────────────────────────────────┘
 */
export function ForecastPanel({ rows }: ForecastPanelProps) {
  const forecast = useMemo(() => buildForecast(rows), [rows]);

  if (forecast.historical.length < 7) {
    return (
      <Panel
        title="Forecast · next 30 days"
        subtitle="Needs at least one week of data before projecting"
      >
        <div className="flex items-center gap-3 rounded-md border border-dashed border-[var(--color-border)] px-4 py-6 font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
          <AlertTriangle size={16} aria-hidden="true" />
          Import more usage before the forecast can settle.
        </div>
      </Panel>
    );
  }

  const lastHistoryAvg = recentDailyAverage(forecast.historical, 7);
  const projectedDailyMean =
    forecast.projected.length > 0 ? forecast.totalProjected / forecast.projected.length : 0;
  const deltaPct = lastHistoryAvg > 0 ? (projectedDailyMean - lastHistoryAvg) / lastHistoryAvg : 0;

  return (
    <Panel
      title="Forecast · next 30 days"
      subtitle="OLS linear regression · last 90 days → next 30 days · 95 % prediction band"
      action={<ForecastBadge trend={forecast.trend} confidence={forecast.confidence} />}
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
        <ForecastChart forecast={forecast} />
        <ForecastKpis
          forecast={forecast}
          lastHistoryAvg={lastHistoryAvg}
          projectedDailyMean={projectedDailyMean}
          deltaPct={deltaPct}
        />
      </div>
      <ForecastCaption
        forecast={forecast}
        projectedDailyMean={projectedDailyMean}
        deltaPct={deltaPct}
      />
    </Panel>
  );
}

/* -------------------------------------------------------------- *
 *  Build inputs from RowWithCost
 * -------------------------------------------------------------- */

function buildForecast(rows: ReadonlyArray<RowWithCost>): ForecastResult {
  if (rows.length === 0) {
    return forecastDailyCost([]);
  }
  // Roll cost up by day so the regression sees a clean univariate series.
  const dayMap = new Map<string, number>();
  for (const r of rows) {
    const day = r.dateISO.slice(0, 10);
    dayMap.set(day, (dayMap.get(day) ?? 0) + r.cost);
  }
  const raw = [...dayMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, value]) => ({ date, value }));
  // Pad missing days with zeros so the regression handles weekend gaps
  // and import-time holes correctly.
  const filled = fillMissingDays(raw);
  return forecastDailyCost(filled, { lookbackDays: 90, horizonDays: 30 });
}

function recentDailyAverage(series: ReadonlyArray<{ value: number }>, n: number): number {
  if (series.length === 0) return 0;
  const slice = series.slice(-n);
  return slice.reduce((acc, p) => acc + p.value, 0) / slice.length;
}

/* -------------------------------------------------------------- *
 *  Chart — SVG with shaded band + dashed projection
 * -------------------------------------------------------------- */

function ForecastChart({ forecast }: { forecast: ForecastResult }) {
  const W = 620;
  const H = 200;
  const padL = 36;
  const padR = 10;
  const padT = 10;
  const padB = 24;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const all = [
    ...forecast.historical.map((p) => ({ date: p.date, value: p.value })),
    ...forecast.projected.map((p) => ({ date: p.date, value: p.upper })),
  ];
  if (all.length === 0) return null;

  const yMax = Math.max(
    1e-6,
    ...forecast.historical.map((p) => p.value),
    ...forecast.projected.map((p) => p.upper),
  );
  const xMax = all.length - 1;
  const x = (i: number) => padL + (innerW * i) / xMax;
  const y = (v: number) => padT + innerH - (innerH * v) / yMax;
  // Vertical separator marks where the historical series ends — i.e.,
  // "today" from the forecast's perspective.
  const cutoffIdx = forecast.historical.length - 1;
  const cutoffX = x(cutoffIdx);

  const histPath = forecast.historical
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(2)} ${y(p.value).toFixed(2)}`)
    .join(' ');

  // Projection line is appended to the last historical point so the two
  // segments visually join without a jump.
  const projPath = forecast.projected
    .map((p, i) => {
      const absI = forecast.historical.length + i;
      const cmd = i === 0 ? 'M' : 'L';
      return `${cmd} ${x(absI).toFixed(2)} ${y(p.mean).toFixed(2)}`;
    })
    .join(' ');

  // Confidence band — only over the projection portion (we can't compute
  // a band for the past). Top path goes left → right, bottom comes back
  // right → left so the polygon closes neatly.
  const bandTop = forecast.projected.map((p, i) => {
    const absI = forecast.historical.length + i;
    return `${i === 0 ? 'M' : 'L'} ${x(absI).toFixed(2)} ${y(p.upper).toFixed(2)}`;
  });
  const bandBottom = forecast.projected
    .slice()
    .reverse()
    .map((p, i, arr) => {
      const absI = forecast.historical.length + (arr.length - 1 - i);
      return `L ${x(absI).toFixed(2)} ${y(p.lower).toFixed(2)}`;
    });
  const bandPath =
    forecast.projected.length > 0 ? `${bandTop.join(' ')} ${bandBottom.join(' ')} Z` : '';

  // Y axis ticks — pick 3 friendly stops based on yMax.
  const ticks = niceTicks(yMax, 3);

  return (
    <div className="overflow-x-auto rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-3">
      <svg
        width={W}
        height={H}
        role="img"
        aria-label="Daily cost forecast with 95 percent prediction band"
      >
        {/* Y axis ticks + horizontal guide lines */}
        {ticks.map((t) => (
          <g key={`tick-${t}`}>
            <line
              x1={padL}
              x2={W - padR}
              y1={y(t)}
              y2={y(t)}
              stroke="color-mix(in oklab, var(--color-text) 8%, transparent)"
              strokeDasharray="2 4"
            />
            <text
              x={padL - 4}
              y={y(t) + 3}
              textAnchor="end"
              fontSize={9}
              fontFamily="var(--font-mono)"
              fill="var(--color-text-subtle)"
            >
              {fmtUSDCompact(t)}
            </text>
          </g>
        ))}

        {/* Confidence band */}
        {bandPath ? (
          <motion.path
            d={bandPath}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.18 }}
            transition={{ duration: 0.6, ease: [0.2, 0, 0, 1] }}
            fill="var(--color-accent)"
          />
        ) : null}

        {/* Cutoff rule */}
        <line
          x1={cutoffX}
          x2={cutoffX}
          y1={padT}
          y2={H - padB}
          stroke="color-mix(in oklab, var(--color-text) 35%, transparent)"
          strokeDasharray="3 3"
        />
        <text
          x={cutoffX + 4}
          y={padT + 10}
          fontSize={9}
          fontFamily="var(--font-mono)"
          fill="var(--color-text-subtle)"
        >
          today
        </text>

        {/* Historical line */}
        <motion.path
          d={histPath}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth={1.6}
          strokeLinejoin="round"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.9, ease: [0.2, 0, 0, 1] }}
        />

        {/* Projection line (dashed) */}
        {projPath ? (
          <motion.path
            d={projPath}
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth={1.4}
            strokeLinejoin="round"
            strokeLinecap="round"
            strokeDasharray="4 4"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 0.8 }}
            transition={{ duration: 0.9, ease: [0.2, 0, 0, 1], delay: 0.3 }}
          />
        ) : null}

        {/* End marker */}
        {forecast.projected.length > 0 ? (
          <circle
            cx={x(forecast.historical.length + forecast.projected.length - 1)}
            cy={y(forecast.projected[forecast.projected.length - 1]!.mean)}
            r={3}
            fill="var(--color-accent)"
          />
        ) : null}

        {/* X axis end labels */}
        <text
          x={padL}
          y={H - 6}
          fontSize={9}
          fontFamily="var(--font-mono)"
          fill="var(--color-text-subtle)"
        >
          {forecast.historical[0]?.date ?? ''}
        </text>
        <text
          x={W - padR}
          y={H - 6}
          textAnchor="end"
          fontSize={9}
          fontFamily="var(--font-mono)"
          fill="var(--color-text-subtle)"
        >
          {forecast.projected[forecast.projected.length - 1]?.date ?? ''}
        </text>
      </svg>
    </div>
  );
}

function niceTicks(max: number, n: number): number[] {
  if (max <= 0) return [0];
  // Round max up to a friendly value (1, 2, 5, 10 × 10^k) for cleaner ticks.
  const exp = Math.floor(Math.log10(max));
  const base = 10 ** exp;
  const mant = max / base;
  const rounded = mant <= 1 ? 1 : mant <= 2 ? 2 : mant <= 5 ? 5 : 10;
  const top = rounded * base;
  const out: number[] = [];
  for (let i = 1; i <= n; i++) out.push((top * i) / n);
  return out;
}

/* -------------------------------------------------------------- *
 *  KPI strip + caption + badge
 * -------------------------------------------------------------- */

function ForecastKpis({
  forecast,
  lastHistoryAvg,
  projectedDailyMean,
  deltaPct,
}: {
  forecast: ForecastResult;
  lastHistoryAvg: number;
  projectedDailyMean: number;
  deltaPct: number;
}) {
  return (
    <div className="flex flex-col gap-3">
      <Kpi
        label="Next 30 days · projected"
        value={fmtUSD(forecast.totalProjected)}
        sub={`range ${fmtUSDCompact(forecast.totalLower)} – ${fmtUSDCompact(forecast.totalUpper)}`}
        accent
      />
      <Kpi
        label="Projected daily run-rate"
        value={fmtUSD(projectedDailyMean)}
        sub={`drift ${forecast.slope >= 0 ? '+' : ''}${fmtUSDCompact(forecast.slope)}/day`}
      />
      <Kpi
        label="Recent 7-day daily avg"
        value={fmtUSD(lastHistoryAvg)}
        sub={
          deltaPct === 0
            ? 'matches forecast'
            : `${deltaPct > 0 ? '+' : ''}${(deltaPct * 100).toFixed(0)} % vs forecast`
        }
      />
      <Kpi
        label="Model fit (R²)"
        value={`${(forecast.rSquared * 100).toFixed(0)}%`}
        sub={
          forecast.confidence === 'high'
            ? 'tight fit'
            : forecast.confidence === 'medium'
              ? 'noisy fit'
              : 'loose fit'
        }
      />
    </div>
  );
}

function ForecastCaption({
  forecast,
  projectedDailyMean,
  deltaPct,
}: {
  forecast: ForecastResult;
  projectedDailyMean: number;
  deltaPct: number;
}) {
  const trendText =
    forecast.trend === 'rising' ? 'climbing' : forecast.trend === 'falling' ? 'cooling' : 'flat';
  const confidenceText =
    forecast.confidence === 'high'
      ? 'the regression hugs the line, so the band is narrow'
      : forecast.confidence === 'medium'
        ? 'there is some noise around the trend, so the band widens'
        : 'the trend is mostly noise — read the projection as a vague rough number';

  return (
    <p className="pt-3 font-serif text-[14px] italic leading-snug text-[var(--color-text-muted)]">
      Your daily spend is {trendText} at {fmtUSD(projectedDailyMean)}/day on average over the next
      30 days{' '}
      <span className="text-[var(--color-text)]">
        ({fmtUSDCompact(forecast.totalLower)} – {fmtUSDCompact(forecast.totalUpper)} total)
      </span>
      . That is {deltaPct >= 0 ? 'about' : 'roughly'}{' '}
      <span className="text-[var(--color-text)]">{(deltaPct * 100).toFixed(0)} %</span>{' '}
      {deltaPct >= 0 ? 'above' : 'below'} your last 7-day pace, and {confidenceText}.
    </p>
  );
}

function Kpi({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div
      className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5"
      style={{
        background: accent
          ? 'color-mix(in oklab, var(--color-accent) 7%, var(--color-surface))'
          : undefined,
      }}
    >
      <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
        {label}
      </div>
      <div
        className="mt-1 font-serif text-[20px] leading-tight tracking-tight tabular-nums"
        style={accent ? { color: 'var(--color-accent)' } : undefined}
      >
        {value}
      </div>
      {sub ? (
        <div className="mt-0.5 font-mono text-[10px] text-[var(--color-text-subtle)]">{sub}</div>
      ) : null}
    </div>
  );
}

function ForecastBadge({
  trend,
  confidence,
}: {
  trend: ForecastResult['trend'];
  confidence: ForecastResult['confidence'];
}) {
  const trendColor =
    trend === 'rising'
      ? 'var(--color-warning)'
      : trend === 'falling'
        ? 'var(--color-accent)'
        : 'var(--color-text-muted)';
  const confidenceText = confidence.toUpperCase();
  return (
    <div
      className="flex items-center gap-2 rounded-md border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.08em]"
      style={{
        borderColor: 'color-mix(in oklab, var(--color-accent) 35%, var(--color-border))',
      }}
    >
      <span style={{ color: trendColor }} className="inline-flex items-center gap-0.5">
        {trend === 'rising' ? (
          <ArrowUpRight size={10} aria-hidden="true" />
        ) : trend === 'falling' ? (
          <ArrowDownRight size={10} aria-hidden="true" />
        ) : (
          <Minus size={10} aria-hidden="true" />
        )}
        {trend}
      </span>
      <span className="text-[var(--color-text-subtle)]">·</span>
      <span className="text-[var(--color-text)] inline-flex items-center gap-1">
        <CircleDot size={9} aria-hidden="true" />
        {confidenceText} CONFIDENCE
      </span>
      <span className="text-[var(--color-text-subtle)]">·</span>
      <TrendingUp size={10} aria-hidden="true" className="text-[var(--color-accent)]" />
    </div>
  );
}
