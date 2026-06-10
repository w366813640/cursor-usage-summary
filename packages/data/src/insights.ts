import type { RowWithCost, UsageSummary } from './aggregators';
import { detectAllAnomalies } from './anomalies';
import { computeBudgetUrgency } from './budgetGuard';
import { computeEfficiency } from './efficiency';
import { fillMissingDays, forecastDailyCost } from './forecast';
import { type Translator, translate } from './i18n';

export type ActionInsightKind =
  | 'budget-risk'
  | 'forecast-trend'
  | 'anomaly'
  | 'efficiency'
  | 'cache-health'
  | 'top-burn'
  | 'healthy';

export type ActionInsightPriority = 'high' | 'medium' | 'low';
export type ActionInsightConfidence = 'high' | 'medium' | 'low';

export interface ActionInsight {
  id: string;
  kind: ActionInsightKind;
  priority: ActionInsightPriority;
  confidence: ActionInsightConfidence;
  title: string;
  detail: string;
  action: string;
  estimatedSavings?: number;
  source: string;
}

export interface ComputeActionInsightsOptions {
  monthlyRequestBudget?: number;
  maxItems?: number;
  /** Clock override for deterministic budget scoring (defaults to now). */
  asOf?: Date;
  /**
   * Optional locale translator. When omitted, every insight falls back
   * to its English literal (which is also what the test suite asserts
   * against). When provided, every visible string is routed through
   * `narrative.insight.*` keys.
   */
  t?: Translator;
}

const PRIORITY_SCORE: Record<ActionInsightPriority, number> = {
  high: 300,
  medium: 200,
  low: 100,
};

/**
 * Deterministic local "what should I do next?" feed.
 *
 * This composes existing analytics rather than inventing a new model: budget
 * urgency, forecast trend, anomaly detection, efficiency recommendations,
 * cache health, and top-burn rows. No network calls, no LLM, no side effects.
 */
export function computeActionInsights(
  summary: UsageSummary,
  rows: ReadonlyArray<RowWithCost>,
  options: ComputeActionInsightsOptions = {},
): ActionInsight[] {
  const budget = options.monthlyRequestBudget ?? 500;
  const maxItems = options.maxItems ?? 5;
  const t = options.t;
  const insights: ActionInsight[] = [];

  addBudgetInsight(insights, summary, budget, t, options.asOf);
  addAnomalyInsight(insights, summary, rows, t);
  addEfficiencyInsights(insights, summary, rows, t);
  addForecastInsight(insights, summary, t);
  addCacheInsight(insights, summary, t);
  addTopBurnInsight(insights, summary, t);

  if (insights.length === 0) {
    const hasData = summary.totalRows > 0;
    insights.push({
      id: 'healthy',
      kind: 'healthy',
      priority: 'low',
      confidence: hasData ? 'high' : 'low',
      title: hasData
        ? translate(t, 'narrative.insight.healthy.title', 'No urgent cost action in this dataset')
        : translate(t, 'narrative.insight.empty.title', 'Import usage data to get cost coaching'),
      detail: hasData
        ? translate(
            t,
            'narrative.insight.healthy.detail',
            'Budget, anomalies, cache reuse, max-mode, and model mix all look calm enough for now.',
          )
        : translate(
            t,
            'narrative.insight.empty.detail',
            'The action feed appears after a CSV is loaded and enough usage exists to score.',
          ),
      action: hasData
        ? translate(t, 'narrative.insight.healthy.action', 'Keep watching the weekly summary.')
        : translate(t, 'narrative.insight.empty.action', 'Import a Cursor usage CSV.'),
      source: 'local insight engine',
    });
  }

  return insights
    .sort((a, b) => insightScore(b) - insightScore(a) || a.id.localeCompare(b.id))
    .slice(0, maxItems);
}

function addBudgetInsight(
  out: ActionInsight[],
  summary: UsageSummary,
  budget: number,
  t: Translator | undefined,
  asOf?: Date,
): void {
  const urgency = computeBudgetUrgency(summary, budget, { t, asOf });
  if (!urgency.enabled || urgency.severity === 'safe') return;

  out.push({
    id: `budget-${urgency.monthStart}-${urgency.severity}`,
    kind: 'budget-risk',
    priority: urgency.severity === 'high' ? 'high' : 'medium',
    confidence: urgency.daysElapsed >= 7 ? 'high' : 'medium',
    title:
      urgency.severity === 'high'
        ? translate(t, 'narrative.insight.budget.titleHigh', 'Monthly request budget is at risk')
        : translate(
            t,
            'narrative.insight.budget.titleMedium',
            'Monthly request budget is trending hot',
          ),
    detail: urgency.message,
    action:
      urgency.exhaustionDay !== null
        ? translate(
            t,
            'narrative.insight.budget.actionExhaustion',
            'Audit high-cost days before day {day}.',
            { day: urgency.exhaustionDay },
          )
        : translate(
            t,
            'narrative.insight.budget.actionDefault',
            'Review max-mode and model mix before the month ends.',
          ),
    source: 'monthly budget guard',
  });
}

function addAnomalyInsight(
  out: ActionInsight[],
  summary: UsageSummary,
  rows: ReadonlyArray<RowWithCost>,
  t: Translator | undefined,
): void {
  const anomalies = detectAllAnomalies(summary, rows, { t });
  const high = anomalies.bySeverity.high[0];
  const medium = anomalies.bySeverity.medium[0];
  const picked = high ?? medium;
  if (!picked) return;

  out.push({
    id: `anomaly-${picked.kind}-${picked.date}`,
    kind: 'anomaly',
    priority: picked.severity === 'high' ? 'high' : 'medium',
    confidence: summary.byDay.length >= 14 ? 'high' : 'medium',
    title: translate(t, 'narrative.insight.anomaly.title', 'Investigate {date}', {
      date: picked.date,
    }),
    detail: picked.explanation,
    action: translate(
      t,
      'narrative.insight.anomaly.action',
      'Open the Day audit for that date and inspect the request sequence.',
    ),
    source: `anomaly detector: ${picked.kind}`,
  });
}

function addEfficiencyInsights(
  out: ActionInsight[],
  summary: UsageSummary,
  rows: ReadonlyArray<RowWithCost>,
  t: Translator | undefined,
): void {
  const report = computeEfficiency(summary, rows, { t });
  for (const rec of report.recommendations) {
    if (rec.kind === 'good-news') continue;
    out.push({
      id: `efficiency-${rec.kind}-${rec.title}`,
      kind: 'efficiency',
      priority: rec.priority,
      confidence: report.actualRequests >= 10 ? 'medium' : 'low',
      title: rec.title,
      detail: rec.detail,
      action:
        rec.kind === 'drop-maxmode'
          ? translate(
              t,
              'narrative.insight.efficiency.actionMaxmode',
              'Open Requests and filter max-mode-heavy days first.',
            )
          : translate(
              t,
              'narrative.insight.efficiency.actionModel',
              'Open Models and compare the expensive model against cheaper routine-work options.',
            ),
      estimatedSavings: rec.estimatedSavings,
      source: 'efficiency analyzer',
    });
  }
}

function addForecastInsight(
  out: ActionInsight[],
  summary: UsageSummary,
  t: Translator | undefined,
): void {
  const series = fillMissingDays(summary.byDay.map((d) => ({ date: d.date, value: d.cost })));
  const forecast = forecastDailyCost(series, { lookbackDays: 90, horizonDays: 30 });
  if (forecast.projected.length === 0) return;
  if (forecast.trend !== 'rising') return;

  const current30 = series.slice(-30).reduce((acc, p) => acc + p.value, 0);
  if (current30 <= 0) return;
  const drift = (forecast.totalProjected - current30) / current30;
  if (drift < 0.15) return;

  out.push({
    id: 'forecast-rising-30d',
    kind: 'forecast-trend',
    priority: drift >= 0.35 ? 'high' : 'medium',
    confidence: forecast.confidence,
    title: translate(t, 'narrative.insight.forecast.title', 'Next 30 days may rise {pct}%', {
      pct: (drift * 100).toFixed(0),
    }),
    detail: translate(
      t,
      'narrative.insight.forecast.detail',
      'The local linear forecast projects ${projected} over the next 30 days, versus ${current} in the latest 30-day window.',
      {
        projected: forecast.totalProjected.toFixed(2),
        current: current30.toFixed(2),
      },
    ),
    action: translate(
      t,
      'narrative.insight.forecast.action',
      'Review the forecast panel and compare the latest high-cost week.',
    ),
    source: '30-day forecast',
  });
}

function addCacheInsight(
  out: ActionInsight[],
  summary: UsageSummary,
  t: Translator | undefined,
): void {
  const { totalInput, hitRatio } = summary.cacheHitStats;
  if (totalInput < 10_000) return;
  if (hitRatio >= 0.25) return;

  out.push({
    id: 'cache-health-low',
    kind: 'cache-health',
    priority: hitRatio < 0.1 ? 'medium' : 'low',
    confidence: totalInput >= 100_000 ? 'high' : 'medium',
    title: translate(t, 'narrative.insight.cache.title', 'Cache reuse looks low'),
    detail: translate(
      t,
      'narrative.insight.cache.detail',
      'Only {pct}% of input tokens came from cache reads. Repeated long contexts may be landing cold.',
      { pct: (hitRatio * 100).toFixed(1) },
    ),
    action: translate(
      t,
      'narrative.insight.cache.action',
      'Look for repeated workflows that could reuse warmed context or shorter prompts.',
    ),
    source: 'cache hit stats',
  });
}

function addTopBurnInsight(
  out: ActionInsight[],
  summary: UsageSummary,
  t: Translator | undefined,
): void {
  const hottest = summary.topBurns[0];
  if (!hottest || hottest.cost < 5) return;

  out.push({
    id: `top-burn-${hottest.id}`,
    kind: 'top-burn',
    priority: hottest.cost >= 25 ? 'high' : 'medium',
    confidence: hottest.costEstimated ? 'medium' : 'high',
    title: translate(t, 'narrative.insight.topBurn.title', 'One request cost ${cost}', {
      cost: hottest.cost.toFixed(2),
    }),
    detail: translate(
      t,
      hottest.maxMode
        ? 'narrative.insight.topBurn.detailMaxMode'
        : 'narrative.insight.topBurn.detail',
      hottest.maxMode ? '{model} on {date} with max-mode enabled.' : '{model} on {date}.',
      { model: hottest.model, date: hottest.dateISO.slice(0, 10) },
    ),
    action: translate(
      t,
      'narrative.insight.topBurn.action',
      'Open Day audit for that date and inspect the request sequence around it.',
    ),
    source: 'top burn row',
  });
}

function insightScore(insight: ActionInsight): number {
  const savings = insight.estimatedSavings ?? 0;
  const confidence = insight.confidence === 'high' ? 30 : insight.confidence === 'medium' ? 15 : 0;
  return PRIORITY_SCORE[insight.priority] + confidence + Math.min(60, savings);
}
