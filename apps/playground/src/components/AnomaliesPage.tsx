import { fmtUSD } from '@cu/charts';
import {
  type Anomaly,
  type CacheHitDropAnomaly,
  type CostPerReqShiftAnomaly,
  type CostSpikeAnomaly,
  type RowWithCost,
  type Severity,
  type UsageSummary,
  detectAllAnomalies,
} from '@cu/data';
import { AlertTriangle, ChevronRight, Database, Flame, Layers } from '@cu/icons';
import { useT } from '@cu/ui';
import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { Panel } from './Panel';

interface AnomaliesPageProps {
  summary: UsageSummary;
  rows: ReadonlyArray<RowWithCost>;
}

/**
 * Local anomaly inspector — no network, no model API.
 *
 * Three independent detectors run over the loaded CSV and surface the days
 * where *this user's* behavior diverged from *their own* recent baseline:
 *
 *   - cost-spike       (your daily spend was an outlier)
 *   - costperreq-shift (each request cost much more than usual)
 *   - cache-drop       (your cache hit ratio dropped meaningfully)
 *
 * The page is deliberately read-mostly: each card explains *what* and *why*
 * in plain English, and provides a single "Open day" affordance that hands
 * the date off to the Day page via sessionStorage (same mechanism as the
 * overview heatmap drill).
 */
export function AnomaliesPage({ summary, rows }: AnomaliesPageProps) {
  const t = useT();
  const { all, bySeverity, costSpikes, cprShifts, cacheDrops } = useMemo(() => {
    const detection = detectAllAnomalies(summary, rows, { t });
    const costSpikes = detection.all.filter((a): a is CostSpikeAnomaly => a.kind === 'cost-spike');
    const cprShifts = detection.all.filter(
      (a): a is CostPerReqShiftAnomaly => a.kind === 'costperreq-shift',
    );
    const cacheDrops = detection.all.filter(
      (a): a is CacheHitDropAnomaly => a.kind === 'cache-drop',
    );
    return {
      all: detection.all,
      bySeverity: detection.bySeverity,
      costSpikes,
      cprShifts,
      cacheDrops,
    };
  }, [summary, rows, t]);

  const hasAny = all.length > 0;

  return (
    <div className="flex flex-col gap-5">
      <SummaryBar
        totalDays={summary.byDay.length}
        anomalies={all.length}
        high={bySeverity.high.length}
        medium={bySeverity.medium.length}
        low={bySeverity.low.length}
      />

      {!hasAny ? (
        <Panel title={t('anomalies.none.title')} subtitle={t('anomalies.none.subtitle')}>
          <div className="font-mono text-[12px] text-[var(--color-text-subtle)] leading-relaxed">
            {t('anomalies.none.body')}
          </div>
        </Panel>
      ) : (
        <>
          <DetectorSection
            title={t('anomalies.section.costSpikes.title')}
            subtitle={t('anomalies.section.costSpikes.subtitle')}
            icon={<Flame className="h-3.5 w-3.5" aria-hidden="true" />}
            count={costSpikes.length}
          >
            {costSpikes.map((a) => (
              <CostSpikeCard key={`${a.kind}-${a.date}`} anomaly={a} />
            ))}
            {costSpikes.length === 0 ? <EmptyDetector /> : null}
          </DetectorSection>

          <DetectorSection
            title={t('anomalies.section.cpr.title')}
            subtitle={t('anomalies.section.cpr.subtitle')}
            icon={<Layers className="h-3.5 w-3.5" aria-hidden="true" />}
            count={cprShifts.length}
          >
            {cprShifts.map((a) => (
              <CostPerReqCard key={`${a.kind}-${a.date}`} anomaly={a} />
            ))}
            {cprShifts.length === 0 ? <EmptyDetector /> : null}
          </DetectorSection>

          <DetectorSection
            title={t('anomalies.section.cache.title')}
            subtitle={t('anomalies.section.cache.subtitle')}
            icon={<Database className="h-3.5 w-3.5" aria-hidden="true" />}
            count={cacheDrops.length}
          >
            {cacheDrops.map((a) => (
              <CacheDropCard key={`${a.kind}-${a.date}`} anomaly={a} />
            ))}
            {cacheDrops.length === 0 ? <EmptyDetector /> : null}
          </DetectorSection>
        </>
      )}

      <MethodPanel />
    </div>
  );
}

/* -------------------------------------------------------------- *
 *  Top-of-page summary bar
 * -------------------------------------------------------------- */

interface SummaryBarProps {
  totalDays: number;
  anomalies: number;
  high: number;
  medium: number;
  low: number;
}

function SummaryBar({ totalDays, anomalies, high, medium, low }: SummaryBarProps) {
  const t = useT();
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
    >
      <Metric label={t('anomalies.summary.daysScanned')} value={String(totalDays)} />
      <Divider />
      <Metric
        label={t('anomalies.summary.anomalies')}
        value={String(anomalies)}
        emphasis={anomalies > 0}
      />
      <Divider />
      <Metric label={t('severity.high')} value={String(high)} tone="high" />
      <Metric label={t('severity.medium')} value={String(medium)} tone="medium" />
      <Metric label={t('severity.low')} value={String(low)} tone="low" />
    </motion.div>
  );
}

function Metric({
  label,
  value,
  emphasis = false,
  tone,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  tone?: Severity;
}) {
  const toneColor =
    tone === 'high'
      ? 'var(--color-accent)'
      : tone === 'medium'
        ? 'var(--color-text)'
        : tone === 'low'
          ? 'var(--color-text-subtle)'
          : undefined;
  return (
    <div className="flex flex-col">
      <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
        {label}
      </div>
      <div
        className={`font-mono text-[20px] tabular-nums ${
          emphasis ? 'text-[var(--color-text)]' : ''
        }`}
        style={toneColor ? { color: toneColor } : undefined}
      >
        {value}
      </div>
    </div>
  );
}

function Divider() {
  return <span className="h-6 w-px bg-[var(--color-border)]" aria-hidden="true" />;
}

/* -------------------------------------------------------------- *
 *  Per-detector section
 * -------------------------------------------------------------- */

function DetectorSection({
  title,
  subtitle,
  icon,
  count,
  children,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  count: number;
  children: React.ReactNode;
}) {
  const t = useT();
  return (
    <Panel
      title={title}
      subtitle={subtitle}
      action={
        <span className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
          {icon}
          <span>{t('anomalies.section.flagged', { n: count })}</span>
        </span>
      }
    >
      <div className="flex flex-col gap-2">{children}</div>
    </Panel>
  );
}

function EmptyDetector() {
  const t = useT();
  return (
    <div className="font-mono text-[12px] text-[var(--color-text-subtle)]">
      {t('anomalies.section.empty')}
    </div>
  );
}

/* -------------------------------------------------------------- *
 *  Anomaly card variants
 * -------------------------------------------------------------- */

function CostSpikeCard({ anomaly }: { anomaly: CostSpikeAnomaly }) {
  const t = useT();
  return (
    <AnomalyCardShell anomaly={anomaly}>
      <Stat label={t('anomalies.stat.cost')} value={fmtUSD(anomaly.cost)} />
      <Stat label={t('anomalies.stat.baseline')} value={fmtUSD(anomaly.baselineMedian)} />
      <Stat
        label={t('anomalies.stat.signal')}
        value={
          anomaly.baselineMad === 0
            ? `${(anomaly.cost / Math.max(anomaly.baselineMedian, 0.5)).toFixed(1)}x`
            : `${anomaly.robustZ.toFixed(1)}z`
        }
      />
    </AnomalyCardShell>
  );
}

function CostPerReqCard({ anomaly }: { anomaly: CostPerReqShiftAnomaly }) {
  const t = useT();
  return (
    <AnomalyCardShell anomaly={anomaly}>
      <Stat label={t('anomalies.stat.costPerReq')} value={fmtUSD(anomaly.current)} />
      <Stat label={t('anomalies.stat.baseline')} value={fmtUSD(anomaly.baseline)} />
      <Stat label={t('anomalies.stat.ratio')} value={`${anomaly.ratio.toFixed(1)}x`} />
      <Stat label={t('anomalies.stat.topModel')} value={anomaly.topModel} mono compact />
    </AnomalyCardShell>
  );
}

function CacheDropCard({ anomaly }: { anomaly: CacheHitDropAnomaly }) {
  const t = useT();
  return (
    <AnomalyCardShell anomaly={anomaly}>
      <Stat label={t('anomalies.stat.today')} value={`${(anomaly.current * 100).toFixed(0)}%`} />
      <Stat
        label={t('anomalies.stat.baseline')}
        value={`${(anomaly.baseline * 100).toFixed(0)}%`}
      />
      <Stat label={t('anomalies.stat.drop')} value={`${anomaly.dropPp.toFixed(0)}pp`} />
    </AnomalyCardShell>
  );
}

function AnomalyCardShell({
  anomaly,
  children,
}: {
  anomaly: Anomaly;
  children: React.ReactNode;
}) {
  const t = useT();
  const tone =
    anomaly.severity === 'high'
      ? 'var(--color-accent)'
      : anomaly.severity === 'medium'
        ? 'var(--color-text)'
        : 'var(--color-text-subtle)';

  return (
    <div
      className="group flex items-stretch gap-3 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface-muted)]/40 p-3"
      style={{ boxShadow: `inset 3px 0 0 0 ${tone}` }}
    >
      <div className="flex flex-1 flex-col gap-1.5">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[12px] text-[var(--color-text)] tabular-nums">
            {anomaly.date}
          </span>
          <SeverityBadge severity={anomaly.severity} />
        </div>
        <div className="font-serif text-[14px] leading-snug">{anomaly.explanation}</div>
        <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-1.5">{children}</div>
      </div>
      <button
        type="button"
        onClick={() => openDay(anomaly.date)}
        className="flex items-center gap-1 self-center rounded-md border border-transparent px-2 py-1 font-mono text-[11px] text-[var(--color-text-subtle)] uppercase tracking-[0.08em] transition-colors hover:border-[var(--color-border)] hover:text-[var(--color-text)]"
      >
        {t('anomalies.openDay')}
        <ChevronRight className="h-3 w-3" aria-hidden="true" />
      </button>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: Severity }) {
  const t = useT();
  const styles: Record<Severity, { fg: string; bg: string }> = {
    high: { fg: 'var(--color-accent-text)', bg: 'var(--color-accent)' },
    medium: { fg: 'var(--color-text)', bg: 'var(--color-surface)' },
    low: { fg: 'var(--color-text-subtle)', bg: 'var(--color-surface-muted)' },
  };
  const s = styles[severity];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-sm border border-[var(--color-border)] px-1.5 py-[1px] font-mono text-[11px] uppercase tracking-[0.1em]"
      style={{ background: s.bg, color: s.fg }}
    >
      <AlertTriangle className="h-2.5 w-2.5" aria-hidden="true" />
      {t(`severity.${severity}`)}
    </span>
  );
}

function Stat({
  label,
  value,
  mono = false,
  compact = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  compact?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
        {label}
      </span>
      <span
        className={[
          mono ? 'font-mono' : 'font-sans',
          'text-[13px] tabular-nums text-[var(--color-text)]',
          compact ? 'max-w-[200px] truncate' : '',
        ].join(' ')}
      >
        {value}
      </span>
    </div>
  );
}

/* -------------------------------------------------------------- *
 *  Method panel — short methodology note
 * -------------------------------------------------------------- */

function MethodPanel() {
  const t = useT();
  // Each bullet template wraps a bolded label in `<<L>>…<</L>>` so we
  // can split on the same sentinel here and let translators reorder
  // freely (CJK often inverts the label/body order).
  const renderLabelled = (template: string) => {
    const parts = template.split(/<<L>>|<<\/L>>/);
    return (
      <>
        {parts[0]}
        <span className="text-[var(--color-text)]">{parts[1]}</span>
        {parts.slice(2).join('')}
      </>
    );
  };

  return (
    <Panel title={t('anomalies.method.title')} subtitle={t('anomalies.method.subtitle')}>
      <ul className="flex list-inside list-disc flex-col gap-1.5 font-mono text-[12px] text-[var(--color-text-subtle)] leading-relaxed">
        <li>{renderLabelled(t('anomalies.method.bullet1'))}</li>
        <li>{renderLabelled(t('anomalies.method.bullet2'))}</li>
        <li>{renderLabelled(t('anomalies.method.bullet3'))}</li>
        <li>{t('anomalies.method.bullet4')}</li>
      </ul>
    </Panel>
  );
}

/* -------------------------------------------------------------- *
 *  Hand-off helper (shared with the overview heatmap drill)
 * -------------------------------------------------------------- */

function openDay(dateISO: string) {
  try {
    sessionStorage.setItem('cu:pendingDayDate', dateISO);
  } catch {
    // sessionStorage might be unavailable in some sandboxes; fall through.
  }
  window.location.hash = '/day';
}
