# Day 3: Onboarding and Import Confidence

## Goal

Make first launch and CSV import feel safe, clear, and premium by explaining privacy, accepted data shape, expected outcomes, duplicate detection, and recovery paths.

## Requirements

- Replace the current design-system preview with a user-centered onboarding checklist.
- Add copy that proves local-only behavior: desktop SQLite, no upload, no external APIs.
- Clarify accepted CSV source, size limit, and common parse failure causes.
- Provide a sample-data tour option if a sample dataset exists or can be safely added.
- Improve import preview language for duplicate file, no new rows, partial overlap, and would-add states.
- Preserve the existing preview-then-commit safety model.

## Acceptance Criteria

- [ ] Empty DB state tells the user what to do and what they will learn.
- [ ] Parse failures are actionable and do not strand the user.
- [ ] Duplicate and partial overlap imports are clearly explained before commit.
- [ ] User can open settings/history after import without losing context.
- [ ] Import UX is verified with valid CSV, invalid CSV, duplicate CSV, and restored DB.

## Likely Files

- `apps/playground/src/pages/WelcomePage.tsx`
- `apps/playground/src/components/ImportPreviewDrawer.tsx`
- `apps/playground/src/components/ImportHistoryDrawer.tsx`
- `apps/playground/src/hooks/useDesktopIngest.ts`
- `scripts/desktop-ui-smoke.mjs`

## Out Of Scope

- Changing SQLite schema.
- Changing dedupe key semantics.
- Reintroducing browser web mode.

## Validation

- `pnpm lint`
- `pnpm typecheck`
- `node scripts/desktop-ui-smoke.mjs` where environment supports Electron smoke tests.
