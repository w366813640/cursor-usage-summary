import type { RowWithCost, UsageSummary } from './aggregators';

/**
 * "Where is my money going, and what could I do about it?"
 *
 * Efficiency analyzer: takes the loaded rows + the aggregate summary and
 * produces a fully-derived report showing per-model cost-per-request, two
 * what-if scenarios (everything at your cheapest model's $/req; same volume
 * without max-mode), and a ranked list of plain-English recommendations.
 *
 * Pure function — no IO, no DOM, deterministic. The numbers are deliberately
 * conservative: we estimate max-mode premium at 50% (real-world max-mode
 * routinely costs 2-4x baseline, so dropping it saves ~50%; we don't
 * promise more than that lest the recommendations feel like marketing).
 */

export interface ModelEfficiency {
  model: string;
  cost: number;
  requestUnits: number;
  costPerReq: number; // 0 when requestUnits === 0
  costShare: number; // 0..1
  maxModeCost: number; // total cost from rows where maxMode === true
  maxModeShare: number; // 0..1, of THIS model's spend
}

export interface EfficiencyScenario {
  /** Hypothetical total cost if everything ran under this scenario. */
  cost: number;
  /** actualCost - scenarioCost (positive = saving). */
  savings: number;
  /** savings / actualCost (0..1). */
  savingsPct: number;
}

export interface EfficiencyRecommendation {
  /** One-line actionable copy ("Switch X to Y to save $Z"). */
  title: string;
  /** Longer-form context for tooltip / expanded view. */
  detail: string;
  /** Estimated dollar savings if the user follows the recommendation. */
  estimatedSavings: number;
  /** Severity / priority bucket used by the UI to colour-code. */
  priority: 'high' | 'medium' | 'low';
  /** Categorical tag — lets the UI render an icon per kind. */
  kind: 'switch-model' | 'drop-maxmode' | 'cache-warmup' | 'good-news';
}

export interface EfficiencyReport {
  /** Mirror of summary.totalCost for convenience. */
  actualCost: number;
  /** Sum of `requests.value` across `units` rows. */
  actualRequests: number;
  /** actualCost / actualRequests (0 when no requests). */
  actualCostPerReq: number;
  /** Per-model breakdown sorted by cost desc. */
  byModel: ModelEfficiency[];
  /** The (model, $/req) with the lowest $/req above a minimum-volume floor. */
  cheapest: { model: string; costPerReq: number } | null;
  /** The most expensive (model, $/req) by the same volume floor. */
  mostExpensive: { model: string; costPerReq: number } | null;
  scenarios: {
    /** All requests rebilled at the cheapest model's $/req. */
    cheapestMix: EfficiencyScenario;
    /** Drop the max-mode premium on all max-mode rows (50% estimated). */
    noMaxMode: EfficiencyScenario;
  };
  /** Ranked recommendations (high priority first, capped at 5). */
  recommendations: EfficiencyRecommendation[];
}

export interface ComputeEfficiencyOptions {
  /** Models with fewer than N request-units are ignored as too-noisy. Default 10. */
  minRequestUnits?: number;
  /** Estimated cost reduction from dropping max-mode (0..1). Default 0.5. */
  maxModeReductionRate?: number;
  /** Min dollar savings to surface as a recommendation. Default $1. */
  minRecommendationSavings?: number;
}

const DEFAULTS: Required<ComputeEfficiencyOptions> = {
  minRequestUnits: 10,
  maxModeReductionRate: 0.5,
  minRecommendationSavings: 1,
};

export function computeEfficiency(
  summary: UsageSummary,
  rows: ReadonlyArray<RowWithCost>,
  opts: ComputeEfficiencyOptions = {},
): EfficiencyReport {
  const { minRequestUnits, maxModeReductionRate, minRecommendationSavings } = {
    ...DEFAULTS,
    ...opts,
  };

  const actualCost = summary.totalCost;
  const actualRequests = summary.totalRequestUnits;
  const actualCostPerReq = actualRequests > 0 ? actualCost / actualRequests : 0;

  // Aggregate max-mode cost per model (needs a second pass since
  // UsageSummary.byModel doesn't carry it).
  const maxModeCostByModel = new Map<string, number>();
  for (const r of rows) {
    if (!r.maxMode) continue;
    maxModeCostByModel.set(r.model, (maxModeCostByModel.get(r.model) ?? 0) + r.cost);
  }

  const byModel: ModelEfficiency[] = summary.byModel.map((b) => {
    const maxModeCost = maxModeCostByModel.get(b.model) ?? 0;
    const costPerReq = b.requestUnits > 0 ? b.cost / b.requestUnits : 0;
    return {
      model: b.model,
      cost: b.cost,
      requestUnits: b.requestUnits,
      costPerReq,
      costShare: actualCost > 0 ? b.cost / actualCost : 0,
      maxModeCost,
      maxModeShare: b.cost > 0 ? maxModeCost / b.cost : 0,
    };
  });
  byModel.sort((a, b) => b.cost - a.cost);

  // Find cheapest / most-expensive *eligible* model (above noise floor).
  const eligible = byModel.filter((m) => m.requestUnits >= minRequestUnits && m.costPerReq > 0);
  let cheapest: EfficiencyReport['cheapest'] = null;
  let mostExpensive: EfficiencyReport['mostExpensive'] = null;
  if (eligible.length > 0) {
    const minM = eligible.reduce((acc, m) => (m.costPerReq < acc.costPerReq ? m : acc));
    const maxM = eligible.reduce((acc, m) => (m.costPerReq > acc.costPerReq ? m : acc));
    cheapest = { model: minM.model, costPerReq: minM.costPerReq };
    mostExpensive = { model: maxM.model, costPerReq: maxM.costPerReq };
  }

  // Scenario 1 — all requests at the cheapest $/req.
  const cheapestMixCost = cheapest ? actualRequests * cheapest.costPerReq : actualCost;
  const cheapestMixSavings = Math.max(0, actualCost - cheapestMixCost);
  const cheapestMix: EfficiencyScenario = {
    cost: cheapestMixCost,
    savings: cheapestMixSavings,
    savingsPct: actualCost > 0 ? cheapestMixSavings / actualCost : 0,
  };

  // Scenario 2 — drop max-mode premium on all max-mode rows.
  let totalMaxModeCost = 0;
  for (const cost of maxModeCostByModel.values()) totalMaxModeCost += cost;
  const noMaxModeSavings = totalMaxModeCost * maxModeReductionRate;
  const noMaxMode: EfficiencyScenario = {
    cost: Math.max(0, actualCost - noMaxModeSavings),
    savings: noMaxModeSavings,
    savingsPct: actualCost > 0 ? noMaxModeSavings / actualCost : 0,
  };

  // Recommendations.
  const recs = buildRecommendations({
    byModel,
    eligible,
    cheapest,
    mostExpensive,
    totalMaxModeCost,
    maxModeReductionRate,
    actualCost,
    minRecommendationSavings,
  });

  return {
    actualCost,
    actualRequests,
    actualCostPerReq,
    byModel,
    cheapest,
    mostExpensive,
    scenarios: { cheapestMix, noMaxMode },
    recommendations: recs,
  };
}

interface RecommendationContext {
  byModel: ModelEfficiency[];
  eligible: ModelEfficiency[];
  cheapest: { model: string; costPerReq: number } | null;
  mostExpensive: { model: string; costPerReq: number } | null;
  totalMaxModeCost: number;
  maxModeReductionRate: number;
  actualCost: number;
  minRecommendationSavings: number;
}

function buildRecommendations(ctx: RecommendationContext): EfficiencyRecommendation[] {
  const out: EfficiencyRecommendation[] = [];

  // Switch-model: if the most-expensive eligible model dominates spend
  // (cost share >= 20%) and is meaningfully pricier than the cheapest one.
  if (ctx.cheapest && ctx.mostExpensive && ctx.cheapest.model !== ctx.mostExpensive.model) {
    const expensive = ctx.byModel.find((m) => m.model === ctx.mostExpensive!.model);
    if (expensive && expensive.costShare >= 0.2) {
      const ratio = ctx.mostExpensive.costPerReq / Math.max(ctx.cheapest.costPerReq, 0.0001);
      if (ratio >= 1.5) {
        // Assume the user shifts half of expensive-model requests to the
        // cheapest one. Conservative because not all tasks are
        // substitutable; we say "consider" not "definitely save".
        const shiftedRequests = expensive.requestUnits * 0.5;
        const savings = shiftedRequests * (ctx.mostExpensive.costPerReq - ctx.cheapest.costPerReq);
        if (savings >= ctx.minRecommendationSavings) {
          out.push({
            kind: 'switch-model',
            title: `Consider switching half of ${shortName(expensive.model)} to ${shortName(ctx.cheapest.model)} to save ~$${savings.toFixed(2)}`,
            detail: `${shortName(expensive.model)} cost $${expensive.costPerReq.toFixed(2)}/req vs ${shortName(ctx.cheapest.model)} at $${ctx.cheapest.costPerReq.toFixed(2)}/req (${ratio.toFixed(1)}x cheaper). Routing routine work to the cheaper model unlocks the saving without changing the harder tasks.`,
            estimatedSavings: savings,
            priority: savings > 20 ? 'high' : savings > 5 ? 'medium' : 'low',
          });
        }
      }
    }
  }

  // Drop max-mode: if max-mode share of total spend is non-trivial.
  if (ctx.totalMaxModeCost > 0 && ctx.actualCost > 0) {
    const share = ctx.totalMaxModeCost / ctx.actualCost;
    const savings = ctx.totalMaxModeCost * ctx.maxModeReductionRate;
    if (share >= 0.15 && savings >= ctx.minRecommendationSavings) {
      out.push({
        kind: 'drop-maxmode',
        title: `Max-mode is ${(share * 100).toFixed(0)}% of your spend — ~$${savings.toFixed(2)} of that is the premium`,
        detail: `You spent $${ctx.totalMaxModeCost.toFixed(2)} with max-mode on. Max-mode typically costs 2-4x baseline; turning it off when you don't need the deep-thinking pass would save roughly ${(ctx.maxModeReductionRate * 100).toFixed(0)}% of those rows.`,
        estimatedSavings: savings,
        priority: savings > 20 ? 'high' : savings > 5 ? 'medium' : 'low',
      });
    }
  }

  // Concentration risk: one model owns > 70% of spend AND > 50% of requests.
  const topModel = ctx.byModel[0];
  if (topModel && topModel.costShare >= 0.7 && ctx.actualCost > 5) {
    const diversifySavings = topModel.cost * 0.1; // conservative 10%
    if (diversifySavings >= ctx.minRecommendationSavings) {
      out.push({
        kind: 'switch-model',
        title: `${(topModel.costShare * 100).toFixed(0)}% of spend is on ${shortName(topModel.model)} — single-model risk`,
        detail: `Heavy single-model dependence makes you sensitive to price changes and outages. A modest fanout to a complementary model would shave ~$${diversifySavings.toFixed(2)} and add resilience.`,
        estimatedSavings: diversifySavings,
        priority: 'low',
      });
    }
  }

  // Good news: if nothing fires, surface a positive note so the panel isn't empty.
  if (out.length === 0) {
    out.push({
      kind: 'good-news',
      title: 'No obvious efficiency wins — your mix is already lean',
      detail:
        'Your spend is spread across reasonable $/req models with no large max-mode tax. Keep watching the anomaly inspector for surprise spikes.',
      estimatedSavings: 0,
      priority: 'low',
    });
  }

  // Sort by estimated savings desc, then take top 5.
  out.sort((a, b) => b.estimatedSavings - a.estimatedSavings);
  return out.slice(0, 5);
}

function shortName(model: string): string {
  // Truncate noisy provider/date suffixes for headline copy.
  // Keep the recognisable family + tier (sonnet, opus, gpt-5.5, etc.).
  return model
    .replace(/^claude-/, '')
    .replace(/-thinking(-max)?$/, (m) => m)
    .slice(0, 36);
}
