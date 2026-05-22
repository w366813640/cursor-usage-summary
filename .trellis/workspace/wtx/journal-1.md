# Journal - wtx (Part 1)

> AI development session journal
> Started: 2026-05-14

---



## Session 1: Desktop app PR21->PR25: native binary auto-switch + Settings + Year heatmap + Compare batches + Forecast + cross-platform packaging + tray + budget toast

**Date**: 2026-05-15
**Task**: Desktop app PR21->PR25: native binary auto-switch + Settings + Year heatmap + Compare batches + Forecast + cross-platform packaging + tray + budget toast
**Branch**: `master`

### Summary

Pushed the full desktop roadmap end-to-end across 5 PRs + 1 dev fix. PR21: install-natives.mts auto-detects and swaps the better-sqlite3 ABI on desktop:dev vs itest boot. PR22: Settings drawer (theme/budget/currency/DB path) + DB JSON backup/restore for cross-machine sync. PR23: Year heatmap (GitHub-style 365-day calendar with cost/req/tokens toggle), burn caption upgrade (5 categories with max-mode 2x callout), Cost-per-agent route (Cloud Agent / Automation aggregation). PR24: Compare two batches modal (side-by-side stat cards + delta) backed by new UsageDb.batchStats(), 30-day Forecast panel with OLS linear regression + 95% CI band. PR25: mac .dmg (x64+arm64) + linux .AppImage configs + documented publish providers + event-driven auto-updater IPC bridge, tray icon (zlib-encoded PNG, no committed asset), Windows toast notifications at 80%/100% budget thresholds with per-month dedup persisted to disk. Also fixed dev orchestrator: Electron silently exited on Windows when stdio was piped without --enable-logging. Quality gates: 175 vitest (153 prior + 22 new for budgetNotifier+trayIcon) + 3 smoke (db / ui / year) + typecheck + biome all green. Pushed to origin/master at github.com:w366813640/cursor-usage-summary (17 commits total).

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `2d2e887` | (see git log) |
| `33db98b` | (see git log) |
| `c8b6dfc` | (see git log) |
| `b79543d` | (see git log) |
| `941b299` | (see git log) |
| `0c82acb` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete

---

## Session 2: v1.2 power upgrade — anomaly inspector + efficiency calculator + side nav + budget urgency

**Date**: 2026-05-22
**Task**: 05-22-v12-power-upgrade (archived to 2026-05/)
**Branch**: `master`

### Summary

Shipped v1.2 across 6 small PRs in one YOLO session, full-stack from
pure-data utilities to UI layer. New surfaces: Cmd+K command palette,
"Anomalies" route with 3 statistical detectors (cost spike via robust
z-score / MAD with ratio fallback, cost-per-request shift, cache hit
drop), Efficiency analyzer with two what-if scenarios + ranked plain-
English recommendations, sticky Budget Urgency banner that projects
month-end exhaustion day, left-rail collapsible icon SideNav (replaces
top NavTabs), Focus Mode toggle that strips the Overview to just the
high-signal cards, new cu-linear-night brand, Heatmap outlier ring
that visually echoes the anomaly detector, WeekSummaryCard narrative
("X this week across N models · top driver M") on the Overview, copy-
to-clipboard on every KPI hero card, interactive Sparkline with hover
crosshair + click-to-drill, Heatmap day-click that drills into the
Hours page via sessionStorage.

### Main Changes

- packages/data: 4 new pure modules + 33 vitest cases
  - weekSummary.ts (composeWeekSummary)
  - anomalies.ts (detectAllAnomalies, detectCostSpikes, detectCostPerReqShifts, detectCacheHitDrops + median/MAD/robustZScore)
  - efficiency.ts (computeEfficiency)
  - budgetGuard.ts (computeBudgetUrgency)
- packages/charts: Sparkline hover/click; KpiCard copyable; Heatmap outlierDates ring.
- packages/brand: cu-linear-night brand (indigo on navy).
- packages/icons: + Database export.
- apps/playground: SideNav, CommandPaletteProvider (kbar), AnomaliesPage, EfficiencyCard, WeekSummaryCard, BudgetUrgencyBanner, useFocusMode hook, FileToolbar focus toggle.
- DashboardShell rewritten as `[SideNav | main]` two-column flex.
- OverviewPage reflows: Banner -> Week -> KPI -> Efficiency -> (focus-gated context panels).

### Git Commits

| Hash | Message |
|------|---------|
| `8b4a535` | v1.2 PR1: Cmd+K palette + week-summary + copyable KPI + sparkline + heatmap drill |
| `e027851` | v1.2 PR2: anomaly inspector (3 detectors + dedicated route) |
| `58b916b` | v1.2 PR3: efficiency analyzer (per-model $/req + what-if + recs) |
| `17b6980` | v1.2 PR4: collapsible left-side icon nav, drops top tabs |
| `fc5caeb` | v1.2 PR5: focus mode + cu-linear-night brand + calendar outlier ring |
| `c5649dd` | v1.2 PR6: budget urgency banner — exhaustion-day projection |

### Testing

- [OK] pnpm -w lint: 213 files, 0 warnings, 0 errors
- [OK] pnpm -r typecheck: 9 packages green
- [OK] pnpm -w test: 69 data + 22 desktop = 91 unit tests pass (+33 new in this session)
- [OK] @cu/playground build: 4.9s, no errors

### Status

[OK] **Completed**

### Next Steps

- (optional) Power-user surface: per-day diff view, e2e Playwright for new routes.
- (optional) Wire cu-linear-night into the brand-swatch onboarding tour.
- None blocking.
