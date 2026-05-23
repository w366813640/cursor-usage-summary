# Day 2: Action Feed Insight Engine

## Goal

Add a deterministic local action feed that ranks the most useful recommendations from existing budget, forecast, anomaly, efficiency, and top-burn signals.

## Requirements

- Create a pure data module that produces ranked insight cards.
- Inputs should reuse existing data from `UsageSummary`, `RowWithCost`, efficiency, anomalies, forecast, budget, and cache savings.
- Each insight must include title, explanation, recommended action, priority, confidence, estimated savings when available, and source kind.
- The engine must handle empty data, low data, no findings, ties, and conflicting signals.
- Overview should surface the top recommendations before secondary chart panels.
- No network calls and no LLM dependency.

## Acceptance Criteria

- [ ] At least these insight kinds are supported: budget risk, forecast trend, anomaly, max-mode tax, model substitution, cache health, and healthy state.
- [ ] Recommendations are deterministic for the same input.
- [ ] Low-confidence recommendations clearly say why confidence is low.
- [ ] Overview displays the top 3 to 5 actions with direct next steps.
- [ ] Unit tests cover ranking, empty state, tie-breaks, and low-data behavior.

## Likely Files

- `packages/data/src/insights.ts`
- `packages/data/src/index.ts`
- `packages/data/src/__tests__/insights.test.ts`
- `apps/playground/src/components/overview/*`
- `apps/playground/src/components/OverviewPage.tsx`

## Out Of Scope

- AI-generated prose.
- User-editable rules.
- Team or account-level benchmarks.

## Validation

- `pnpm --filter @cu/data test`
- `pnpm lint`
- `pnpm typecheck`
- Manual Overview review with safe, risky, and low-data datasets.
