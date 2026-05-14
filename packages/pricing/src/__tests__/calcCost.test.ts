import type { UsageRow } from '@cu/data';
import { describe, expect, it } from 'vitest';
import { calcCostFromPricing, costRow } from '../calcCost';
import type { ModelPricing } from '../types';

const FIXED_DATE = new Date('2026-05-13T09:00:00.000Z');

function makeRow(partial: Partial<UsageRow> = {}): UsageRow {
  return {
    id: 'fixture',
    dateISO: FIXED_DATE.toISOString(),
    date: FIXED_DATE,
    cloudAgentId: '',
    automationId: '',
    kind: 'Included',
    model: 'claude-4-sonnet',
    maxMode: false,
    tokens: {
      inputWithCacheWrite: 0,
      inputWithoutCacheWrite: 0,
      cacheRead: 0,
      output: 0,
      total: 0,
    },
    requests: { kind: 'units', value: 1 },
    ...partial,
  };
}

const claude46Opus: ModelPricing = {
  key: 'claude-4.6-opus',
  displayName: 'Claude 4.6 Opus',
  provider: 'Anthropic',
  unitPrice: { input: 5, cacheWrite: 6.25, cacheRead: 0.5, output: 25 },
};

const gpt5: ModelPricing = {
  key: 'gpt-5',
  displayName: 'GPT-5',
  provider: 'OpenAI',
  unitPrice: { input: 1.25, cacheWrite: null, cacheRead: 0.125, output: 10 },
};

describe('calcCostFromPricing', () => {
  it('returns zero for Free rows', () => {
    const row = makeRow({ requests: { kind: 'free' } });
    expect(calcCostFromPricing(row, claude46Opus).total).toBe(0);
  });

  it('returns zero for Errored rows', () => {
    const row = makeRow({ requests: { kind: 'errored' } });
    expect(calcCostFromPricing(row, claude46Opus).total).toBe(0);
  });

  it('costs a tiny Claude Opus row by per-million math', () => {
    // 1M input (no cache) + 1M cacheRead + 1M output = $5 + $0.5 + $25 = $30.5
    const row = makeRow({
      tokens: {
        inputWithCacheWrite: 0,
        inputWithoutCacheWrite: 1_000_000,
        cacheRead: 1_000_000,
        output: 1_000_000,
        total: 3_000_000,
      },
    });
    const breakdown = calcCostFromPricing(row, claude46Opus);
    expect(breakdown.inputCost).toBeCloseTo(5);
    expect(breakdown.cacheReadCost).toBeCloseTo(0.5);
    expect(breakdown.outputCost).toBeCloseTo(25);
    expect(breakdown.total).toBeCloseTo(30.5);
  });

  it('uses the cache-write tier when present', () => {
    const row = makeRow({
      tokens: {
        inputWithCacheWrite: 1_000_000,
        inputWithoutCacheWrite: 0,
        cacheRead: 0,
        output: 0,
        total: 1_000_000,
      },
    });
    const breakdown = calcCostFromPricing(row, claude46Opus);
    // 1M cacheWrite × $6.25 = $6.25
    expect(breakdown.cacheWriteCost).toBeCloseTo(6.25);
    expect(breakdown.total).toBeCloseTo(6.25);
  });

  it('falls back cacheWrite tokens to input rate when pricing.cacheWrite is null', () => {
    const row = makeRow({
      tokens: {
        inputWithCacheWrite: 1_000_000,
        inputWithoutCacheWrite: 0,
        cacheRead: 0,
        output: 0,
        total: 1_000_000,
      },
    });
    const breakdown = calcCostFromPricing(row, gpt5);
    // 1M cacheWrite billed at gpt-5 input rate $1.25
    expect(breakdown.cacheWriteCost).toBeCloseTo(1.25);
  });

  it('handles the 44M-token Opus burn observed in real CSV', () => {
    // From input/usage-events-2026-05-14.csv row 9:
    //   inputWithCacheWrite=641667, inputWithoutCacheWrite=292069,
    //   cacheRead=43_445_788, output=220_334
    const row = makeRow({
      model: 'claude-opus-4-7-thinking-max',
      tokens: {
        inputWithCacheWrite: 641_667,
        inputWithoutCacheWrite: 292_069,
        cacheRead: 43_445_788,
        output: 220_334,
        total: 44_599_858,
      },
    });
    // Claude 4.7 Opus rates: input $5 / cacheWrite $6.25 / cacheRead $0.5 / output $25
    // = 0.292069*5 + 0.641667*6.25 + 43.445788*0.5 + 0.220334*25
    // = 1.4603 + 4.0104 + 21.7229 + 5.5084 = ~$32.70
    const result = costRow(row);
    expect(result.cost).toBeGreaterThan(30);
    expect(result.cost).toBeLessThan(35);
    expect(result.costEstimated).toBe(false);
  });
});
