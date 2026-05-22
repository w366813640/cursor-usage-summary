import { fmtUSD } from '@cu/charts';
import {
  type EfficiencyRecommendation,
  type RowWithCost,
  type UsageSummary,
  computeEfficiency,
} from '@cu/data';
import { Layers, Lightbulb, Sparkles, ThermometerSun, TrendingDown } from '@cu/icons';
import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { Panel } from '../Panel';

interface EfficiencyCardProps {
  summary: UsageSummary;
  rows: ReadonlyArray<RowWithCost>;
}

/**
 * "Where can I trim?" surface on the Overview page.
 *
 * Three stats up top — actual $/req, savings under cheapest-mix scenario,
 * savings under no-max-mode scenario — then a ranked list of plain English
 * recommendations from {@link computeEfficiency}. Each rec carries a
 * priority pill so heavy hitters (>= $20 estimated savings) read first.
 */
export function EfficiencyCard({ summary, rows }: EfficiencyCardProps) {
  const report = useMemo(() => computeEfficiency(summary, rows), [summary, rows]);

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.42, delay: 0.18, ease: [0.2, 0, 0, 1] }}
    >
      <Panel
        title="Efficiency"
        subtitle="Where can I trim?"
        action={
          <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
            <ThermometerSun className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{report.byModel.length} models scanned</span>
          </span>
        }
      >
        <div className="flex flex-col gap-4">
          <StatRow report={report} />
          <RecommendationList recommendations={report.recommendations} />
        </div>
      </Panel>
    </motion.section>
  );
}

function StatRow({ report }: { report: ReturnType<typeof computeEfficiency> }) {
  const cheapestSavings = report.scenarios.cheapestMix.savings;
  const noMaxSavings = report.scenarios.noMaxMode.savings;
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <ScenarioStat
        label="Your cost/req"
        value={fmtUSD(report.actualCostPerReq)}
        sub={
          report.cheapest
            ? `cheapest model: ${shortName(report.cheapest.model)} @ ${fmtUSD(report.cheapest.costPerReq)}/req`
            : 'not enough data yet'
        }
      />
      <ScenarioStat
        label="Cheapest-mix savings"
        value={cheapestSavings > 0 ? `${fmtUSD(cheapestSavings)}` : '—'}
        sub={
          cheapestSavings > 0
            ? `${(report.scenarios.cheapestMix.savingsPct * 100).toFixed(0)}% off current cost`
            : 'already at the cheap end'
        }
        highlight={cheapestSavings > 0}
      />
      <ScenarioStat
        label="No-max-mode savings"
        value={noMaxSavings > 0 ? `${fmtUSD(noMaxSavings)}` : '—'}
        sub={
          noMaxSavings > 0
            ? `${(report.scenarios.noMaxMode.savingsPct * 100).toFixed(0)}% off current cost`
            : 'max-mode is off'
        }
        highlight={noMaxSavings > 0}
      />
    </div>
  );
}

function ScenarioStat({
  label,
  value,
  sub,
  highlight = false,
}: {
  label: string;
  value: string;
  sub: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface-muted)]/30 p-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
        {label}
      </div>
      <div
        className="font-mono text-[20px] tabular-nums"
        style={{ color: highlight ? 'var(--color-accent)' : 'var(--color-text)' }}
      >
        {value}
      </div>
      <div className="text-[11px] text-[var(--color-text-subtle)] leading-snug">{sub}</div>
    </div>
  );
}

function RecommendationList({
  recommendations,
}: {
  recommendations: EfficiencyRecommendation[];
}) {
  if (recommendations.length === 0) return null;
  return (
    <ul className="flex flex-col gap-2">
      {recommendations.map((rec) => (
        <RecCard key={`${rec.kind}-${rec.title}`} rec={rec} />
      ))}
    </ul>
  );
}

function RecCard({ rec }: { rec: EfficiencyRecommendation }) {
  const Icon =
    rec.kind === 'switch-model'
      ? Layers
      : rec.kind === 'drop-maxmode'
        ? TrendingDown
        : rec.kind === 'good-news'
          ? Sparkles
          : Lightbulb;
  const tone =
    rec.priority === 'high'
      ? 'var(--color-accent)'
      : rec.priority === 'medium'
        ? 'var(--color-text)'
        : 'var(--color-text-subtle)';
  return (
    <li
      className="flex items-start gap-3 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 transition-colors hover:border-[var(--color-border-strong)]"
      style={{ boxShadow: `inset 3px 0 0 0 ${tone}` }}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" style={{ color: tone }} />
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="font-serif text-[14px] leading-snug">{rec.title}</span>
          {rec.priority !== 'low' && rec.kind !== 'good-news' ? (
            <span
              className="inline-flex items-center rounded-sm border border-[var(--color-border)] px-1.5 py-[1px] font-mono text-[9px] uppercase tracking-[0.1em]"
              style={{
                background:
                  rec.priority === 'high' ? 'var(--color-accent)' : 'var(--color-surface)',
                color: rec.priority === 'high' ? 'var(--color-accent-text)' : 'var(--color-text)',
              }}
            >
              {rec.priority}
            </span>
          ) : null}
        </div>
        <p className="font-mono text-[12px] text-[var(--color-text-subtle)] leading-relaxed">
          {rec.detail}
        </p>
      </div>
    </li>
  );
}

function shortName(model: string): string {
  return model.replace(/^claude-/, '').slice(0, 36);
}
