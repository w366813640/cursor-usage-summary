import type { RowWithCost, UsageSummary } from './aggregators';

export type BudgetScenarioKind = 'baseline' | 'cache' | 'top-burn' | 'volume';

export interface BudgetScenario {
  id: string;
  kind: BudgetScenarioKind;
  title: string;
  detail: string;
  action: string;
  projectedRequests: number;
  projectedCost: number;
  requestDelta: number;
  costDelta: number;
  confidence: 'high' | 'medium' | 'low';
}

export interface BudgetScenarioOptions {
  monthlyRequestBudget?: number;
  todayISO?: string;
}

interface CurrentMonthPace {
  requestUnits: number;
  cost: number;
  daysCovered: number;
  daysInMonth: number;
  projectedRequests: number;
  projectedCost: number;
}

export function computeBudgetScenarios(
  summary: UsageSummary,
  rows: ReadonlyArray<RowWithCost>,
  options: BudgetScenarioOptions = {},
): BudgetScenario[] {
  const monthlyRequestBudget = options.monthlyRequestBudget ?? 500;
  const pace = currentMonthPace(summary, options.todayISO);
  if (!pace) return [];

  const baseline: BudgetScenario = {
    id: 'baseline',
    kind: 'baseline',
    title: 'Stay the course',
    detail: `${Math.round(pace.projectedRequests).toLocaleString()} projected request units this month.`,
    action:
      pace.projectedRequests > monthlyRequestBudget
        ? 'Budget risk is active; use one of the savings levers below.'
        : 'Current pace stays inside the configured request budget.',
    projectedRequests: pace.projectedRequests,
    projectedCost: pace.projectedCost,
    requestDelta: 0,
    costDelta: 0,
    confidence: pace.daysCovered >= 14 ? 'high' : pace.daysCovered >= 7 ? 'medium' : 'low',
  };

  const cacheSavings = cacheScenarioSavings(summary, pace.projectedCost);
  const topBurnSavings = topBurnScenarioSavings(rows, pace.projectedCost);
  const volumeSavings = pace.projectedCost * 0.1;

  return [
    baseline,
    savingsScenario({
      id: 'cache-plus-10',
      kind: 'cache',
      title: 'Lift cache reuse',
      detail: 'Model a modest cache-health improvement on fresh input-heavy work.',
      action: 'Batch repeated context and avoid rewriting large prompts between adjacent runs.',
      baseline,
      costSavings: cacheSavings,
      requestSavings: 0,
      confidence: summary.cacheHitStats.totalInput > 0 ? 'medium' : 'low',
    }),
    savingsScenario({
      id: 'top-burn-minus-15',
      kind: 'top-burn',
      title: 'Trim top-burn runs',
      detail: 'Model a 15% reduction on the most expensive recent requests.',
      action: 'Review the largest max-mode or long-context runs before repeating them.',
      baseline,
      costSavings: topBurnSavings,
      requestSavings: 0,
      confidence: rows.length >= 10 ? 'medium' : 'low',
    }),
    savingsScenario({
      id: 'volume-minus-10',
      kind: 'volume',
      title: 'Reduce request volume',
      detail: 'Model a 10% reduction in request units for exploratory work.',
      action: 'Move low-value iterations into fewer, more deliberate checkpoints.',
      baseline,
      costSavings: volumeSavings,
      requestSavings: pace.projectedRequests * 0.1,
      confidence: 'high',
    }),
  ].sort((a, b) => a.projectedCost - b.projectedCost);
}

function savingsScenario({
  id,
  kind,
  title,
  detail,
  action,
  baseline,
  costSavings,
  requestSavings,
  confidence,
}: {
  id: string;
  kind: BudgetScenarioKind;
  title: string;
  detail: string;
  action: string;
  baseline: BudgetScenario;
  costSavings: number;
  requestSavings: number;
  confidence: BudgetScenario['confidence'];
}): BudgetScenario {
  const safeCostSavings = Math.max(0, Math.min(costSavings, baseline.projectedCost));
  const safeRequestSavings = Math.max(0, Math.min(requestSavings, baseline.projectedRequests));
  return {
    id,
    kind,
    title,
    detail,
    action,
    projectedRequests: baseline.projectedRequests - safeRequestSavings,
    projectedCost: baseline.projectedCost - safeCostSavings,
    requestDelta: -safeRequestSavings,
    costDelta: -safeCostSavings,
    confidence,
  };
}

function currentMonthPace(summary: UsageSummary, todayISO?: string): CurrentMonthPace | null {
  const lastISO = todayISO ?? summary.dateRange.lastISO;
  if (!lastISO || summary.byDay.length === 0) return null;
  const monthKey = lastISO.slice(0, 7);
  const days = summary.byDay.filter((d) => d.date.startsWith(monthKey));
  if (days.length === 0) return null;
  const requestUnits = days.reduce((acc, d) => acc + d.requestUnits, 0);
  const cost = days.reduce((acc, d) => acc + d.cost, 0);
  const daysInMonth = new Date(
    Date.UTC(Number(monthKey.slice(0, 4)), Number(monthKey.slice(5, 7)), 0),
  ).getUTCDate();
  const daysCovered = Math.max(1, days.length);
  return {
    requestUnits,
    cost,
    daysCovered,
    daysInMonth,
    projectedRequests: (requestUnits / daysCovered) * daysInMonth,
    projectedCost: (cost / daysCovered) * daysInMonth,
  };
}

function cacheScenarioSavings(summary: UsageSummary, projectedCost: number): number {
  const { hitRatio, totalInput } = summary.cacheHitStats;
  if (totalInput <= 0) return 0;
  const roomToImprove = Math.max(0, 0.7 - hitRatio);
  return projectedCost * Math.min(0.12, roomToImprove * 0.18);
}

function topBurnScenarioSavings(rows: ReadonlyArray<RowWithCost>, projectedCost: number): number {
  const topBurnCost = rows
    .slice()
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 5)
    .reduce((acc, row) => acc + row.cost, 0);
  return Math.min(projectedCost * 0.18, topBurnCost * 0.15);
}
