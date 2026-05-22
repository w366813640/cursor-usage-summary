import type { RowWithCost, UsageSummary } from './aggregators';

/**
 * Locally-computed anomaly detection over Cursor usage data.
 *
 * Three independent detectors, each one a pure function, zero external
 * dependencies. They answer the three questions a developer reading their
 * own usage data actually has when looking at *today*:
 *
 *   1. "Did I spend a lot more today than usual?"   -> {@link detectCostSpikes}
 *   2. "Did each request cost more than usual?"      -> {@link detectCostPerReqShifts}
 *   3. "Did my cache hit ratio drop noticeably?"     -> {@link detectCacheHitDrops}
 *
 * Design choices documented in `.trellis/tasks/05-22-v12-power-upgrade/research/anomaly-detection-algorithms.md`:
 *
 * - Cost spike uses **robust z-score** (MAD) instead of plain z-score so a
 *   single past outlier doesn't poison the baseline.
 * - Cost-per-req shift uses **personal-baseline multiplier** because it's
 *   intuitive ("today is N x your usual") and handles model switches well.
 * - Cache hit drop uses **percentage-point delta** vs lagged window — pp
 *   units are the right scale for ratios.
 */

export type Severity = 'low' | 'medium' | 'high';

export type Anomaly = CostSpikeAnomaly | CostPerReqShiftAnomaly | CacheHitDropAnomaly;

export interface CostSpikeAnomaly {
  kind: 'cost-spike';
  date: string; // YYYY-MM-DD
  cost: number;
  baselineMedian: number;
  baselineMad: number;
  robustZ: number;
  severity: Severity;
  explanation: string;
}

export interface CostPerReqShiftAnomaly {
  kind: 'costperreq-shift';
  date: string;
  current: number; // $/req on this day
  baseline: number; // user's robust baseline $/req
  ratio: number; // current / baseline
  topModel: string; // model with the highest cost share on this day
  dailyCost: number; // total cost on this day (used to gate noise)
  severity: Severity;
  explanation: string;
}

export interface CacheHitDropAnomaly {
  kind: 'cache-drop';
  date: string;
  current: number; // hit ratio on this day (0..1)
  baseline: number; // baseline hit ratio (0..1)
  dropPp: number; // percentage-point delta (positive number = drop)
  severity: Severity;
  explanation: string;
}

export interface AnomalyDetectionOptions {
  /** Cost-spike robust z-score cutoff. Default 2.5 (cursor-usage-tracker default). */
  costSpikeZ?: number;
  /** Cost-spike: minimum absolute cost on the anomaly day, filters cheap-day noise. Default $5. */
  costSpikeMinCost?: number;
  /** Cost-per-req: anomaly when today's ratio is >= N x baseline. Default 3.0. */
  costPerReqRatio?: number;
  /** Cost-per-req: minimum dollar spend on the day to consider. Default $5. */
  costPerReqMinDailyCost?: number;
  /** Cache-drop: anomaly when today's hit ratio is >= N pp below baseline. Default 10. */
  cacheDropMinPp?: number;
  /** Look-back window used for personal baselines. Default 14 days. */
  baselineWindowDays?: number;
}

const DEFAULTS: Required<AnomalyDetectionOptions> = {
  costSpikeZ: 2.5,
  costSpikeMinCost: 5,
  costPerReqRatio: 3.0,
  costPerReqMinDailyCost: 5,
  cacheDropMinPp: 10,
  baselineWindowDays: 14,
};

/* -------------------------------------------------------------- *
 *  Statistics helpers
 * -------------------------------------------------------------- */

export function median(values: ReadonlyArray<number>): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  if (n % 2 === 0) return (sorted[n / 2 - 1]! + sorted[n / 2]!) / 2;
  return sorted[(n - 1) / 2]!;
}

export function medianAbsoluteDeviation(values: ReadonlyArray<number>): number {
  if (values.length === 0) return 0;
  const med = median(values);
  const absDev = values.map((v) => Math.abs(v - med));
  return median(absDev);
}

/**
 * Robust z-score (Hampel 1974): `0.6745 * (x - median) / MAD`.
 *
 * The 0.6745 constant makes the result comparable to a classic z-score
 * under a Normal distribution: |robustZ| > 2 ~ 2 sigma. Returns 0 when
 * MAD is 0 (all values identical or degenerate) so callers don't have
 * to NaN-guard.
 */
export function robustZScore(value: number, baseline: ReadonlyArray<number>): number {
  if (baseline.length === 0) return 0;
  const med = median(baseline);
  const mad = medianAbsoluteDeviation(baseline);
  if (mad === 0) return 0;
  return (0.6745 * (value - med)) / mad;
}

/* -------------------------------------------------------------- *
 *  Detector 1: daily cost spike
 * -------------------------------------------------------------- */

/**
 * Walk `byDay` left-to-right and flag any day whose cost is a robust
 * z-score outlier vs the trailing `baselineWindowDays`. Self-contained —
 * the only state is the rolling baseline.
 */
export function detectCostSpikes(
  summary: UsageSummary,
  opts: AnomalyDetectionOptions = {},
): CostSpikeAnomaly[] {
  const { costSpikeZ, costSpikeMinCost, baselineWindowDays } = { ...DEFAULTS, ...opts };
  const out: CostSpikeAnomaly[] = [];
  const days = summary.byDay;
  if (days.length < 7) return out; // need at least a week of baseline

  for (let i = baselineWindowDays; i < days.length; i++) {
    const today = days[i]!;
    if (today.cost < costSpikeMinCost) continue;
    const window = days.slice(Math.max(0, i - baselineWindowDays), i).map((d) => d.cost);
    const med = median(window);
    const mad = medianAbsoluteDeviation(window);

    // When the baseline is perfectly flat (MAD === 0) robust-z collapses
    // to 0 and silently misses obvious spikes. Fall back to a "x times
    // the median" ratio so a $80 day against a flat $1 baseline still
    // surfaces. We map the ratio onto a synthetic z so severity buckets
    // and the explanation copy stay consistent.
    let z: number;
    let usedRatioFallback = false;
    if (mad === 0) {
      const baseline = Math.max(med, 0.5);
      const ratio = today.cost / baseline;
      if (ratio < 5) continue;
      z = Math.min(99, ratio);
      usedRatioFallback = true;
    } else {
      z = (0.6745 * (today.cost - med)) / mad;
      if (z < costSpikeZ) continue;
    }

    const severity: Severity = z >= 3.5 ? 'high' : z >= 2.5 ? 'medium' : 'low';
    const explanation = usedRatioFallback
      ? `${today.date} spent $${today.cost.toFixed(2)}, ${(today.cost / Math.max(med, 0.5)).toFixed(1)}x your usual baseline of $${med.toFixed(2)}.`
      : `${today.date} spent $${today.cost.toFixed(2)}, ${z.toFixed(1)} robust-z above the ${baselineWindowDays}-day baseline of $${med.toFixed(2)}.`;
    out.push({
      kind: 'cost-spike',
      date: today.date,
      cost: today.cost,
      baselineMedian: med,
      baselineMad: mad,
      robustZ: z,
      severity,
      explanation,
    });
  }
  return out;
}

/* -------------------------------------------------------------- *
 *  Detector 2: cost-per-request shift (catches model switches)
 * -------------------------------------------------------------- */

interface PerDayCpr {
  date: string;
  cost: number;
  units: number;
  cpr: number; // cost / units; 0 when units==0
  topModel: string; // model with the largest cost share on this day
}

function aggregateCostPerRequestByDay(rows: ReadonlyArray<RowWithCost>): PerDayCpr[] {
  const map = new Map<string, { cost: number; units: number; byModel: Map<string, number> }>();
  for (const r of rows) {
    const day = r.dateISO.slice(0, 10);
    const units = r.requests.kind === 'units' ? r.requests.value : 0;
    let entry = map.get(day);
    if (!entry) {
      entry = { cost: 0, units: 0, byModel: new Map() };
      map.set(day, entry);
    }
    entry.cost += r.cost;
    entry.units += units;
    entry.byModel.set(r.model, (entry.byModel.get(r.model) ?? 0) + r.cost);
  }
  const out: PerDayCpr[] = [];
  for (const [date, e] of map) {
    let topModel = '';
    let topCost = -1;
    for (const [m, c] of e.byModel) {
      if (c > topCost) {
        topCost = c;
        topModel = m;
      }
    }
    out.push({
      date,
      cost: e.cost,
      units: e.units,
      cpr: e.units > 0 ? e.cost / e.units : 0,
      topModel,
    });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export function detectCostPerReqShifts(
  rows: ReadonlyArray<RowWithCost>,
  opts: AnomalyDetectionOptions = {},
): CostPerReqShiftAnomaly[] {
  const { costPerReqRatio, costPerReqMinDailyCost, baselineWindowDays } = {
    ...DEFAULTS,
    ...opts,
  };
  const series = aggregateCostPerRequestByDay(rows);
  const out: CostPerReqShiftAnomaly[] = [];
  if (series.length < 7) return out;

  for (let i = baselineWindowDays; i < series.length; i++) {
    const today = series[i]!;
    // Only consider days with non-trivial cost AND units, otherwise the
    // ratio is dominated by single-row noise.
    if (today.cost < costPerReqMinDailyCost) continue;
    if (today.units === 0) continue;

    const window = series
      .slice(Math.max(0, i - baselineWindowDays), i)
      .filter((d) => d.units > 0)
      .map((d) => d.cpr);
    if (window.length < 3) continue;
    const baseline = median(window);
    if (baseline <= 0) continue;
    const ratio = today.cpr / baseline;
    if (ratio < costPerReqRatio) continue;

    const severity: Severity = ratio >= 5 ? 'high' : ratio >= 3 ? 'medium' : 'low';
    out.push({
      kind: 'costperreq-shift',
      date: today.date,
      current: today.cpr,
      baseline,
      ratio,
      topModel: today.topModel,
      dailyCost: today.cost,
      severity,
      explanation: `${today.date} cost/request was $${today.cpr.toFixed(2)}, ${ratio.toFixed(1)}x your baseline of $${baseline.toFixed(2)} (top model on this day: ${today.topModel}).`,
    });
  }
  return out;
}

/* -------------------------------------------------------------- *
 *  Detector 3: cache hit ratio drop
 * -------------------------------------------------------------- */

interface PerDayCacheRatio {
  date: string;
  ratio: number; // 0..1, NaN-safe (0 when no input tokens)
  inputTokens: number;
}

function aggregateCacheRatioByDay(rows: ReadonlyArray<RowWithCost>): PerDayCacheRatio[] {
  const map = new Map<string, { input: number; cache: number }>();
  for (const r of rows) {
    const day = r.dateISO.slice(0, 10);
    let e = map.get(day);
    if (!e) {
      e = { input: 0, cache: 0 };
      map.set(day, e);
    }
    e.input += r.tokens.inputWithCacheWrite + r.tokens.inputWithoutCacheWrite + r.tokens.cacheRead;
    e.cache += r.tokens.cacheRead;
  }
  const out: PerDayCacheRatio[] = [];
  for (const [date, e] of map) {
    out.push({
      date,
      ratio: e.input > 0 ? e.cache / e.input : 0,
      inputTokens: e.input,
    });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export function detectCacheHitDrops(
  rows: ReadonlyArray<RowWithCost>,
  opts: AnomalyDetectionOptions = {},
): CacheHitDropAnomaly[] {
  const { cacheDropMinPp, baselineWindowDays } = { ...DEFAULTS, ...opts };
  const series = aggregateCacheRatioByDay(rows);
  const out: CacheHitDropAnomaly[] = [];
  if (series.length < 7) return out;

  for (let i = baselineWindowDays; i < series.length; i++) {
    const today = series[i]!;
    // Skip days with negligible token volume — a 0% hit ratio on a single
    // tiny request is not actually anomalous.
    if (today.inputTokens < 1000) continue;
    const window = series
      .slice(Math.max(0, i - baselineWindowDays), i)
      .filter((d) => d.inputTokens >= 1000);
    if (window.length < 3) continue;
    const baseline = median(window.map((d) => d.ratio));
    const dropPp = (baseline - today.ratio) * 100;
    if (dropPp < cacheDropMinPp) continue;

    const severity: Severity = dropPp >= 25 ? 'high' : dropPp >= 15 ? 'medium' : 'low';
    out.push({
      kind: 'cache-drop',
      date: today.date,
      current: today.ratio,
      baseline,
      dropPp,
      severity,
      explanation: `${today.date} cache hit ratio dropped ${dropPp.toFixed(0)}pp to ${(today.ratio * 100).toFixed(0)}% (baseline ${(baseline * 100).toFixed(0)}%).`,
    });
  }
  return out;
}

/* -------------------------------------------------------------- *
 *  Unified detection entry point
 * -------------------------------------------------------------- */

export interface DetectAllResult {
  all: Anomaly[];
  bySeverity: { high: Anomaly[]; medium: Anomaly[]; low: Anomaly[] };
  byDay: Map<string, Anomaly[]>;
}

export function detectAllAnomalies(
  summary: UsageSummary,
  rows: ReadonlyArray<RowWithCost>,
  opts: AnomalyDetectionOptions = {},
): DetectAllResult {
  const spikes = detectCostSpikes(summary, opts);
  const shifts = detectCostPerReqShifts(rows, opts);
  const drops = detectCacheHitDrops(rows, opts);
  const all: Anomaly[] = [...spikes, ...shifts, ...drops].sort((a, b) =>
    b.date.localeCompare(a.date),
  );
  const bySeverity: DetectAllResult['bySeverity'] = { high: [], medium: [], low: [] };
  const byDay = new Map<string, Anomaly[]>();
  for (const a of all) {
    bySeverity[a.severity].push(a);
    const list = byDay.get(a.date) ?? [];
    list.push(a);
    byDay.set(a.date, list);
  }
  return { all, bySeverity, byDay };
}
