# Day 1: IA and Product Copy Refresh

## Goal

Make the product easier to understand on first contact by redesigning the route structure, labels, first-read hierarchy, and core copy around the "local-first cost coach" direction.

## Requirements

- Define the primary mental model: Analyze, Investigate, Act, and Manage.
- Review current route labels: Overview, Year, Anomalies, Models, Rows, Day.
- Decide whether "Day" remains a single-day inspector or returns to a broader Hours/range analysis concept.
- Update top-level product copy so the app answers: what happened, why, what to do, and whether to trust it.
- Keep copy concise, direct, and money-trustworthy.
- Avoid adding new functionality in this task unless needed to support navigation/copy changes.

## Acceptance Criteria

- [ ] Sidebar route labels and descriptions are internally consistent.
- [ ] Overview has a clear first-read hierarchy before detailed charts.
- [ ] Welcome and non-desktop copy accurately describe desktop-only SQLite behavior.
- [ ] No route name promises a capability the UI does not expose.
- [ ] Updated copy is covered by a manual walkthrough with empty DB, restored DB, and imported CSV states.

## Likely Files

- `apps/playground/src/components/SideNav.tsx`
- `apps/playground/src/router/useRoute.ts`
- `apps/playground/src/pages/WelcomePage.tsx`
- `apps/playground/src/components/DashboardShell.tsx`
- `apps/playground/src/components/OverviewPage.tsx`
- `README.md`

## Out Of Scope

- New analytics algorithms.
- Performance lazy-loading.
- New settings persistence.

## Validation

- `pnpm lint`
- `pnpm typecheck`
- Manual desktop walkthrough of all routes.
