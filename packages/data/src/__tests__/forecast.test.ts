import { describe, expect, it } from 'vitest';
import { fillMissingDays, forecastDailyCost } from '../forecast';

/**
 * Build a contiguous N-day series starting at 2026-01-01 with values
 * produced by `valueFor(i)`. Keeps tests data-light + reproducible.
 */
function buildSeries(n: number, valueFor: (i: number) => number) {
  const out: Array<{ date: string; value: number }> = [];
  const start = new Date(Date.UTC(2026, 0, 1));
  for (let i = 0; i < n; i++) {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    out.push({ date: d.toISOString().slice(0, 10), value: valueFor(i) });
  }
  return out;
}

describe('forecastDailyCost', () => {
  it('returns a degenerate forecast when given fewer than 7 points', () => {
    const r = forecastDailyCost(buildSeries(3, () => 1));
    expect(r.projected).toHaveLength(0);
    expect(r.trend).toBe('flat');
    expect(r.confidence).toBe('low');
  });

  it('recovers slope + intercept exactly on a perfectly linear series', () => {
    // y = 0.5 * x + 2
    const r = forecastDailyCost(buildSeries(30, (i) => 0.5 * i + 2));
    expect(r.slope).toBeCloseTo(0.5, 10);
    expect(r.intercept).toBeCloseTo(2, 10);
    expect(r.rSquared).toBeCloseTo(1, 8);
    expect(r.trend).toBe('rising');
    expect(r.confidence).toBe('high');
    expect(r.projected).toHaveLength(30);
  });

  it('produces a forecast whose mean continues the regression line', () => {
    // y = 1 * x + 0; day 30 (first projected) should ≈ 30, day 59 ≈ 59.
    const r = forecastDailyCost(buildSeries(30, (i) => i));
    expect(r.projected[0]?.mean).toBeCloseTo(30, 6);
    expect(r.projected[29]?.mean).toBeCloseTo(59, 6);
    // Confidence band should collapse on a perfectly linear series.
    expect(r.projected[0]?.upper).toBeCloseTo(r.projected[0]!.mean, 6);
  });

  it('produces a wider band when noise is present', () => {
    // Linear trend + noise → r² < 1, stdError > 0.
    const r = forecastDailyCost(buildSeries(30, (i) => i + (i % 3 === 0 ? 5 : -3)));
    expect(r.rSquared).toBeLessThan(1);
    expect(r.stdError).toBeGreaterThan(0);
    const first = r.projected[0]!;
    expect(first.upper).toBeGreaterThan(first.mean);
    expect(first.lower).toBeLessThanOrEqual(first.mean);
  });

  it('floors lower bound + mean at zero so we never project negative cost', () => {
    // Strongly falling series: y = 10 - 0.5 * i — by i=20 the regression
    // is negative; the forecast must clamp to 0.
    const r = forecastDailyCost(buildSeries(30, (i) => Math.max(0, 10 - 0.5 * i)));
    for (const p of r.projected) {
      expect(p.mean).toBeGreaterThanOrEqual(0);
      expect(p.lower).toBeGreaterThanOrEqual(0);
    }
  });

  it('respects horizonDays + lookbackDays options', () => {
    const r = forecastDailyCost(
      buildSeries(120, (i) => i),
      {
        lookbackDays: 30,
        horizonDays: 7,
      },
    );
    // Should only have looked at the last 30 of the 120-day series.
    expect(r.historical).toHaveLength(30);
    expect(r.projected).toHaveLength(7);
  });

  it('sums projected.mean correctly into totalProjected', () => {
    const r = forecastDailyCost(buildSeries(30, () => 5));
    const sumMean = r.projected.reduce((acc, p) => acc + p.mean, 0);
    expect(r.totalProjected).toBeCloseTo(sumMean, 8);
    // Flat series → mean ≈ 5 every day, 30-day total ≈ 150.
    expect(r.totalProjected).toBeCloseTo(150, 4);
    expect(r.trend).toBe('flat');
  });

  it('labels confidence by R² thresholds', () => {
    const high = forecastDailyCost(buildSeries(30, (i) => 1 + 0.1 * i));
    expect(high.confidence).toBe('high');

    // Pure noise: low correlation with the time axis.
    const noisySeed = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8, 9, 7, 9];
    const noisyValues: number[] = [];
    for (let i = 0; i < 30; i++) {
      noisyValues.push(noisySeed[i % noisySeed.length]!);
    }
    const noise = forecastDailyCost(buildSeries(30, (i) => noisyValues[i]!));
    expect(['low', 'medium']).toContain(noise.confidence);
  });
});

describe('fillMissingDays', () => {
  it('fills gaps with zero-valued days', () => {
    const sparse = [
      { date: '2026-05-01', value: 1.5 },
      { date: '2026-05-04', value: 2.0 },
    ];
    const filled = fillMissingDays(sparse);
    expect(filled.map((d) => d.date)).toEqual([
      '2026-05-01',
      '2026-05-02',
      '2026-05-03',
      '2026-05-04',
    ]);
    expect(filled.map((d) => d.value)).toEqual([1.5, 0, 0, 2.0]);
  });

  it('returns empty input untouched', () => {
    expect(fillMissingDays([])).toEqual([]);
  });

  it('extends the series up to endDate when provided', () => {
    const sparse = [{ date: '2026-05-01', value: 1.5 }];
    const filled = fillMissingDays(sparse, '2026-05-03');
    expect(filled).toHaveLength(3);
    expect(filled[2]).toEqual({ date: '2026-05-03', value: 0 });
  });
});
