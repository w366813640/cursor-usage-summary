# v1.2 Power Upgrade: anomaly detection + efficiency + side nav + reports

## Goal

把 v1.0/v1.1（Bloomberg/Tufte 风的密集可视化）升级成"AI 时代的运营 dashboard"。
重点弥补三个 gap：

1. **缺异常检测层** — 用户每天打开 dashboard 时最关心 "今天 vs 我平时一样吗"，
   当前完全没回答（只有月底 80%/100% budget toast）。
2. **缺行动建议层** — KPI 报数完就结束，没有 "next-step recommendation"。
3. **缺 power UX** — 没有 Cmd/Ctrl+K palette、没有 focus mode、顶部 6 tabs
   已经拥挤未来无扩展位、chart 没有 hover crosshair / click-to-drill。

用户原话："让这个项目更加[好用]，UI 更加炫酷，参考市面上最好最全的统计信息。
review 项目，提出建设性意见。" + YOLO 模式（自动化执行到完成）。

参考的标杆（详见 `research/competitive-landscape.md`）：

| 标杆 | 我们要学的 |
|---|---|
| `cursor-usage-tracker` (GitHub 19★) | 三层 anomaly detection + expensive-model alert + MTTD/MTTI/MTTR + cost-spike 自动归因 |
| `PostHog Insights` | 13 种 anomaly 算法 + Simulate 预览 + request clustering（2D embedding scatter）+ narrative explainer |
| `Vercel / Linear` | command palette + 左侧 collapsible nav + 单 accent + 4-step surface ladder + Geist 字体 |
| `Cloudflare Custom Dashboards` | 模板 gallery + log-explorer drill-down |
| `ModelMeter / TokenTop / OpenUsage` | budget guardrails + live burn rate + adaptive sidebar |

## What I already know

- **Stack**: pnpm 9 + turbo + Vite 6 + React 19 + TS 5.6 strict + Tailwind v4 + Framer Motion 11
  + D3 modules + PapaParse + Biome 1.9 + Vitest + Playwright._electron
- **Routes**: 6 个 — Overview, Year, Models, Agents, Details, Hours
- **核心 chart 组件**（在 `@cu/charts`）：Heatmap, WeekHourHeatmap, Sparkline, Treemap, KpiCard,
  StackBar, StatGrid, SmallMultiples, BurnStoryCard
- **桌面 IPC** 已成熟：`bridge.{window, theme, app, platform, db, settings, budget, update}`
- **SQLite schema** 已固化（PR16+），不动；新功能都在 `apps/playground` 层或 `@cu/data` 派生函数
- **设计 token** 在 `packages/tokens`（CSS variable driver）+ Brand 主题在 `packages/brand`

## Decisions (ADR-lite — made by AI per user delegation in YOLO mode)

### Decision 1: 拆 9 个 PR，按 ROI × 工作量排序

理由：单 PR 容易 review、容易回滚、commit 历史清晰；用户已 ship v1.0 不能因为
某个 PR 失败把全局拖坏。

### Decision 2: anomaly detection 用统计法本地实现，不引外部依赖

- z-score / robust z-score (MAD) 都是几十行代码
- 不调 OpenAI/Anthropic（违反 "100% local" 隐私哲学）
- 不引 PostHog SDK / sentry（既增依赖也违反 local-only）

### Decision 3: command palette 用 `kbar` 而不是自写

- `kbar` ~10KB gzipped，React-native API，比自写 200 行省时间且更稳定
- 已经支持 fuzzy search、nested action、keyboard nav、ARIA

### Decision 4: 左侧 nav 用 collapsible icon 两态（icon-only 60px / 展开 220px）

- 顶 NavTabs 已经 6 项，加 anomalies/efficiency/health/reports 必爆
- Linear/Datadog/Cloudflare/Vercel 全部左侧 nav，是 power dashboard 标配

### Decision 5: 不做 E3 (CSV 自动 fetch from cursor.com)

- 违反 "100% local" 隐私设计的核心承诺
- 即使作为 opt-in 也会增加 maintenance + 招致 user issue
- 留给将来再决定，本 task 不做

### Decision 6: D1 Monthly Report 用 `react-pdf` 而非 `pdf-lib`

- `react-pdf` 用 JSX 写布局，复用现有 component 思维
- `pdf-lib` 偏向 raw 文档操作，写复合 layout 痛苦

### Decision 7: 不动 SQLite schema / IPC contract

- v1.1 桌面已发布，DB 兼容性是硬约束
- 所有派生函数留在 `@cu/data` 层（纯函数，零持久化副作用）

## Requirements

### 必须项（v1.2 minimum）

- [ ] **R1**: Cmd/Ctrl+K Command Palette（路由跳转 + 设置项 + 数据动作）
- [ ] **R2**: Overview 顶部「This week in a sentence」自动叙事卡
- [ ] **R3**: Sparkline / 月柱图 / Heatmap 统一加 hover crosshair + click-to-drill
- [ ] **R4**: KPI 数字 hover 出现 copy icon，点击复制到剪贴板
- [ ] **R5**: Top 5 burns 加自动归因小卡（已有 `burnCaption()` 函数，扩展即可）
- [ ] **R6**: 新路由 `#anomalies` — 3 类检测 + calendar 上异常日红描边
- [ ] **R7**: ModelsPage 加 efficiency 列（$/Mtok output, $/req avg, vs cheapest peer 倍数）
- [ ] **R8**: ModelsPage 底部加 "savings calculator"（if move X% opus → sonnet, save $Y）
- [ ] **R9**: MonthlyBudgetPanel 加 expensive-model blacklist + 剩余预算 / 剩余天数 pace gauge
- [ ] **R10**: 左侧 collapsible icon nav，替换顶部 NavTabs
- [ ] **R11**: 任意 `<Panel>` 加 focus mode（点击 ⤢ → portal 全屏）
- [ ] **R12**: 新增 `cu-mono` + `cu-linear-night` 两个 brand theme

### 期望项（v1.2 stretch）

- [ ] **R13**: outlier ring（所有 line/bar 偏离 baseline 2σ 的点描边）
- [ ] **R14**: D1 Monthly Report 一键 PDF
- [ ] **R15**: D2 Cost Story Timeline（Year route 横向 timeline）
- [ ] **R16**: D3 Goal Tracking（"this month under $X" 进度环）
- [ ] **R17**: E2 Time-of-day Efficiency Heatmap（cost-per-req metric）
- [ ] **R18**: E4 数据健康度面板（新路由 `#health`）

### 推迟项（v1.3 或之后）

- E1 Request Clustering（K-means 实现简单但 UX 设计需要更多打磨）
- E3 CSV 自动 fetch（Decision 5）

## Acceptance Criteria

- [ ] `pnpm lint` exits 0
- [ ] `pnpm -r typecheck` exits 0
- [ ] `pnpm -w test` exits 0（≥ 175 个，新增 PR 不能让现有测试变红）
- [ ] 每个 PR 单独一个 commit，message 遵循现有风格（`feat:` / `fix:` / `polish:` 中英文都行）
- [ ] 新增功能都有最起码的 unit test（纯函数）或 smoke test（UI）
- [ ] desktop smoke 三件套（`desktop-smoke.mjs` / `desktop-ui-smoke.mjs` / `desktop-year-smoke.mjs`）
      若 PR 影响 desktop UI 必须重跑 + 截图全过

## Definition of Done

- 上述 R1-R12（**必须项**）全部完成 + commit + 三件 quality gate 全绿
- R13-R18（期望项）尽量做，做不完写明剩余路线图到 `.trellis/spec/` 或本 prd
- README 关键章节更新（新路由、新功能、新 brand theme）
- 不引入新的"不稳定依赖"（除 `kbar` + `react-pdf` 这两个已记录的）

## Out of Scope (explicit)

- 不动 Electron 主进程 + IPC contract（兼容性硬约束）
- 不动 SQLite schema
- 不调外部 LLM API（违反 local-only 隐私）
- 不做 CSV 自动 fetch
- 不做 community baseline（隐私）
- 不做 mobile / PWA（v1.2 不在这个范围）
- 不引 React Router（继续用 30 行自写 hash router，加新路由就是改 `useRoute` 的枚举）

## Technical Approach

### PR1 (Layer A) · Quick Wins (R1-R5)

**新依赖**: `kbar`

**改动**:
- 新组件 `apps/playground/src/components/CommandPalette.tsx`
  - `<KBarProvider>` 包在 `App.tsx` 外层
  - actions: 6 个路由跳转 + 打开 settings drawer + import / history / clear local
  - shortcut: `Cmd+K` (mac) / `Ctrl+K` (win/linux)
- 新组件 `apps/playground/src/components/overview/WeekSummaryCard.tsx`
  - 输入 `summary + rows`，输出一句话 + 3 个 bullet + 1 个建议
  - 纯函数 `composeWeekSummary(summary)` 在 `@cu/data` 里写 + 单测
- `packages/charts/src/Sparkline.tsx`：加 `onPointClick` + hover crosshair
- `packages/charts/src/Heatmap.tsx`：加 `onCellClick`
- `packages/charts/src/KpiCard.tsx`：value 加 `<CopyButton>` hover 显示
- `OverviewBurns.tsx`：每个 BurnStoryCard 下面加一条 `burnCaption()`（已存在）

### PR2 (B1) · Anomaly Detection (R6)

**改动**:
- 新路由 `anomalies` → 改 `apps/playground/src/router/useRoute.ts`
- 新组件 `apps/playground/src/components/AnomaliesPage.tsx`
- 纯函数 `@cu/data/anomalies.ts`：
  - `detectCostSpikes(byDay, { zScoreThreshold = 2.5, window = 7 })`
  - `detectCostPerReqShift(rows, { spikeMultiplier = 3, minDailyCost = 5 })`
  - `detectCacheHitDrop(byDay, { dropPpThreshold = 15, window = 7 })`
  - 每个返回 `Anomaly[]` discriminated union with severity / day / explanation
- UI：sticky 顶 KPI（open / week / month 三个数）+ timeline 表 + filter by severity
- `OverviewActivity` 的 calendar heatmap 上：异常日加红色 outline ring
- 单测覆盖三个 detector

### PR3 (B2 + B3) · Efficiency + Budget Guard (R7-R9)

**改动**:
- `ModelsPage.tsx`：表头加 `$/Mtok out` + `$/req avg` + `vs cheap` 三列
- 底部新增 `EfficiencyCalculator` 卡：双 slider（"move X% of opus traffic to sonnet" → `if-then` savings）
- `MonthlyBudgetPanel.tsx`：
  - 加 expensive-model blacklist UI（settings drawer 里 multi-select chips）
  - blacklist 模型在 KPI 卡上单独显示 + 黑名单 spend 总额
  - 剩余预算 pace gauge：绿/黄/红三态环 + "remaining budget / remaining days = $X/day allowed"
- `settingsStore.ts`：加 `expensiveModelBlacklist: string[]` + clamp 检验
- 单测：efficiency math + budget pace math + blacklist normalize

### PR4 (C1) · Left collapsible nav (R10)

**改动**:
- 重写 `DashboardShell.tsx`：CSS Grid `[icon-nav 60px | main 1fr]`，
  expanded 状态变成 `[full-nav 220px | main 1fr]`
- 新组件 `apps/playground/src/components/SideNav.tsx`
  - 状态由 `useSettings` 持久化（新增 `sideNavCollapsed: boolean`）
  - 7 项（含新的 anomalies）→ icon + label + active accent rail
  - 底部：theme switcher + settings button + collapse toggle
- 删除 `NavTabs.tsx`（或保留 as fallback for narrow viewport）
- ResponsiveBreakpoint：< 768px 自动 collapse；很窄时候变成顶 tab bar fallback

### PR5 (C2 + C3 + C4) · Focus mode + new themes + outlier ring (R11-R13)

**改动**:
- `Panel.tsx` 加 `focusable?: boolean` prop；右上角 ⤢ 按钮
  → portal 到全屏 modal，背景 backdrop-blur，ESC / 点击外面退出
- `packages/brand/src/themes.ts` 增加 2 个新 theme：
  - `cu-mono`：grayscale only，accent = 当前 surface contrast text 黑/白
  - `cu-linear-night`：bg `#010102`, accent `#5e6ad2`, 4-step surface ladder
- `BrandSwitcher.tsx` 加新选项 + 预览缩略图
- `Sparkline` / `BarChart` 加 `outlierThresholdSigma?: number` prop
  → 偏离 baseline 超过阈值的点描红色 ring

### PR6 (D1) · Monthly Report PDF (R14)

**新依赖**: `react-pdf`

**改动**:
- 新组件 `apps/playground/src/components/reports/MonthlyReportPdf.tsx`
  - 4 页：cover (month + headline) / activity (heatmap + bars) / burns (top 5 narrative) / forecast
  - 全部 React 组件，用 react-pdf 的 `<Document>` `<Page>` `<View>` `<Text>`
- 新 hook `useGenerateMonthlyReport(month)`
- Overview 顶部按钮 "Generate report" → 点击 → 下载 PDF
- 不持久化 PDF，纯前端 blob 下载

### PR7 (D2 + D3) · Cost Story Timeline + Goal Tracking (R15-R16)

**改动**:
- 新组件 `apps/playground/src/components/year/CostStoryTimeline.tsx`
  - 横向时间轴：top 5 burns + budget cross events + month boundaries + max-mode runs
  - hover 弹卡片显示具体内容
- `settingsStore`：加 `monthlyGoals: { yyyymm: { capUSD: number } }`
- `GoalProgressRing` 组件（用 SVG ring + tabular-nums）
- Overview KPI hero 加可选 "Goal progress" 卡

### PR8 (E2 + E4) · Efficiency heatmap + Health page (R17-R18)

**改动**:
- `WeekHourHeatmap` 加 `metric: 'cost' | 'costPerReq' | 'requests'`
- 新路由 `health` → `HealthPage.tsx`
  - 表格：parse failures / 未识别 model / 缺失日期 / 重复 batch / cache hit < 20% 的天
  - 每行 click → drill 到 details page filtered

### PR9 (其它 + 路线图收尾)

- 任何遗漏的小修
- README / 设计文档更新
- 旧 PR 中可能引入的 lint suppression 清理
- 准备 v1.2 发布说明

## Decision (ADR-lite)

**Context**: 用户在 YOLO 模式下委托 AI 全程决策 + 实施。当前 v1.0 已发布，
工程质量已经在"可视化产品"标杆水准（Bloomberg/Tufte 美学 + 信息密集），
但相比"AI 时代的运营 dashboard"还差三层（异常检测 / 行动建议 / power UX）。

**Decision**: 一次性写完整路线图 prd，按 9 个 PR 顺序执行，每个 PR 独立 commit + 通过
三件 quality gate（lint / typecheck / test）；优先做 R1-R12（必须项），R13-R18（期望项）
看时间余量。

**Consequences**:
- 一次 session 不可能完成 9 个 PR；R1-R3 在本 session 内做完；R4+ 留给下次
  （prd 已完整，下次 `/trellis:continue` 直接接着干）
- 引入两个新依赖（`kbar` + `react-pdf`），均为 React 生态稳定包
- SQLite schema / IPC contract 不动，保证向前兼容
- 旧的 NavTabs 在 PR4 后删除（archived in git history）

## Technical Notes

- 任何 chart 改动先做 `@cu/charts` 包内，避免在 `apps/playground` 重复实现
- 任何"派生 metric"（efficiency / anomaly score / pace）写在 `@cu/data` 纯函数 + 单测
- 设计 token 不动（accent 暖橙 + 单 chromatic 是项目灵魂）；新主题在 `packages/brand` 加
- 任何 settings 改动要 clamp + normalize（参考 `apps/desktop/src/settingsStore.ts` 已有模式）
- 任何 PR 影响 desktop UI 都要重跑 `node scripts/desktop-ui-smoke.mjs`
- IPC bridge 改动需要同步更新 `apps/playground/src/electron/types.ts`

## Research References

- [`research/competitive-landscape.md`](research/competitive-landscape.md) — 5 个标杆的横向对比，gap 分析详细版
- [`research/anomaly-detection-algorithms.md`](research/anomaly-detection-algorithms.md) — z-score / MAD / robust 算法选型
- [`research/command-palette-libraries.md`](research/command-palette-libraries.md) — kbar vs cmdk vs 自写对比
