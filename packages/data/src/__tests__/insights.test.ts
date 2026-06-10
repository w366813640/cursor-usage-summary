import { describe, expect, it } from 'vitest';
import { type RowWithCost, aggregate, computeActionInsights } from '../index';
import type { UsageRow } from '../types';

function makeRow(seed: number, overrides: Partial<RowWithCost> = {}): RowWithCost {
  const dateISO =
    overrides.dateISO ?? `2026-05-${String((seed % 28) + 1).padStart(2, '0')}T12:00:00.000Z`;
  const base: UsageRow = {
    id: `row-${seed}`,
    dateISO,
    date: new Date(dateISO),
    cloudAgentId: '',
    automationId: '',
    kind: 'Included',
    model: seed % 2 === 0 ? 'claude-opus-4-7-thinking-max' : 'gpt-5-fast',
    maxMode: false,
    tokens: {
      inputWithCacheWrite: 200,
      inputWithoutCacheWrite: 800,
      cacheRead: 0,
      output: 300,
      total: 1300,
    },
    requests: { kind: 'units', value: 1 },
  };
  return {
    ...base,
    cost: 1,
    costEstimated: false,
    ...overrides,
  };
}

describe('computeActionInsights', () => {
  it('returns a healthy empty-state insight when there is no data', () => {
    const insights = computeActionInsights(aggregate([]), []);
    expect(insights).toHaveLength(1);
    expect(insights[0]?.kind).toBe('healthy');
    expect(insights[0]?.confidence).toBe('low');
  });

  it('surfaces a high priority top-burn insight', () => {
    const rows = [
      makeRow(1, { cost: 40, maxMode: true }),
      makeRow(2, { cost: 1 }),
      makeRow(3, { cost: 1 }),
    ];
    const summary = aggregate(rows);

    const insights = computeActionInsights(summary, rows);

    expect(insights.some((i) => i.kind === 'top-burn' && i.priority === 'high')).toBe(true);
  });

  it('ranks budget risk above low cache-health guidance', () => {
    const rows: RowWithCost[] = [];
    for (let day = 1; day <= 10; day++) {
      rows.push(
        makeRow(day, {
          dateISO: `2026-05-${String(day).padStart(2, '0')}T12:00:00.000Z`,
          cost: 1,
          tokens: {
            inputWithCacheWrite: 5_000,
            inputWithoutCacheWrite: 5_000,
            cacheRead: 0,
            output: 1_000,
            total: 11_000,
          },
          requests: { kind: 'units', value: 100 },
        }),
      );
    }
    const summary = aggregate(rows);

    const insights = computeActionInsights(summary, rows, {
      monthlyRequestBudget: 500,
      asOf: new Date('2026-05-10T12:00:00.000Z'),
    });

    expect(insights[0]?.kind).toBe('budget-risk');
    expect(insights.some((i) => i.kind === 'cache-health')).toBe(true);
  });

  it('is deterministic for the same input', () => {
    const rows = [makeRow(1, { cost: 20 }), makeRow(2, { cost: 3 }), makeRow(3, { cost: 2 })];
    const summary = aggregate(rows);

    const a = computeActionInsights(summary, rows);
    const b = computeActionInsights(summary, rows);

    expect(a.map((i) => i.id)).toEqual(b.map((i) => i.id));
  });
});
