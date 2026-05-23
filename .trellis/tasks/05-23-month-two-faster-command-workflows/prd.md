# Month 2 Week 2: Faster Command Workflows

## Goal

Make the app feel faster for keyboard-heavy users by exposing common desktop actions from the command palette.

## Requirements

- Add commands for focus mode, settings, import, import history, and report export where action context is available.
- Keep command names searchable with aliases.
- Avoid commands that silently mutate user data.

## Acceptance Criteria

- Keyboard users can discover major actions from Cmd/Ctrl+K.
- Commands remain disabled or absent when no desktop context exists.
- Typecheck and lint pass.
