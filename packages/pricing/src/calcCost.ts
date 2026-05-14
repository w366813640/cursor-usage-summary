import type { RowWithCost } from '@cu/data';
import type { UsageRow } from '@cu/data';
import { matchModel } from './modelMatcher';
import type { ModelPricing } from './types';

/** Cost breakdown for a single row, in USD. */
export interface CostBreakdown {
  inputCost: number;
  cacheWriteCost: number;
  cacheReadCost: number;
  outputCost: number;
  total: number;
}

const PER_MILLION = 1_000_000;

/**
 * Compute cost for a single row given an explicit pricing entry.
 *
 *  - Free / errored rows always return zero.
 *  - cacheWrite price `null` (e.g. GPT, Composer): cacheWrite tokens are
 *    treated as plain `input` tokens at the input rate. This matches what
 *    Cursor's own quota engine does.
 *  - "Fast" tier and "Max Mode" multipliers are encoded in the pricing
 *    table directly; this function does NOT layer additional multipliers.
 */
export function calcCostFromPricing(row: UsageRow, pricing: ModelPricing): CostBreakdown {
  if (row.requests.kind !== 'units') {
    return {
      inputCost: 0,
      cacheWriteCost: 0,
      cacheReadCost: 0,
      outputCost: 0,
      total: 0,
    };
  }

  const { tokens } = row;
  const { unitPrice } = pricing;

  const inputCost = (tokens.inputWithoutCacheWrite * unitPrice.input) / PER_MILLION;

  let cacheWriteCost = 0;
  if (unitPrice.cacheWrite !== null) {
    cacheWriteCost = (tokens.inputWithCacheWrite * unitPrice.cacheWrite) / PER_MILLION;
  } else {
    // No separate cache-write tier → bill cacheWrite tokens at input rate.
    cacheWriteCost = (tokens.inputWithCacheWrite * unitPrice.input) / PER_MILLION;
  }

  const cacheReadCost = (tokens.cacheRead * unitPrice.cacheRead) / PER_MILLION;
  const outputCost = (tokens.output * unitPrice.output) / PER_MILLION;

  return {
    inputCost,
    cacheWriteCost,
    cacheReadCost,
    outputCost,
    total: inputCost + cacheWriteCost + cacheReadCost + outputCost,
  };
}

/**
 * High-level helper: cost a single row by dispatching through `matchModel`.
 * Returns the row enriched with `cost` and `costEstimated` fields.
 */
export function costRow(row: UsageRow): RowWithCost {
  const match = matchModel(row.model);
  const breakdown = calcCostFromPricing(row, match.pricing);
  return {
    ...row,
    cost: breakdown.total,
    costEstimated: match.estimated,
  };
}

/** Convenience: cost an entire array. */
export function costRows(rows: ReadonlyArray<UsageRow>): RowWithCost[] {
  return rows.map(costRow);
}
