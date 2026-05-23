# Week 1: Diagnostics and Support Bundle

## Goal

Make the desktop app support-ready without compromising privacy by adding a user-facing diagnostics export and clear support copy.

## Requirements

- Export only metadata: app/platform versions, settings shape, row/batch counts, update status, and paths.
- Do not export raw rows, prompt text, Cloud Agent IDs, Automation IDs, or file contents.
- Surface diagnostics from Settings near backup/update controls.
- Keep IPC whitelisted through preload and typed in the renderer.

## Acceptance Criteria

- Settings includes a diagnostics export action with success/error feedback.
- The exported JSON is readable and privacy-safe.
- Typecheck, lint, and desktop tests pass.
