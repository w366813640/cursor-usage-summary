import type { RowWithCost, UsageRow } from '@cu/data';
import { matchModel } from './modelMatcher';

const PER_MILLION = 1_000_000;

export interface CacheSavingsResult {
  /** Total USD that *would have been* spent if cacheRead tokens were billed at the normal input rate. */
  hypotheticalInputCost: number;
  /** Actual USD spent on cacheRead tokens. */
  actualCacheReadCost: number;
  /** hypotheticalInputCost − actualCacheReadCost. Always ≥ 0 for sane pricing. */
  savings: number;
  /** Aggregate cacheRead token count across the dataset. */
  cacheReadTokens: number;
  /** Sum of inputWithoutCacheWrite + inputWithCacheWrite + cacheRead. */
  totalInputTokens: number;
  /** cacheRead / totalInput ratio (0..1), NaN-safe. */
  hitRatio: number;
  /** Per-day cache savings, ordered by date — handy for a sparkline. */
  byDay: ReadonlyArray<{ date: string; savings: number }>;
}

const EMPTY: CacheSavingsResult = {
  hypotheticalInputCost: 0,
  actualCacheReadCost: 0,
  savings: 0,
  cacheReadTokens: 0,
  totalInputTokens: 0,
  hitRatio: 0,
  byDay: [],
};

/**
 * "How much money did cache reuse actually save you?"
 *
 * We compute this by replaying each row's pricing entry:
 *   savings_per_row = (input_price − cacheRead_price) × cacheRead_tokens / 1M
 *
 * Free / errored rows contribute 0. Rows where `matchModel` falls back to
 * the Auto-pool still get a savings estimate — they're approximate, but the
 * shape of the number is still informative.
 *
 * Both `rows` and the returned `byDay` are read-only.
 */
export function calcCacheSavings(rows: ReadonlyArray<UsageRow | RowWithCost>): CacheSavingsResult {
  if (rows.length === 0) return EMPTY;

  let hypotheticalInputCost = 0;
  let actualCacheReadCost = 0;
  let cacheReadTokens = 0;
  let totalInputTokens = 0;

  const dayMap = new Map<string, number>();

  for (const row of rows) {
    if (row.requests.kind !== 'units') continue;
    const t = row.tokens;
    totalInputTokens += t.inputWithoutCacheWrite + t.inputWithCacheWrite + t.cacheRead;
    if (t.cacheRead <= 0) continue;
    const { pricing } = matchModel(row.model);
    const inputRate = pricing.unitPrice.input;
    const cacheReadRate = pricing.unitPrice.cacheRead;
    const hypo = (t.cacheRead * inputRate) / PER_MILLION;
    const real = (t.cacheRead * cacheReadRate) / PER_MILLION;
    const rowSavings = Math.max(0, hypo - real);
    hypotheticalInputCost += hypo;
    actualCacheReadCost += real;
    cacheReadTokens += t.cacheRead;

    // YYYY-MM-DD bucket (UTC). `row.date` is a Date object after parsing.
    const date = row.date.toISOString().slice(0, 10);
    dayMap.set(date, (dayMap.get(date) ?? 0) + rowSavings);
  }

  const byDay = Array.from(dayMap.entries())
    .map(([date, savings]) => ({ date, savings }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const savings = Math.max(0, hypotheticalInputCost - actualCacheReadCost);
  const hitRatio = totalInputTokens > 0 ? cacheReadTokens / totalInputTokens : 0;

  return {
    hypotheticalInputCost,
    actualCacheReadCost,
    savings,
    cacheReadTokens,
    totalInputTokens,
    hitRatio,
    byDay,
  };
}
