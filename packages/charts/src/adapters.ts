import type { ModelBucket, UsageSummary } from '@cu/data';
import type { HeatmapDatum } from './Heatmap';
import type { SmallMultiplesItem } from './SmallMultiples';
import type { SparkPoint } from './Sparkline';
import type { StackBarSegment } from './StackBar';
import type { TreemapDatum } from './Treemap';
import type { WeekHourCell } from './WeekHourHeatmap';

/** Map UsageSummary.byDay to GitHub-calendar heatmap. */
export function daysToHeatmap(
  summary: Pick<UsageSummary, 'byDay'>,
  metric: 'cost' | 'requests' = 'cost',
): HeatmapDatum[] {
  return summary.byDay.map((d) => ({
    date: d.date,
    value: metric === 'cost' ? d.cost : d.requestUnits,
    meta:
      metric === 'cost'
        ? `${d.requestUnits.toFixed(0)} req · ${d.rows} rows`
        : `$${d.cost.toFixed(2)} · ${d.rows} rows`,
  }));
}

/** Map UsageSummary.hourWeekday to WeekHour heatmap cells. */
export function hourWeekdayToCells(
  summary: Pick<UsageSummary, 'hourWeekday'>,
  metric: 'cost' | 'rows' = 'cost',
): WeekHourCell[] {
  return summary.hourWeekday.map((c) => ({
    weekday: c.weekday,
    hour: c.hour,
    value: metric === 'cost' ? c.cost : c.rows,
    meta: metric === 'cost' ? `${c.rows} rows` : undefined,
  }));
}

/** Reduce daily trends to a single sparkline. */
export function daysToSparkline(
  summary: Pick<UsageSummary, 'byDay'>,
  metric: 'cost' | 'requests' = 'cost',
): SparkPoint[] {
  return summary.byDay.map((d) => ({
    date: d.date,
    value: metric === 'cost' ? d.cost : d.requestUnits,
  }));
}

/**
 * Build small-multiples grid for the top-N models by cost, each with a
 * per-day cost sparkline. We deliberately only show top-N so the grid
 * doesn't get noisy when a CSV has 30+ models.
 */
export function modelsToSmallMultiples(
  rows: ReadonlyArray<{ date: Date; model: string; cost: number }>,
  byModel: ReadonlyArray<ModelBucket>,
  topN = 8,
): SmallMultiplesItem[] {
  const top = byModel.slice(0, topN);
  const items: SmallMultiplesItem[] = [];
  for (const m of top) {
    const trend = new Map<string, number>();
    for (const r of rows) {
      if (r.model !== m.model) continue;
      const ymd = r.date.toISOString().slice(0, 10);
      trend.set(ymd, (trend.get(ymd) ?? 0) + r.cost);
    }
    const series: SparkPoint[] = Array.from(trend.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, value]) => ({ date, value }));
    items.push({
      id: m.model,
      label: m.model,
      total: m.cost,
      trend: series,
      sub: `${m.rows} rows · ${(m.shareOfCost * 100).toFixed(1)}%${
        m.costEstimated ? ' · est' : ''
      }`,
    });
  }
  return items;
}

/** Aggregate token totals into 4 stack-bar segments. */
export function tokensToStackSegments(
  summary: Pick<UsageSummary, 'totalTokens'>,
): StackBarSegment[] {
  const t = summary.totalTokens;
  return [
    {
      id: 'in-no-cache',
      label: 'Input',
      value: t.inputWithoutCacheWrite,
      color: 'var(--cu-cat-1)',
    },
    {
      id: 'in-cache-write',
      label: 'Cache Write',
      value: t.inputWithCacheWrite,
      color: 'var(--cu-cat-2)',
    },
    { id: 'cache-read', label: 'Cache Read', value: t.cacheRead, color: 'var(--cu-cat-3)' },
    { id: 'output', label: 'Output', value: t.output, color: 'var(--cu-cat-4)' },
  ];
}

/** Aggregate cost-by-provider into stack-bar segments. */
export function providersToStackSegments(
  summary: Pick<UsageSummary, 'byProvider'>,
): StackBarSegment[] {
  const palette: Record<string, string> = {
    Anthropic: 'var(--cu-cat-1)',
    OpenAI: 'var(--cu-cat-2)',
    Cursor: 'var(--cu-cat-3)',
    Google: 'var(--cu-cat-4)',
    xAI: 'var(--cu-cat-5)',
  };
  return summary.byProvider.map((p) => ({
    id: p.provider,
    label: p.provider,
    value: p.cost,
    color: palette[p.provider] ?? 'var(--cu-cat-6)',
  }));
}

export interface ModelsToTreemapOptions {
  /**
   * Models whose cost is below this fraction of the total are aggregated
   * into a single "Other (N models)" leaf. Default 0.01 (1%). Set to 0 to
   * disable aggregation — every model gets its own tile even if it's a
   * 0.01% sliver.
   */
  otherThresholdPct?: number;
}

function groupOfModel(model: string): string {
  const ml = model.toLowerCase();
  if (ml.startsWith('claude')) return 'anthropic';
  if (ml.startsWith('gpt') || ml.startsWith('o1') || ml.startsWith('o3') || ml.startsWith('o4')) {
    return 'openai';
  }
  if (ml.startsWith('composer') || ml === 'auto' || ml.startsWith('code-supernova')) {
    return 'cursor';
  }
  if (ml.startsWith('gemini')) return 'google';
  if (ml.startsWith('grok')) return 'xai';
  return 'other';
}

const TREEMAP_GROUP_PALETTE: Record<string, string> = {
  anthropic: 'var(--cu-cat-1)',
  openai: 'var(--cu-cat-2)',
  cursor: 'var(--cu-cat-3)',
  google: 'var(--cu-cat-4)',
  xai: 'var(--cu-cat-5)',
  other: 'var(--cu-cat-6)',
};

/** Map model buckets to treemap leaves (one rect per model, sized by cost). */
export function modelsToTreemap(
  byModel: ReadonlyArray<ModelBucket>,
  options: ModelsToTreemapOptions = {},
): TreemapDatum[] {
  const { otherThresholdPct = 0.01 } = options;
  const positives = byModel.filter((m) => m.cost > 0);
  const totalCost = positives.reduce((acc, m) => acc + m.cost, 0);
  const threshold = otherThresholdPct > 0 ? otherThresholdPct * totalCost : 0;

  const headliners: TreemapDatum[] = [];
  const tail: ModelBucket[] = [];

  for (const m of positives) {
    if (threshold > 0 && m.cost < threshold) {
      tail.push(m);
      continue;
    }
    const group = groupOfModel(m.model);
    headliners.push({
      id: m.model,
      label: m.model,
      value: m.cost,
      group,
      color: TREEMAP_GROUP_PALETTE[group],
    });
  }

  if (tail.length > 0) {
    const sum = tail.reduce((acc, m) => acc + m.cost, 0);
    headliners.push({
      id: '__other__',
      label: `Other · ${tail.length} models`,
      value: sum,
      group: 'other',
      color: TREEMAP_GROUP_PALETTE.other,
    });
  }

  return headliners;
}
