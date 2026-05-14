import type { TokenCounts, UsageRow } from './types';

export interface RowWithCost extends UsageRow {
  /** Estimated USD cost for this row. May be 0 for free / errored events. */
  cost: number;
  /** Whether this cost was inferred from Auto pool fallback (legacy model). */
  costEstimated: boolean;
}

export interface ModelBucket {
  model: string;
  rows: number;
  cost: number;
  costEstimated: boolean;
  /**
   * Sum of `RequestsValue.value` for rows whose `requests.kind === 'units'`.
   * Free / errored rows contribute 0.
   */
  requestUnits: number;
  tokens: TokenCounts;
  shareOfCost: number;
  shareOfRequests: number;
}

export interface DayBucket {
  /** YYYY-MM-DD in UTC. */
  date: string;
  rows: number;
  cost: number;
  requestUnits: number;
  tokens: TokenCounts;
}

/** Hour 0-23 × Weekday 0-6 (0 = Sunday) heatmap cell. */
export interface HourWeekdayCell {
  hour: number;
  weekday: number;
  cost: number;
  rows: number;
}

export interface CacheHitStats {
  /** Sum of cacheRead + inputWithCacheWrite + inputWithoutCacheWrite. */
  totalInput: number;
  /** Sum of cacheRead alone. */
  cacheRead: number;
  /** cacheRead / totalInput. NaN-safe → 0 if denominator is 0. */
  hitRatio: number;
}

export interface UsageSummary {
  totalRows: number;
  totalRequestUnits: number;
  totalCost: number;
  /** True if at least one row was costed via Auto-pool fallback. */
  costPartiallyEstimated: boolean;
  totalTokens: TokenCounts;
  freeRows: number;
  erroredRows: number;
  byModel: ModelBucket[];
  byDay: DayBucket[];
  byProvider: Array<{ provider: string; cost: number; rows: number }>;
  hourWeekday: HourWeekdayCell[];
  topBurns: RowWithCost[];
  cacheHitStats: CacheHitStats;
  /** Inclusive [first, last] dates in UTC ISO. Both null if no rows. */
  dateRange: { firstISO: string | null; lastISO: string | null };
}

const ZERO_TOKENS: TokenCounts = {
  inputWithCacheWrite: 0,
  inputWithoutCacheWrite: 0,
  cacheRead: 0,
  output: 0,
  total: 0,
};

function addTokens(a: TokenCounts, b: TokenCounts): TokenCounts {
  return {
    inputWithCacheWrite: a.inputWithCacheWrite + b.inputWithCacheWrite,
    inputWithoutCacheWrite: a.inputWithoutCacheWrite + b.inputWithoutCacheWrite,
    cacheRead: a.cacheRead + b.cacheRead,
    output: a.output + b.output,
    total: a.total + b.total,
  };
}

function ymdUTC(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function requestUnitsOf(row: UsageRow): number {
  return row.requests.kind === 'units' ? row.requests.value : 0;
}

/**
 * Lightweight provider classifier. Mirrors the human reading of model names —
 * does NOT need to be exhaustive, used only for the "byProvider" donut.
 */
export function classifyProvider(model: string): string {
  const m = model.toLowerCase();
  if (m.startsWith('claude')) return 'Anthropic';
  if (m.startsWith('gpt')) return 'OpenAI';
  if (m.startsWith('o1') || m.startsWith('o3') || m.startsWith('o4')) return 'OpenAI';
  if (m.startsWith('gemini')) return 'Google';
  if (m.startsWith('grok')) return 'xAI';
  if (m.startsWith('composer')) return 'Cursor';
  if (m === 'auto') return 'Cursor';
  if (m.startsWith('deepseek')) return 'DeepSeek';
  if (m.startsWith('kimi')) return 'Moonshot';
  if (m.startsWith('qwen')) return 'Qwen';
  return 'Other';
}

export interface AggregateOptions {
  /** Number of rows to include in `topBurns`. Defaults to 10. */
  topBurnsCount?: number;
}

/**
 * Single-pass aggregation over rows already costed by the pricing engine.
 * Pure function — safe to call for any subset (filtered ranges, single model).
 */
export function aggregate(rows: RowWithCost[], options: AggregateOptions = {}): UsageSummary {
  const topBurnsCount = options.topBurnsCount ?? 10;

  if (rows.length === 0) {
    return {
      totalRows: 0,
      totalRequestUnits: 0,
      totalCost: 0,
      costPartiallyEstimated: false,
      totalTokens: { ...ZERO_TOKENS },
      freeRows: 0,
      erroredRows: 0,
      byModel: [],
      byDay: [],
      byProvider: [],
      hourWeekday: [],
      topBurns: [],
      cacheHitStats: { totalInput: 0, cacheRead: 0, hitRatio: 0 },
      dateRange: { firstISO: null, lastISO: null },
    };
  }

  let totalRequestUnits = 0;
  let totalCost = 0;
  let totalTokens: TokenCounts = { ...ZERO_TOKENS };
  let freeRows = 0;
  let erroredRows = 0;
  let costPartiallyEstimated = false;

  const modelMap = new Map<string, ModelBucket>();
  const dayMap = new Map<string, DayBucket>();
  const providerMap = new Map<string, { provider: string; cost: number; rows: number }>();
  const hwMap = new Map<string, HourWeekdayCell>();

  // After the empty-rows guard above, `rows[0]` is definitely a row,
  // but TS's `noUncheckedIndexedAccess` can't see that — hoist it once.
  const seed = rows[0];
  if (!seed) {
    throw new Error('aggregate: unreachable — rows was empty after non-empty check');
  }
  let firstDate = seed.date;
  let lastDate = seed.date;

  for (const row of rows) {
    const units = requestUnitsOf(row);
    totalRequestUnits += units;
    totalCost += row.cost;
    totalTokens = addTokens(totalTokens, row.tokens);
    if (row.requests.kind === 'free') freeRows += 1;
    if (row.requests.kind === 'errored') erroredRows += 1;
    if (row.costEstimated) costPartiallyEstimated = true;

    if (row.date < firstDate) firstDate = row.date;
    if (row.date > lastDate) lastDate = row.date;

    const mb = modelMap.get(row.model) ?? {
      model: row.model,
      rows: 0,
      cost: 0,
      costEstimated: false,
      requestUnits: 0,
      tokens: { ...ZERO_TOKENS },
      shareOfCost: 0,
      shareOfRequests: 0,
    };
    mb.rows += 1;
    mb.cost += row.cost;
    mb.requestUnits += units;
    mb.tokens = addTokens(mb.tokens, row.tokens);
    if (row.costEstimated) mb.costEstimated = true;
    modelMap.set(row.model, mb);

    const ymd = ymdUTC(row.date);
    const db = dayMap.get(ymd) ?? {
      date: ymd,
      rows: 0,
      cost: 0,
      requestUnits: 0,
      tokens: { ...ZERO_TOKENS },
    };
    db.rows += 1;
    db.cost += row.cost;
    db.requestUnits += units;
    db.tokens = addTokens(db.tokens, row.tokens);
    dayMap.set(ymd, db);

    const provider = classifyProvider(row.model);
    const pb = providerMap.get(provider) ?? { provider, cost: 0, rows: 0 };
    pb.cost += row.cost;
    pb.rows += 1;
    providerMap.set(provider, pb);

    const hour = row.date.getUTCHours();
    const weekday = row.date.getUTCDay();
    const key = `${hour}-${weekday}`;
    const hw = hwMap.get(key) ?? { hour, weekday, cost: 0, rows: 0 };
    hw.cost += row.cost;
    hw.rows += 1;
    hwMap.set(key, hw);
  }

  const byModel = Array.from(modelMap.values())
    .map((m) => ({
      ...m,
      shareOfCost: totalCost > 0 ? m.cost / totalCost : 0,
      shareOfRequests: totalRequestUnits > 0 ? m.requestUnits / totalRequestUnits : 0,
    }))
    .sort((a, b) => b.cost - a.cost);

  const byDay = Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  const byProvider = Array.from(providerMap.values()).sort((a, b) => b.cost - a.cost);
  const hourWeekday = Array.from(hwMap.values());
  const topBurns = [...rows].sort((a, b) => b.cost - a.cost).slice(0, topBurnsCount);

  const cacheHitStats: CacheHitStats = (() => {
    const totalInput =
      totalTokens.inputWithCacheWrite + totalTokens.inputWithoutCacheWrite + totalTokens.cacheRead;
    const cacheRead = totalTokens.cacheRead;
    return {
      totalInput,
      cacheRead,
      hitRatio: totalInput > 0 ? cacheRead / totalInput : 0,
    };
  })();

  return {
    totalRows: rows.length,
    totalRequestUnits,
    totalCost,
    costPartiallyEstimated,
    totalTokens,
    freeRows,
    erroredRows,
    byModel,
    byDay,
    byProvider,
    hourWeekday,
    topBurns,
    cacheHitStats,
    dateRange: {
      firstISO: firstDate.toISOString(),
      lastISO: lastDate.toISOString(),
    },
  };
}
