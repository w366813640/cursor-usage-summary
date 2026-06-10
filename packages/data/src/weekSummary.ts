import type { RowWithCost, UsageSummary } from './aggregators';
import { type Translator, translate } from './i18n';

/**
 * A short "what's going on this week" narrative, generated locally from
 * the aggregated usage data — no LLM call, no network. Surfaces on the
 * Overview page as a single card right above the KPI hero, answering the
 * question users have when they first open the dashboard:
 *
 *   "Anything I should know before I dive in?"
 *
 * Three pieces:
 *
 *   - headline    one sentence with the dominant number
 *   - bullets     2-4 noteworthy observations
 *   - suggestion  one actionable next step (or null if everything is normal)
 *
 * Locale-aware: pass `opts.t` (any `Translator`) to render the output in
 * the user's chosen language. Without `t`, the function returns the
 * built-in English literals — which is what the test suite asserts
 * against and what every pre-i18n caller already produces.
 */
export interface WeekSummary {
  /** "$123.45 across 3 models · top driver claude-4.6-opus (54%)." */
  headline: string;
  /** ["cache hit ratio 78% (↘8pp vs prior week)", …] */
  bullets: string[];
  /** "Consider checking the Anomalies tab — yesterday spiked 4× your avg." */
  suggestion: string | null;
  /** True when the dataset has < 7 days — used to show a degenerate banner. */
  degraded: boolean;
  /** Days actually covered by the "this week" window (1..7). */
  windowDays: number;
}

interface ComposeOptions {
  /** Last date in the dataset. Defaults to the latest `summary.byDay`. */
  asOfISO?: string;
  /**
   * Optional translator. When omitted, the function falls back to the
   * English literals embedded below — keeps the test suite (which
   * matches on "No usage", "spend is up", "cache hit", etc.) and every
   * legacy caller working without modification.
   */
  t?: Translator;
}

/**
 * Compose a `WeekSummary` from the dataset.
 *
 * Pure function, deterministic — same inputs always produce the same string
 * output, which keeps the on-screen text from flickering between renders
 * (and lets us unit-test it).
 */
export function composeWeekSummary(
  summary: UsageSummary,
  rows: ReadonlyArray<RowWithCost>,
  opts: ComposeOptions = {},
): WeekSummary {
  const t = opts.t;

  // Defensive: empty dataset.
  if (summary.byDay.length === 0 || rows.length === 0) {
    return {
      headline: translate(t, 'narrative.weekSummary.noUsage', 'No usage data yet.'),
      bullets: [],
      suggestion: null,
      degraded: true,
      windowDays: 0,
    };
  }

  // Pick the "as of" anchor — last day with data unless overridden.
  const asOf = opts.asOfISO ?? summary.byDay.at(-1)?.date ?? '';
  if (!asOf) {
    return {
      headline: translate(t, 'narrative.weekSummary.noUsage', 'No usage data yet.'),
      bullets: [],
      suggestion: null,
      degraded: true,
      windowDays: 0,
    };
  }

  // 7-day window ending at asOf (inclusive). We don't enumerate empty
  // dates here — byDay already only contains active days, and the
  // "windowDays" we report is the count we actually observed.
  const asOfDate = new Date(`${asOf}T00:00:00Z`);
  const sevenDaysAgo = new Date(asOfDate);
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 6);
  const fourteenDaysAgo = new Date(asOfDate);
  fourteenDaysAgo.setUTCDate(fourteenDaysAgo.getUTCDate() - 13);

  const inThisWeek = (d: Date | string) =>
    new Date(typeof d === 'string' ? `${d}T00:00:00Z` : d) >= sevenDaysAgo &&
    new Date(typeof d === 'string' ? `${d}T00:00:00Z` : d) <= asOfDate;

  const inPriorWeek = (d: Date | string) =>
    new Date(typeof d === 'string' ? `${d}T00:00:00Z` : d) >= fourteenDaysAgo &&
    new Date(typeof d === 'string' ? `${d}T00:00:00Z` : d) < sevenDaysAgo;

  const thisWeekDays = summary.byDay.filter((d) => inThisWeek(d.date));
  const priorWeekDays = summary.byDay.filter((d) => inPriorWeek(d.date));

  const thisWeekCost = thisWeekDays.reduce((acc, d) => acc + d.cost, 0);
  const priorWeekCost = priorWeekDays.reduce((acc, d) => acc + d.cost, 0);

  const thisWeekRows = rows.filter((r) => inThisWeek(r.date));
  if (thisWeekRows.length === 0) {
    return {
      headline: translate(t, 'narrative.weekSummary.noUsageRecent', 'No usage in the past 7 days.'),
      bullets: [],
      suggestion: translate(
        t,
        'narrative.weekSummary.noUsageRecentSuggestion',
        'Import a more recent CSV or check that this dataset is current.',
      ),
      degraded: true,
      windowDays: 0,
    };
  }

  // Top model in the window.
  const costByModel = new Map<string, number>();
  for (const r of thisWeekRows) {
    costByModel.set(r.model, (costByModel.get(r.model) ?? 0) + r.cost);
  }
  const sortedModels = [...costByModel.entries()].sort((a, b) => b[1] - a[1]);
  const topEntry = sortedModels[0]!;
  const topModelName = topEntry[0];
  const topModelShare = thisWeekCost > 0 ? topEntry[1] / thisWeekCost : 0;
  const distinctModels = sortedModels.length;

  // Cache hit ratio (this week vs prior).
  const thisCacheRead = thisWeekRows.reduce((acc, r) => acc + r.tokens.cacheRead, 0);
  const thisInput = thisWeekRows.reduce(
    (acc, r) =>
      acc + r.tokens.inputWithCacheWrite + r.tokens.inputWithoutCacheWrite + r.tokens.cacheRead,
    0,
  );
  const thisHitRatio = thisInput > 0 ? thisCacheRead / thisInput : 0;

  const priorWeekRows = rows.filter((r) => inPriorWeek(r.date));
  const priorCacheRead = priorWeekRows.reduce((acc, r) => acc + r.tokens.cacheRead, 0);
  const priorInput = priorWeekRows.reduce(
    (acc, r) =>
      acc + r.tokens.inputWithCacheWrite + r.tokens.inputWithoutCacheWrite + r.tokens.cacheRead,
    0,
  );
  const priorHitRatio = priorInput > 0 ? priorCacheRead / priorInput : 0;
  const hitRatioDeltaPp = (thisHitRatio - priorHitRatio) * 100;

  // Cost delta vs prior week.
  const costDeltaPct = priorWeekCost > 0 ? (thisWeekCost - priorWeekCost) / priorWeekCost : null;

  // Max-mode share.
  const maxModeRows = thisWeekRows.filter((r) => r.maxMode);
  const maxModeCost = maxModeRows.reduce((acc, r) => acc + r.cost, 0);
  const maxModeShare = thisWeekCost > 0 ? maxModeCost / thisWeekCost : 0;

  // Hottest single day.
  const hottestDay = thisWeekDays.reduce(
    (acc, d) => (d.cost > acc.cost ? d : acc),
    thisWeekDays[0]!,
  );

  // Headline.
  const headlineKey =
    distinctModels === 1
      ? 'narrative.weekSummary.headline.single'
      : 'narrative.weekSummary.headline.multi';
  const headlineFallback =
    distinctModels === 1
      ? '{cost} this week across {models} model · top driver {topModel} ({sharePct}%).'
      : '{cost} this week across {models} models · top driver {topModel} ({sharePct}%).';
  const headline = translate(t, headlineKey, headlineFallback, {
    cost: fmtUSDInline(thisWeekCost),
    models: distinctModels,
    topModel: topModelName,
    sharePct: (topModelShare * 100).toFixed(0),
  });

  // Bullets — pick the 2-4 most interesting.
  const bullets: string[] = [];

  if (costDeltaPct !== null && Math.abs(costDeltaPct) >= 0.1) {
    const dir = costDeltaPct > 0 ? '↗' : '↘';
    bullets.push(
      translate(
        t,
        'narrative.weekSummary.bullet.spendDelta',
        'Spend {dir} {pct}% vs prior 7 days ({prior} → {curr}).',
        {
          dir,
          pct: (Math.abs(costDeltaPct) * 100).toFixed(0),
          prior: fmtUSDInline(priorWeekCost),
          curr: fmtUSDInline(thisWeekCost),
        },
      ),
    );
  }

  if (thisInput > 0 && priorInput > 0 && Math.abs(hitRatioDeltaPp) >= 5) {
    const dir = hitRatioDeltaPp > 0 ? '↗' : '↘';
    bullets.push(
      translate(
        t,
        'narrative.weekSummary.bullet.cacheHitDelta',
        'Cache hit ratio {pct}% {dir} {deltaPp}pp vs prior week.',
        {
          pct: (thisHitRatio * 100).toFixed(0),
          dir,
          deltaPp: Math.abs(hitRatioDeltaPp).toFixed(0),
        },
      ),
    );
  } else if (thisInput > 0) {
    bullets.push(
      translate(
        t,
        'narrative.weekSummary.bullet.cacheHitStable',
        'Cache hit ratio {pct}% (stable).',
        {
          pct: (thisHitRatio * 100).toFixed(0),
        },
      ),
    );
  }

  if (maxModeShare >= 0.1) {
    bullets.push(
      translate(
        t,
        'narrative.weekSummary.bullet.maxMode',
        "Max-mode is {pct}% of this week's spend ({cost}).",
        {
          pct: (maxModeShare * 100).toFixed(0),
          cost: fmtUSDInline(maxModeCost),
        },
      ),
    );
  }

  if (hottestDay && hottestDay.cost > 0) {
    const sharePct = (hottestDay.cost / Math.max(0.0001, thisWeekCost)) * 100;
    if (sharePct >= 30) {
      bullets.push(
        translate(
          t,
          'narrative.weekSummary.bullet.hottestDay',
          '{date} alone was {cost} — {sharePct}% of the week.',
          {
            date: hottestDay.date,
            cost: fmtUSDInline(hottestDay.cost),
            sharePct: sharePct.toFixed(0),
          },
        ),
      );
    }
  }

  // Suggestion — only when something actionable stands out.
  let suggestion: string | null = null;
  if (costDeltaPct !== null && costDeltaPct >= 0.5) {
    suggestion = translate(
      t,
      'narrative.weekSummary.suggestion.spendUp',
      'Spend is up {pct}% — open the Anomalies tab to see what changed.',
      { pct: (costDeltaPct * 100).toFixed(0) },
    );
  } else if (maxModeShare >= 0.4) {
    suggestion = translate(
      t,
      'narrative.weekSummary.suggestion.maxModeHeavy',
      'Max-mode is driving {pct}% of this week — review whether every max request was necessary.',
      { pct: (maxModeShare * 100).toFixed(0) },
    );
  } else if (hitRatioDeltaPp <= -10) {
    suggestion = translate(
      t,
      'narrative.weekSummary.suggestion.cacheDrop',
      'Cache hit ratio dropped {deltaPp}pp — new conversation patterns are bypassing cache.',
      { deltaPp: Math.abs(hitRatioDeltaPp).toFixed(0) },
    );
  } else if (topModelShare >= 0.7 && distinctModels >= 3) {
    suggestion = translate(
      t,
      'narrative.weekSummary.suggestion.topModelDominant',
      '{topModel} dominates {pct}% — check the Models page to see if a cheaper alternative fits.',
      {
        topModel: topModelName,
        pct: (topModelShare * 100).toFixed(0),
      },
    );
  }

  return {
    headline,
    bullets: bullets.slice(0, 4),
    suggestion,
    degraded: false,
    windowDays: thisWeekDays.length,
  };
}

/**
 * Inline USD formatter that picks a sensible precision based on magnitude.
 * Kept local to this file because the `@cu/charts/utils` formatters use
 * fixed precision (good for KPI cards, less good for inline narrative).
 */
function fmtUSDInline(n: number): string {
  if (!Number.isFinite(n)) return '$0';
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  if (Math.abs(n) >= 100) return `$${n.toFixed(0)}`;
  if (Math.abs(n) >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(2)}`;
}
