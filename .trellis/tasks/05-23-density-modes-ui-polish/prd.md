# Day 4: Density Modes and UI Polish

## Goal

Let the product serve both first-time users and power users by adding density modes and polishing chart captions, empty states, layout hierarchy, and table/filter ergonomics.

## Requirements

- Add a settings-backed density preference: Comfortable, Dense, and Presentation.
- Density should affect spacing, table row height, optional captions, and chart chrome without changing underlying data.
- Add reusable chart captions that explain how to read the chart, current takeaway, and next action.
- Improve empty states for filters, date selections, low-data forecast, and no anomalies.
- Improve Details filters with clearer reset and optional saved-filter direction if small enough.
- Keep the visual language restrained: warm accent, no rainbow status overload, no decorative motion.

## Acceptance Criteria

- [ ] Density mode can be changed from settings and persists.
- [ ] Overview, Details, Day, Year, and Settings remain readable in all density modes.
- [ ] Every major chart panel has a useful caption or takeaway.
- [ ] Empty states include recovery actions where possible.
- [ ] Visual regression screenshots are updated or manually captured for dark and light modes.

## Likely Files

- `apps/playground/src/components/SettingsDrawer.tsx`
- `apps/playground/src/hooks/useSettings.ts`
- `apps/playground/src/components/Panel.tsx`
- `apps/playground/src/components/DetailsPage.tsx`
- `apps/playground/src/components/HoursPage.tsx`
- `apps/playground/src/components/overview/*`
- `packages/ui/src/styles.css`
- `apps/playground/src/styles.css`

## Out Of Scope

- Large navigation restructure.
- Route-level lazy loading.
- New analytics algorithms.

## Validation

- `pnpm lint`
- `pnpm typecheck`
- Manual dark/light review across all routes.
