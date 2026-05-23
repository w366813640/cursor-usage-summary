# 30-Day Commercial Polish — PRD

## Why

The previous UI fix pass (`05-23-ui-fix-polish-pass`) shipped the big
visible items the user called out: dark-seam fix, density polish,
sidebar click toggle, FileToolbar consolidation, Day Audit rebuild,
sticky chrome, Models hygiene. The product still feels like a
power-user dashboard rather than a polished consumer/SaaS desktop app.

This task is the "commercialisation" pass: close the gap between
"works for me on my machine" and "I'd be comfortable putting this in
front of a paying customer's eyes". The user explicitly asked for
**product quality + 人性化 (humanisation)** improvements, not new
features.

## Success criteria

A user opening the app for the first time can:

1. Understand what the app does within the first 5 seconds (hero card
   + welcome tour intro).
2. Import a CSV without reading documentation (clear empty-state CTA,
   inline error rescue, drag-drop affordance).
3. Open Settings → "Manage data" or any drawer without the app
   header overlapping the drawer chrome (the `c366a60` regression).
4. Navigate the whole app with the keyboard only (Cmd/Ctrl+K + arrow
   keys + Esc) and have visible focus rings throughout.
5. Discover at least one new useful affordance per session via
   passive surfaces (tooltips, hover hints, "?" floating quick-tips
   button).
6. Open the Settings drawer's header at any scroll depth (sticky
   drawer-internal header).
7. Recover from every error path with a single click (retry, copy,
   reveal in folder) — no silent dead ends.

## In-scope (this session)

### A · Drawer chrome (fix the `c366a60` regression)
1. **All drawer overlays z-[60]** (above sticky app header z-50) →
   already done at commit `pending`.
2. **Drawer-internal sticky headers** — Settings / ImportPreview /
   ImportHistory drawers each keep their own title bar visible as
   the drawer scrolls (previously the title disappeared when the
   drawer body was tall enough to scroll).
3. **Drawer body padding-top accounts for sticky drawer header**
   so the first section doesn't tuck under it on initial open.

### B · Empty states (don't leave the user staring at a blank panel)
4. **OverviewPage** when `summary.totalRows === 0` → friendly empty
   block ("Import a CSV to see your dashboard") with the same
   onPick CTA that the welcome hero uses.
5. **AnomaliesPage** already has "No anomalies detected" — verify
   it still renders correctly under sticky chrome.
6. **ModelsPage** when `partition.visible.length === 0` AND
   `hideLowActivity === true` → suggest "show all" link inline.
7. **HoursPage** (Day audit) when `targetDate` not in dataset →
   answer-hero already says "No requests on this day yet"; keep
   verified.

### C · Keyboard & a11y
8. **Esc closes every drawer** — audit Settings / ImportHistory /
   ImportPreview / CompareBatchesModal; standardise on a shared
   `useEscToClose(open, onClose)` hook.
9. **Focus trap inside drawers** — first focusable element gets
   focus on open; Tab/Shift-Tab cycle within drawer.
10. **Keyboard shortcut overlay** triggered by `?` (Shift+/) →
    floating modal listing every shortcut (`Cmd/Ctrl+K`,
    `Esc`, `?`, `F` for focus, etc).
11. **Visible focus rings** — single CSS variable
    `--cu-focus-ring` and `:focus-visible` applied everywhere
    (audit Panel buttons / nav rail / Settings inputs).

### D · Discoverability
12. **First-run onboarding tour** — three coachmark steps after the
    first successful import:
      (1) "This is your dashboard — the headline is here."
      (2) "Switch tabs in the sidebar (collapsed by default — click
         the chevron to expand)."
      (3) "Open Settings → Manage data for import, exports, and
         navigation order."
    Persisted via `localStorage` key `cu:onboardingV1Done`.
13. **Floating Quick Tips ("?") button** bottom-right that opens
    the keyboard-shortcuts overlay + a "What's new" panel.
14. **"What's new" panel** in Settings → reads a hard-coded
    `CHANGELOG_ENTRIES` array; bumps `cu:lastSeenChangelogVersion`
    so unseen entries get a dot indicator on the Quick Tips
    button.
15. **About panel** in Settings → version, build hash (if available
    via Electron bridge), data location path, license, source link.

### E · Microcopy & polish
16. **Tooltip consistency** — wrap critical hover affordances with
    a shared `<HelpHint>` component (single 220ms delay,
    consistent typography, max-width).
17. **Loading shimmer** — replace pulse skeletons with a shared
    `Shimmer` component for visual coherence.
18. **Hover-row "open day audit" inline action** on the Details
    page so power users jump faster than the heatmap drill-down.

## Out-of-scope (deliberately deferred)

- Full localisation (the I18nProvider is present but only "en" is
  used; multi-language can wait until the visual chrome stabilises).
- Telemetry / opt-in usage reporting.
- Auto-update UX redesign (current `UpdateStatusCard` is functional).
- Multi-CSV diffing UI beyond `CompareBatchesModal`.
- Performance pass beyond what's already shipped (virtualised
  tables ≥ 1000 rows can wait — current datasets fit fine).

## Verification

- `pnpm typecheck` + `pnpm lint` + `pnpm test` clean.
- Walk through items 1-18 with the Electron dev shell open.
- Visual smoke: import a sample CSV, open every drawer, press `?`
  to surface shortcuts, press `Esc` to close. Tab through Settings
  fields with the keyboard.
- Confirm onboarding tour fires once on a freshly-cleared
  localStorage and never again on subsequent loads.
