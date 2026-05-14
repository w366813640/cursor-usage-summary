import { describe, expect, it } from 'vitest';
import { type RowWithCost, aggregate, classifyProvider } from '../aggregators';
import type { UsageRow } from '../types';

function makeRow(overrides: Partial<UsageRow> & { dateISO: string; model: string }): UsageRow {
  const { dateISO, model, ...rest } = overrides;
  const date = new Date(dateISO);
  return {
    id: `${dateISO}::${model}::test`,
    dateISO,
    date,
    cloudAgentId: '',
    automationId: '',
    kind: 'Included',
    model,
    maxMode: false,
    tokens: {
      inputWithCacheWrite: 0,
      inputWithoutCacheWrite: 0,
      cacheRead: 0,
      output: 0,
      total: 0,
    },
    requests: { kind: 'units', value: 1 },
    ...rest,
  };
}

function withCost(row: UsageRow, cost: number, estimated = false): RowWithCost {
  return { ...row, cost, costEstimated: estimated };
}

describe('classifyProvider', () => {
  it.each([
    ['claude-4.6-opus-max', 'Anthropic'],
    ['gpt-5-high', 'OpenAI'],
    ['o3', 'OpenAI'],
    ['gemini-2.5-pro-preview-05-06', 'Google'],
    ['grok-4', 'xAI'],
    ['composer-2-fast', 'Cursor'],
    ['auto', 'Cursor'],
    ['deepseek-v3', 'DeepSeek'],
    ['kimi-k2-instruct', 'Moonshot'],
    ['qwen-3-coder-480b', 'Qwen'],
    ['mistral-large', 'Other'],
  ])('classifies %s as %s', (model, expected) => {
    expect(classifyProvider(model)).toBe(expected);
  });
});

describe('aggregate', () => {
  it('returns empty zero-state for no rows', () => {
    const summary = aggregate([]);
    expect(summary.totalRows).toBe(0);
    expect(summary.totalCost).toBe(0);
    expect(summary.byModel).toEqual([]);
    expect(summary.dateRange.firstISO).toBeNull();
    expect(summary.cacheHitStats.hitRatio).toBe(0);
  });

  it('sums totals and produces sorted byModel by cost', () => {
    const rows: RowWithCost[] = [
      withCost(
        makeRow({
          dateISO: '2026-05-13T09:00:00.000Z',
          model: 'claude-opus-4-7-thinking-max',
          tokens: {
            inputWithCacheWrite: 100,
            inputWithoutCacheWrite: 50,
            cacheRead: 1000,
            output: 200,
            total: 1350,
          },
          requests: { kind: 'units', value: 1 },
        }),
        50,
      ),
      withCost(
        makeRow({
          dateISO: '2026-05-13T10:00:00.000Z',
          model: 'gpt-5-high',
          tokens: {
            inputWithCacheWrite: 0,
            inputWithoutCacheWrite: 100,
            cacheRead: 500,
            output: 60,
            total: 660,
          },
          requests: { kind: 'units', value: 0.5 },
        }),
        2,
      ),
      withCost(
        makeRow({
          dateISO: '2026-05-12T11:00:00.000Z',
          model: 'gpt-5-high',
          tokens: {
            inputWithCacheWrite: 0,
            inputWithoutCacheWrite: 100,
            cacheRead: 500,
            output: 60,
            total: 660,
          },
          requests: { kind: 'units', value: 0.5 },
        }),
        3,
      ),
    ];

    const summary = aggregate(rows);
    expect(summary.totalRows).toBe(3);
    expect(summary.totalCost).toBeCloseTo(55);
    expect(summary.totalRequestUnits).toBeCloseTo(2);
    expect(summary.byModel[0]!.model).toBe('claude-opus-4-7-thinking-max');
    expect(summary.byModel[0]!.shareOfCost).toBeCloseTo(50 / 55);
    expect(summary.byModel[1]!.model).toBe('gpt-5-high');
    expect(summary.byModel[1]!.cost).toBeCloseTo(5);
    expect(summary.byDay.map((d) => d.date)).toEqual(['2026-05-12', '2026-05-13']);
    expect(summary.dateRange.firstISO).toBe('2026-05-12T11:00:00.000Z');
    expect(summary.dateRange.lastISO).toBe('2026-05-13T10:00:00.000Z');
  });

  it('counts free and errored rows separately', () => {
    const rows: RowWithCost[] = [
      withCost(
        makeRow({
          dateISO: '2026-05-13T09:00:00.000Z',
          model: 'claude-x',
          requests: { kind: 'free' },
        }),
        0,
      ),
      withCost(
        makeRow({
          dateISO: '2026-05-13T10:00:00.000Z',
          model: 'claude-x',
          kind: 'Aborted, Not Charged',
          requests: { kind: 'errored' },
        }),
        0,
      ),
      withCost(
        makeRow({
          dateISO: '2026-05-13T11:00:00.000Z',
          model: 'claude-x',
          requests: { kind: 'units', value: 1 },
        }),
        2,
      ),
    ];

    const summary = aggregate(rows);
    expect(summary.freeRows).toBe(1);
    expect(summary.erroredRows).toBe(1);
    expect(summary.totalRequestUnits).toBe(1);
    expect(summary.totalCost).toBe(2);
  });

  it('flags costPartiallyEstimated when any row was Auto-pool fallback', () => {
    const rows: RowWithCost[] = [
      withCost(makeRow({ dateISO: '2026-05-13T09:00:00.000Z', model: 'claude-x' }), 2),
      withCost(makeRow({ dateISO: '2026-05-13T10:00:00.000Z', model: 'mystery' }), 1, true),
    ];
    const summary = aggregate(rows);
    expect(summary.costPartiallyEstimated).toBe(true);
    expect(summary.byModel.find((m) => m.model === 'mystery')?.costEstimated).toBe(true);
  });

  it('topBurns returns the costliest N rows in descending order', () => {
    const rows: RowWithCost[] = [
      withCost(makeRow({ dateISO: '2026-05-13T09:00:00.000Z', model: 'a' }), 5),
      withCost(makeRow({ dateISO: '2026-05-13T10:00:00.000Z', model: 'b' }), 100),
      withCost(makeRow({ dateISO: '2026-05-13T11:00:00.000Z', model: 'c' }), 30),
      withCost(makeRow({ dateISO: '2026-05-13T12:00:00.000Z', model: 'd' }), 1),
    ];

    const summary = aggregate(rows, { topBurnsCount: 2 });
    expect(summary.topBurns.map((r) => r.cost)).toEqual([100, 30]);
  });

  it('cacheHitStats divides cacheRead by total input', () => {
    const rows: RowWithCost[] = [
      withCost(
        makeRow({
          dateISO: '2026-05-13T09:00:00.000Z',
          model: 'claude-x',
          tokens: {
            inputWithCacheWrite: 100,
            inputWithoutCacheWrite: 100,
            cacheRead: 800,
            output: 100,
            total: 1100,
          },
        }),
        1,
      ),
    ];
    const summary = aggregate(rows);
    expect(summary.cacheHitStats.totalInput).toBe(1000);
    expect(summary.cacheHitStats.cacheRead).toBe(800);
    expect(summary.cacheHitStats.hitRatio).toBeCloseTo(0.8);
  });
});
