# Day 6: Motion and Accessibility Pass

## Goal

Make motion purposeful and accessible: every animation should explain state change, respect reduced-motion preferences, and preserve keyboard and screen-reader usability.

## Requirements

- Define motion roles: entrance, feedback, drilldown, alert, and data reveal.
- Add or reuse a motion preference guard so Framer Motion variants respect `prefers-reduced-motion`.
- Avoid animating large tables or thousands of chart cells.
- Review keyboard paths for sidebar, command palette, settings, import drawers, tables, date picker, and modal flows.
- Improve ARIA labels and descriptions for dense charts and data tables where practical.
- Ensure focus behavior is predictable after drawers/modals open and close.

## Acceptance Criteria

- [ ] Reduced-motion mode removes translate/scale/path drawing where appropriate.
- [ ] Keyboard-only navigation can reach all primary actions.
- [ ] Focus returns to the triggering control after drawers/modals close where practical.
- [ ] Dense charts have accessible names or adjacent textual explanations.
- [ ] Motion rules are documented in code or project spec if reusable.

## Likely Files

- `packages/motion/src/*`
- `apps/playground/src/components/*`
- `apps/playground/src/components/DateRangeFilter.tsx`
- `apps/playground/src/components/ImportPreviewDrawer.tsx`
- `apps/playground/src/components/ImportHistoryDrawer.tsx`
- `apps/playground/src/components/SettingsDrawer.tsx`
- `packages/charts/src/*`

## Out Of Scope

- Full WCAG certification.
- Complete screen-reader data table redesign.
- Replacing Framer Motion.

## Validation

- `pnpm lint`
- `pnpm typecheck`
- Manual keyboard walkthrough.
- Manual reduced-motion walkthrough using OS or browser setting.
