import { describe, expect, it } from 'vitest';
import { type RowWithCost, aggregate } from '../aggregators';
import { computeEfficiency } from '../efficiency';

function row(opts: {
  date?: string;
  model: string;
  cost: number;
  units?: number;
  maxMode?: boolean;
}): RowWithCost {
  const date = new Date(`${opts.date ?? '2026-05-15'}T12:00:00Z`);
  return {
    id: `${opts.model}-${Math.random()}`,
    dateISO: date.toISOString(),
    date,
    cloudAgentId: '',
    automationId: '',
    kind: 'Included',
    model: opts.model,
    maxMode: opts.maxMode ?? false,
    tokens: {
      inputWithCacheWrite: 0,
      inputWithoutCacheWrite: 1000,
      cacheRead: 0,
      output: 500,
      total: 1500,
    },
    requests: { kind: 'units', value: opts.units ?? 1 },
    cost: opts.cost,
    costEstimated: false,
  };
}

function makeMix(): RowWithCost[] {
  const rows: RowWithCost[] = [];
  // 100 sonnet requests @ $0.20/req
  for (let i = 0; i < 100; i++) {
    rows.push(row({ model: 'claude-sonnet-4-5', cost: 0.2, units: 1 }));
  }
  // 20 opus requests @ $2/req
  for (let i = 0; i < 20; i++) {
    rows.push(row({ model: 'claude-opus-4-7-thinking', cost: 2, units: 1 }));
  }
  // 10 max-mode opus @ $5/req
  for (let i = 0; i < 10; i++) {
    rows.push(row({ model: 'claude-opus-4-7-thinking-max', cost: 5, units: 1, maxMode: true }));
  }
  return rows;
}

describe('computeEfficiency', () => {
  it('produces a coherent report on a realistic mix', () => {
    const rows = makeMix();
    const summary = aggregate(rows);
    const report = computeEfficiency(summary, rows);

    expect(report.actualCost).toBeCloseTo(100 * 0.2 + 20 * 2 + 10 * 5);
    expect(report.actualRequests).toBe(130);
    expect(report.actualCostPerReq).toBeGreaterThan(0);

    // 3 models present in byModel
    expect(report.byModel.length).toBe(3);

    // Cheapest should be sonnet
    expect(report.cheapest?.model).toBe('claude-sonnet-4-5');
    expect(report.cheapest?.costPerReq).toBeCloseTo(0.2);

    // Most expensive should be max-mode opus
    expect(report.mostExpensive?.model).toBe('claude-opus-4-7-thinking-max');
    expect(report.mostExpensive?.costPerReq).toBeCloseTo(5);
  });

  it('cheapest-mix scenario saves money', () => {
    const rows = makeMix();
    const summary = aggregate(rows);
    const report = computeEfficiency(summary, rows);
    expect(report.scenarios.cheapestMix.cost).toBeLessThan(report.actualCost);
    expect(report.scenarios.cheapestMix.savings).toBeGreaterThan(0);
    expect(report.scenarios.cheapestMix.savingsPct).toBeGreaterThan(0.5);
  });

  it('no-max-mode scenario captures max-mode spend', () => {
    const rows = makeMix();
    const summary = aggregate(rows);
    const report = computeEfficiency(summary, rows, { maxModeReductionRate: 0.5 });
    // 10 * $5 = $50 max-mode cost; 50% reduction = $25 saved.
    expect(report.scenarios.noMaxMode.savings).toBeCloseTo(25);
  });

  it('emits drop-maxmode recommendation when max-mode share >= 15%', () => {
    const rows = makeMix();
    const summary = aggregate(rows);
    const report = computeEfficiency(summary, rows);
    const drop = report.recommendations.find((r) => r.kind === 'drop-maxmode');
    expect(drop).toBeTruthy();
    expect(drop?.estimatedSavings).toBeGreaterThan(0);
  });

  it('emits switch-model recommendation when expensive model dominates', () => {
    const rows = makeMix();
    const summary = aggregate(rows);
    const report = computeEfficiency(summary, rows);
    const switchRec = report.recommendations.find((r) => r.kind === 'switch-model');
    expect(switchRec).toBeTruthy();
  });

  it('returns good-news recommendation on a clean mix', () => {
    // 50 sonnet rows only, no max-mode.
    const rows: RowWithCost[] = [];
    for (let i = 0; i < 50; i++) {
      rows.push(row({ model: 'claude-sonnet-4-5', cost: 0.2, units: 1 }));
    }
    const summary = aggregate(rows);
    const report = computeEfficiency(summary, rows);
    expect(report.recommendations[0]?.kind).toBe('good-news');
  });

  it('handles empty data gracefully', () => {
    const summary = aggregate([]);
    const report = computeEfficiency(summary, []);
    expect(report.actualCost).toBe(0);
    expect(report.actualRequests).toBe(0);
    expect(report.actualCostPerReq).toBe(0);
    expect(report.byModel.length).toBe(0);
    expect(report.cheapest).toBeNull();
    expect(report.scenarios.cheapestMix.savings).toBe(0);
    expect(report.scenarios.noMaxMode.savings).toBe(0);
    expect(report.recommendations[0]?.kind).toBe('good-news');
  });

  it('per-model maxModeCost matches inputs', () => {
    const rows = makeMix();
    const summary = aggregate(rows);
    const report = computeEfficiency(summary, rows);
    const m = report.byModel.find((r) => r.model === 'claude-opus-4-7-thinking-max');
    expect(m?.maxModeCost).toBe(50);
    expect(m?.maxModeShare).toBe(1);
  });
});
