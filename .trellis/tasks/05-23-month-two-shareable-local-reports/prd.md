# Month 2 Week 1: Shareable Local Reports

## Goal

Add a privacy-safe markdown report export so users can share a cost summary without exposing raw CSV data.

## Requirements

- Export headline cost, requests, date range, top insights, and scenario summary.
- Redact or omit raw row IDs, Cloud Agent IDs, Automation IDs, and prompt-like data.
- Use client-side download; no network or disk IPC required.

## Acceptance Criteria

- Toolbar exposes a report export action.
- Markdown file contains summary and action recommendations.
- Typecheck and lint pass.
