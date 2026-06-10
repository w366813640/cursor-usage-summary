import { describe, expect, it } from 'vitest';
import { type RowWithCost, aggregate } from '../aggregators';
import { computeBudgetUrgency } from '../budgetGuard';

function row(date: string, units: number, cost = units * 0.5): RowWithCost {
  const d = new Date(`${date}T12:00:00Z`);
  return {
    id: `${date}-${Math.random()}`,
    dateISO: d.toISOString(),
    date: d,
    cloudAgentId: '',
    automationId: '',
    kind: 'Included',
    model: 'claude-sonnet-4-5',
    maxMode: false,
    tokens: {
      inputWithCacheWrite: 0,
      inputWithoutCacheWrite: 100,
      cacheRead: 0,
      output: 50,
      total: 150,
    },
    requests: { kind: 'units', value: units },
    cost,
    costEstimated: false,
  };
}

describe('computeBudgetUrgency', () => {
  it('returns disabled when budget <= 0', () => {
    const rows = [row('2026-05-15', 10)];
    const r = computeBudgetUrgency(aggregate(rows), 0, { asOf: new Date('2026-05-15T12:00Z') });
    expect(r.enabled).toBe(false);
  });

  it('returns disabled when no data', () => {
    const r = computeBudgetUrgency(aggregate([]), 500, { asOf: new Date('2026-05-15T12:00Z') });
    expect(r.enabled).toBe(false);
  });

  it('returns safe when projection is comfortably under budget', () => {
    const rows: RowWithCost[] = [];
    // 15 days at 10 requests/day = 150 used → projection ~300 over 30 days
    for (let d = 1; d <= 15; d++) {
      rows.push(row(`2026-05-${String(d).padStart(2, '0')}`, 10));
    }
    const r = computeBudgetUrgency(aggregate(rows), 500, {
      asOf: new Date('2026-05-15T12:00Z'),
    });
    expect(r.enabled).toBe(true);
    expect(r.severity).toBe('safe');
    expect(r.exhaustionDay).toBeNull();
    expect(r.projectedTotal).toBeGreaterThan(0);
  });

  it('flags low when slightly over budget', () => {
    const rows: RowWithCost[] = [];
    // 15 days at 18 requests/day = 270 used → projection ~540 over 30 days
    for (let d = 1; d <= 15; d++) {
      rows.push(row(`2026-05-${String(d).padStart(2, '0')}`, 18));
    }
    const r = computeBudgetUrgency(aggregate(rows), 500, {
      asOf: new Date('2026-05-15T12:00Z'),
    });
    expect(r.enabled).toBe(true);
    expect(['low', 'medium']).toContain(r.severity);
    expect(r.exhaustionDay).not.toBeNull();
  });

  it('flags high when 20%+ over budget', () => {
    const rows: RowWithCost[] = [];
    // 15 days at 25 requests/day = 375 used → projection 750 (50% over)
    for (let d = 1; d <= 15; d++) {
      rows.push(row(`2026-05-${String(d).padStart(2, '0')}`, 25));
    }
    const r = computeBudgetUrgency(aggregate(rows), 500, {
      asOf: new Date('2026-05-15T12:00Z'),
    });
    expect(r.severity).toBe('high');
    expect(r.exhaustionDay).not.toBeNull();
    expect(r.daysToExhaustion).toBeLessThan(15);
  });

  it('respects warmup window — early-month spike does not panic', () => {
    const rows: RowWithCost[] = [
      row('2026-05-01', 200), // burst on day 1
    ];
    const r = computeBudgetUrgency(aggregate(rows), 500, {
      asOf: new Date('2026-05-01T12:00Z'),
      warmupDays: 3,
    });
    expect(r.severity).toBe('safe'); // within warmup
  });

  it('marks negative daysToExhaustion when already over budget', () => {
    const rows: RowWithCost[] = [];
    // 20 days at 30 requests/day = 600 used (already over 500)
    for (let d = 1; d <= 20; d++) {
      rows.push(row(`2026-05-${String(d).padStart(2, '0')}`, 30));
    }
    const r = computeBudgetUrgency(aggregate(rows), 500, {
      asOf: new Date('2026-05-20T12:00Z'),
    });
    expect(r.severity).toBe('high');
    expect(r.daysToExhaustion).toBeLessThanOrEqual(0);
    expect(r.message).toMatch(/exhausted/i);
  });
});
