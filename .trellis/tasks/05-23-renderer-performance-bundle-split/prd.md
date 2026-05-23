# Day 5: Renderer Performance and Bundle Split

## Goal

Reduce initial renderer cost and improve perceived speed by lazy-loading rare routes and expensive panels while preserving the desktop dashboard experience.

## Requirements

- Lazy-load non-default routes from `DashboardShell`.
- Consider lazy-loading expensive secondary panels such as Forecast, Compare Ranges, Year, Anomalies, and Compare Batches.
- Keep first dashboard paint focused on top action feed, KPI hero, and essential context.
- Memoize or centralize repeated expensive computations such as anomaly detection and forecast derivation where needed.
- Add bundle budget reporting or a documented build-size checkpoint.
- Preserve route deep-linking and command palette navigation.

## Acceptance Criteria

- [ ] Default Overview still works after reload and DB hydration.
- [ ] Non-default routes load on demand with a lightweight pending state.
- [ ] Build output captures before/after chunk sizes.
- [ ] Main app chunk target is below 400 kB, or exceptions are documented.
- [ ] No user-visible regression in route navigation, export, or drilldown.

## Likely Files

- `apps/playground/src/components/DashboardShell.tsx`
- `apps/playground/src/components/OverviewPage.tsx`
- `apps/playground/src/components/CommandPalette.tsx`
- `apps/playground/vite.config.ts`
- `package.json`

## Out Of Scope

- Replacing chart libraries.
- Rewriting table virtualization unless needed after measurement.
- Native Electron startup work.

## Validation

- `pnpm --filter @cu/playground build`
- `pnpm lint`
- `pnpm typecheck`
- Manual route navigation and deep-link checks.
