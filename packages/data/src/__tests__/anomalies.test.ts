import { describe, expect, it } from 'vitest';
import { type RowWithCost, aggregate } from '../aggregators';
import {
  detectAllAnomalies,
  detectCacheHitDrops,
  detectCostPerReqShifts,
  detectCostSpikes,
  median,
  medianAbsoluteDeviation,
  robustZScore,
} from '../anomalies';

function makeRow(opts: {
  date: string; // YYYY-MM-DD
  model: string;
  cost: number;
  units?: number;
  inputW?: number;
  cacheRead?: number;
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
    requests: { kind: 'units', value: opts.units ?? 1 },
    cost: opts.cost,
    costEstimated: false,
  };
}

describe('median + MAD + robustZScore', () => {
  it('median handles odd / even lengths and empty', () => {
    expect(median([])).toBe(0);
    expect(median([5])).toBe(5);
    expect(median([1, 2, 3])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it('MAD is 0 when all values identical', () => {
    expect(medianAbsoluteDeviation([5, 5, 5, 5])).toBe(0);
  });

  it('robust z-score is 0 when MAD is 0', () => {
    expect(robustZScore(100, [5, 5, 5, 5])).toBe(0);
  });

  it('robust z-score scales correctly', () => {
    const baseline = [10, 12, 11, 13, 9, 10, 11];
    const z = robustZScore(50, baseline);
    expect(z).toBeGreaterThan(2.5);
  });
});

describe('detectCostSpikes', () => {
  it('returns empty for < 7 days', () => {
    const rows = [makeRow({ date: '2026-05-15', model: 'sonnet', cost: 100 })];
    expect(detectCostSpikes(aggregate(rows))).toEqual([]);
  });

  it('flags a clear spike against a quiet baseline', () => {
    const rows: RowWithCost[] = [];
    // 14 quiet days at $1
    for (let d = 1; d <= 14; d++) {
      rows.push(
        makeRow({
          date: `2026-05-${String(d).padStart(2, '0')}`,
          model: 'sonnet',
          cost: 1,
        }),
      );
    }
    // Spike day
    rows.push(makeRow({ date: '2026-05-15', model: 'opus-max', cost: 80 }));
    const anomalies = detectCostSpikes(aggregate(rows));
    expect(anomalies.length).toBe(1);
    expect(anomalies[0]?.date).toBe('2026-05-15');
    expect(anomalies[0]?.severity).toBe('high');
    expect(anomalies[0]?.robustZ).toBeGreaterThan(3.5);
  });

  it('does not flag below minCost', () => {
    const rows: RowWithCost[] = [];
    for (let d = 1; d <= 14; d++) {
      rows.push(
        makeRow({
          date: `2026-05-${String(d).padStart(2, '0')}`,
          model: 'sonnet',
          cost: 0.01,
        }),
      );
    }
    rows.push(makeRow({ date: '2026-05-15', model: 'opus-max', cost: 1 }));
    const anomalies = detectCostSpikes(aggregate(rows), { costSpikeMinCost: 5 });
    expect(anomalies).toEqual([]);
  });

  it('does not flag a gentle linear ramp', () => {
    const rows: RowWithCost[] = [];
    // 14 days ramping 1 → 14
    for (let d = 1; d <= 14; d++) {
      rows.push(
        makeRow({
          date: `2026-05-${String(d).padStart(2, '0')}`,
          model: 'sonnet',
          cost: d,
        }),
      );
    }
    rows.push(makeRow({ date: '2026-05-15', model: 'sonnet', cost: 15 }));
    const anomalies = detectCostSpikes(aggregate(rows));
    expect(anomalies).toEqual([]);
  });
});

describe('detectCostPerReqShifts', () => {
  it('flags model-switch style $/req jump', () => {
    const rows: RowWithCost[] = [];
    // 14 days of sonnet at $0.30/req (1 unit, $0.30)
    for (let d = 1; d <= 14; d++) {
      rows.push(
        makeRow({
          date: `2026-05-${String(d).padStart(2, '0')}`,
          model: 'sonnet',
          cost: 0.3,
          units: 1,
        }),
      );
    }
    // Switch day: opus-max-thinking at $5/req (1 unit, $5)
    for (let i = 0; i < 5; i++) {
      rows.push(
        makeRow({
          date: '2026-05-15',
          model: 'opus-max-thinking',
          cost: 5,
          units: 1,
        }),
      );
    }
    const anomalies = detectCostPerReqShifts(rows);
    expect(anomalies.length).toBe(1);
    expect(anomalies[0]?.topModel).toBe('opus-max-thinking');
    expect(anomalies[0]?.ratio).toBeGreaterThan(10);
    expect(anomalies[0]?.severity).toBe('high');
  });

  it('does not flag below min daily cost', () => {
    const rows: RowWithCost[] = [];
    for (let d = 1; d <= 14; d++) {
      rows.push(
        makeRow({
          date: `2026-05-${String(d).padStart(2, '0')}`,
          model: 'sonnet',
          cost: 0.05,
          units: 0.5,
        }),
      );
    }
    rows.push(
      makeRow({
        date: '2026-05-15',
        model: 'opus-max',
        cost: 1,
        units: 0.1,
      }),
    );
    const anomalies = detectCostPerReqShifts(rows, { costPerReqMinDailyCost: 5 });
    expect(anomalies).toEqual([]);
  });
});

describe('detectCacheHitDrops', () => {
  it('flags a meaningful pp drop', () => {
    const rows: RowWithCost[] = [];
    // 14 days at 80% cache hit ratio (input=2000, cache=8000)
    for (let d = 1; d <= 14; d++) {
      rows.push(
        makeRow({
          date: `2026-05-${String(d).padStart(2, '0')}`,
          model: 'sonnet',
          cost: 1,
          inputW: 2000,
          cacheRead: 8000,
        }),
      );
    }
    // Drop day: 20% cache hit ratio
    rows.push(
      makeRow({
        date: '2026-05-15',
        model: 'sonnet',
        cost: 1,
        inputW: 8000,
        cacheRead: 2000,
      }),
    );
    const anomalies = detectCacheHitDrops(rows);
    expect(anomalies.length).toBe(1);
    expect(anomalies[0]?.dropPp).toBeGreaterThan(50);
    expect(anomalies[0]?.severity).toBe('high');
  });
});

describe('detectAllAnomalies', () => {
  it('groups outputs by severity and by day', () => {
    const rows: RowWithCost[] = [];
    for (let d = 1; d <= 14; d++) {
      rows.push(
        makeRow({
          date: `2026-05-${String(d).padStart(2, '0')}`,
          model: 'sonnet',
          cost: 1,
          units: 1,
          inputW: 1000,
          cacheRead: 9000,
        }),
      );
    }
    // Spike + model switch on the same day
    rows.push(
      makeRow({
        date: '2026-05-15',
        model: 'opus-max',
        cost: 50,
        units: 1,
        inputW: 9000,
        cacheRead: 1000,
      }),
    );
    const summary = aggregate(rows);
    const r = detectAllAnomalies(summary, rows);
    expect(r.all.length).toBeGreaterThanOrEqual(2);
    const dayGroup = r.byDay.get('2026-05-15');
    expect(dayGroup?.length).toBeGreaterThanOrEqual(2);
  });
});
