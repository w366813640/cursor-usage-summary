import { fmtUSD } from '@cu/charts';
import {
  type ActionInsight,
  type RowWithCost,
  type UsageSummary,
  computeActionInsights,
} from '@cu/data';
import { AlertTriangle, Database, Flame, Lightbulb, Target, TrendingUp } from '@cu/icons';
import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { useSettings } from '../../hooks/useSettings';
import { Panel } from '../Panel';

interface ActionFeedProps {
  summary: UsageSummary;
  rows: ReadonlyArray<RowWithCost>;
}

/**
 * Overview first-read: deterministic local recommendations ranked by urgency,
 * confidence, and estimated savings. This is the "what should I do next?"
 * layer over the existing charts.
 */
export function ActionFeed({ summary, rows }: ActionFeedProps) {
  const { settings } = useSettings();
  const insights = useMemo(
    () =>
      computeActionInsights(summary, rows, {
        monthlyRequestBudget: settings.monthlyRequestBudget,
        maxItems: 4,
      }),
    [summary, rows, settings.monthlyRequestBudget],
  );

  const primary = insights[0] ?? null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.36, ease: [0.2, 0, 0, 1] }}
    >
      <Panel
        title="Action feed"
        subtitle="What changed, why it matters, and what to do first"
        action={
          <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
            local rules · no network
          </span>
        }
      >
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.1fr_1fr]">
          {primary ? <PrimaryInsight insight={primary} /> : null}
          <div className="flex flex-col gap-2">
            {insights.slice(primary ? 1 : 0).map((insight) => (
              <CompactInsight key={insight.id} insight={insight} />
            ))}
          </div>
        </div>
      </Panel>
    </motion.section>
  );
}

function PrimaryInsight({ insight }: { insight: ActionInsight }) {
  const Icon = iconFor(insight);
  return (
    <div
      className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-4"
      style={{ boxShadow: `inset 3px 0 0 0 ${toneFor(insight)}` }}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4" aria-hidden="true" style={{ color: toneFor(insight) }} />
          <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--color-text-subtle)]">
            do this first
          </span>
        </div>
        <MetaPill insight={insight} />
      </div>
      <h3 className="font-serif text-[20px] leading-tight tracking-tight">{insight.title}</h3>
      <p className="mt-2 font-mono text-[12px] leading-relaxed text-[var(--color-text-muted)]">
        {insight.detail}
      </p>
      <div className="mt-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
        <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--color-text-subtle)]">
          Next action
        </div>
        <div className="mt-1 text-[13px] text-[var(--color-text)]">{insight.action}</div>
      </div>
    </div>
  );
}

function CompactInsight({ insight }: { insight: ActionInsight }) {
  const Icon = iconFor(insight);
  return (
    <div className="flex items-start gap-3 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] p-3.5">
      <Icon
        className="mt-0.5 h-4 w-4 shrink-0"
        aria-hidden="true"
        style={{ color: toneFor(insight) }}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-serif text-[15px] leading-tight">{insight.title}</span>
          <MetaPill insight={insight} compact />
        </div>
        <p className="mt-1.5 font-mono text-[12px] leading-relaxed text-[var(--color-text-subtle)]">
          {insight.action}
        </p>
      </div>
    </div>
  );
}

function MetaPill({ insight, compact = false }: { insight: ActionInsight; compact?: boolean }) {
  const savings = insight.estimatedSavings && insight.estimatedSavings > 0;
  return (
    <span className="inline-flex items-center gap-1 rounded-sm border border-[var(--color-border)] px-1.5 py-[1px] font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
      <span>{insight.priority}</span>
      {!compact ? <span>· {insight.confidence} confidence</span> : null}
      {savings ? <span>· save {fmtUSD(insight.estimatedSavings ?? 0)}</span> : null}
    </span>
  );
}

function iconFor(insight: ActionInsight) {
  switch (insight.kind) {
    case 'budget-risk':
      return Target;
    case 'forecast-trend':
      return TrendingUp;
    case 'anomaly':
      return AlertTriangle;
    case 'cache-health':
      return Database;
    case 'top-burn':
      return Flame;
    default:
      return Lightbulb;
  }
}

function toneFor(insight: ActionInsight): string {
  if (insight.priority === 'high') return 'var(--color-accent)';
  if (insight.priority === 'medium') return 'var(--color-warning)';
  return 'var(--color-text-subtle)';
}
