# Week 2: Forecast Scenarios and Budget Planning

## Goal

Add a deterministic planning layer that turns current usage into simple scenarios: stay the course, improve cache efficiency, reduce top-burn work, or tighten request volume.

## Requirements

- Implement pure data functions with tests.
- Scenario output should include projected requests/cost, delta, and a plain-English action.
- Render a concise Overview panel near forecast/budget surfaces.
- No network calls or stochastic behavior.

## Acceptance Criteria

- Data tests cover empty data, baseline, and savings scenarios.
- Overview shows the top scenarios with actionable copy.
- Typecheck and lint pass.
