import type { UsageSummary } from './aggregators';

/**
 * Budget urgency calculator — answers "am I about to blow my plan budget,
 * and if so, by when?".
 *
 * Input is the same pieces the dashboard already has on hand: the loaded
 * UsageSummary (for per-day request counts) + the user's monthly request
 * budget from settings + an `asOf` date (overridable in tests).
 *
 * Output is a single self-contained object the UI can render without
 * additional math. Severity bucket is meant to drive the banner's colour
 * stripe (safe = hidden, low = subtle, medium = accent, high = warning).
 */

export type BudgetSeverity = 'safe' | 'low' | 'medium' | 'high';

export interface BudgetUrgency {
  /** False when there's no month-to-date data or no budget set. */
  enabled: boolean;
  monthStart: string; // YYYY-MM-DD (UTC)
  monthEnd: string; // YYYY-MM-DD (UTC) inclusive last day
  totalDaysInMonth: number;
  daysElapsed: number; // inclusive of today
  daysRemaining: number; // exclusive of today
  budget: number; // requests / month
  used: number; // requests this month
  dailyRate: number; // used / daysElapsed
  projectedTotal: number; // total expected by month-end at current pace
  /** (projected - budget) / budget; negative => running under budget. */
  projectedOverBudgetPct: number;
  /**
   * If projected total >= budget, the calendar day-of-month on which the
   * user is expected to exhaust their budget at the current pace. Null
   * when on track or no signal.
   */
  exhaustionDay: number | null;
  /**
   * Days remaining until the exhaustion day (positive => urgency,
   * negative => already exhausted). Null when on track.
   */
  daysToExhaustion: number | null;
  severity: BudgetSeverity;
  /** A short, ready-to-render banner line for the UI. */
  message: string;
}

export interface BudgetGuardOptions {
  /** Stub date for unit tests. */
  asOf?: Date;
  /** Treat usage as "safe" until at least N days have elapsed. Default 3. */
  warmupDays?: number;
}

export function computeBudgetUrgency(
  summary: UsageSummary,
  monthlyBudget: number,
  opts: BudgetGuardOptions = {},
): BudgetUrgency {
  const asOf = opts.asOf ?? new Date();
  const warmupDays = opts.warmupDays ?? 3;
  const year = asOf.getUTCFullYear();
  const month = asOf.getUTCMonth(); // 0-indexed
  const monthStart = new Date(Date.UTC(year, month, 1));
  const monthEndExclusive = new Date(Date.UTC(year, month + 1, 1));
  const totalDaysInMonth = Math.round(
    (monthEndExclusive.getTime() - monthStart.getTime()) / (1000 * 60 * 60 * 24),
  );
  const dayOfMonth = asOf.getUTCDate(); // 1..totalDaysInMonth
  const daysElapsed = dayOfMonth;
  const daysRemaining = totalDaysInMonth - dayOfMonth;
  const monthStartIso = monthStart.toISOString().slice(0, 10);
  const monthEndIso = new Date(Date.UTC(year, month, totalDaysInMonth)).toISOString().slice(0, 10);

  const baseline: BudgetUrgency = {
    enabled: false,
    monthStart: monthStartIso,
    monthEnd: monthEndIso,
    totalDaysInMonth,
    daysElapsed,
    daysRemaining,
    budget: monthlyBudget,
    used: 0,
    dailyRate: 0,
    projectedTotal: 0,
    projectedOverBudgetPct: 0,
    exhaustionDay: null,
    daysToExhaustion: null,
    severity: 'safe',
    message: '',
  };

  if (monthlyBudget <= 0 || summary.byDay.length === 0) return baseline;

  // Sum month-to-date request count from byDay. byDay carries cost only
  // by default but in our aggregator it also tracks request units —
  // double-check the field name lives on DayBucket.
  let used = 0;
  for (const d of summary.byDay) {
    if (d.date < monthStartIso) continue;
    if (d.date > monthEndIso) continue;
    used += d.requestUnits;
  }
  if (used === 0) return baseline;

  const dailyRate = used / daysElapsed;
  const projectedTotal = dailyRate * totalDaysInMonth;
  const projectedOverBudgetPct = (projectedTotal - monthlyBudget) / monthlyBudget;

  // Exhaustion day — when the cumulative spend (at current rate) first
  // crosses `monthlyBudget`. Linearly extrapolate from today's `used`.
  let exhaustionDay: number | null = null;
  let daysToExhaustion: number | null = null;
  if (projectedTotal >= monthlyBudget) {
    const dayWhenWeCross = monthlyBudget / dailyRate; // day-of-month (float)
    exhaustionDay = Math.max(1, Math.ceil(dayWhenWeCross));
    daysToExhaustion = exhaustionDay - dayOfMonth;
  }

  // Severity ladder. Warmup keeps the first few days quiet so a single
  // big day doesn't trigger urgency the moment you import data.
  let severity: BudgetSeverity = 'safe';
  if (daysElapsed >= warmupDays) {
    if (projectedOverBudgetPct >= 0.2) severity = 'high';
    else if (projectedOverBudgetPct >= 0.05) severity = 'medium';
    else if (projectedOverBudgetPct >= 0) severity = 'low';
  }

  const message = buildMessage({
    severity,
    monthlyBudget,
    projectedTotal,
    projectedOverBudgetPct,
    exhaustionDay,
    daysToExhaustion,
    used,
    daysElapsed,
    daysRemaining,
    dailyRate,
    totalDaysInMonth,
  });

  return {
    enabled: true,
    monthStart: monthStartIso,
    monthEnd: monthEndIso,
    totalDaysInMonth,
    daysElapsed,
    daysRemaining,
    budget: monthlyBudget,
    used,
    dailyRate,
    projectedTotal,
    projectedOverBudgetPct,
    exhaustionDay,
    daysToExhaustion,
    severity,
    message,
  };
}

interface MessageContext {
  severity: BudgetSeverity;
  monthlyBudget: number;
  projectedTotal: number;
  projectedOverBudgetPct: number;
  exhaustionDay: number | null;
  daysToExhaustion: number | null;
  used: number;
  daysElapsed: number;
  daysRemaining: number;
  dailyRate: number;
  totalDaysInMonth: number;
}

function buildMessage(c: MessageContext): string {
  if (c.severity === 'safe') {
    const remaining = Math.max(0, c.monthlyBudget - c.used);
    return `On track. ${remaining.toFixed(0)} of ${c.monthlyBudget} requests remaining for the month.`;
  }
  if (c.exhaustionDay !== null && c.daysToExhaustion !== null) {
    if (c.daysToExhaustion <= 0) {
      const overBy = Math.max(0, c.used - c.monthlyBudget);
      return `Budget exhausted — ${overBy.toFixed(0)} requests over with ${c.daysRemaining} days left in the month.`;
    }
    return `At ${c.dailyRate.toFixed(0)} requests/day you'll hit your ${c.monthlyBudget}-request budget on day ${c.exhaustionDay} (in ${c.daysToExhaustion} days), ${Math.max(0, c.totalDaysInMonth - c.exhaustionDay)} days before month-end.`;
  }
  // Defensive fallback when there's no exhaustion (e.g. projected exactly
  // equals budget) — happens at severity === 'low' edge cases.
  const overPct = (c.projectedOverBudgetPct * 100).toFixed(0);
  return `Projecting ${c.projectedTotal.toFixed(0)} requests by month-end (${overPct}% over the ${c.monthlyBudget} budget) at the current pace.`;
}
