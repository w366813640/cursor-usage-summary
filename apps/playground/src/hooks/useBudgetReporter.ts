import type { UsageSummary } from '@cu/data';
import { useEffect, useMemo, useRef } from 'react';
import { reportBudget } from '../electron/desktopStorage';
import type { BudgetReportPayload } from '../electron/types';
import { useSettings } from './useSettings';

/**
 * Watches the current-month aggregate + the user's monthly request
 * budget and pushes the snapshot to the main process via
 * `bridge.budget.report` whenever it materially changes. Main process
 * uses this to:
 *
 *   1. Refresh the tray context-menu label (`May 2026: $42.18 · 312 / 500 req (62%)`).
 *   2. Decide whether to fire an OS-level toast at the 80% / 100%
 *      thresholds. Dedup is per-month and persisted, so even though
 *      this hook fires on every render with new data, the user never
 *      gets spammed.
 *
 * Cheap when the snapshot is unchanged — we serialise the payload into
 * a string key and skip the IPC call when nothing differs from the
 * last push.
 */
export interface UseBudgetReporterOptions {
  summary: UsageSummary | null;
  /**
   * Optional override that disables IPC pushes entirely. Used by the
   * web mode (when bridge is absent) to keep the hook callable without
   * crashing — though after PR20 every desktop renderer ships with the
   * bridge so this is mostly defensive.
   */
  enabled?: boolean;
}

export function useBudgetReporter({ summary, enabled = true }: UseBudgetReporterOptions): void {
  const { settings } = useSettings();
  const lastKey = useRef<string | null>(null);

  const payload = useMemo<BudgetReportPayload | null>(() => {
    if (!enabled || !summary) return null;
    const currentMonth = pickCurrentMonth(summary);
    if (!currentMonth) return null;
    const projected = projectMonth(currentMonth, summary.dateRange.lastISO);
    return {
      monthKey: currentMonth.ym,
      monthLabel: currentMonth.label,
      spendUSD: currentMonth.cost,
      requestUnits: currentMonth.requestUnits,
      budgetRequests: settings.monthlyRequestBudget,
      projectedRequests: projected,
    };
  }, [enabled, summary, settings.monthlyRequestBudget]);

  useEffect(() => {
    if (!payload) return;
    const key = stableKey(payload);
    if (lastKey.current === key) return;
    lastKey.current = key;
    void reportBudget(payload).catch(() => {
      // Bridge may be absent (web mode) or the IPC channel may have
      // gone away during a dev-server restart. Either case is harmless
      // — we'll retry on the next material change.
    });
  }, [payload]);
}

interface MonthBucket {
  ym: string;
  label: string;
  cost: number;
  requestUnits: number;
  daysCovered: number;
}

function pickCurrentMonth(summary: UsageSummary): MonthBucket | null {
  const map = new Map<string, { cost: number; requestUnits: number; daysCovered: number }>();
  for (const d of summary.byDay) {
    const ym = d.date.slice(0, 7);
    const prev = map.get(ym) ?? { cost: 0, requestUnits: 0, daysCovered: 0 };
    map.set(ym, {
      cost: prev.cost + d.cost,
      requestUnits: prev.requestUnits + d.requestUnits,
      daysCovered: prev.daysCovered + 1,
    });
  }
  if (map.size === 0) return null;
  const ym = Array.from(map.keys()).sort().pop() as string;
  const agg = map.get(ym) as { cost: number; requestUnits: number; daysCovered: number };
  return {
    ym,
    label: monthLabel(ym),
    cost: agg.cost,
    requestUnits: agg.requestUnits,
    daysCovered: agg.daysCovered,
  };
}

function projectMonth(month: MonthBucket, lastISO: string | null): number | null {
  const parts = month.ym.split('-').map(Number);
  const y = parts[0];
  const m = parts[1];
  if (!Number.isFinite(y) || !Number.isFinite(m)) return null;
  const daysInMonth = new Date(Date.UTC(y as number, m as number, 0)).getUTCDate();
  const probe = lastISO ? new Date(lastISO) : new Date();
  if (Number.isNaN(probe.getTime())) return null;
  const dayOfMonth = Math.max(1, Math.min(daysInMonth, probe.getUTCDate()));
  return (month.requestUnits / dayOfMonth) * daysInMonth;
}

function monthLabel(ym: string): string {
  const parts = ym.split('-').map(Number);
  const y = parts[0];
  const m = parts[1];
  if (!Number.isFinite(y) || !Number.isFinite(m)) return ym;
  const date = new Date(Date.UTC(y as number, (m as number) - 1, 1));
  return date.toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function stableKey(payload: BudgetReportPayload): string {
  return [
    payload.monthKey,
    payload.budgetRequests,
    payload.requestUnits.toFixed(0),
    payload.spendUSD.toFixed(2),
    payload.projectedRequests != null ? payload.projectedRequests.toFixed(0) : 'null',
  ].join('|');
}
