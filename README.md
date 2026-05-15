# Cursor Usage Viz

> 一个本地运行的 Cursor 用量数据可视化产品。Bloomberg Terminal 风格的密集仪表盘 + Top 5 烧钱请求的「这一天发生了什么」叙事卡片。

把从 [cursor.com/dashboard/usage](https://cursor.com/dashboard/usage) 导出的 `usage-events-*.csv` 拖进来，按 [Cursor 官方公布的模型定价](https://cursor.com/docs/models-and-pricing) 算出每条请求的真实成本，画出 60 天热力图、模型分布、工作节奏热图，还能下钻到任意一行明细。

![Overview screenshot](./_temp/pr5-screenshots/01-overview-dark.png)

## 它解决了什么问题

Cursor 的 dashboard 给你一个 monthly bill 数字，但不会告诉你：

- 这 393 天里钱具体烧在哪些 model 上（claude-opus-4-7 拿走了多少？code-supernova 多少？）
- 哪一个单笔请求最贵（$51 的那次 max-mode 是什么时候发生的？）
- cache reuse 给你省了多少钱（≈ $15K，比你实际花的还多 4×）
- 你的 burn 集中在哪个时段（UTC 凌晨 3-6 点 → 中午 11-2 点 UTC+8）
- 是否在月度速率上加速 / 减速（30d run-rate projection）

这个 viz 就是回答上面这些问题的。

## 4 个路由

| 路由 | 内容 |
|---|---|
| **Overview** | 4 张 KPI 卡（总花费 / hottest request / top model / cache savings · hover 加 accent rail）+ **月度请求预算面板 v2**（500-req/月 plan vs 实际，含 4 KPI strip + 月度柱图 + cap 线 + 历史均值线 + linear projection + alert strip + cost-per-request 趋势 sparkline）+ **Compare ranges 面板**（last 7d / 14d / 30d / mtd vs 之前一个等长窗口，4 项 delta + 并排日柱）+ 60 天 calendar heatmap + week-hour heat（responsive · 不再 overflow · 一键 PNG 导出）+ token & provider breakdown + model treemap + small-multiples + Top 5 burn stories（一键 PNG 导出整组卡片） |
| **Models** | 全部 34 个模型的表格，按 cost / rows / avg / tokens 排序 · sticky thead · 每行 chevron + mini sparkline + cache hit % + share-of-cost mini-bar · 点击展开 token mix bar + daily-cost 大图（带 accent 渐变 inset rail） |
| **Details** | 全部 row 表格（2300+ 条），含 search / model filter / 3 种排序 / 分页 · sticky thead · cost ≥ $1 自动放大 + accent 着色 · 鼠标悬停整行带 accent rail + raised bg · tabular-nums 对齐 |
| **Hours** | 24 小时 bar / 7 weekday bar（peak slot 用 accent 高亮 + "peak" 角标 / 周末 cool tone）/ 7×24 大热点图 / Top 5 hot slots leaderboard（#1 hero 化 · 每张卡底部 magnitude rail）· **顶部小日历**：rounded-[14px] panel · presets toolbar · today 用 ring 标注 · range edge 加大圆点 · 当月数据天数 badge · **底部明细表**：单日 / 多日选择时按 cost 倒序 + sticky thead + 4 张 summary stat（Requests / Total cost / Tokens / Avg / req）+ accent rail row hover |

## 数据隐私

- CSV **100% 在浏览器内处理**，绝不上传到任何后端
- 不向 Cursor / OpenAI / Anthropic 等任何接口发送请求
- 没有 backend，没有数据库，没有 cookie
- 一键 「导出脱敏 CSV」：Cloud Agent ID / Automation ID 被替换成 deterministic short alias (`agent-xxxxxx` / `auto-xxxxxx`)，cost / tokens / model / date 保留 — 适合分享给社区或截屏前去脱敏

## 多 CSV 合并

Cursor 一次只能导出最近 N 天。攒了多个月的 CSV？

- 上传第一份 CSV
- FileToolbar 上点 「+ 合并 CSV」 选下一份
- 重复 dedupe key 是 `dateISO + model + cloudAgentId + automationId + tokens + maxMode + requests`（重叠时间窗口不会重复计算）
- toolbar 显示 `N 份 CSV 已合并`，hover 看完整文件列表
- 合并后顶部短暂出现 diff 卡片：`+N 行 · 距上次 X 天 · 新增花费 $Y`

## 本地持久化（PR8 + PR10.2）

打开过的数据自动存进浏览器的 IndexedDB（用 `idb-keyval`，结构化克隆 → Date 等类型零损耗），再次进入直接进入 dashboard，**不需要重新上传也不需要点 「恢复」按钮**。

- 首次访问 → dropzone + 设计系统预览
- 之后访问 → 一段短暂的 「Restoring local session…」 占位 → 直接落到 dashboard，顶部 diff banner 提示是从本地恢复（"Restored your previous session"）
- 上传新 CSV 时自动算出 diff（新增多少 / 距上次多久 / 新增花费），banner 在 6s 后自动消失
- toolbar 上常驻 「clear local」 按钮 → 二次确认对话框 → 完整删除（再下次进入就回到 dropzone）

## 日期筛选器（Hours 页 · PR10.4）

`Hours` 路由顶部内置一个 mini-calendar：

- **预设**：All / Last 7d / Last 30d / This month（按 CSV 中最近一天算）
- **单击某天** → 单日聚焦
- **再点另一天** → 形成日期 range（自动按 ISO 排序）
- **Cmd / Ctrl + 点击** → 切换多日多选
- 有数据的天底部有一个小圆点；没数据的天可见但灰
- Selection 摘要显示在卡片标题旁（"2026-05-06 → 2026-05-11"），筛选后所有图表（24h bar / weekday bar / 7×24 heatmap / Top 5 hot slots）即时重算
- **当选择非 All 时**，页面底部多出一个 `Requests in selection` 表格 — 按 cost ↓ 罗列所选时段的每一条请求（时间 / 模型 / kind / cost / tokens / cache 命中率 / max 标志），单日聚焦时这正好是 "这一天我花在哪儿了" 的清单

任何选择状态都可以一键 `Clear selection` 回到 "All days"。

## 快速开始

```bash
# Node 20+, pnpm 9+
pnpm install

# 启动浏览器开发版 → http://localhost:5173
pnpm playground

# 全 workspace typecheck
pnpm -r typecheck

# Lint / 格式化（Biome 1.9）
pnpm lint
pnpm format
```

## 项目结构

```
cursor_usage/
├── apps/
│   └── playground/                  Vite + React 19 入口（4 路由）
│       └── src/
│           ├── components/
│           │   ├── DashboardShell   FileToolbar + NavTabs + AnimatePresence
│           │   ├── OverviewPage     Act 1/2/3 总览
│           │   ├── ModelsPage       模型表格 + 行展开
│           │   ├── DetailsPage      全 row 表格 + 过滤分页
│           │   ├── HoursPage        时段画像
│           │   ├── FileToolbar      数据上下文条 + 合并 / 脱敏 / 重选
│           │   ├── NavTabs          4 tabs + framer layoutId underline
│           │   ├── SectionHeader    通用 section 头
│           │   └── Panel            通用 card + MetricToggle
│           ├── pages/
│           │   └── WelcomePage      Boot 时检查 IndexedDB，有则直接 hydrate；没有 → hero + dropzone
│           ├── hooks/
│           │   └── useCsvIngest     idle/parsing/success/error 状态机 + appendFile dedup + hydrate / clear
│           ├── storage/
│           │   └── persistence      idb-keyval session store + describeLastUpdate
│           └── router/
│               └── useRoute         30 行 hash-based router（0 依赖）
│           └── components/
│               └── DateRangeFilter  Hours 页用的小日历（preset · 单日 · 多日 · range）
├── packages/
│   ├── tokens/                      Tailwind v4 preset + chart 色板 + warm-restrained 调色
│   ├── motion/                      Framer Motion springs / variants
│   ├── icons/                       Lucide 子集 + CuMark brand glyph
│   ├── brand/                       BrandProvider + 3 个 built-in（cu-warm / cu-bloomberg / cu-mono）
│   ├── ui/                          Button / IconButton / Badge / Tooltipped / ThemeProvider …
│   ├── data/                        CSV 解析 + Aggregator + redact
│   ├── pricing/                     Cursor 32+ 模型定价表 + costRows() + calcCacheSavings()
│   └── charts/                      Heatmap / WeekHourHeatmap / Sparkline / Treemap / KpiCard / StackBar / StatGrid / SmallMultiples / BurnStoryCard
│       apps/playground/src/
│           └── export/              html-to-image 包装 + ExportButton 复用组件（PNG 截图）
│           └── components/
│               └── CompareRangesPanel  Overview 的「last Nd vs prior Nd」对比卡片
├── input/                           把你的 usage-events-*.csv 放这里（不入 git）
└── scripts/
    ├── e2e-pr3.mjs                  Playwright 截图脚本 · charts 库
    ├── e2e-pr4.mjs                  Playwright · 概览页
    ├── e2e-pr5.mjs                  Playwright · 4 路由
    ├── e2e-pr10.mjs                 Playwright · 自动恢复 / 日期筛选器 / responsive heatmap
    ├── e2e-pr12.mjs                 Playwright · KpiCard hover / Details polish / Monthly v2
    ├── e2e-pr13.mjs                 Playwright · Models 表格 / Hours 日历 + bars + selection 明细
    ├── e2e-pr14.mjs                 Playwright · Compare ranges / Export PNG / 错误 UX / Clear filters
    └── desktop-smoke.mjs            Playwright._electron · 启动桌面 app + 截 splash + 截主窗口
```

## v1.0 Desktop（Electron 40，开发中）

从 v0.9 web app 升级成 Claude-Desktop-同代的 Windows / macOS / Linux 桌面应用。
脚手架（PR15）+ SQLite 持久化（PR16）+ 拖入式导入 UI（PR17）
+ Year-in-review / 跨月趋势（PR18）已经着陆，打包成 installer 会在 PR19 跟上。

```bash
pnpm desktop:install-natives   # 一次：把 better-sqlite3 prebuild 切到 Electron flavor
pnpm desktop:dev               # 起 vite + 编译 main + 启动 Electron（带 splash + DB）
pnpm desktop:build             # 编译 main + 构建 renderer dist
pnpm desktop:package           # 出 .exe / .dmg / .AppImage（取决于当前 OS）
node scripts/desktop-smoke.mjs       # Playwright._electron 启动 + 截图烟测
node scripts/desktop-db-smoke.mjs    # PR16 · 数据库 IPC e2e（import / dedupe / undo / 重启）
node scripts/desktop-ui-smoke.mjs    # PR17 · 桌面 UI 流程（dashboard / 历史抽屉 / 预览抽屉）
node scripts/desktop-year-smoke.mjs  # PR18 · Year route（当年 / 切年 / 跨月趋势 / 全页）
```

- Electron 40.10.0 + electron-builder 25 + electron-updater 6.3
- Branded splash 窗（五条 bar mark · 软脉冲动画 · dark/light 自适应）
- 隐藏标题栏 + `titleBarOverlay`（与 Claude Desktop 同款 Windows 体验）
- `AppUserModelID` 设在第一个窗口之前，Windows 任务栏识别 `com.cursorusage.desktop`
  而不是 `electron.exe`
- preload bridge：`window.bridge.{window, theme, app, platform, db}`，
  `contextIsolation: true` + `sandbox: true` + `nodeIntegration: false`
- 默认入口 = 渲染 `apps/playground` 当前的 React 应用（v0.9 全部 4 个路由、动画、
  Compare ranges、Export PNG 不破坏）
- 数据库：`better-sqlite3 12.10` 跑在主进程，DB 文件落在
  `app.getPath('userData')/cursor-usage.db`，关闭 app 数据持久；卸载默认保留
- 两级去重：导入批次按文件 SHA-256 唯一约束，行级用 12 列复合主键 + `INSERT OR IGNORE`
- Undo：每次导入是一个 `import_batches` 记录，`ON DELETE CASCADE` 一键回滚
- 详细的设计决策与 PR 路线图见
  [.trellis/tasks/05-15-brainstorm-desktop-app/prd.md](./.trellis/tasks/05-15-brainstorm-desktop-app/prd.md)

## 数据流

```
File (CSV)
  │
  │  PapaParse + safe number/date coercion
  ▼
parseUsageCsv()      → ReadonlyArray<UsageRow>
  │
  │  per-row pricing lookup (matchModel + calcCost)
  ▼
costRows()           → ReadonlyArray<RowWithCost>
  │
  │  group by model / day / hour-weekday / provider, sort topBurns
  ▼
aggregate()          → UsageSummary
  │
  ▼
React state → KpiCard / Heatmap / Treemap / ...
```

每个步骤都是纯函数 + 充分单测覆盖，没有副作用。

## 定价数据

定价表 100% 来自 Cursor 官方：[cursor.com/docs/models-and-pricing](https://cursor.com/docs/models-and-pricing)

- 涵盖 32+ 个模型（Claude 4/3 系列、GPT-5 系列、Gemini、Grok、Composer、Code Supernova、Auto pool）
- 每模型分 `input / output / cacheRead / cacheWrite` 四种单价
- max-mode 单独定价（部分模型可触发 ×5 ~ ×10 倍率）
- 旧模型（claude-3.7-sonnet 等）退化按 Auto pool 兜底 + UI 上标记 `est.` badge
- 数据校验通过 86 个单测，含 68 个 real-CSV sweep（用真实导出回放计算）

## 设计哲学

- **方向 D · Bloomberg/Tufte 信息密集主体 + Top 5 烧钱请求叙事化**
- 默认暗色（power tool / Bloomberg 气质），亮色可切换
- 字体：Source Serif 4（标题 / 大数字）+ Inter（UI body）+ JetBrains Mono（数据 / token / cost）
- accent：暖橙 `#db8460`（暗色）/ 赤土橙 `#c96f4a`（亮色）
- 反 AI slop：不用紫色渐变 / 不用 emoji bullet / 不用圆角卡片+左 border accent / 不画 SVG 装饰

## 开发进度

| PR | 内容 | 状态 |
|---|---|---|
| **PR1** | 工程脚手架 + 设计令牌 + 占位欢迎页 | ✅ |
| **PR2** | 数据层（CSV 解析 + 定价引擎 + cost 计算 + 86 单测） | ✅ |
| **PR3** | charts 库（Heatmap / WeekHour / Sparkline / Treemap / StackBar / Multiples / StatGrid） | ✅ |
| **PR4** | 概览页（4 KPI + 6 charts + Top 5 burn 叙事 + 30d projection + cache savings） | ✅ |
| **PR5** | 4 路由（Overview / Models / Details / Hours） | ✅ |
| **PR6** | 隐私脱敏 + 多 CSV 合并 + README 收尾 | ✅ |
| **PR7** | KPI count-up + 卡片错位进场 + Sparkline draw-on + Heatmap stagger + Treemap grow + 浅色主题修复 | ✅ |
| **PR8** | IndexedDB 持久化（idb-keyval）+ 上次更新提示 + diff banner + 清空对话框 | ✅ |
| **PR10** | 默认英文（移除所有 UI 中文）+ 自动恢复 dashboard（去 restore 卡）+ Hour×Weekday responsive 修复 overflow + Hours 日期筛选器（presets · 日历 · 单日 · 多日 · range）+ 单日 / 多日聚焦时底部加 `Requests in selection` 明细表 | ✅ |
| **PR11** | 月度请求预算面板（500-req plan · 月柱图 · cap 线 · linear projection）+ UI 美化（SectionHeader 加 accent dot + 渐变 hairline / Panel 加 inset highlight + hover border / 页面背景 radial gradient ambience / 顶部 header backdrop-blur） | ✅ |
| **PR12** | MonthlyBudgetPanel v2（historical avg 点线 + alert strip 智能提示 + cost-per-request 趋势 sparkline）+ KpiCard 强化（hover 时 accent rail 横扫 / inset shadow / 平滑过渡） + Details 表格美化（sticky thead + cost hero font + tabular-nums + 行 hover accent rail）+ FileToolbar 重设计（icon + 分组 + danger 样式 clear） | ✅ |
| **PR13** | Models 页深度美化（chevron drilldown + share-of-cost mini-bar + sort chip group + 展开 inset rail）+ Hours 页深度美化（DateRangeFilter rounded-[14px] panel + today ring + range edge 大圆点 + 当月数据 badge / 小时和星期 bar 加 peak 高亮 + weekend tone / Top 5 hot slots #1 hero 化 + magnitude rail / SelectionDetailPanel 加 4 张 summary stat + sticky thead + accent rail） | ✅ |
| **PR14** | UX 三件套：H. CSV 解析错误升级（warn-tone alert card + tips + retry）+ Details/Hours 空状态加 'Clear filters / selection' 按钮；G. **CompareRangesPanel**（last 7d/14d/30d/mtd vs 之前一个等长窗口，4 张 KPI delta + 并排日 bar）；I. **ExportButton**（html-to-image，Hour×Weekday 和 Top 5 burns 一键 PNG 下载，自动用 theme 背景） | ✅ |
| **PR15** | **v1.0 Desktop · Electron 脚手架**：`apps/desktop` 整套（main.ts / preload.ts / splash.ts / updater.ts / dev orchestrator / electron-builder.yml）· Electron 40.10 + electron-builder 25 · 隐藏标题栏 + Windows titleBarOverlay · AppUserModelID `com.cursorusage.desktop` · branded 五条 bar splash window · preload bridge（window / theme / app）· `pnpm desktop:dev` 端到端能跑 · `scripts/desktop-smoke.mjs` Playwright._electron 烟测 | ✅ |
| **PR16** | **v1.0 Desktop · SQLite 持久化**：新包 `@cu/storage`（schema + `UsageDb` + 11 个 vitest 单测，全部 `:memory:` SQLite）· `better-sqlite3 12.10` 主进程驻留 · 双层去重（`import_batches.file_sha256` UNIQUE + `rows` 12 列复合主键 + `INSERT OR IGNORE`）· `ON DELETE CASCADE` 撤销单次导入 · 6 个 prepared query（counts / byDay / byMonth / byModel / byHourWeekday / topBurns）· IPC `bridge.db.{counts, importRows, listBatches, undoBatch, query}`（contextBridge + 白名单）· `install-natives` 脚本一键切 Electron / Node prebuild · `scripts/desktop-db-smoke.mjs` Playwright._electron e2e（import → dedupe → 重启 → 数据还在 → undo → 都没了，18 条断言全绿） | ✅ |
| **PR17** | **v1.0 Desktop · 拖入式导入 + 合并预览 + 历史 / undo UI**：渲染器侧 `electron/{bridge,types,desktopStorage}` 三件套（typed bridge accessor + Web Crypto SHA-256 + Date 自动 rehydrate）· 新 hook `useDesktopIngest`（idle → parsing → preview → committing → success 状态机 · 全程不写 IDB）· 桌面模式自动检测（`isDesktop()`）下分别走 `useDesktopIngest`（DB）与原 `useCsvIngest`（IDB）· `ImportPreviewDrawer` 右滑抽屉（三态：duplicate file / no new rows / would-add KPI + new date range，commit 前可 cancel）· `ImportHistoryDrawer` 列出全部 batch + per-batch 两步 undo 确认 + cascade 删除文案 · `FileToolbar` 注入 `desktopActions` 后切换为 IMPORT / HISTORY / REDACTED 三按钮 · 全局窗口 drop 监听（拖到 dashboard 任意位置都能开预览）· 渲染器永不直接 import @cu/storage（避开 better-sqlite3 在 browser bundler 里炸）· `UsageDb.previewImport`（SAVEPOINT + ROLLBACK 干跑）+ `UsageDb.allRowsCosted`（重建 RowWithCost 给 renderer 用）· 14/14 vitest 单测全绿（+3）· `scripts/desktop-db-smoke.mjs` 扩到 25 条断言全绿（+7）· `scripts/desktop-ui-smoke.mjs` 5 张截图全过（dashboard / 历史 / undo 确认 / 预览抽屉 / 导入后 dashboard） | ✅ |
| **PR18** | **v1.0 Desktop · Year-in-review + 跨月趋势**：新增第五个路由 `#year`（`useRoute`/`NavTabs` 都加进去）· `YearReviewPage` 组合两个面板：① **YearReviewPanel**——年选择 chip（自动列出所有有数据的年份）+ 6 张年级 KPI（YEAR SPEND / REQUESTS / TOP MODEL + share-of-year / CACHE SAVINGS + 全局 hit ratio / MOST EXPENSIVE DAY / LONGEST STREAK + 日期范围）+ 12-month 成本 bar chart（current month 高亮 accent · framer-motion height 进场）+ Quarter-over-quarter 4 卡（QoQ delta 三态着色）· ② **CrossMonthTrendsPanel**——last-90d 的 rolling-30d cost Sparkline（peak / latest 标注）+ last-month overview 卡（MoM delta pill）+ top-5 model MoM table（按 |Δ$| 排序 · this/prev cost · Δ$ tabular-nums · Δ% pill · 12-month per-model sparkline）+ empty-state 文案（不足两月时）· `computeYearReview` / `computeCrossMonth` 纯函数（O(n) 单次遍历 + Map 聚合，10k 行 <5ms）· `install-natives` 增加 canonical-version 检测（pnpm 留下的 orphan 版本只 warn 不 fail）· `scripts/desktop-year-smoke.mjs`（14 月跨年 seed → Year tab → 4 截图：当年 / 切年 / 跨月趋势 / fullPage）4 张截图全过 · biome + 125/125 tests + 全 typecheck 全绿 | ✅ |

## 技术栈

- **包管理**：pnpm 9 + workspace + turbo
- **构建**：Vite 6 + React 19 + TypeScript 5.6（严格模式）
- **样式**：Tailwind v4（CSS Variables 驱动）
- **动画**：Framer Motion 11
- **图表**：D3 modules（scale / array / time / format / hierarchy / shape）+ 自封装 React wrapper（约 12 个 chart 组件）
- **CSV 解析**：PapaParse
- **桌面**：Electron 40 + electron-builder 25 + electron-updater 6.3（PR15+）
- **本地数据库**：better-sqlite3 12.10（WAL / WITHOUT ROWID / 复合 PK）+ `@cu/storage` 封装（PR16+）
- **测试**：Vitest（单元）+ Playwright（截图回归 + `_electron` e2e）
- **Lint / Format**：Biome 1.9

## 致谢

- 设计语言基于 `oh-my-open-ui` 和 `writing_aassist` 两个 base 项目
- 定价数据 100% 来自 Cursor 官方文档：https://cursor.com/docs/models-and-pricing
- 灵感参考：Bloomberg Terminal、Edward Tufte《The Visual Display of Quantitative Information》、GitHub contribution graph

## License

Private project. Not for distribution.
