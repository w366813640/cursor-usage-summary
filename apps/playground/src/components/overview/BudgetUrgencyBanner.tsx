import {
  type BudgetSeverity,
  type RowWithCost,
  type UsageSummary,
  computeBudgetUrgency,
} from '@cu/data';
import { AlertTriangle, Clock, Target, X } from '@cu/icons';
import { useT } from '@cu/ui';
import { m } from 'framer-motion';
import { useMemo, useState } from 'react';
import { useEntrance } from '../../hooks/useEntranceOnce';
import { useSettings } from '../../hooks/useSettings';

interface BudgetUrgencyBannerProps {
  summary: UsageSummary;
  // Rows are accepted for parity with the other Overview cards; the
  // current implementation only needs the summary, but keeping the
  // signature future-proof avoids a re-thread later if we want to add
  // hourly burn-rate detail to the message.
  rows?: ReadonlyArray<RowWithCost>;
}

// Severity tones — label is looked up from the dictionary at render
// time (see `severityLabel(...)` below) so it can be translated; the
// CSS colour vars stay here because they're not user-visible text.
const SEVERITY_TONE: Record<
  Exclude<BudgetSeverity, 'safe'>,
  { bg: string; border: string; fg: string }
> = {
  low: {
    bg: 'color-mix(in oklab, var(--color-accent) 6%, transparent)',
    border: 'color-mix(in oklab, var(--color-accent) 35%, var(--color-border))',
    fg: 'var(--color-text)',
  },
  medium: {
    bg: 'color-mix(in oklab, var(--color-accent) 12%, transparent)',
    border: 'color-mix(in oklab, var(--color-accent) 55%, var(--color-border))',
    fg: 'var(--color-accent)',
  },
  high: {
    bg: 'color-mix(in oklab, var(--color-warning, var(--color-accent)) 14%, transparent)',
    border:
      'color-mix(in oklab, var(--color-warning, var(--color-accent)) 65%, var(--color-border))',
    fg: 'var(--color-warning, var(--color-accent))',
  },
};

/**
 * Sticky banner that surfaces budget urgency at the very top of the
 * Overview page. It only renders when severity > 'safe' so the page is
 * silent for well-behaved months.
 *
 * Two dismiss modes:
 *   - Soft dismiss (X button): hides this session only, returns next time
 *     the user reloads the dashboard.
 *   - Implicit dismiss when the user fixes the situation (severity drops
 *     back to 'safe'): banner unmounts naturally.
 *
 * The session-only dismiss key is keyed on the severity + month so the
 * banner re-appears if the situation gets worse (e.g. low → high) or
 * when a new month starts.
 */
export function BudgetUrgencyBanner({ summary }: BudgetUrgencyBannerProps) {
  const { settings } = useSettings();
  const t = useT();
  const entrance = useEntrance();
  const urgency = useMemo(
    () => computeBudgetUrgency(summary, settings.monthlyRequestBudget, { t }),
    [summary, settings.monthlyRequestBudget, t],
  );

  const dismissKey =
    urgency.enabled && urgency.severity !== 'safe'
      ? `cu:budget-banner-dismissed:${urgency.monthStart}:${urgency.severity}`
      : null;
  const [dismissed, setDismissed] = useState(() => {
    if (!dismissKey) return false;
    try {
      return sessionStorage.getItem(dismissKey) === '1';
    } catch {
      return false;
    }
  });

  if (!urgency.enabled || urgency.severity === 'safe' || dismissed) return null;

  const tone = SEVERITY_TONE[urgency.severity];
  const Icon = urgency.severity === 'high' ? AlertTriangle : Target;

  const onDismiss = () => {
    setDismissed(true);
    if (dismissKey) {
      try {
        sessionStorage.setItem(dismissKey, '1');
      } catch {
        // sessionStorage may be unavailable; the in-state dismiss still
        // hides the banner for the rest of the session anyway.
      }
    }
  };

  const usedPct = urgency.budget > 0 ? Math.min(100, (urgency.used / urgency.budget) * 100) : 0;

  return (
    <m.aside
      initial={entrance ? { opacity: 0, y: -8 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.2, 0, 0, 1] }}
      role="alert"
      className="flex items-start gap-3 rounded-[12px] border px-4 py-3"
      style={{ background: tone.bg, borderColor: tone.border, color: tone.fg }}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="flex flex-1 flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] uppercase tracking-[0.1em] opacity-80">
            {t(`budget.banner.severity.${urgency.severity}`)}
          </span>
          <span className="text-[var(--color-text-subtle)] opacity-60" aria-hidden="true">
            ·
          </span>
          <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--color-text-subtle)]">
            {urgency.monthStart.slice(0, 7)}
          </span>
        </div>
        <p className="font-serif text-[14px] leading-snug text-[var(--color-text)]">
          {urgency.message}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-1">
          <Metric
            label={t('budget.banner.usedBudget')}
            value={`${urgency.used.toFixed(0)} / ${urgency.budget}`}
          />
          <Metric
            label={t('budget.banner.rate')}
            value={t('budget.banner.rateValue', { rate: urgency.dailyRate.toFixed(1) })}
          />
          <Metric
            label={t('budget.banner.projected')}
            value={`${urgency.projectedTotal.toFixed(0)} (${(urgency.projectedOverBudgetPct * 100).toFixed(0)}%)`}
          />
          {urgency.exhaustionDay !== null ? (
            <Metric
              label={t('budget.banner.runOut')}
              value={t('budget.banner.runOutValue', { day: urgency.exhaustionDay })}
              icon={<Clock className="h-3 w-3" aria-hidden="true" />}
            />
          ) : null}
        </div>
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-[var(--color-surface-muted)]">
          <div
            className="h-full"
            style={{
              width: `${usedPct}%`,
              background: tone.fg,
              transition: 'width 240ms ease',
            }}
          />
        </div>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t('budget.banner.dismissAria')}
        className="-mr-1 -mt-0.5 ml-2 inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--color-text-subtle)] transition-colors hover:bg-[var(--color-surface-muted)]/40 hover:text-[var(--color-text)]"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </m.aside>
  );
}

function Metric({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
        {label}
      </span>
      <span className="flex items-center gap-1 font-mono text-[12px] tabular-nums text-[var(--color-text)]">
        {icon}
        {value}
      </span>
    </span>
  );
}
