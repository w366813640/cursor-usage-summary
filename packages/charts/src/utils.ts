import { format } from 'd3-format';

/** Round to two decimals, drop trailing zeros for readability. */
const usdFmt = format('$,.2f');
const compactFmt = format('.2~s');

export function fmtUSD(n: number): string {
  return usdFmt(n);
}

/**
 * Compact USD: $1.2K / $34.5M / $1.23B. For chart axes and tight tooltips.
 * Falls back to full precision below $10 (so "$3.40" doesn't become "$3.4").
 */
export function fmtUSDCompact(n: number): string {
  if (Math.abs(n) < 10) return usdFmt(n);
  return `$${compactFmt(n)}`;
}

/** Compact token counts: 4.27B / 119.3M. */
export function fmtTokens(n: number): string {
  return compactFmt(n);
}

export function fmtPercent(p: number, digits = 1): string {
  return `${(p * 100).toFixed(digits)}%`;
}

/**
 * Step-style quantile bucketer for heatmaps. Returns 0..steps-1 given a
 * value and a sorted ascending array of breakpoints; `value` lower than
 * `breakpoints[0]` returns 0.
 */
export function bucketize(value: number, breakpoints: ReadonlyArray<number>): number {
  for (let i = breakpoints.length - 1; i >= 0; i--) {
    if (value >= breakpoints[i]!) return i + 1;
  }
  return 0;
}

/**
 * Compute quantile breakpoints from a numeric array. Skips zero/empty
 * values so heatmap empty days don't pull the scale down to nothing.
 * `levels` must be > 1 — we return `levels - 1` breakpoints.
 */
export function quantileBreakpoints(values: ReadonlyArray<number>, levels: number): number[] {
  const positive = values.filter((v) => v > 0).sort((a, b) => a - b);
  if (positive.length === 0 || levels < 2) return [];
  const out: number[] = [];
  for (let i = 1; i < levels; i++) {
    const idx = Math.min(positive.length - 1, Math.floor((i / levels) * positive.length));
    out.push(positive[idx] ?? 0);
  }
  return out;
}
