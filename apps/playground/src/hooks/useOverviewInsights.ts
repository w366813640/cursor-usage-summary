import {
  type ActionInsight,
  type DetectAllResult,
  type EfficiencyReport,
  type ForecastResult,
  type RowWithCost,
  type Translator,
  type UsageSummary,
  type WeekSummary,
  composeWeekSummary,
  computeActionInsights,
  computeEfficiency,
  detectAllAnomalies,
  fillMissingDays,
  forecastDailyCost,
} from '@cu/data';
import { useI18n } from '@cu/ui';
import { useMemo } from 'react';
import { perfSpan } from '../utils/perf';

/**
 * One-stop computation for every heavy Overview analysis (perf plan 1.1/1.2).
 *
 * Before this hook, the Overview panels each ran their own full-dataset
 * pass — and worse, `ActionFeed → computeActionInsights` re-ran
 * `detectAllAnomalies` + `computeEfficiency` that `OverviewActivity` /
 * `EfficiencyCard` had already computed. That meant anomalies ×2,
 * efficiency ×2, forecast ×2 on every Overview mount.
 *
 * This hook:
 *  1. computes each analysis exactly once per (rows, locale, budget),
 *  2. injects the precomputed anomalies/efficiency into
 *     `computeActionInsights` so it skips its internal recompute,
 *  3. caches the bundle in a module-level WeakMap keyed on the `rows`
 *     array identity — the rows reference is held stable in WelcomePage
 *     state, so navigating away and back to Overview reuses the bundle
 *     instead of recomputing from scratch (route switches remount pages).
 */
export interface OverviewInsights {
  anomalies: DetectAllResult;
  efficiency: EfficiencyReport;
  week: WeekSummary;
  forecast: ForecastResult;
  actionInsights: ActionInsight[];
}

const cache = new WeakMap<ReadonlyArray<RowWithCost>, Map<string, OverviewInsights>>();

/**
 * Anomaly detection cached separately from the bundle: it doesn't depend
 * on the budget setting, and the Anomalies route needs the same result —
 * sharing the cache means Overview → Anomalies costs zero extra passes.
 */
const anomaliesCache = new WeakMap<ReadonlyArray<RowWithCost>, Map<string, DetectAllResult>>();

export function getCachedAnomalies(
  summary: UsageSummary,
  rows: ReadonlyArray<RowWithCost>,
  locale: string,
  t: Translator | undefined,
): DetectAllResult {
  let byLocale = anomaliesCache.get(rows);
  if (!byLocale) {
    byLocale = new Map();
    anomaliesCache.set(rows, byLocale);
  }
  const hit = byLocale.get(locale);
  if (hit) return hit;
  const end = perfSpan('detectAllAnomalies');
  const result = detectAllAnomalies(summary, rows, { t });
  end(`${rows.length} rows`);
  byLocale.set(locale, result);
  return result;
}

export function useOverviewInsights(
  summary: UsageSummary,
  rows: ReadonlyArray<RowWithCost>,
  monthlyRequestBudget: number,
): OverviewInsights {
  const { locale, t } = useI18n();

  return useMemo(() => {
    let byVariant = cache.get(rows);
    if (!byVariant) {
      byVariant = new Map();
      cache.set(rows, byVariant);
    }
    const variantKey = `${locale}|${monthlyRequestBudget}`;
    const hit = byVariant.get(variantKey);
    if (hit) return hit;

    const end = perfSpan('overviewInsights');
    const anomalies = getCachedAnomalies(summary, rows, locale, t);
    const efficiency = computeEfficiency(summary, rows, { t });
    const week = composeWeekSummary(summary, rows, { t });
    const forecast = buildForecast(rows);
    const actionInsights = computeActionInsights(summary, rows, {
      monthlyRequestBudget,
      maxItems: 4,
      t,
      precomputed: { anomalies, efficiency },
    });
    const bundle: OverviewInsights = { anomalies, efficiency, week, forecast, actionInsights };
    byVariant.set(variantKey, bundle);
    end(`${rows.length} rows`);
    return bundle;
  }, [summary, rows, locale, t, monthlyRequestBudget]);
}

/**
 * Daily-rollup + OLS regression input for the Forecast panel. Moved here
 * from `ForecastPanel.tsx` so the result rides the same cross-route cache.
 */
export function buildForecast(rows: ReadonlyArray<RowWithCost>): ForecastResult {
  if (rows.length === 0) {
    return forecastDailyCost([]);
  }
  // Roll cost up by day so the regression sees a clean univariate series.
  const dayMap = new Map<string, number>();
  for (const r of rows) {
    const day = r.dateISO.slice(0, 10);
    dayMap.set(day, (dayMap.get(day) ?? 0) + r.cost);
  }
  const raw = [...dayMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, value]) => ({ date, value }));
  return forecastDailyCost(fillMissingDays(raw), { lookbackDays: 90, horizonDays: 30 });
}
