/**
 * Pure logic for deciding *whether* to fire a budget-cross notification.
 * Kept Electron-free so it stays trivially testable in vitest.
 *
 * Behaviour:
 *
 *   - Two thresholds: 80% (heads-up) and 100% (over-budget).
 *   - At most one notification per (month, threshold) pair, so the user
 *     gets a max of two toasts per month even if the renderer pings us
 *     every few seconds.
 *   - `state.thresholdsHit` is keyed by `YYYY-MM`. Older months are
 *     trimmed by `prune()` so the on-disk file stays small.
 *   - `budget <= 0` disables notifications entirely (renderer setting
 *     the cap to 0 means "I don't want a budget enforced").
 *
 * The renderer drives this via `bridge.budget.report({...})`. The main
 * process passes the report through `decideBudgetNotification`, fires
 * the toast if asked, and records the hit so we don't repeat.
 */

export interface BudgetReport {
  /** YYYY-MM, e.g. "2026-05". */
  monthKey: string;
  /** Human-friendly month label, e.g. "May 2026". */
  monthLabel: string;
  /** Total $ spent this month so far. */
  spendUSD: number;
  /** Request units consumed this month so far. */
  requestUnits: number;
  /** Budget cap in request units. */
  budgetRequests: number;
  /** Linear projection for end-of-month, or null when not enough data. */
  projectedRequests: number | null;
}

export interface BudgetNotifierState {
  /** Per-month set of thresholds (0.8 / 1.0) already notified. */
  thresholdsHit: Record<string, number[]>;
}

export interface NotificationPayload {
  title: string;
  body: string;
  /** Threshold that was crossed (0.8 / 1.0). Used to record state. */
  threshold: number;
  /** The month-key the hit belongs to. */
  monthKey: string;
  /** True when crossing 1.0 — UI may want to highlight urgent. */
  urgent: boolean;
}

const THRESHOLDS = [1.0, 0.8] as const;

export function makeInitialState(): BudgetNotifierState {
  return { thresholdsHit: {} };
}

/**
 * Decide whether the given report should fire a notification.
 * Pure — does not mutate `state`. Returns `null` when there is nothing
 * new to notify about.
 */
export function decideBudgetNotification(
  state: BudgetNotifierState,
  report: BudgetReport,
): NotificationPayload | null {
  if (report.budgetRequests <= 0) return null;
  if (report.requestUnits <= 0) return null;

  const ratio = report.requestUnits / report.budgetRequests;
  const hit = new Set(state.thresholdsHit[report.monthKey] ?? []);

  for (const t of THRESHOLDS) {
    if (ratio >= t && !hit.has(t)) {
      const pct = Math.round(ratio * 100);
      const urgent = t >= 1.0;
      const title = urgent
        ? `Over budget · ${pct}% of ${report.budgetRequests.toLocaleString()} req`
        : `Approaching budget · ${pct}% used`;
      const used = Math.round(report.requestUnits).toLocaleString();
      const cap = report.budgetRequests.toLocaleString();
      const proj =
        report.projectedRequests != null
          ? ` Projected EOM: ${Math.round(report.projectedRequests).toLocaleString()} req.`
          : '';
      const body = urgent
        ? `${report.monthLabel} · ${used} of ${cap} req used ($${report.spendUSD.toFixed(2)}).${proj}`
        : `${report.monthLabel} · ${used} of ${cap} req used so far ($${report.spendUSD.toFixed(2)}).${proj}`;
      return { title, body, threshold: t, monthKey: report.monthKey, urgent };
    }
  }
  return null;
}

/**
 * Record that a notification was shown. Returns a new state object —
 * we keep this immutable so the caller can decide whether to persist.
 */
export function recordNotification(
  state: BudgetNotifierState,
  monthKey: string,
  threshold: number,
): BudgetNotifierState {
  const next = { ...state.thresholdsHit };
  const existing = new Set(next[monthKey] ?? []);
  existing.add(threshold);
  next[monthKey] = Array.from(existing).sort((a, b) => a - b);
  return { thresholdsHit: next };
}

/**
 * Trim entries older than `keepMonths` so the persisted JSON doesn't
 * grow forever. Default keeps the current month + the previous one;
 * everything else is dropped. Returns a new state object.
 */
export function prune(
  state: BudgetNotifierState,
  nowMonthKey: string,
  keepMonths = 2,
): BudgetNotifierState {
  const cutoff = computeCutoff(nowMonthKey, keepMonths);
  const next: Record<string, number[]> = {};
  for (const [key, vals] of Object.entries(state.thresholdsHit)) {
    if (key >= cutoff) next[key] = vals;
  }
  return { thresholdsHit: next };
}

function computeCutoff(nowMonthKey: string, keepMonths: number): string {
  const parts = nowMonthKey.split('-');
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return nowMonthKey;
  let y = year;
  let m = month - (keepMonths - 1);
  while (m <= 0) {
    m += 12;
    y -= 1;
  }
  return `${y.toString().padStart(4, '0')}-${m.toString().padStart(2, '0')}`;
}
