# Polish: Beautify Agents + Simplify Overview + Cleanup + Final Delivery

## Goal

User requested a final consolidation pass before shipping v1.0:
- **美化AI** — beautify the AI-themed page (AgentsPage)
- **简化数据** — reduce data density / consolidate redundant displays in Overview
- **去除容易项目** — remove low-value / dead code / redundant features
- **最终交付** — run quality gates and commit

User explicitly delegated all decisions: "不要问我任何问题，我都采取你的推荐。直接执行，直到完成"

## What I already know

- Project is at v1.0 / PR25, fully feature-complete
- 6 routes: Overview · Year · Models · Agents · Details · Hours
- The Agents page (`AgentsPage.tsx`, 25 KB) is the most AI-themed surface — it answers "which Cloud Agent / Automation is burning my budget"
- The Overview page stacks 6 sections vertically (KPI hero · MonthlyBudget · CompareRanges · Forecast · Activity · Burns) — lots of scroll
- The `KpiCard` "Cache reuse savings" card has 3 different numerical reads (headline + hit ratio + "if billed as fresh input" + "actual cache-read cost") — visually overloaded
- `NavTabs` has a `TAB_HINTS` dict feeding native `title` tooltips — barely visible, low value
- The `dateRange` shown in `ExpandableAgentRow` includes a tooltip `title={dateRange}` but always also renders `lastDate` plainly — the user can never see the first-seen date

## Decisions (ADR-lite — made by AI per user delegation)

### Decision 1: Beautify AgentsPage with focused visual upgrades (not a rewrite)

**Context**: AgentsPage is functional but the visual hierarchy can be tighter — the KPI strip uses equal-weight cards (4×), and the table rows lack a leading rank badge that visually anchors the "this is #1 / #2 / #3 burn" idea (the Models page already does this).

**Decision**:
- Promote the top-3 agents with a leading colored rank chip (#1 accent, #2/#3 muted) — mirror the Top 5 burns convention.
- Tighten the KPI strip: the "Top agent" card already has `accent`, but the value font is the same size as the others — make it visibly larger to confirm "this one matters most".
- Add a tabular-nums + framer fade-in on the agent table rows so the page feels alive on mount, matching ModelsPage/HoursPage.
- Show **both** `firstSeen → lastSeen` inline (instead of only `lastSeen`) — the tooltip is unreliable and the active-range arc is the most useful single piece of context per agent.

**Consequences**: AgentsPage feels more consistent with the rest of the dashboard; no logic changes; pure visual polish.

### Decision 2: Simplify the "Cache reuse savings" KPI card

**Context**: The fourth Overview hero card crams 4 numbers (headline savings · hit ratio · "if billed as fresh input" · "actual cache-read cost") + a sparkline + a badge into one card. The two inset rows ("if billed as fresh input" / "actual cache-read cost") are arithmetic that recomputes the headline — they don't add information.

**Decision**: Replace the two redundant inset rows with one focused inset that surfaces a NEW number: **`tokens reused`** + **`vs lifetime input`** — the "scale of free compute" framing. This drops the visual line count from 4 to 2 and the new framing is actually new info.

**Consequences**: KPI card balance matches the other three (each has 1-2 inset rows max); the redundant arithmetic is implicit in the headline.

### Decision 3: Consolidate Overview "Composition" section

**Context**: The Composition row in Overview currently has 2 panels side-by-side (Token mix · Spend by provider), each a `StatGrid` of 4-ish items. Below them, the model treemap and small-multiples follow. The two side-by-side panels are essentially the same visual idiom — two parallel breakdowns.

**Decision**: Merge `Token mix` + `Spend by provider` into a single 2-column Panel ("Token & provider mix") with a single subtitle and a shared empty state. Visually less duplication, same data.

**Consequences**: One fewer panel header / border / subtitle, same data density — the Overview becomes slightly less staccato.

### Decision 4: Remove low-value items

**Decision**:
- Remove `TAB_HINTS` (native `title` tooltips) from `NavTabs` — the tab labels are already self-explanatory and the tooltips create accessibility noise.
- Remove unused exports / dead branches encountered while editing.

**Consequences**: Less code, fewer "what is this for?" code-review questions.

### Decision 5: Final delivery

**Decision**: Run `pnpm lint` + `pnpm -r typecheck` + `pnpm -w test`; only commit if all three pass. Commit message style matches recent history (`feat:` / `fix:` / `chore:` prefix, English, short).

**Consequences**: Predictable shippable state.

## Requirements

- AgentsPage: rank chips on top-3 rows, larger "Top agent" KPI value, inline first→last date range, mount fade-in
- Overview KPI hero: Cache savings card shows `tokens reused` + `vs lifetime input` instead of redundant cost arithmetic
- Overview Activity: Token mix + Spend by provider merged into one 2-column panel
- NavTabs: `TAB_HINTS` + `title` attribute removed
- All lints / typechecks / tests green
- Single commit, conventional message

## Acceptance Criteria

- [ ] `pnpm lint` exits 0
- [ ] `pnpm -r typecheck` exits 0
- [ ] `pnpm -w test` exits 0 (all existing tests pass; no new tests required since this is a visual + minor refactor task)
- [ ] AgentsPage: top-3 rows visually distinct from rest
- [ ] AgentsPage: "Top agent" KPI value larger / bolder than peer KPI values
- [ ] AgentsPage: every row shows `first → last` date when first ≠ last
- [ ] Overview cache savings card has at most 2 inset rows, shows tokens reused
- [ ] Overview composition section has 1 merged token+provider panel (was 2)
- [ ] `NavTabs.tsx` no longer references `TAB_HINTS`
- [ ] Single git commit lands with a descriptive message

## Definition of Done

- Lint / typecheck / tests green
- Manual scan of dev server (if time) confirms no broken layouts (optional — skip if dev server slow to boot on this machine)
- Commit pushed to `master` is not required; just landed locally

## Out of Scope (explicit)

- No new routes / pages
- No new charts
- No backend / IPC / DB changes
- No design-token / color changes (the theme is shipped as-is)
- No removal of existing functionality beyond `TAB_HINTS`
- No README / docs update (those are accurate as-is)
- No PR / push to remote

## Technical Approach

1. Beautify AgentsPage:
   - `AgentsPage.tsx`: introduce a `RankChip` mini-component (#1 / #2 / #3 only); render before the agent label in the table row.
   - Increase `AgentKpi` value size when `accent=true` (use `text-[26px]` instead of `text-[22px]`).
   - Replace single `lastDate` cell with `firstDate → lastDate` (or just `lastDate` if equal) — keep the existing `dateRange` variable.
   - Add a `motion.tr` wrapper or staggered child animation to the table body on mount.
2. Simplify cache savings KPI in `OverviewKpiHero.tsx`:
   - Drop the two redundant inset rows.
   - Replace with: `tokens reused` row + a one-line "saved {savings} on {fmtTokens(cacheReadTokens)} reused tokens".
3. Merge composition panels in `OverviewActivity.tsx`:
   - One `<Panel title="Token & provider mix">` with `grid-cols-1 lg:grid-cols-2` inside; each half retains its `StatGrid`.
4. `NavTabs.tsx`: drop `TAB_HINTS` const + `title` attr.
5. Run `pnpm lint && pnpm -r typecheck && pnpm -w test` (PowerShell: use `;` not `&&` if needed).
6. `git add` + `git commit -m "polish: agents + overview consolidation + cleanup"`.

## Technical Notes

- pnpm 9 workspace + Turbo. Lint is biome (`pnpm lint`).
- Tests live in `packages/*/test/` (vitest) and `apps/*`.
- Active task is `05-17-polish-and-deliver` (just created).
- No spec files exist yet — `.trellis/spec/{backend,frontend}/` is empty (bootstrap task unfinished). That's not blocking for this visual / cleanup work.
