# Day 7: Desktop Release UX Hardening

## Goal

Prepare Cursor Usage to feel like a real shipped desktop app by improving release UX, diagnostics, backup/restore confidence, update affordances, and packaging smoke coverage.

## Requirements

- Add or document final app icon and signing/notarization requirements.
- Improve update UX around disabled, checking, available, downloaded, and error states.
- Add a user-facing diagnostics/export plan for support without leaking private data.
- Validate backup and restore copy, failure handling, and success confirmation.
- Add an error boundary or top-level recoverable error surface for renderer failures.
- Keep Electron security posture: context isolation, sandbox, node integration off, IPC whitelist.

## Acceptance Criteria

- [ ] Release checklist exists and covers Windows, macOS, and Linux expectations.
- [ ] Update status is visible and understandable when auto-update is disabled or unavailable.
- [ ] Backup/restore paths have clear success and failure states.
- [ ] Renderer errors show a recoverable product surface, not a blank window.
- [ ] Packaging smoke matrix is documented and runnable on supported hosts.

## Likely Files

- `apps/desktop/electron-builder.yml`
- `apps/desktop/src/updater.ts`
- `apps/desktop/src/main.ts`
- `apps/playground/src/components/SettingsDrawer.tsx`
- `apps/playground/src/App.tsx`
- `scripts/desktop-installer-smoke.mjs`
- `README.md`

## Out Of Scope

- Actually purchasing certificates.
- Shipping a public update server.
- Changing database schema.

## Validation

- `pnpm desktop:build`
- `pnpm --filter @cu/desktop test`
- `node scripts/desktop-installer-smoke.mjs` when packaged artifact is available.
