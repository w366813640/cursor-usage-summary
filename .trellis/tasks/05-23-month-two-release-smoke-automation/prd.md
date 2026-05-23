# Month 2 Week 4: Release Smoke Automation

## Goal

Add a single release-readiness command for local maintainers that runs the important non-packaging gates in order.

## Requirements

- Chain lint, typecheck, tests, playground build, and bundle report.
- Keep packaging separate because signing/host requirements differ by OS.
- Document command expectations in the desktop release checklist.

## Acceptance Criteria

- `pnpm release:smoke` exists and runs locally.
- Release checklist references the command.
- Command passes in the current workspace.
