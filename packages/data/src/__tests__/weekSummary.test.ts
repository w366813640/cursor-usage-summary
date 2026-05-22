import { describe, expect, it } from 'vitest';
import { type RowWithCost, aggregate } from '../aggregators';
import { composeWeekSummary } from '../weekSummary';

function makeRow(opts: {
  date: string; // YYYY-MM-DD
  model: string;
  cost: number;
  cacheRead?: number;
  inputW?: number;
  output?: number;
  maxMode?: boolean;
}): RowWithCost {
  const date = new Date(`${opts.date}T12:00:00Z`);
  return {
    id: `${opts.date}::${opts.model}::${Math.random()}`,
    dateISO: date.toISOString(),
    date,
    cloudAgentId: '',
    automationId: '',
    kind: 'Included',
    model: opts.model,
    maxMode: opts.maxMode ?? false,
    tokens: {
      inputWithCacheWrite: 0,
      inputWithoutCacheWrite: opts.inputW ?? 1000,
      cacheRead: opts.cacheRead ?? 0,
      output: opts.output ?? 500,
      total: (opts.inputW ?? 1000) + (opts.cacheRead ?? 0) + (opts.output ?? 500),
    },
    requests: { kind: 'units', value: 1 },
    cost: opts.cost,
    costEstimated: false,
  };
}

describe('composeWeekSummary', () => {
  it('returns a degraded summary for empty data', () => {
    const s = aggregate([]);
    const r = composeWeekSummary(s, []);
    expect(r.degraded).toBe(true);
    expect(r.headline).toContain('No usage');
    expect(r.bullets).toEqual([]);
  });

  it('produces a headline with the dominant model and spend', () => {
    const rows: RowWithCost[] = [
      makeRow({ date: '2026-05-15', model: 'claude-4.6-opus', cost: 30 }),
      makeRow({ date: '2026-05-16', model: 'claude-4.6-opus', cost: 25 }),
      makeRow({ date: '2026-05-17', model: 'claude-4.6-sonnet', cost: 5 }),
      makeRow({ date: '2026-05-18', model: 'claude-4.6-opus', cost: 15 }),
    ];
    const s = aggregate(rows);
    const r = composeWeekSummary(s, rows, { asOfISO: '2026-05-18' });
    expect(r.degraded).toBe(false);
    expect(r.headline).toContain('claude-4.6-opus');
    expect(r.headline).toContain('models');
    expect(r.headline).toMatch(/\$\d/);
  });

  it('flags a 50%+ spend jump as a suggestion', () => {
    const rows: RowWithCost[] = [
      // Prior week 2026-05-05 → 2026-05-11 (cheap)
      makeRow({ date: '2026-05-08', model: 'claude-4.6-sonnet', cost: 5 }),
      makeRow({ date: '2026-05-10', model: 'claude-4.6-sonnet', cost: 5 }),
      // This week 2026-05-12 → 2026-05-18 (expensive)
      makeRow({ date: '2026-05-14', model: 'claude-4.6-opus', cost: 40 }),
      makeRow({ date: '2026-05-15', model: 'claude-4.6-opus', cost: 30 }),
      makeRow({ date: '2026-05-18', model: 'claude-4.6-opus', cost: 20 }),
    ];
    const s = aggregate(rows);
    const r = composeWeekSummary(s, rows, { asOfISO: '2026-05-18' });
    expect(r.suggestion).not.toBeNull();
    expect(r.suggestion?.toLowerCase()).toContain('spend is up');
    expect(r.bullets.some((b) => b.includes('↗'))).toBe(true);
  });

  it('reports cache hit ratio drop in bullets', () => {
    const rows: RowWithCost[] = [
      // Prior week: 80% cache hits
      makeRow({
        date: '2026-05-08',
        model: 'claude-4.6-sonnet',
        cost: 10,
        inputW: 200,
        cacheRead: 800,
      }),
      // This week: 20% cache hits
      makeRow({
        date: '2026-05-15',
        model: 'claude-4.6-sonnet',
        cost: 10,
        inputW: 800,
        cacheRead: 200,
      }),
    ];
    const s = aggregate(rows);
    const r = composeWeekSummary(s, rows, { asOfISO: '2026-05-18' });
    expect(r.bullets.some((b) => b.toLowerCase().includes('cache hit'))).toBe(true);
    expect(r.bullets.some((b) => b.includes('↘'))).toBe(true);
  });

  it('flags max-mode heavy weeks with a suggestion', () => {
    const rows: RowWithCost[] = [
      makeRow({
        date: '2026-05-15',
        model: 'claude-4.6-opus',
        cost: 50,
        maxMode: true,
      }),
      makeRow({
        date: '2026-05-16',
        model: 'claude-4.6-opus',
        cost: 40,
        maxMode: true,
      }),
      makeRow({
        date: '2026-05-17',
        model: 'claude-4.6-sonnet',
        cost: 10,
        maxMode: false,
      }),
    ];
    const s = aggregate(rows);
    const r = composeWeekSummary(s, rows, { asOfISO: '2026-05-18' });
    expect(r.bullets.some((b) => b.toLowerCase().includes('max-mode'))).toBe(true);
    expect(r.suggestion?.toLowerCase()).toContain('max-mode');
  });

  it('caps bullets at 4 items', () => {
    const rows: RowWithCost[] = [
      // 3-model mix, big delta, hot day, max-mode → triggers all categories
      makeRow({
        date: '2026-05-15',
        model: 'claude-4.6-opus',
        cost: 100,
        maxMode: true,
        inputW: 100,
        cacheRead: 900,
      }),
      makeRow({ date: '2026-05-08', model: 'claude-4.6-sonnet', cost: 5 }),
      makeRow({
        date: '2026-05-16',
        model: 'gpt-5.5',
        cost: 20,
        inputW: 900,
        cacheRead: 100,
      }),
    ];
    const s = aggregate(rows);
    const r = composeWeekSummary(s, rows, { asOfISO: '2026-05-18' });
    expect(r.bullets.length).toBeLessThanOrEqual(4);
  });
});
