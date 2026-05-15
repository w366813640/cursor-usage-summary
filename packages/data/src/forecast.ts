/**
 * Simple OLS linear regression + 95 % prediction band for the daily
 * cost series. Designed for the Forecast panel on the Overview page —
 * we run it on the last 30 / 60 / 90 days and project the next 30.
 *
 * Why OLS and not exponential smoothing / ARIMA?
 *
 *   - The series is short (≤ 90 points) and has a clear linear drift
 *     in the common "ramp-up usage" case the dashboard targets.
 *   - We want a transparent number the user can sanity-check from the
 *     panel itself ("avg of last 30 days × N + drift") rather than a
 *     black-box smoother.
 *   - Implementation is one file, no external dep, easy to unit-test.
 *
 * If you ever need richer behaviour, this is the single place to swap
 * in a different model — the consumers depend only on `ForecastResult`.
 */

export interface ForecastPoint {
  /** ISO YYYY-MM-DD. */
  date: string;
  /** Point estimate for the day in USD. */
  mean: number;
  /** 95 % CI lower bound (floored at 0). */
  lower: number;
  /** 95 % CI upper bound. */
  upper: number;
}

export interface HistoricalPoint {
  date: string;
  value: number;
}

export interface ForecastResult {
  /** The historical data window the regression was run over. */
  historical: HistoricalPoint[];
  /** Next-N-days projection, day-by-day. */
  projected: ForecastPoint[];
  /** Sum of the projected `mean` values across the horizon. */
  totalProjected: number;
  /** Sum of `lower` bounds across the horizon. */
  totalLower: number;
  /** Sum of `upper` bounds across the horizon. */
  totalUpper: number;
  /**
   * Slope in $/day for the historical window. Positive = trending up.
   * Useful for an arrow / "+12 % MoM" indicator.
   */
  slope: number;
  /** Y-intercept in $ (cost at day 0 of the regression). */
  intercept: number;
  /** Coefficient of determination — 1 = perfect fit, 0 = noise. */
  rSquared: number;
  /** Standard deviation of regression residuals (used to size the band). */
  stdError: number;
  /**
   * Qualitative trend label, derived from `slope` and the historical mean
   * so the UI doesn't have to repeat the threshold logic.
   */
  trend: 'rising' | 'falling' | 'flat';
  /** Qualitative confidence label, derived from `rSquared`. */
  confidence: 'high' | 'medium' | 'low';
}

export interface ForecastOptions {
  /** Number of days to project forward. Default 30. */
  horizonDays?: number;
  /**
   * Cap the historical window. Default 90 — long enough to catch a
   * monthly billing rhythm, short enough that two-year-old behaviour
   * doesn't dominate the slope.
   */
  lookbackDays?: number;
}

/**
 * Run the regression + project forward. The input must be sorted
 * ascending by date and contiguous (one entry per calendar day in the
 * series). Missing days should be passed as `{ date, value: 0 }` so the
 * regression sees zeros instead of skipping them.
 *
 * If fewer than 7 data points are supplied the function returns a
 * degenerate forecast (empty projection, `trend: 'flat'`, `confidence: 'low'`)
 * so callers can branch on `result.historical.length >= 7` instead of
 * sprinkling guards everywhere.
 */
export function forecastDailyCost(
  data: ReadonlyArray<HistoricalPoint>,
  options: ForecastOptions = {},
): ForecastResult {
  const { horizonDays = 30, lookbackDays = 90 } = options;
  const window = data.slice(-lookbackDays);
  const n = window.length;

  if (n < 7) {
    return {
      historical: [...window],
      projected: [],
      totalProjected: 0,
      totalLower: 0,
      totalUpper: 0,
      slope: 0,
      intercept: window.length > 0 ? window[window.length - 1]!.value : 0,
      rSquared: 0,
      stdError: 0,
      trend: 'flat',
      confidence: 'low',
    };
  }

  // x indexes are 0..n-1; y is daily cost in USD.
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += window[i]!.value;
  }
  const meanX = sumX / n;
  const meanY = sumY / n;

  for (let i = 0; i < n; i++) {
    const dx = i - meanX;
    const dy = window[i]!.value - meanY;
    sumXY += dx * dy;
    sumXX += dx * dx;
  }

  const slope = sumXX > 0 ? sumXY / sumXX : 0;
  const intercept = meanY - slope * meanX;

  // Residuals + R².
  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < n; i++) {
    const yi = window[i]!.value;
    const fit = intercept + slope * i;
    ssRes += (yi - fit) ** 2;
    ssTot += (yi - meanY) ** 2;
  }
  const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;
  // Sample standard deviation of residuals (n-2 dof; OLS classic).
  const stdError = n > 2 ? Math.sqrt(ssRes / (n - 2)) : 0;

  // Project forward. We use the 95 % confidence multiplier (1.96) as the
  // band width — wide enough to feel honest about uncertainty but not so
  // wide it dwarfs the central line on the chart.
  const Z = 1.96;
  const lastDate = window[n - 1]!.date;
  const lastDay = new Date(`${lastDate}T00:00:00Z`);

  const projected: ForecastPoint[] = [];
  let totalProjected = 0;
  let totalLower = 0;
  let totalUpper = 0;
  for (let h = 1; h <= horizonDays; h++) {
    const day = new Date(lastDay);
    day.setUTCDate(day.getUTCDate() + h);
    const date = day.toISOString().slice(0, 10);
    const x = n - 1 + h;
    const mean = Math.max(0, intercept + slope * x);
    const lower = Math.max(0, mean - Z * stdError);
    const upper = Math.max(mean, mean + Z * stdError);
    projected.push({ date, mean, lower, upper });
    totalProjected += mean;
    totalLower += lower;
    totalUpper += upper;
  }

  // Trend tag — measured relative to the historical mean so a small
  // absolute slope on a low-budget account still reads correctly.
  const dailyDrift = slope;
  const relativeDrift = meanY > 0 ? Math.abs(dailyDrift) / meanY : 0;
  const trend: ForecastResult['trend'] =
    relativeDrift < 0.005 ? 'flat' : dailyDrift > 0 ? 'rising' : 'falling';

  const confidence: ForecastResult['confidence'] =
    rSquared >= 0.6 ? 'high' : rSquared >= 0.25 ? 'medium' : 'low';

  return {
    historical: [...window],
    projected,
    totalProjected,
    totalLower,
    totalUpper,
    slope,
    intercept,
    rSquared,
    stdError,
    trend,
    confidence,
  };
}

/**
 * Fill in any missing days in a `[ { date, value } ]` series with zeros,
 * so the regression sees a contiguous time grid. The forecast utility
 * assumes contiguous data; this helper is what callers run before
 * passing the daily cost series in.
 */
export function fillMissingDays(
  data: ReadonlyArray<HistoricalPoint>,
  endDate?: string,
): HistoricalPoint[] {
  if (data.length === 0) return [];
  const map = new Map<string, number>();
  for (const d of data) map.set(d.date, d.value);
  const startStr = data[0]!.date;
  const endStr = endDate ?? data[data.length - 1]!.date;
  const start = new Date(`${startStr}T00:00:00Z`);
  const end = new Date(`${endStr}T00:00:00Z`);
  const out: HistoricalPoint[] = [];
  for (let cur = new Date(start); cur <= end; cur.setUTCDate(cur.getUTCDate() + 1)) {
    const iso = cur.toISOString().slice(0, 10);
    out.push({ date: iso, value: map.get(iso) ?? 0 });
  }
  return out;
}
