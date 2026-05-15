import { describe, expect, it } from 'vitest';
import {
  type BudgetReport,
  decideBudgetNotification,
  makeInitialState,
  prune,
  recordNotification,
} from '../budgetNotifier';

function report(overrides: Partial<BudgetReport> = {}): BudgetReport {
  return {
    monthKey: '2026-05',
    monthLabel: 'May 2026',
    spendUSD: 0,
    requestUnits: 0,
    budgetRequests: 500,
    projectedRequests: null,
    ...overrides,
  };
}

describe('decideBudgetNotification', () => {
  it('returns null when no usage yet', () => {
    expect(decideBudgetNotification(makeInitialState(), report({ requestUnits: 0 }))).toBeNull();
  });

  it('returns null when budget is disabled (0)', () => {
    expect(
      decideBudgetNotification(
        makeInitialState(),
        report({ requestUnits: 1000, budgetRequests: 0 }),
      ),
    ).toBeNull();
  });

  it('returns null when below the 80% threshold', () => {
    const out = decideBudgetNotification(
      makeInitialState(),
      report({ requestUnits: 350, budgetRequests: 500 }),
    );
    expect(out).toBeNull();
  });

  it('fires at the 80% threshold', () => {
    const out = decideBudgetNotification(
      makeInitialState(),
      report({ requestUnits: 400, budgetRequests: 500 }),
    );
    expect(out).not.toBeNull();
    expect(out?.threshold).toBe(0.8);
    expect(out?.urgent).toBe(false);
    expect(out?.title).toContain('Approaching');
  });

  it('fires at the 100% threshold', () => {
    const out = decideBudgetNotification(
      makeInitialState(),
      report({ requestUnits: 500, budgetRequests: 500 }),
    );
    expect(out?.threshold).toBe(1.0);
    expect(out?.urgent).toBe(true);
    expect(out?.title).toContain('Over budget');
  });

  it('picks the higher threshold first when both crossed in one shot', () => {
    // Renderer pushed a stale snapshot, then jumped past 100% — we want
    // the over-budget toast, not the 80% heads-up.
    const out = decideBudgetNotification(
      makeInitialState(),
      report({ requestUnits: 600, budgetRequests: 500 }),
    );
    expect(out?.threshold).toBe(1.0);
  });

  it('does not refire the same threshold within a month', () => {
    let state = makeInitialState();
    const first = decideBudgetNotification(
      state,
      report({ requestUnits: 420, budgetRequests: 500 }),
    );
    expect(first?.threshold).toBe(0.8);
    state = recordNotification(state, first?.monthKey ?? '', first?.threshold ?? 0.8);
    const second = decideBudgetNotification(
      state,
      report({ requestUnits: 450, budgetRequests: 500 }),
    );
    expect(second).toBeNull();
  });

  it('still fires the 100% toast even if 80% was already shown', () => {
    let state = recordNotification(makeInitialState(), '2026-05', 0.8);
    const out = decideBudgetNotification(state, report({ requestUnits: 510, budgetRequests: 500 }));
    expect(out?.threshold).toBe(1.0);
    state = recordNotification(state, out?.monthKey ?? '', out?.threshold ?? 1.0);
    const after = decideBudgetNotification(
      state,
      report({ requestUnits: 700, budgetRequests: 500 }),
    );
    expect(after).toBeNull();
  });

  it('treats different months independently', () => {
    let state = recordNotification(makeInitialState(), '2026-05', 0.8);
    state = recordNotification(state, '2026-05', 1.0);
    const out = decideBudgetNotification(
      state,
      report({
        monthKey: '2026-06',
        monthLabel: 'Jun 2026',
        requestUnits: 410,
        budgetRequests: 500,
      }),
    );
    expect(out?.threshold).toBe(0.8);
    expect(out?.monthKey).toBe('2026-06');
  });

  it('includes spend and projection in the body when available', () => {
    const out = decideBudgetNotification(
      makeInitialState(),
      report({ requestUnits: 510, spendUSD: 42.18, projectedRequests: 720 }),
    );
    expect(out?.body).toContain('$42.18');
    expect(out?.body).toContain('720');
  });
});

describe('prune', () => {
  it('keeps the current and previous month by default', () => {
    const base = recordNotification(makeInitialState(), '2026-05', 0.8);
    const more = recordNotification(base, '2026-04', 1.0);
    const older = recordNotification(more, '2026-01', 0.8);
    const pruned = prune(older, '2026-05');
    expect(Object.keys(pruned.thresholdsHit).sort()).toEqual(['2026-04', '2026-05']);
  });

  it('drops nothing when all entries are within the window', () => {
    const state = recordNotification(makeInitialState(), '2026-05', 1.0);
    expect(prune(state, '2026-05')).toEqual(state);
  });

  it('handles year rollovers in the cutoff calculation', () => {
    let state = recordNotification(makeInitialState(), '2025-12', 1.0);
    state = recordNotification(state, '2025-11', 0.8);
    state = recordNotification(state, '2025-10', 0.8);
    const pruned = prune(state, '2026-01');
    expect(Object.keys(pruned.thresholdsHit).sort()).toEqual(['2025-12', '2026-01'].slice(0, 1));
    // 2026-01 hasn't fired yet so the only entry kept is 2025-12.
    expect(pruned.thresholdsHit['2025-12']).toEqual([1.0]);
  });
});

describe('recordNotification', () => {
  it('does not duplicate the same threshold value', () => {
    let state = recordNotification(makeInitialState(), '2026-05', 0.8);
    state = recordNotification(state, '2026-05', 0.8);
    expect(state.thresholdsHit['2026-05']).toEqual([0.8]);
  });

  it('stores thresholds sorted ascending', () => {
    let state = recordNotification(makeInitialState(), '2026-05', 1.0);
    state = recordNotification(state, '2026-05', 0.8);
    expect(state.thresholdsHit['2026-05']).toEqual([0.8, 1.0]);
  });
});
