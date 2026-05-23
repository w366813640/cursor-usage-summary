# Product Upgrade Roadmap: Local-First Cost Coach

## Goal

Upgrade Cursor Usage from a dense local analytics dashboard into a polished local-first cost coach: it should explain what happened, why it happened, what to do next, and why the numbers can be trusted.

## Scope

This parent task tracks the one-week roadmap. Implementation should happen through the child tasks, each small enough to review independently.

## Child Tasks

- Day 1: IA and product copy refresh
- Day 2: Action feed insight engine
- Day 3: Onboarding and import confidence
- Day 4: Density modes and UI polish
- Day 5: Renderer performance and bundle split
- Day 6: Motion and accessibility pass
- Day 7: Desktop release UX hardening

## Requirements

- Preserve the current local-only privacy model.
- Preserve the existing Bloomberg/Tufte power-user identity while adding a calmer first read.
- Prefer deterministic local rules over network or LLM calls.
- Keep changes incremental and reviewable.
- Maintain lint, typecheck, and tests green after each child task.

## Acceptance Criteria

- [ ] Each child task has a focused PRD and can be implemented independently.
- [ ] The route and UX direction are coherent across Overview, Day, Details, Models, Anomalies, Settings, and desktop shell.
- [ ] The app has a top-level action layer that turns existing analytics into recommendations.
- [ ] Performance, motion, accessibility, and release readiness are explicitly covered.

## Technical Notes

- Current verification baseline: `pnpm lint`, `pnpm typecheck`, and `pnpm test` pass.
- Build output baseline: renderer main chunk is about 566.70 kB, gzip 165.02 kB.
- Current dirty tree includes WIP edits in `DateRangeFilter`, `HoursPage`, `WelcomePage`, and styles; child tasks should work with those changes, not revert them.
- Detailed planning artifact: `project-improvement-roadmap.canvas.tsx`.
