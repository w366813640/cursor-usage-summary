import type { RowWithCost } from '@cu/data';

/**
 * "What does this burn equal to?" — given a costly request, express its
 * cost as a multiple of a baseline (the median Sonnet call).
 *
 *  - Returns null when the baseline is 0 (e.g. no Sonnet rows in dataset).
 *  - Always uses positive baseline (we ignore $0 free / errored rows).
 */
export function ratioOver(cost: number, baseline: number): number | null {
  if (baseline <= 0) return null;
  return cost / baseline;
}

const SONNET_MATCHERS = [
  'claude-4-sonnet',
  'claude-4.5-sonnet',
  'claude-4.6-sonnet',
  'claude-3.7-sonnet',
];

/**
 * The median cost of a "Sonnet-class" request in the dataset, used as a
 * baseline for burn-story comparisons ("this one request equals N normal
 * Sonnet calls"). We pick median not mean because the distribution is
 * fat-tailed — one Sonnet thinking-max session can be 100x a normal one.
 *
 * Sonnet was chosen because it's Cursor's most common workhorse model and
 * gives an intuitively understandable baseline ($0.0X per call territory).
 */
export function medianSonnetCost(rows: ReadonlyArray<RowWithCost>): number {
  const costs: number[] = [];
  for (const r of rows) {
    if (r.cost <= 0) continue;
    const m = r.model.toLowerCase();
    if (SONNET_MATCHERS.some((needle) => m.includes(needle))) {
      costs.push(r.cost);
    }
  }
  if (costs.length === 0) return 0;
  costs.sort((a, b) => a - b);
  const mid = Math.floor(costs.length / 2);
  if (costs.length % 2 === 0) {
    return ((costs[mid - 1] ?? 0) + (costs[mid] ?? 0)) / 2;
  }
  return costs[mid] ?? 0;
}

/**
 * Format a sonnet-equivalence ratio as a sentence chip.
 *  - 1.0x          → "≈ 1 Sonnet call"
 *  - 12.5x         → "≈ 12 Sonnet calls"
 *  - 1234x         → "≈ 1.2K Sonnet calls"
 *  - null baseline → null (let caller hide the chip)
 */
export function formatSonnetEquivalence(ratio: number | null): string | null {
  if (ratio === null || !Number.isFinite(ratio)) return null;
  if (ratio < 1) return `≈ ${ratio.toFixed(2)} Sonnet calls`;
  if (ratio < 100) return `≈ ${Math.round(ratio)} Sonnet calls`;
  if (ratio < 1000) return `≈ ${Math.round(ratio)} Sonnet calls`;
  if (ratio < 10_000) return `≈ ${(ratio / 1000).toFixed(1)}K Sonnet calls`;
  return `≈ ${(ratio / 1000).toFixed(0)}K Sonnet calls`;
}
