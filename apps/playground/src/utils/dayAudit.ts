import type { RowWithCost } from '@cu/data';

/**
 * Pure computation helpers backing the Day audit "answer hero" and
 * the day-over-day comparison strip. Lives outside the component so
 * the unit tests can drive every branch without React in the loop.
 *
 * All inputs are read-only; the helpers never mutate row arrays.
 */

export interface DayAnswer {
  /** YYYY-MM-DD of the day under audit (in UTC). */
  date: string;
  /** Friendly label, e.g. "Today (2026-05-23)" or "2026-05-21". */
  dateLabel: string;
  /** Total USD spent on this day. */
  totalCost: number;
  /** Total request rows on this day. */
  totalRows: number;
  /** Total cost across the surrounding week (target ± 3 days). */
  weekCost: number;
  /** `totalCost / weekCost`, clamped to [0,1]. NaN-safe -> 0. */
  shareOfWeek: number;
  /** The single most expensive request that landed on the day. */
  biggest: RowWithCost | null;
  /** True if `date` matches "today" in the user's UTC clock. */
  isToday: boolean;
  /**
   * Top model by spend on this day — duplicates the calc that drives
   * the narrative paragraph below so callers can render a tiny inline
   * chip without re-running the reduce.
   */
  topModel: { model: string; cost: number; share: number } | null;
  /** Peak hour (0-23) on this day; null if the day had zero rows. */
  peakHour: number | null;
}

/**
 * Build the "today's answer" payload from the full row set + a target
 * date string (`YYYY-MM-DD`). Cheap (~O(rows)); safe to call on every
 * render without memoization for sub-1000 row days.
 */
export function buildDayAnswer(allRows: ReadonlyArray<RowWithCost>, targetDate: string): DayAnswer {
  const dayRows = allRows.filter((r) => r.dateISO.slice(0, 10) === targetDate);
  const totalCost = dayRows.reduce((acc, r) => acc + r.cost, 0);
  const totalRows = dayRows.length;
  const biggest = dayRows.reduce<RowWithCost | null>((best, r) => {
    if (!best) return r;
    return r.cost > best.cost ? r : best;
  }, null);

  const target = parseISODate(targetDate);
  const weekStart = addDays(target, -3);
  const weekEnd = addDays(target, 3);
  let weekCost = 0;
  for (const r of allRows) {
    const ymd = r.dateISO.slice(0, 10);
    const d = parseISODate(ymd);
    if (d.getTime() >= weekStart.getTime() && d.getTime() <= weekEnd.getTime()) {
      weekCost += r.cost;
    }
  }
  const shareOfWeek = weekCost > 0 ? Math.min(1, totalCost / weekCost) : 0;

  // Top model + peak hour
  const modelMap = new Map<string, number>();
  const hourMap = new Map<number, number>();
  for (const r of dayRows) {
    modelMap.set(r.model, (modelMap.get(r.model) ?? 0) + r.cost);
    hourMap.set(r.date.getUTCHours(), (hourMap.get(r.date.getUTCHours()) ?? 0) + r.cost);
  }
  let topModel: { model: string; cost: number; share: number } | null = null;
  for (const [model, cost] of modelMap.entries()) {
    if (!topModel || cost > topModel.cost) {
      topModel = { model, cost, share: totalCost > 0 ? cost / totalCost : 0 };
    }
  }
  let peakHour: number | null = null;
  let peakHourCost = -1;
  for (const [hour, cost] of hourMap.entries()) {
    if (cost > peakHourCost) {
      peakHourCost = cost;
      peakHour = hour;
    }
  }

  const today = todayISO();
  return {
    date: targetDate,
    dateLabel: targetDate === today ? `Today (${targetDate})` : targetDate,
    totalCost,
    totalRows,
    weekCost,
    shareOfWeek,
    biggest,
    isToday: targetDate === today,
    topModel,
    peakHour,
  };
}

export interface DayComparison {
  /** Cost on the target day. */
  target: number;
  /** Cost on the comparison day (could be 0 / no data). */
  reference: number;
  /** `(target - reference) / reference`. Infinity when reference = 0. */
  pctDelta: number;
  /** Label like "yesterday (2026-05-22)" or "last Fri (2026-05-16)". */
  referenceLabel: string;
  /** Whether the comparison day exists in the dataset at all. */
  hasReferenceData: boolean;
}

/**
 * Compute the two comparison cards: today vs yesterday and today vs
 * the same weekday a week ago. Each entry handles the no-data case
 * (`hasReferenceData = false`) so the UI can render "no baseline" copy
 * without a separate branch.
 */
export function buildDayComparisons(
  allRows: ReadonlyArray<RowWithCost>,
  targetDate: string,
): { yesterday: DayComparison; sameWeekday: DayComparison } {
  const targetDateObj = parseISODate(targetDate);
  const yesterdayDate = formatISO(addDays(targetDateObj, -1));
  const sameWeekdayDate = formatISO(addDays(targetDateObj, -7));

  const targetCost = sumCost(allRows, targetDate);
  const yesterdayCost = sumCost(allRows, yesterdayDate);
  const sameWeekdayCost = sumCost(allRows, sameWeekdayDate);

  const yesterdayHasData = hasDataOn(allRows, yesterdayDate);
  const sameWeekdayHasData = hasDataOn(allRows, sameWeekdayDate);

  return {
    yesterday: {
      target: targetCost,
      reference: yesterdayCost,
      pctDelta: pctDelta(targetCost, yesterdayCost),
      referenceLabel: `yesterday (${yesterdayDate})`,
      hasReferenceData: yesterdayHasData,
    },
    sameWeekday: {
      target: targetCost,
      reference: sameWeekdayCost,
      pctDelta: pctDelta(targetCost, sameWeekdayCost),
      referenceLabel: `${WEEKDAYS[targetDateObj.getUTCDay()]} a week ago (${sameWeekdayDate})`,
      hasReferenceData: sameWeekdayHasData,
    },
  };
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/**
 * Compose the narrative paragraph shown under the answer hero. Pure
 * text — never goes through an LLM. Sentences are kept short so the
 * eye can read them inside a single beat.
 */
export function composeDayNarrative(answer: DayAnswer, comparison: DayComparison): string {
  if (answer.totalRows === 0) {
    return `No requests landed on ${answer.date}. Pick another date with the filter to start your audit.`;
  }

  const parts: string[] = [];
  const costTxt = formatUSD(answer.totalCost);
  const rowsTxt = `${answer.totalRows.toLocaleString()} request${answer.totalRows === 1 ? '' : 's'}`;
  parts.push(`Spent ${costTxt} across ${rowsTxt}.`);

  if (answer.topModel && answer.topModel.share >= 0.15) {
    const sharePct = Math.round(answer.topModel.share * 100);
    parts.push(
      `Top driver: ${answer.topModel.model} (${formatUSD(answer.topModel.cost)}, ${sharePct}% of the day).`,
    );
  }

  if (answer.biggest && answer.biggest.cost > 0) {
    const t = answer.biggest.date.toISOString().slice(11, 16);
    parts.push(
      `Single biggest: ${formatUSD(answer.biggest.cost)} at ${t} on ${answer.biggest.model}.`,
    );
  }

  if (answer.peakHour !== null && answer.totalRows >= 3) {
    parts.push(`Peak hour was ${String(answer.peakHour).padStart(2, '0')}:00 UTC.`);
  }

  if (comparison.hasReferenceData && comparison.reference > 0) {
    const delta = comparison.pctDelta;
    if (!Number.isFinite(delta)) {
      // skipped — the next sentence already covers the "no baseline" case
    } else if (Math.abs(delta) < 0.05) {
      parts.push('Roughly flat vs yesterday — no surprise jump.');
    } else if (delta > 0) {
      parts.push(`Up ${(delta * 100).toFixed(0)}% vs yesterday — worth a closer look.`);
    } else {
      parts.push(`Down ${Math.abs(delta * 100).toFixed(0)}% vs yesterday.`);
    }
  }

  return parts.join(' ');
}

function sumCost(rows: ReadonlyArray<RowWithCost>, date: string): number {
  let total = 0;
  for (const r of rows) {
    if (r.dateISO.slice(0, 10) === date) total += r.cost;
  }
  return total;
}

function hasDataOn(rows: ReadonlyArray<RowWithCost>, date: string): boolean {
  for (const r of rows) {
    if (r.dateISO.slice(0, 10) === date) return true;
  }
  return false;
}

function pctDelta(target: number, reference: number): number {
  if (reference === 0) return target === 0 ? 0 : Number.POSITIVE_INFINITY;
  return (target - reference) / reference;
}

function parseISODate(d: string): Date {
  // ISO date strings without a Z suffix are interpreted as local on
  // some engines; force UTC midnight so addDays is timezone-stable.
  return new Date(`${d}T00:00:00Z`);
}

function formatISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d.getTime());
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatUSD(value: number): string {
  const sign = value < 0 ? '-' : '';
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}
