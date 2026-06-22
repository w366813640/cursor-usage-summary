import { fmtUSD } from '@cu/charts';
import type { EfficiencyRecommendation, EfficiencyReport } from '@cu/data';
import { Layers, Lightbulb, Sparkles, ThermometerSun, TrendingDown } from '@cu/icons';
import { useT } from '@cu/ui';
import { m } from 'framer-motion';
import { useEntrance } from '../../hooks/useEntranceOnce';
import { Panel } from '../Panel';

interface EfficiencyCardProps {
  /** Precomputed by useOverviewInsights — shared with the rest of Overview. */
  report: EfficiencyReport;
}

/**
 * "Where can I trim?" surface on the Overview page.
 *
 * Three stats up top — actual $/req, savings under cheapest-mix scenario,
 * savings under no-max-mode scenario — then a ranked list of plain English
 * recommendations from {@link computeEfficiency}. Each rec carries a
 * priority pill so heavy hitters (>= $20 estimated savings) read first.
 */
export function EfficiencyCard({ report }: EfficiencyCardProps) {
  const t = useT();
  const entrance = useEntrance();

  return (
    <m.section
      initial={entrance ? { opacity: 0, y: 8 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.42, delay: 0.18, ease: [0.2, 0, 0, 1] }}
    >
      <Panel
        title={t('overview.efficiency.title')}
        subtitle={t('overview.efficiency.subtitle')}
        action={
          <span className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
            <ThermometerSun className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{t('overview.efficiency.modelsScanned', { n: report.byModel.length })}</span>
          </span>
        }
      >
        <div className="flex flex-col gap-4">
          <StatRow report={report} />
          <RecommendationList recommendations={report.recommendations} />
        </div>
      </Panel>
    </m.section>
  );
}

function StatRow({ report }: { report: EfficiencyReport }) {
  const t = useT();
  const cheapestSavings = report.scenarios.cheapestMix.savings;
  const noMaxSavings = report.scenarios.noMaxMode.savings;
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <ScenarioStat
        label={t('overview.efficiency.yourCostPerReq')}
        value={fmtUSD(report.actualCostPerReq)}
        sub={
          report.cheapest
            ? t('overview.efficiency.cheapestModel', {
                model: shortName(report.cheapest.model),
                cost: fmtUSD(report.cheapest.costPerReq),
              })
            : t('overview.efficiency.notEnoughData')
        }
      />
      <ScenarioStat
        label={t('overview.efficiency.cheapestSavings')}
        value={cheapestSavings > 0 ? `${fmtUSD(cheapestSavings)}` : '—'}
        sub={
          cheapestSavings > 0
            ? t('overview.efficiency.pctOff', {
                pct: (report.scenarios.cheapestMix.savingsPct * 100).toFixed(0),
              })
            : t('overview.efficiency.alreadyCheap')
        }
        highlight={cheapestSavings > 0}
      />
      <ScenarioStat
        label={t('overview.efficiency.noMaxSavings')}
        value={noMaxSavings > 0 ? `${fmtUSD(noMaxSavings)}` : '—'}
        sub={
          noMaxSavings > 0
            ? t('overview.efficiency.pctOff', {
                pct: (report.scenarios.noMaxMode.savingsPct * 100).toFixed(0),
              })
            : t('overview.efficiency.maxModeOff')
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
      <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
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
  const t = useT();
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
              className="inline-flex items-center rounded-sm border border-[var(--color-border)] px-1.5 py-[1px] font-mono text-[11px] uppercase tracking-[0.1em]"
              style={{
                background:
                  rec.priority === 'high' ? 'var(--color-accent)' : 'var(--color-surface)',
                color: rec.priority === 'high' ? 'var(--color-accent-text)' : 'var(--color-text)',
              }}
            >
              {t(`overview.actionFeed.priority.${rec.priority}`)}
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
