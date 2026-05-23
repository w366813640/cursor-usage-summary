import { describe, expect, it } from 'vitest';
import { type RowWithCost, aggregate, computeBudgetScenarios } from '../index';
import type { UsageRow } from '../types';

function makeRow(day: number, overrides: Partial<RowWithCost> = {}): RowWithCost {
  const dateISO = `2026-05-${String(day).padStart(2, '0')}T12:00:00.000Z`;
  const base: UsageRow = {
    id: `scenario-row-${day}`,
    dateISO,
    date: new Date(dateISO),
    cloudAgentId: '',
    automationId: '',
    kind: 'Included',
    model: 'claude-sonnet-4',
    maxMode: false,
    tokens: {
      inputWithCacheWrite: 100,
      inputWithoutCacheWrite: 900,
      cacheRead: 0,
      output: 200,
      total: 1200,
    },
    requests: { kind: 'units', value: 10 },
  };
  return {
    ...base,
    cost: 2,
    costEstimated: false,
    ...overrides,
  };
}

describe('computeBudgetScenarios', () => {
  it('returns no scenarios for empty data', () => {
    expect(computeBudgetScenarios(aggregate([]), [])).toEqual([]);
  });

  it('projects the current month from observed daily pace', () => {
    const rows = [makeRow(1), makeRow(2), makeRow(3)];
    const scenarios = computeBudgetScenarios(aggregate(rows), rows, {
      monthlyRequestBudget: 500,
      todayISO: '2026-05-03T00:00:00.000Z',
    });

    const baseline = scenarios.find((s) => s.id === 'baseline');
    expect(baseline?.projectedRequests).toBe(310);
    expect(baseline?.projectedCost).toBe(62);
  });

  it('ranks savings scenarios ahead of baseline by projected cost', () => {
    const rows = [
      makeRow(1, { cost: 40 }),
      makeRow(2, { cost: 2 }),
      makeRow(3, { cost: 2 }),
      makeRow(4, { cost: 2 }),
      makeRow(5, { cost: 2 }),
    ];
    const scenarios = computeBudgetScenarios(aggregate(rows), rows, {
      todayISO: '2026-05-05T00:00:00.000Z',
    });

    expect(scenarios[0]?.projectedCost).toBeLessThan(scenarios.at(-1)?.projectedCost ?? 0);
    expect(scenarios.at(-1)?.kind).toBe('baseline');
  });

  it('is deterministic for the same inputs', () => {
    const rows = [makeRow(1), makeRow(2), makeRow(3)];
    const summary = aggregate(rows);

    expect(computeBudgetScenarios(summary, rows)).toEqual(computeBudgetScenarios(summary, rows));
  });
});
