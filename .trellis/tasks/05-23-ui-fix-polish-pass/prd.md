# UI fix and polish pass

User reports several UX/visual issues plus asks for proactive discovery of more
improvements. All work is renderer-side in `apps/playground` + a small main-process
fix for the title-bar overlay.

## Hard requirements (from user)

1. **Density** — main screen feels cramped, small text hurts readability.
   - Approach: keep the three density presets (`comfortable / dense / presentation`),
     but make `comfortable` (default) noticeably more airy: bigger panel padding,
     larger line-height, increased inter-section gap, **floor every visible text
     size at 11px** (kill 9px / 10px throughout).
2. **Right-side dark seam** — the Windows title-bar overlay shows the dark
   `#1F1E1B` color when the renderer is in light mode (and vice-versa) because
   `setTitleBarOverlay` only re-fires on system theme change, not on the user
   toggling the in-app theme. Fix: have `theme:set` IPC update the overlay too,
   and make the renderer call `theme:set` whenever the resolved mode changes.
3. **Sidebar interaction** — currently hover-to-expand. Replace with
   click-the-chevron-only; persist the expanded state in localStorage.
4. **File toolbar cleanup** — once data is imported, the metadata strip (file
   name / rows seen / parse time / date range / saved-ago) is noise. Hide the
   strip entirely. Move `Import / History / Redacted / Report` actions into the
   Settings drawer under a new "Data management" group. Keep `Focus` toggle in
   the dashboard chrome (it directly affects the page layout).
5. **Nav order / hide** — Settings drawer gains a "Navigation" group with
   drag-to-reorder + per-route visibility toggle; persist to settings store.
6. **Day Audit (top priority)** — rebuild as:
   - Top "today's answer" hero strip (cost / share of week / single most
     expensive request with model & time), replacing the 5-cell `Day total`
     panel.
   - Auto-narrative paragraph ("The 14:00 burst drove 38% of today's cost
     — opus-thinking-max at $4.12 avg / request. Consider routing routine
     work to sonnet-thinking to save ~$XX.").
   - One-click "Jump to that request" anchored to the row in the detail table.
   - Day-over-day comparison card (today vs yesterday + today vs same weekday
     last week).
   - "Mark as audited" per row, persisted to localStorage — audited rows
     dim and a header summary shows "X of Y audited".

## Proactive improvements (agent-discovered)

- Standardize small caps to ≥11px across panels, toolbars, drawers.
- WeekSummaryCard: increase headline leading; gap-y on bullets ≥ 8px.
- Panel title dot + serif title: bump dot to 8px and title to 17px (was 16/6).
- SettingsDrawer status banner: pill becomes 12px, easier to read at a glance.
- Stagger panel mount animations consistently (currently several use 0.42s
  with overlapping delays; normalize to a `panelEnter()` helper).
- Sidenav: when collapsed, the route group label currently fades to opacity-0
  but still reserves vertical space — collapse height to 0 so the rail feels
  tighter.

## Out of scope

- Server-side / SQLite schema changes — none of the requested fixes need them.
- New analytical features beyond Day Audit narrative — keep insight engine
  reused.
- Onboarding / WelcomeHero copy — already iterated in prior tasks.

## Success criteria

- [ ] No visible 9px / 10px text in the production UI (lint via grep of
      `text-\[(9|10)px\]`).
- [ ] Right-side seam matches the active theme in both light and dark.
- [ ] Sidebar no longer animates on hover; chevron click toggles & persists.
- [ ] File toolbar shows only the Focus toggle when data is loaded.
- [ ] Settings drawer exposes nav order + data management.
- [ ] Day Audit shows the answer hero + narrative + comparison + mark-audited.
- [ ] `pnpm typecheck` + `pnpm lint` clean.
