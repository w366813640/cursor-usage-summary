# Month 1: Product Acceleration Roadmap

## Goal

Execute a one-month upgrade plan that moves Cursor Usage from a strong local dashboard into a polished local-first cost coach with support readiness, planning tools, personalization, and quality gates.

## Workstreams

1. Diagnostics and support bundle: privacy-safe local support export, update state clarity, release checklist follow-through.
2. Forecast scenarios and budget planning: deterministic scenarios that answer "what happens if I change habits?"
3. Personal goals and habits: local goals, action feed personalization, and progress cues.
4. Performance and quality hardening: bundle budget reporting, lazy-load guardrails, tests, and accessibility smoke coverage.

## Requirements

- Keep all user data local; no network or LLM calls.
- Prefer pure data functions with focused tests before UI.
- Preserve existing Electron security posture and IPC boundaries.
- Commit each executable workstream separately after validation.

## Acceptance Criteria

- Each child task has a PRD and a concrete implementation commit.
- New features have deterministic behavior and validation commands.
- Release/support surfaces do not leak raw prompt text, IDs, or CSV contents.
- Existing dirty user work is not reverted or accidentally committed.
