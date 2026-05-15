import { Sparkline, fmtTokens, fmtUSD, fmtUSDCompact } from '@cu/charts';
import type { RowWithCost } from '@cu/data';
import { Bot, Calendar, ChevronRight, Cog, Flame, User, Zap } from '@cu/icons';
import { motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { MetricToggle, Panel } from './Panel';

interface AgentsPageProps {
  rows: ReadonlyArray<RowWithCost>;
}

type AgentScope = 'all' | 'cloud-agent' | 'automation';
type SortKey = 'cost' | 'requests' | 'rows' | 'last';
type AgentKind = 'cloud-agent' | 'automation' | 'interactive';

interface AgentBucket {
  /** The grouping key — `cloudAgentId`, `automationId`, or "interactive". */
  key: string;
  /** Display label — truncated middle ellipsis for long opaque IDs. */
  label: string;
  /** Full untruncated ID for tooltips. */
  fullId: string;
  kind: AgentKind;
  cost: number;
  requests: number;
  tokens: number;
  rows: number;
  topModel: string | null;
  topModelCost: number;
  firstSeen: string;
  lastSeen: string;
  trend: Array<{ date: string; value: number }>;
  /** Models used by this agent, sorted by cost desc. */
  modelMix: Array<{ model: string; cost: number; rows: number }>;
}

/**
 * Cost-per-agent drill-down.
 *
 * Cursor CSV exports carry two opaque identifiers per row:
 *
 *   - `Cloud Agent ID`   · set when the request originated from a Cloud Agent run
 *   - `Automation ID`    · set when the request was part of an Automation
 *
 * Both may be empty (interactive Cursor usage), one may be set (pure
 * cloud-agent or pure automation), or both may be set (cloud-agent run
 * triggered from an automation).
 *
 * This page lets you answer "which agent burned the most money?" by
 * collapsing rows into buckets keyed by the agent identifier. Scope toggle
 * at the top lets you pick:
 *
 *   · All           — buckets keyed by cloudAgentId if set, else automationId
 *                     else "interactive" (one combined row for un-attributed)
 *   · Cloud Agents  — only rows with cloudAgentId set, keyed by that
 *   · Automations   — only rows with automationId set, keyed by that
 */
export function AgentsPage({ rows }: AgentsPageProps) {
  const [scope, setScope] = useState<AgentScope>('all');
  const [sortKey, setSortKey] = useState<SortKey>('cost');
  const [expanded, setExpanded] = useState<string | null>(null);

  const buckets = useMemo(() => groupRowsByAgent(rows, scope), [rows, scope]);

  const sorted = useMemo(() => {
    const list = [...buckets];
    list.sort((a, b) => {
      if (sortKey === 'cost') return b.cost - a.cost;
      if (sortKey === 'requests') return b.requests - a.requests;
      if (sortKey === 'rows') return b.rows - a.rows;
      // `last` — most recently active first.
      return b.lastSeen.localeCompare(a.lastSeen);
    });
    return list;
  }, [buckets, sortKey]);

  const totals = useMemo(() => deriveTotals(buckets, rows), [buckets, rows]);

  return (
    <div className="flex flex-col gap-6">
      <Panel
        title="Cost per agent"
        subtitle={`${totals.agentCount} agents · ${fmtUSD(totals.agentCost)} from agents · ${fmtUSD(totals.interactiveCost)} interactive`}
        action={
          <div className="flex items-center gap-2">
            <MetricToggle
              value={scope}
              options={['all', 'cloud-agent', 'automation'] as const}
              onChange={setScope}
            />
          </div>
        }
      >
        {/* KPI strip — quick answers to "are agents draining my budget?" */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <AgentKpi
            icon={<Bot size={12} aria-hidden="true" />}
            label="Cloud agents"
            value={totals.cloudAgentCount.toLocaleString()}
            sub={
              totals.cloudAgentCost > 0
                ? `${fmtUSD(totals.cloudAgentCost)} · ${((totals.cloudAgentCost / Math.max(0.0001, totals.totalCost)) * 100).toFixed(0)}% of total`
                : 'no cloud agents'
            }
          />
          <AgentKpi
            icon={<Cog size={12} aria-hidden="true" />}
            label="Automations"
            value={totals.automationCount.toLocaleString()}
            sub={
              totals.automationCost > 0
                ? `${fmtUSD(totals.automationCost)} · ${((totals.automationCost / Math.max(0.0001, totals.totalCost)) * 100).toFixed(0)}% of total`
                : 'no automations'
            }
          />
          <AgentKpi
            icon={<Flame size={12} aria-hidden="true" />}
            label="Top agent"
            value={totals.topAgent ? fmtUSD(totals.topAgent.cost) : '—'}
            sub={
              totals.topAgent
                ? `${labelKind(totals.topAgent.kind)} · ${totals.topAgent.label}`
                : null
            }
            accent
          />
          <AgentKpi
            icon={<User size={12} aria-hidden="true" />}
            label="Interactive (you)"
            value={fmtUSD(totals.interactiveCost)}
            sub={
              totals.totalCost > 0
                ? `${((totals.interactiveCost / totals.totalCost) * 100).toFixed(0)}% of total · ${totals.interactiveRows.toLocaleString()} rows`
                : null
            }
          />
        </div>

        {sorted.length === 0 ? (
          <EmptyAgentsCopy scope={scope} />
        ) : (
          <div className="mt-6 overflow-x-auto rounded-md border border-[var(--color-border)]">
            <table className="w-full border-collapse text-[12px]">
              <thead className="bg-[var(--color-surface-muted)] text-[var(--color-text-subtle)]">
                <tr>
                  <Th align="left">Agent</Th>
                  <Th align="left">Type</Th>
                  <SortTh active={sortKey === 'cost'} onClick={() => setSortKey('cost')}>
                    Cost
                  </SortTh>
                  <SortTh active={sortKey === 'requests'} onClick={() => setSortKey('requests')}>
                    Requests
                  </SortTh>
                  <SortTh active={sortKey === 'rows'} onClick={() => setSortKey('rows')}>
                    Rows
                  </SortTh>
                  <Th align="left">Top model</Th>
                  <SortTh
                    align="left"
                    active={sortKey === 'last'}
                    onClick={() => setSortKey('last')}
                  >
                    Last active
                  </SortTh>
                  <Th align="left">30-day trend</Th>
                  <Th align="right">
                    <span className="sr-only">expand</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((bucket, idx) => {
                  const isExpanded = expanded === bucket.key;
                  return (
                    <ExpandableAgentRow
                      key={bucket.key}
                      bucket={bucket}
                      rank={idx + 1}
                      expanded={isExpanded}
                      onToggle={() => setExpanded(isExpanded ? null : bucket.key)}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

/* -------------------------------------------------------------- *
 *  Aggregation
 * -------------------------------------------------------------- */

/**
 * Bucket rows into agent groups. The `scope` argument decides both what
 * keys to use AND whether to surface an "interactive" catch-all row:
 *
 *   - 'all'           groups by cloudAgentId | automationId | 'interactive'
 *   - 'cloud-agent'   only rows with cloudAgentId set
 *   - 'automation'    only rows with automationId set
 *
 * The single-walk implementation keeps it O(n) even when an account has
 * tens of thousands of rows across hundreds of agents.
 */
function groupRowsByAgent(rows: ReadonlyArray<RowWithCost>, scope: AgentScope): AgentBucket[] {
  type Mut = {
    key: string;
    label: string;
    fullId: string;
    kind: AgentKind;
    cost: number;
    requests: number;
    tokens: number;
    rows: number;
    firstSeen: string;
    lastSeen: string;
    modelMix: Map<string, { cost: number; rows: number }>;
    dayMap: Map<string, number>;
  };
  const map = new Map<string, Mut>();

  for (const r of rows) {
    const cloud = r.cloudAgentId.trim();
    const auto = r.automationId.trim();

    let key: string | null = null;
    let kind: AgentKind = 'interactive';
    let fullId = '';

    if (scope === 'cloud-agent') {
      if (!cloud) continue;
      key = `ca:${cloud}`;
      kind = 'cloud-agent';
      fullId = cloud;
    } else if (scope === 'automation') {
      if (!auto) continue;
      key = `au:${auto}`;
      kind = 'automation';
      fullId = auto;
    } else {
      // All: prefer cloud agent ID, fall back to automation, then interactive.
      if (cloud) {
        key = `ca:${cloud}`;
        kind = 'cloud-agent';
        fullId = cloud;
      } else if (auto) {
        key = `au:${auto}`;
        kind = 'automation';
        fullId = auto;
      } else {
        key = 'interactive';
        kind = 'interactive';
        fullId = '';
      }
    }

    if (!key) continue;

    let bucket = map.get(key);
    if (!bucket) {
      bucket = {
        key,
        label: kind === 'interactive' ? 'Interactive (you)' : truncateId(fullId),
        fullId,
        kind,
        cost: 0,
        requests: 0,
        tokens: 0,
        rows: 0,
        firstSeen: r.dateISO,
        lastSeen: r.dateISO,
        modelMix: new Map(),
        dayMap: new Map(),
      };
      map.set(key, bucket);
    }

    bucket.cost += r.cost;
    bucket.requests += r.requests.kind === 'units' ? r.requests.value : 0;
    bucket.tokens += r.tokens.total;
    bucket.rows += 1;
    if (r.dateISO < bucket.firstSeen) bucket.firstSeen = r.dateISO;
    if (r.dateISO > bucket.lastSeen) bucket.lastSeen = r.dateISO;

    const mm = bucket.modelMix.get(r.model) ?? { cost: 0, rows: 0 };
    mm.cost += r.cost;
    mm.rows += 1;
    bucket.modelMix.set(r.model, mm);

    const day = r.dateISO.slice(0, 10);
    bucket.dayMap.set(day, (bucket.dayMap.get(day) ?? 0) + r.cost);
  }

  // Materialise the trend + topModel + sorted modelMix arrays in one pass.
  const out: AgentBucket[] = [];
  for (const b of map.values()) {
    const trend = [...b.dayMap.entries()]
      .sort((a, b2) => a[0].localeCompare(b2[0]))
      .map(([date, value]) => ({ date, value }));

    const modelMix = [...b.modelMix.entries()]
      .map(([model, v]) => ({ model, cost: v.cost, rows: v.rows }))
      .sort((a, b2) => b2.cost - a.cost);

    const topModel = modelMix[0] ?? null;

    out.push({
      key: b.key,
      label: b.label,
      fullId: b.fullId,
      kind: b.kind,
      cost: b.cost,
      requests: b.requests,
      tokens: b.tokens,
      rows: b.rows,
      topModel: topModel?.model ?? null,
      topModelCost: topModel?.cost ?? 0,
      firstSeen: b.firstSeen,
      lastSeen: b.lastSeen,
      trend,
      modelMix,
    });
  }
  return out;
}

interface AgentTotals {
  agentCount: number;
  agentCost: number;
  interactiveCost: number;
  interactiveRows: number;
  cloudAgentCount: number;
  cloudAgentCost: number;
  automationCount: number;
  automationCost: number;
  totalCost: number;
  topAgent: AgentBucket | null;
}

/**
 * Aggregate KPI strip totals. We re-walk `rows` for the "Cloud agents"
 * + "Automations" counts because the per-scope bucket list above filters
 * them and we want unconditional counts at the top of the page.
 */
function deriveTotals(buckets: AgentBucket[], rows: ReadonlyArray<RowWithCost>): AgentTotals {
  const cloudKeys = new Set<string>();
  const automationKeys = new Set<string>();
  let cloudCost = 0;
  let automationCost = 0;
  let interactiveCost = 0;
  let interactiveRows = 0;
  let totalCost = 0;
  for (const r of rows) {
    totalCost += r.cost;
    const cloud = r.cloudAgentId.trim();
    const auto = r.automationId.trim();
    if (cloud) {
      cloudKeys.add(cloud);
      cloudCost += r.cost;
    } else if (auto) {
      automationKeys.add(auto);
      automationCost += r.cost;
    } else {
      interactiveCost += r.cost;
      interactiveRows += 1;
    }
  }

  const agentBuckets = buckets.filter((b) => b.kind !== 'interactive');
  const agentCount = agentBuckets.length;
  const agentCost = agentBuckets.reduce((acc, b) => acc + b.cost, 0);
  const topAgent =
    agentBuckets.length > 0
      ? agentBuckets.reduce((acc, b) => (b.cost > acc.cost ? b : acc), agentBuckets[0]!)
      : null;

  return {
    agentCount,
    agentCost,
    interactiveCost,
    interactiveRows,
    cloudAgentCount: cloudKeys.size,
    cloudAgentCost: cloudCost,
    automationCount: automationKeys.size,
    automationCost,
    totalCost,
    topAgent,
  };
}

/**
 * Cursor agent IDs are 30-40 char opaque UUIDs. Showing the full string in
 * a table column wastes width; this keeps the first 8 + last 6 chars so the
 * user can still recognise / paste a specific run.
 */
function truncateId(id: string): string {
  if (id.length <= 18) return id;
  return `${id.slice(0, 8)}…${id.slice(-6)}`;
}

function labelKind(k: AgentKind): string {
  if (k === 'cloud-agent') return 'cloud agent';
  if (k === 'automation') return 'automation';
  return 'interactive';
}

/* -------------------------------------------------------------- *
 *  Row + helpers
 * -------------------------------------------------------------- */

function ExpandableAgentRow({
  bucket,
  rank,
  expanded,
  onToggle,
}: {
  bucket: AgentBucket;
  rank: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const lastDate = bucket.lastSeen.slice(0, 10);
  const firstDate = bucket.firstSeen.slice(0, 10);
  const dateRange = firstDate === lastDate ? lastDate : `${firstDate} → ${lastDate}`;

  return (
    <>
      <tr className="border-t border-[var(--color-border)] transition-colors hover:bg-[var(--color-surface-muted)]">
        <td
          className="px-3 py-2 font-mono text-[12px] text-[var(--color-text)]"
          title={bucket.fullId || 'no agent identifier'}
        >
          <span className="mr-1.5 text-[var(--color-text-subtle)]">#{rank}</span>
          {bucket.label}
        </td>
        <td className="px-3 py-2">
          <KindBadge kind={bucket.kind} />
        </td>
        <td
          className="px-3 py-2 text-right font-mono tabular-nums"
          style={{ color: 'var(--color-accent)' }}
        >
          {fmtUSD(bucket.cost)}
        </td>
        <td className="px-3 py-2 text-right font-mono tabular-nums text-[var(--color-text-muted)]">
          {bucket.requests.toLocaleString(undefined, { maximumFractionDigits: 1 })}
        </td>
        <td className="px-3 py-2 text-right font-mono tabular-nums text-[var(--color-text-muted)]">
          {bucket.rows.toLocaleString()}
        </td>
        <td className="px-3 py-2 font-mono text-[11px] text-[var(--color-text)]">
          {bucket.topModel ?? '—'}
          {bucket.topModel && bucket.cost > 0 ? (
            <span className="ml-1 text-[var(--color-text-subtle)]">
              · {((bucket.topModelCost / bucket.cost) * 100).toFixed(0)}%
            </span>
          ) : null}
        </td>
        <td
          className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--color-text-subtle)]"
          title={dateRange}
        >
          {lastDate}
        </td>
        <td className="px-3 py-2">
          <Sparkline
            data={bucket.trend.slice(-30)}
            width={180}
            height={26}
            strokeWidth={1.2}
            showLastPoint
            showPeak={false}
            fillArea
          />
        </td>
        <td className="px-3 py-2 text-right">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            aria-label={expanded ? 'collapse' : 'expand'}
            className="rounded-sm p-1 text-[var(--color-text-subtle)] transition-colors hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]"
          >
            <motion.span
              animate={{ rotate: expanded ? 90 : 0 }}
              transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
              style={{ display: 'inline-flex' }}
            >
              <ChevronRight size={12} aria-hidden="true" />
            </motion.span>
          </button>
        </td>
      </tr>
      {expanded ? <AgentDetailRow bucket={bucket} /> : null}
    </>
  );
}

function AgentDetailRow({ bucket }: { bucket: AgentBucket }) {
  return (
    <tr className="border-t border-[var(--color-border)] bg-[var(--color-surface)]/40">
      <td colSpan={9} className="px-3 py-4">
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
          className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_1fr]"
        >
          <div className="flex flex-col gap-2">
            <SubTitle>Full identifier</SubTitle>
            <code className="break-all rounded-sm border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-2 py-1.5 font-mono text-[11px] text-[var(--color-text)]">
              {bucket.fullId || '— (no identifier; interactive Cursor usage)'}
            </code>
            <div className="mt-2 grid grid-cols-3 gap-3">
              <Stat
                icon={<Zap size={11} aria-hidden="true" />}
                label="Tokens"
                value={fmtTokens(bucket.tokens)}
              />
              <Stat
                icon={<Calendar size={11} aria-hidden="true" />}
                label="Active range"
                value={
                  bucket.firstSeen === bucket.lastSeen
                    ? bucket.firstSeen.slice(0, 10)
                    : `${bucket.firstSeen.slice(0, 10)} → ${bucket.lastSeen.slice(0, 10)}`
                }
                small
              />
              <Stat
                icon={<Flame size={11} aria-hidden="true" />}
                label="Avg / request"
                value={bucket.requests > 0 ? fmtUSDCompact(bucket.cost / bucket.requests) : '—'}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <SubTitle>Model mix · top {Math.min(5, bucket.modelMix.length)}</SubTitle>
            <div className="flex flex-col gap-1.5">
              {bucket.modelMix.slice(0, 5).map((m) => {
                const share = bucket.cost > 0 ? m.cost / bucket.cost : 0;
                return (
                  <div key={m.model} className="flex items-center gap-2 font-mono text-[11px]">
                    <span className="w-40 truncate text-[var(--color-text)]" title={m.model}>
                      {m.model}
                    </span>
                    <div className="flex-1 rounded-sm bg-[var(--color-surface-muted)]">
                      <div
                        className="h-1.5 rounded-sm"
                        style={{
                          width: `${Math.max(2, share * 100)}%`,
                          background: 'var(--color-accent)',
                        }}
                      />
                    </div>
                    <span className="w-16 text-right tabular-nums text-[var(--color-text-muted)]">
                      {fmtUSDCompact(m.cost)}
                    </span>
                    <span className="w-10 text-right tabular-nums text-[var(--color-text-subtle)]">
                      {(share * 100).toFixed(0)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      </td>
    </tr>
  );
}

function AgentKpi({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string | null;
  accent?: boolean;
}) {
  return (
    <div
      className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-3"
      style={{
        background: accent
          ? 'color-mix(in oklab, var(--color-accent) 7%, var(--color-surface))'
          : undefined,
      }}
    >
      <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
        {icon}
        {label}
      </div>
      <div
        className="mt-1 font-serif text-[22px] leading-[1.15] tracking-tight tabular-nums truncate"
        style={accent ? { color: 'var(--color-accent)' } : undefined}
        title={value}
      >
        {value}
      </div>
      {sub ? (
        <div
          className="mt-1 font-mono text-[10px] text-[var(--color-text-subtle)] truncate"
          title={sub}
        >
          {sub}
        </div>
      ) : null}
    </div>
  );
}

function KindBadge({ kind }: { kind: AgentKind }) {
  const config: Record<AgentKind, { label: string; color: string }> = {
    'cloud-agent': { label: 'cloud agent', color: 'var(--cu-cat-2)' },
    automation: { label: 'automation', color: 'var(--cu-cat-3)' },
    interactive: { label: 'interactive', color: 'var(--cu-cat-6)' },
  };
  const cfg = config[kind];
  return (
    <span
      className="inline-flex items-center rounded-sm border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.08em]"
      style={{
        color: cfg.color,
        borderColor: `color-mix(in oklab, ${cfg.color} 35%, transparent)`,
        background: `color-mix(in oklab, ${cfg.color} 8%, transparent)`,
      }}
    >
      {cfg.label}
    </span>
  );
}

function Stat({
  icon,
  label,
  value,
  small,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  small?: boolean;
}) {
  return (
    <div className="rounded-sm border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-2 py-1.5">
      <div className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
        {icon}
        {label}
      </div>
      <div
        className={[
          'mt-0.5 font-mono tabular-nums text-[var(--color-text)]',
          small ? 'text-[10px]' : 'text-[13px]',
        ].join(' ')}
      >
        {value}
      </div>
    </div>
  );
}

function SubTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
      {children}
    </div>
  );
}

function Th({
  children,
  align = 'right',
}: {
  children: React.ReactNode;
  align?: 'left' | 'right';
}) {
  return (
    <th
      className={`sticky top-0 z-10 px-3 py-2 text-${align} font-mono text-[10px] uppercase tracking-[0.08em] font-normal`}
    >
      {children}
    </th>
  );
}

function SortTh({
  children,
  active,
  onClick,
  align = 'right',
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  align?: 'left' | 'right';
}) {
  return (
    <th
      className={`sticky top-0 z-10 px-3 py-2 text-${align} font-mono text-[10px] uppercase tracking-[0.08em] font-normal`}
    >
      <button
        type="button"
        onClick={onClick}
        className={[
          'transition-colors',
          active
            ? 'text-[var(--color-accent)]'
            : 'text-[var(--color-text-subtle)] hover:text-[var(--color-text)]',
        ].join(' ')}
      >
        {children}
        {active ? <span className="ml-1">↓</span> : null}
      </button>
    </th>
  );
}

function EmptyAgentsCopy({ scope }: { scope: AgentScope }) {
  const msg =
    scope === 'cloud-agent'
      ? 'No Cloud Agent runs found in this dataset.'
      : scope === 'automation'
        ? 'No Automation runs found in this dataset.'
        : 'No agents detected — the imported CSVs have no Cloud Agent or Automation IDs.';
  return (
    <div className="mt-6 flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-[var(--color-border)] py-10 text-center">
      <Bot size={20} className="text-[var(--color-text-subtle)]" aria-hidden="true" />
      <p className="font-serif text-[14px] text-[var(--color-text-muted)] max-w-[480px]">{msg}</p>
    </div>
  );
}
