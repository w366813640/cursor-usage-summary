# Month 2: Power-User Workflow Roadmap

## Goal

Make Cursor Usage faster to operate and easier to share/debug locally through privacy-safe reporting, command workflows, explainability, and release automation.

## Workstreams

1. Shareable local reports: export a redacted markdown summary from loaded data.
2. Faster command workflows: expose common actions through the command palette.
3. Explainability polish: make insights and scenarios easier to audit.
4. Release smoke automation: provide one command for release readiness checks.

## Requirements

- Keep exports local and redacted.
- Reuse existing action, insight, and scenario functions.
- Avoid adding external services or account concepts.
- Commit each workstream separately after validation.

## Acceptance Criteria

- Report export works without raw IDs or prompts.
- Command palette covers key desktop actions.
- Insight/scenario cards expose assumptions and confidence.
- Release readiness command is documented and runnable.
