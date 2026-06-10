import type { UsageSummary, WeekSummary } from '@cu/data';
import { useT } from '@cu/ui';
import { motion } from 'framer-motion';
import { useEntrance } from '../../hooks/useEntranceOnce';
import { TrustHint } from '../TrustHint';

interface WeekSummaryCardProps {
  summary: UsageSummary;
  /** Precomputed by useOverviewInsights — shared with the rest of Overview. */
  week: WeekSummary;
}

/**
 * "This week in a sentence" auto-narrative card.
 *
 * Sits at the very top of the Overview, above the KPI hero — answers the
 * user's first question when they open the dashboard: "anything I should
 * know before I dive in?". Pure local computation, no LLM call.
 *
 * Layout:
 *
 *   ▓ This week                                            7 days
 *   ──────────────────────────────────────────────────────────────
 *   $123.45 this week across 3 models · top driver claude-opus (54%).
 *
 *   • Spend ↗ 32% vs prior 7 days ($94 → $123)
 *   • Cache hit ratio 71% ↘ 8pp vs prior week
 *   • Max-mode is 22% of this week's spend ($27)
 *
 *   ⚑  Spend is up 32% — open the Anomalies tab to see what changed.
 */
export function WeekSummaryCard({ summary, week }: WeekSummaryCardProps) {
  const t = useT();
  const entrance = useEntrance();

  return (
    <motion.section
      initial={entrance ? { opacity: 0, y: 6 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38, ease: [0.2, 0, 0, 1] }}
      aria-label={t('overview.week.aria')}
      className={[
        'group relative overflow-hidden border border-[var(--color-border)]',
        'bg-[var(--color-surface)]',
        'shadow-[inset_0_1px_0_color-mix(in_oklab,var(--color-text)_3%,transparent)]',
      ].join(' ')}
      style={{
        borderRadius: 'var(--cu-density-panel-radius)',
        padding: 'var(--cu-density-panel-padding)',
      }}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-3 top-0 h-px"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, color-mix(in oklab, var(--color-accent) 65%, transparent) 50%, transparent 100%)',
        }}
      />
      <header className="flex items-baseline justify-between gap-2 pb-3">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="inline-block size-1.5 rounded-full"
            style={{
              background: 'var(--color-accent)',
              boxShadow: '0 0 0 3px color-mix(in oklab, var(--color-accent) 22%, transparent)',
            }}
          />
          <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
            {t('overview.week.label')}
          </span>
        </div>
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
          {week.degraded
            ? t('overview.week.noHistory')
            : t(
                week.windowDays === 1
                  ? 'overview.week.daysOfDataSingular'
                  : 'overview.week.daysOfDataPlural',
                { n: week.windowDays },
              )}
        </span>
      </header>

      <p
        className="font-serif text-[22px] leading-[1.4] tracking-[-0.005em] text-[var(--color-text)]"
        // Tabular nums on the $ figure keeps the dollar amount aligned even
        // when the headline re-renders mid-animation.
        style={{ fontFeatureSettings: '"tnum" 1' }}
      >
        {week.headline}
        <TrustHint partiallyEstimated={summary.costPartiallyEstimated} />
      </p>

      {week.bullets.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-2 font-mono text-[12px] leading-relaxed text-[var(--color-text-muted)]">
          {week.bullets.map((b, i) => (
            <li
              // Bullets are a stable ordered list — the index is the identifier.
              // biome-ignore lint/suspicious/noArrayIndexKey: bullets are positional
              key={`week-summary-bullet-${i}`}
              className="flex items-start gap-2"
            >
              <span aria-hidden="true" className="pt-1.5 text-[var(--color-text-subtle)]">
                ·
              </span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {week.suggestion ? (
        <div
          className="mt-4 flex items-start gap-2 rounded-md border px-3 py-2 font-mono text-[12px]"
          style={{
            borderColor: 'color-mix(in oklab, var(--color-accent) 35%, transparent)',
            background: 'color-mix(in oklab, var(--color-accent) 7%, transparent)',
            color: 'var(--color-text)',
          }}
        >
          <span aria-hidden="true" style={{ color: 'var(--color-accent)' }}>
            ⚑
          </span>
          <span>{week.suggestion}</span>
        </div>
      ) : null}
    </motion.section>
  );
}
