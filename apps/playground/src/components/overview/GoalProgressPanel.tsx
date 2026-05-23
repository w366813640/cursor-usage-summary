import type { UsageSummary } from '@cu/data';
import { CheckCircle2, CircleDot } from '@cu/icons';
import type { UserSettings } from '../../electron/types';
import { Panel } from '../Panel';

interface GoalProgressPanelProps {
  summary: UsageSummary;
  settings: UserSettings;
}

export function GoalProgressPanel({ summary, settings }: GoalProgressPanelProps) {
  const target = settings.personalGoals.monthlyRequestTarget ?? settings.monthlyRequestBudget;
  const current = currentMonthRequests(summary);
  const ratio = target > 0 ? current / target : 0;
  const focus = describeHabitFocus(settings.personalGoals.habitFocus);

  return (
    <Panel
      title="Personal goal"
      subtitle={`${Math.round(target).toLocaleString()} request target · ${focus.label}`}
      action={
        ratio <= 0.8 ? (
          <CheckCircle2 size={14} className="text-[var(--color-success)]" aria-hidden="true" />
        ) : (
          <CircleDot size={14} className="text-[var(--color-warning)]" aria-hidden="true" />
        )
      }
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1.4fr]">
        <div className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3">
          <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
            This month
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-serif text-[30px] tracking-tight">
              {Math.round(current).toLocaleString()}
            </span>
            <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
              / {Math.round(target).toLocaleString()} req
            </span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--color-border)]/70">
            <div
              className="h-full rounded-full bg-[var(--color-accent)]"
              style={{ width: `${Math.min(100, ratio * 100)}%` }}
            />
          </div>
        </div>
        <div className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3">
          <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
            Habit focus
          </div>
          <p className="mt-2 font-serif text-[18px] tracking-tight text-[var(--color-text)]">
            {focus.label}
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-[var(--color-text-muted)]">
            {focus.detail}
          </p>
        </div>
      </div>
    </Panel>
  );
}

function currentMonthRequests(summary: UsageSummary): number {
  const last = summary.dateRange.lastISO;
  if (!last) return 0;
  const monthKey = last.slice(0, 7);
  return summary.byDay
    .filter((d) => d.date.startsWith(monthKey))
    .reduce((acc, d) => acc + d.requestUnits, 0);
}

function describeHabitFocus(focus: UserSettings['personalGoals']['habitFocus']) {
  switch (focus) {
    case 'cache':
      return {
        label: 'Improve cache reuse',
        detail:
          'Prioritize stable context and fewer prompt rewrites before repeating similar work.',
      };
    case 'top-burn':
      return {
        label: 'Trim top-burn runs',
        detail:
          'Review expensive long-context or max-mode runs before repeating the same workflow.',
      };
    case 'volume':
      return {
        label: 'Reduce request volume',
        detail:
          'Batch exploratory iterations into fewer checkpoints and reserve requests for decisions.',
      };
    default:
      return {
        label: 'No habit selected',
        detail: 'Choose a focus in Settings to make the coach more specific to your current goal.',
      };
  }
}
