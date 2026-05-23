import { fmtUSD } from '@cu/charts';
import {
  type BudgetScenario,
  type RowWithCost,
  type UsageSummary,
  computeBudgetScenarios,
} from '@cu/data';
import { ArrowDownRight, CircleDot } from '@cu/icons';
import { useMemo } from 'react';
import { Panel } from '../Panel';

interface ScenarioPlannerPanelProps {
  summary: UsageSummary;
  rows: ReadonlyArray<RowWithCost>;
  monthlyRequestBudget: number;
}

export function ScenarioPlannerPanel({
  summary,
  rows,
  monthlyRequestBudget,
}: ScenarioPlannerPanelProps) {
  const scenarios = useMemo(
    () => computeBudgetScenarios(summary, rows, { monthlyRequestBudget }),
    [summary, rows, monthlyRequestBudget],
  );

  if (scenarios.length === 0) {
    return (
      <Panel title="Scenario planner" subtitle="Needs current-month data">
        <div className="rounded-md border border-dashed border-[var(--color-border)] px-4 py-6 text-center font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
          Import this month's usage to model budget levers.
        </div>
      </Panel>
    );
  }

  return (
    <Panel
      title="Scenario planner"
      subtitle="Deterministic what-if model · no network · no LLM"
      action={
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
          {scenarios.length} levers
        </span>
      }
    >
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
        {scenarios.map((scenario) => (
          <ScenarioCard key={scenario.id} scenario={scenario} />
        ))}
      </div>
    </Panel>
  );
}

function ScenarioCard({ scenario }: { scenario: BudgetScenario }) {
  const saving = scenario.costDelta < 0;
  return (
    <article className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
          {saving ? (
            <ArrowDownRight size={12} className="text-[var(--color-success)]" aria-hidden="true" />
          ) : (
            <CircleDot size={12} className="text-[var(--color-accent)]" aria-hidden="true" />
          )}
          {scenario.confidence} confidence
        </div>
        {saving ? (
          <span className="font-mono text-[10px] text-[var(--color-success)]">
            {fmtUSD(Math.abs(scenario.costDelta))} saved
          </span>
        ) : null}
      </div>
      <h3 className="font-serif text-[16px] tracking-tight text-[var(--color-text)]">
        {scenario.title}
      </h3>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="font-serif text-[24px] tracking-tight">
          {fmtUSD(scenario.projectedCost)}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
          {Math.round(scenario.projectedRequests).toLocaleString()} req
        </span>
      </div>
      <p className="mt-2 text-[12px] leading-relaxed text-[var(--color-text-muted)]">
        {scenario.detail}
      </p>
      <p className="mt-3 border-t border-[var(--color-border)] pt-2 font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--color-text-subtle)]">
        {scenario.action}
      </p>
    </article>
  );
}
