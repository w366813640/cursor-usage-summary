# Cursor Usage

> A local-first **Bloomberg-Terminal-style desktop app** for understanding what Cursor cost you and what to do next.
> 一个**本地运行**、密集仪表盘 + 自动叙事的 Cursor 用量分析桌面应用。

Drop in the `usage-events-*.csv` exported from [cursor.com/dashboard/usage](https://cursor.com/dashboard/usage) and the app turns it into:

- a one-line **week summary** ("$1,742 across 380 requests — $4.58/req, down 12% vs last week"),
- a **Day Audit** that auto-narrates the biggest spend and jumps you straight to the offending row,
- a **local anomaly detector** that flags days off your usual rhythm,
- a **30-day forecast** with a 95% confidence band,
- a **Year-in-review** with quarter-over-quarter deltas + per-model trends,
- a **Models** view with cache-hit + cost-per-request hygiene scores,
- a fully filterable **All requests** table with saved filters,
- and a **scenario planner** so you can ask "what if I always used Sonnet?"

Every number is computed on your machine. No network, no telemetry, no upload step.

---

## Status

- **Desktop app (Electron + SQLite)** — primary surface. Windows NSIS installer ships; macOS DMG and Linux AppImage build from the same `pnpm package:*` scripts.
- **`apps/playground`** — the same React UI Electron loads. You can also run it in a browser via `pnpm playground` for component work, but the welcome screen will tell non-Electron visitors to switch to the desktop build (no SQLite outside Electron).
- **Web mode was retired in PR20.** All IndexedDB / `idb-keyval` plumbing was removed; the canonical persistence is the SQLite file at `app.getPath('userData')/cursor-usage.db`.

---

## What's in the app

### 6 routes (default order, configurable in `Settings → Navigation`)

| Route | Purpose |
|---|---|
| **Overview** (`g o`) | Headline cost · this-week summary · action feed · 60-day calendar · week×hour heat · token / provider breakdown · model treemap · Top 5 burn stories · monthly budget panel · compare-ranges · 30-day forecast with confidence band |
| **Year review** (`g y`) | GitHub-style 365-day heatmap + per-year KPIs · 12-month bar · quarter-over-quarter deltas · cross-month trends · top-5 model MoM table with sparklines |
| **Anomalies** (`g a`) | Rule-based flags for days that look off (e.g. costlier than the local 7-day mean by 2σ) — each card jumps to the affected day's audit |
| **Models** (`g m`) | All models you've used: cost share, rows, avg, tokens, cache-hit %, mini-sparkline trend. Low-activity models (<10 requests **and** stale > 30 days **and** lifetime cost < $1) are auto-hidden with a "show all" escape hatch. Row→action jumps to the All-requests table pre-filtered by that model. |
| **All requests** (`g r`) | Every row (paginated): search, model filter, 3 sorts. cost ≥ $1 auto-amplifies in the type scale. **Saved filters** persist in `localStorage`. Row→action jumps to that day's Day Audit. |
| **Day audit** (`g h`) | The most-used view. One hero card combines total cost, share of week, biggest single request, day-over-day + same-weekday-week-ago comparisons, an auto-narrative paragraph, and a "mark as audited" affordance per row. |

### Discoverability

- **Sidebar** starts collapsed; click the bottom chevron to expand. Order + visibility are user-configurable from `Settings → Navigation` (drag to reorder, eye icon to hide).
- **Keyboard cheatsheet** — press `?` anywhere. Lists every registered shortcut by group.
- **Command palette** — `Cmd/Ctrl+K` for fuzzy-search actions.
- **Quick Tips** floating button (bottom-right) → cheatsheet + What's new with an unread dot.
- **Onboarding tour** — runs once on first post-import load (3 short steps; gated by `localStorage` `cu:onboardingV1Done`).
- **Trust hints** — small `i` icon next to any cost figure explains the pricing snapshot date and warns when a row was costed via the Auto-pool fallback.

### Data management (in `Settings → Data management`)

- Import another CSV (preview new rows + skipped duplicates before commit)
- Import history (every batch, two-step undo)
- Export redacted CSV (Cloud Agent / Automation IDs replaced with deterministic hash aliases)
- Export local report (Markdown summary with insights + planning scenarios)
- Compare two batches (modal: KPIs + cache-hit + max-mode + estimated stats side by side + daily sparkline)

### Bilingual UI (en / 简体中文)

Both the **chrome** (sidebar, settings drawer, welcome hero, onboarding, keyboard cheatsheet, Quick Tips, Trust hint, error boundary) **and the data narratives** (week summary card, Day Audit auto-paragraph, anomaly explanations, action feed insights, budget banner, efficiency recommendations, burn-story captions) speak both English (default) and Simplified Chinese. Switch in `Settings → Language`; the choice persists via `localStorage` (`cu:locale`) and `<html lang>` updates automatically.

Narrative translation is wired through a tiny `Translator` contract exported from `@cu/data`. Each builder accepts an optional `t` parameter and falls back to its English literal when called without one — so the test suite, the markdown report exporter, and any future CLI consumer keep working unchanged. Renderer components read `useT()` and thread it into the builder. See `.trellis/spec/frontend/i18n.md` for the full pattern + naming convention.

**Still English-only by design:**
the exported markdown report (`Settings → Manage data → Download local report`). Reports get pasted into issues / shared with teammates, so a single canonical language keeps them grep-able.

Adding a third locale is mechanical: copy `packages/ui/src/i18n/dictionaries.ts`, translate the values (274 keys), register the new key in `Locale`, add a button in `SettingsDrawer`. Missing keys silently fall back to English.

---

## Quick start

```bash
# Node 20+, pnpm 9+
pnpm install

# Run the desktop app (Electron + Vite dev server + SQLite ABI ensure)
pnpm desktop:dev

# Or browser-only component work (no DB, welcome screen redirects)
pnpm playground

# Workspace-wide gates
pnpm typecheck
pnpm lint
pnpm test
```

### Packaging

```bash
# Single-platform installers
pnpm --filter @cu/desktop package:win     # NSIS .exe
pnpm --filter @cu/desktop package:mac     # .dmg (x64 + arm64)
pnpm --filter @cu/desktop package:linux   # AppImage (x64)

# All three (only viable on macOS in practice)
pnpm --filter @cu/desktop package:all

# Quick smoke build (skips installer step)
pnpm --filter @cu/desktop package:dir
```

### Smoke tests (Playwright._electron)

```bash
node scripts/desktop-smoke.mjs            # boot + splash + main window screenshots
node scripts/desktop-db-smoke.mjs         # import → dedupe → restart → undo (25 assertions)
node scripts/desktop-ui-smoke.mjs         # dashboard / history / preview drawer (8 screenshots)
node scripts/desktop-year-smoke.mjs       # Year route / 365 heatmap / Agents page
node scripts/desktop-installer-smoke.mjs  # packaged .exe boot + IPC + DB hydration
```

---

## Privacy

- Nothing leaves the machine. The desktop app talks to zero external endpoints — no Cursor API, no telemetry pings, no auto-update fetch unless you opt in by exporting `CU_AUTO_UPDATE=1` and `CU_UPDATE_FEED_URL`.
- Local SQLite lives at `app.getPath('userData')/cursor-usage.db`. Settings JSON lives at the same folder under `cursor-usage-settings.json`.
- "Export redacted CSV" produces a share-safe file: every `cloudAgentId` / `automationId` is replaced with a deterministic short alias (`agent-xxxxxx` / `auto-xxxxxx`) while cost / tokens / model / date are preserved. Pair this with a screenshot redact pass and you can ask the community for help without leaking IDs.

---

## Architecture

```
cursor-usage-viz/
├── apps/
│   ├── desktop/                      Electron main process
│   │   └── src/
│   │       ├── main.ts               window + IPC bootstrap, titleBarOverlay theme sync
│   │       ├── preload.ts            contextBridge — exposes window.cursorUsage / window.bridge
│   │       ├── splash.ts             branded boot window
│   │       ├── db.ts                 thin wrapper over @cu/storage UsageDb
│   │       ├── settingsStore.ts      cursor-usage-settings.json read/write/normalize
│   │       ├── notifications.ts      budget toast dispatcher (respects budgetNotificationsMuted)
│   │       ├── budgetNotifier.ts     pure decision function (80% / 100% thresholds, per-month dedupe)
│   │       ├── trayIcon.ts           pure-zlib PNG encoder for a 5-bar mark (no PNG library dep)
│   │       ├── tray.ts               tray menu wiring + dynamic label updates
│   │       └── updater.ts            optional electron-updater event → IPC bridge
│   └── playground/                   React 19 renderer
│       └── src/
│           ├── App.tsx               provider tree (Theme, I18n, Brand, Tooltip, Toast, ModalStack,
│           │                         KeyboardShortcuts, SidebarState, CommandPalette, MotionConfig,
│           │                         ErrorBoundary)
│           ├── pages/WelcomePage.tsx Desktop boot · dropzone · Onboarding mount · QuickTips mount
│           ├── components/
│           │   ├── DashboardShell    chrome + route switch + budget reporter
│           │   ├── SideNav           collapsible rail (Analyze / Investigate groups)
│           │   ├── FileToolbar       Focus + Manage data (tiny strip; everything else moved to Settings)
│           │   ├── SettingsDrawer    Theme / Language / Density / Budget / Backup / Data Mgmt /
│           │   │                     Navigation / What's new / About
│           │   ├── KeyboardCheatsheet `?` overlay
│           │   ├── QuickTipsButton   bottom-right discoverability button
│           │   ├── OnboardingTour    first-run modal (3 steps, gated)
│           │   ├── TrustHint         `i`-tip explaining pricing source
│           │   ├── OverviewPage      composed from overview/* subpanels
│           │   ├── YearReviewPage    365-day heatmap + cross-month trends
│           │   ├── AnomaliesPage     local flag detector
│           │   ├── ModelsPage        sortable model table with auto-hide low-activity
│           │   ├── DetailsPage       all requests · SavedFiltersBar · cross-page pivots
│           │   ├── HoursPage         exports `DayPage`; the route is `#day` ("Day audit")
│           │   ├── ImportPreviewDrawer / ImportHistoryDrawer / CompareBatchesModal
│           │   ├── ForecastPanel / MonthlyBudgetPanel / CompareRangesPanel
│           │   └── overview/* (ActionFeed, BudgetUrgencyBanner, EfficiencyCard, GoalProgressPanel,
│           │                  OverviewKpiHero, OverviewActivity, OverviewBurns, ScenarioPlannerPanel,
│           │                  WeekSummaryCard)
│           ├── hooks/                useSettings, useFocusMode, useSidebarState (in @cu/ui),
│           │                         useAuditedRows, useDrawerA11y, useUnreadChangelog,
│           │                         useSavedDetailsFilters, useBudgetReporter
│           └── electron/             bridge wrapper + types mirror
├── packages/
│   ├── tokens/                       Tailwind v4 preset + chart palette
│   ├── motion/                       Framer Motion springs / variants
│   ├── icons/                        Lucide subset + CuMark brand glyph
│   ├── brand/                        BrandProvider + cu-warm / cu-bloomberg / cu-mono themes
│   ├── ui/                           Button / IconButton / Tooltipped / ThemeProvider /
│   │                                 I18nProvider / KeyboardShortcutsProvider / SidebarStateProvider /
│   │                                 ModalStackProvider / ToastProvider …
│   ├── data/                         CSV parsing · aggregator · redact · forecast · day audit helpers
│   ├── pricing/                      Model price table + matchModel + cost calculator + cache savings
│   ├── storage/                      better-sqlite3 schema · UsageDb · snapshot import/export
│   └── charts/                       Heatmap / WeekHourHeatmap / Sparkline / Treemap / KpiCard /
│                                     StackBar / StatGrid / SmallMultiples / BurnStoryCard
├── scripts/                          desktop-*-smoke.mjs (Playwright._electron) + bundle-report.mjs
└── .trellis/                         task PRDs, specs, journals (development-time only)
```

### Data flow

```
File (CSV)
  │ PapaParse + safe number/date coercion
  ▼
parseUsageCsv()      → ReadonlyArray<UsageRow>
  │ per-row pricing lookup (matchModel + calcCost)
  ▼
costRows()           → ReadonlyArray<RowWithCost>
  │ group by model / day / hour-weekday / provider, sort topBurns
  ▼
aggregate()          → UsageSummary
  │ persist (desktop only): UsageDb.importRows(SHA256-deduped batch)
  ▼
React state          → KpiCard / Heatmap / Day Audit / Forecast …
```

Every step is a pure function with unit tests; UsageDb is the only side-effect-having layer and lives behind a typed contextBridge.

### Pricing data

- 32+ models covered (Claude 4 / 3 family, GPT-5 family, Gemini, Grok, Composer, Code Supernova, Auto pool).
- Each row carries `input / output / cacheRead / cacheWrite` per-million-token prices.
- Max-mode rows are billed via a separate multiplier table.
- Snapshot date is exported as `PRICING_TABLE_AS_OF` and surfaced in every TrustHint tooltip so you can correlate cost shifts to table updates.
- Source: [cursor.com/docs/models-and-pricing](https://cursor.com/docs/models-and-pricing).

---

## Design philosophy

- **Information density first.** Bloomberg / Tufte rather than card-grid SaaS. Default dark, light is one click away.
- **Cost coach, not chart toy.** Every panel answers a question ("what to do next?"), not just shows numbers.
- **Anti-AI-slop.** No purple gradients. No emoji bullets. No rounded-card-with-left-border-accent. No decorative SVGs.
- **Type scale**
  - Headlines & big numbers: Source Serif 4
  - UI body: Inter
  - Data / tokens / cost: JetBrains Mono (with `tabular-nums` everywhere it matters)
- **Accent**: warm orange `#db8460` (dark) / terracotta `#c96f4a` (light) — easy on the eyes for hours-long sessions.
- **Density tiers**: Comfortable (default) / Dense / Presentation. Tuned via CSS variables, never inline styles.
- **Motion respects `prefers-reduced-motion`** — the shimmer skeleton and Framer Motion transitions both opt out gracefully.

---

## Tech stack

| Concern | Choice |
|---|---|
| Package manager | pnpm 9 + workspaces + Turbo 2 |
| Build | Vite 6 + React 19 + TypeScript 5.6 (strict) |
| Styling | Tailwind v4 (CSS Variables) |
| Animation | Framer Motion 11 (+ a tiny zero-dep shimmer keyframe) |
| Charts | D3 modules (scale / array / time / format / hierarchy / shape) + ~12 React wrappers |
| CSV parsing | PapaParse |
| Desktop | Electron 40 + electron-builder 25 + electron-updater 6.3 |
| Local DB | better-sqlite3 12.10 (WAL / WITHOUT ROWID / 12-col composite PK) via `@cu/storage` |
| Tests | Vitest (unit) + Playwright._electron (e2e + screenshot regression) |
| Lint / Format | Biome 1.9 |
| i18n | In-house: `@cu/ui` `I18nProvider` + dictionary JSON, ~150 LOC, zero deps |

---

## Release notes

The most recent build's highlights live in `apps/playground/src/utils/changelog.ts` and render inside `Settings → What's new` (with a red dot if you haven't seen them yet). For deeper history, browse the per-PR notes under `.trellis/tasks/` — they capture the design decisions in detail.

Highlight reel (recent):

- **30-day commercial polish** — sticky drawer headers, focus traps, Esc to close, drawer overlays now sit above the app header so titles are never clipped.
- **Keyboard discoverability** — `?` cheatsheet, `g + letter` navigation, `Cmd/Ctrl+,` for Settings.
- **Day Audit rewrite** — single hero card with auto-narrative, biggest-spend highlight, Jump-to-row.
- **Trust layer** — `i`-icon tooltips wherever a cost or ratio is shown, with the pricing snapshot date.
- **Cross-page pivots** — Anomalies cards → Day Audit, Models rows → filtered Details.
- **Saved filters** on the Details page (persisted in `localStorage`).
- **Budget notifications** can be muted from Settings (tray label keeps updating regardless).
- **Bilingual everything** — English (default) + 简体中文 toggle in Settings, covering both chrome and the data narratives via a tiny `Translator` contract in `@cu/data`.

---

## License

MIT. The codebase is a personal project; no warranties, no support contract. Use it, fork it, share it.

## Credits

- Pricing data sourced verbatim from [cursor.com/docs/models-and-pricing](https://cursor.com/docs/models-and-pricing).
- Inspiration: Bloomberg Terminal, Edward Tufte's *The Visual Display of Quantitative Information*, GitHub's contribution graph.
- Design tokens evolved from the `oh-my-open-ui` and `writing-aassist` base projects.
