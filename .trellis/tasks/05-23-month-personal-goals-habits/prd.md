# Week 3: Personal Goals and Habits

## Goal

Let users define lightweight local goals so the cost coach can translate generic insights into personal habits.

## Requirements

- Persist goals in the existing settings store.
- Support monthly request target and one optional habit focus.
- Surface goal progress without adding account or sync concepts.
- Keep defaults compatible with existing settings files.

## Acceptance Criteria

- Settings can save and reset local goals.
- Overview/action surfaces can read goals.
- Existing settings migration path remains tolerant of older JSON.
- Typecheck and lint pass.
