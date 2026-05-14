# Cursor Usage Data Visualization

## Goal

把用户从 cursor.com/dashboard/usage 导出的 `usage-events-*.csv` 数据，做成一个高保真、可深度分析的可视化产品。
核心价值：

1. 让用户**一眼看到**自己的 Cursor 使用画像（哪几个模型用得最多、什么时段最高强度、花了多少钱）
2. 让用户能**下钻到每一条请求**的明细——尤其是那条单次烧 4400 万 token 的 opus-4-7-thinking-max 是哪天发生的
3. 让用户基于 Cursor 官方公布的 API 单价，**算出每一条请求的真实成本**（折算成美元），而不是只看到"几个 token"

## What I already know

### 数据格式（已确认）

CSV 字段：`Date, Cloud Agent ID, Automation ID, Kind, Model, Max Mode, Input (w/ Cache Write), Input (w/o Cache Write), Cache Read, Output Tokens, Total Tokens, Requests`

- 共 **2335 条**事件，时间跨度 ~2026-03-16 到 2026-05-13（约 60 天）
- **Kind 分布**：Included (2215, 94.9%) / Errored, No Charge (117, 5.0%) / Aborted (2) / Free (1)
- **36 个独特模型**，Top 5：
  - claude-4-sonnet-thinking (557)
  - claude-4.5-sonnet-thinking (425)
  - claude-4.6-opus-max-thinking (259)
  - claude-3.7-sonnet-thinking (131)
  - gpt-5-high (113), gemini-2.5-pro-preview-05-06 (113)
- **Max Mode** 列存在 → 涉及 Cursor 的 Max Mode pricing
- 同一个 model 名可能有多个变体（thinking / max / xhigh / fast 等后缀）
- 单次请求的 token 量级跨度极大：从几百 token 到 4400 万 token

### Cursor 官方定价（已确认，以下单位均为 USD per 1M tokens）

| 模型 | Input | Cache Write | Cache Read | Output | Notes |
|------|-------|-------------|------------|--------|-------|
| Claude 4 Sonnet | $3 | $3.75 | $0.3 | $15 | Thinking 在旧定价里算 2 requests |
| Claude 4.5 Sonnet | $3 | $3.75 | $0.3 | $15 | Max Mode 必需 |
| Claude 4.6 Sonnet | $3 | $3.75 | $0.3 | $15 | |
| Claude 4.5 Opus | $5 | $6.25 | $0.5 | $25 | Max Mode 必需 |
| Claude 4.6 Opus | $5 | $6.25 | $0.5 | $25 | Max Mode 必需 |
| **Claude 4.6 Opus (Fast)** | **$30** | **$37.5** | **$3** | **$150** | 价格 6 倍！ |
| Claude 4.7 Opus | $5 | $6.25 | $0.5 | $25 | |
| **Claude Opus 4.7 (Fast)** | **$30** | **$37.5** | **$3** | **$150** | 价格 6 倍！ |
| Composer 1 | $1.25 | - | $0.125 | $10 | |
| Composer 1.5 | $3.5 | - | $0.35 | $17.5 | |
| Composer 2 | $0.5 | - | $0.2 | $2.5 | 极便宜 |
| Auto | $1.25 | - | $0.25 | $6 | |
| GPT-5 / 5-Codex / 5.1-Codex | $1.25 | - | $0.125 | $10 | |
| GPT-5 Fast | $2.5 | - | $0.25 | $20 | |
| GPT-5.2 / 5.3-Codex | $1.75 | - | $0.175 | $14 | |
| GPT-5.4 | $2.5 | - | $0.25 | $15 | |
| GPT-5.5 | $5 | - | $0.5 | $30 | |
| Gemini 2.5 Flash | $0.3 | - | $0.03 | $2.5 | |
| Gemini 3 Flash | $0.5 | - | $0.05 | $3 | |
| Gemini 3 Pro / 3.1 Pro | $2 | - | $0.2 | $12 | |
| Grok 4.20 | $2 | - | $0.2 | $6 | |
| Grok 4.3 | $1.25 | - | $0.2 | $2.5 | |
| Kimi K2.5 | $0.6 | - | $0.1 | $3 | |

完整价格表存在 `research/cursor-pricing.md`。

**关键计算公式**：
```
cost = (input_w_cache_write * cache_write_rate
      + input_wo_cache_write * input_rate
      + cache_read * cache_read_rate
      + output_tokens * output_rate) / 1_000_000
```

注意：CSV 里的"Input (w/ Cache Write)"是 cache write 部分；"Input (w/o Cache Write)"是普通 input；要分开计费。

### Base 项目（技术栈与设计语言已确认）

- **`F:\vibe_project\oh-my-open-ui`** —— Claude Desktop Windows 风格的 UI scaffold
- **`F:\vibe_project\writing_aassist`** —— Grammarly Docs-like AI 写作工具

两者共享：
- pnpm monorepo + turbo + biome
- React 19 + Vite 6 + TypeScript 5.6 + Tailwind v4 + Framer Motion 11
- packages: tokens / motion / icons / brand / ui (writing_aassist 多了 editor / suggestions)
- 设计语言：**warm-restrained tool aesthetic**
  - Light: 奶白底 `#F7F3EA` + 赤土橙 accent `#C96F4A` + 暖灰文字 `#2B2926`
  - Dark: 深棕底 `#1D1B17` + 暖橙 accent `#DB8460`
  - 字体：**Source Serif 4** (display) + **Inter** (body) + **JetBrains Mono** (numerals/code)
  - 圆角 6-24px、shadow 含 brown undertone（不是冷色 shadow）
  - Spring system: gentle (220/26/0.9) / snappy (380/30/0.8) / bouncy
- BrandProvider 系统支持品牌切换

### 类似工具的可视化模式（参考，不直接抄）

- **Cursor Stats Extension**：Chrome 扩展，做 calendar + cost analytics
- **CursorLens** (393★)：Next.js + Postgres，详细 cost 仪表盘
- **DevDaily Dashboard**：full-year heatmap (GitHub 风格) + Chart.js
- **Wakadash**：9-panel terminal dashboard，6 主题
- **共同模式**：heatmap + multi-panel + theme + drill-down

## Decision (ADR-lite) · 已与用户确认 2026-05-14

**Context**：Cursor 用量可视化工具，需要在 base 项目（warm-restrained tool aesthetic）的设计基础上做出"信息密集 + 单条洞察叙事化"的产品。

**Decision**：

1. **设计方向 = D**（Bloomberg/Tufte 信息密集主体 + Top 5 烧钱请求叙事化）
   - 主仪表盘：高密度、small multiples、sparkline、深色背景
   - Top 5 烧钱请求：单独做成"这一天发生了什么"的故事卡片
2. **项目形态 = 路径 1**（完整 pnpm monorepo，与 base 同构）
3. **默认主题 = 暗色**（power tool / Bloomberg 气质），亮色作为可切换备选
4. **首屏 Top 3 KPI**：总成本 + 烧钱最狠的请求 + 60 天热力图
5. **Legacy 模型定价 = 选项 1**：用 Auto pool 价兜底 + UI 上「价格估算」角标
6. **CSV 隐私**：100% 浏览器内解析，提供"分享时金额脱敏"开关
7. **不调用 Cursor API**（只消费导出的 CSV）

**Consequences**：
- 与 base 项目共享 packages（tokens / motion / icons / brand / ui）→ 工作量集中在新增 packages（data / pricing / charts）和 playground 应用
- 信息密集 + 叙事化的并存需要严格的视觉层次设计——不能让两套语言互相干扰
- Legacy 模型价格估算需要在 UI 上诚实标注

## Requirements (Final · MVP)

### 数据层（packages/data + packages/pricing）

- CSV 解析（PapaParse）+ 字段类型化为 `UsageRow`
- 字段 normalize：空字符串 → 0；`Requests` 列 union type
- 模型定价表（`pricing-table.ts`）含官方 30+ 模型 + Auto pool 兜底
- Cost 计算引擎：纯函数 `calcCost(row, pricing) → number`，含完整单测
- Aggregator：按模型 / 按日 / 按小时×星期 / 按 Kind 等聚合 API
- Legacy 模型用 Auto pool 兜底，结果带 `priceEstimated: true` 标记

### 视觉层（packages/charts + packages/ui）

复用 base 项目 `@scribe/ui` 的 primitives；新建：

- `Heatmap` —— GitHub 风格 60-365 天热力图，按 cost 着色（accentSoft → accent → 深 accent，4-5 阶梯）
- `WeekHourHeatmap` —— 7×24 小热图，hover 显示当时段累计 cost / requests
- `Sparkline` —— 内嵌 KPI 卡片用，60 天日趋势
- `SmallMultiples` —— 每模型一张迷你 sparkline 网格（Tufte 风格）
- `TokenBreakdown` —— 横向堆叠条，展示一行的 inputCacheWrite / inputNoCache / cacheRead / output 占比
- `CostBreakdown` —— 与 TokenBreakdown 同步，按 cost 占比
- `KpiCard` —— 大数字（Source Serif 4 4xl）+ 小标签（Inter xs muted）+ 可选 sparkline
- `ModelBadge` —— 模型 ID + provider 颜色点 + Max Mode 角标
- `BurnStoryCard` —— Top N 烧钱请求叙事卡片（方向 C 的种子）
- `PriceEstimatedTag` —— Legacy 模型角标
- `DataTable` —— TanStack Table + virtual rows（支持 2335+ 行流畅滚动）
- `FilterBar` —— 日期范围 / 模型多选 / Kind / Max Mode / cost 区间

### 应用层（apps/playground）

#### 路由 1: 概览（Overview，默认页）

布局参考 Bloomberg Terminal 多面板风格：

- Row 1（高 36vh）：3 张 KPI 大卡片
  - **总成本**：$XXX.XX + 总 requests + 总 tokens（小字）+ 60 天 sparkline
  - **烧钱最狠的请求**：$139.37 + 模型 + 时间 + Token breakdown 微缩条
  - **60 天热力图**：当然占据最大宽度
- Row 2（高 28vh）：4 列 small multiples
  - 各 provider 的 cost 趋势 small multiples
  - Top 8 模型的 cost 占比 treemap
  - 7×24 工作节奏热图
  - Cache hit ratio 仪表
- Row 3（高 36vh）：Top 5 烧钱请求叙事卡片网格
  - 每张卡片：日期时间 + 模型 + cost 大数字 + token breakdown 横条 + 「等于平时 N 次 Sonnet」对比文案

#### 路由 2: 明细（Detail）

- 顶部：FilterBar
- 主体：DataTable（2335 行虚拟滚动），列含：日期 / 模型徽章 / Kind / Max Mode / Tokens 4 列 / cost 计算列
- 行点击 → 右侧抽屉打开：完整 TokenBreakdown + CostBreakdown + raw row JSON

#### 路由 3: 模型分析（Models）

- 每个模型一个卡片：
  - Header: ModelBadge + 总 cost + 总 requests + 平均 token/request
  - Body: 60 天 sparkline + token 类型分布饼图 + Max Mode 占比 / 错误率
  - Footer: 「价格估算」角标（如适用）

#### 路由 4: 时段分析（Activity）

- 大 7×24 热图（占整个页面）
- 旁边小卡片：Top 3 工作时段、最长连续工作日、按星期柱状图

### 应用 shell

- 复用 `@scribe/ui` 的 `AppShell + Sidebar + TitleBar`
- Sidebar：4 个路由 + 数据切换器 + 主题切换 + 隐私脱敏开关
- 顶部 TitleBar：项目名 / 数据来源 / 时间范围
- 拖入 CSV 即替换数据集

### 用户额外勾选的 quick wins（已 inline 进对应 PR）

- **D1 · 月度预算预测** → 放进 PR4 概览页第 4 张 KPI 卡（按当前 60 天日均推算月底预测 + 与 Pro/Pro+/Ultra 配额对比）
- **D2 · 多 CSV 合并** → 放进 PR2 数据层，解析后按 (date+model+totalTokens) 做 dedupe；UI 上"再拖一个文件就追加"
- **D3 · 热力图 cost/requests 切换** → 放进 PR3 Heatmap 组件的 `colorBy: 'cost' | 'requests' | 'tokens'` prop

### 真正后置（v0 不做）

- 模型对比雷达图（intelligence vs cost vs speed 主观估）
- 数据导出（PNG / CSV summary）
- Electron 桌面包装
- 多用户 / 团队对比

## Acceptance Criteria (evolving)

- [ ] 拖入用户提供的 `usage-events-2026-05-14.csv`，3 秒内渲染出概览页
- [ ] 总成本数值与逐行手算一致（误差 ≤ $0.01）
- [ ] 热力图能区分"无活动"vs"有活动" 4 个梯度
- [ ] 明细表 2335 行流畅滚动（虚拟滚动）
- [ ] 暗色主题切换无 FOUC
- [ ] 响应式：1920px / 1440px / 1280px 都能用

## Definition of Done (team quality bar)

- TypeScript 严格模式无报错
- biome lint 无 warning
- 浏览器 console 无 error / warning
- 至少 3 个核心模块（pricing engine / csv parser / heatmap）有单元测试
- README 写明数据隐私（CSV 只在浏览器内解析，不上传）
- 鼠标 hover 反馈、键盘可达性达基本水平

## Out of Scope (explicit)

- 不做 Cursor API 实时拉取（不要 token、不要 OAuth）
- 不做用户注册 / 多用户 / 团队对比
- 不做云端持久化（只 localStorage 存最近一次解析的数据 hash）
- 不做 PDF/Excel 导出（先做 web 体验，导出后置）
- 不做协作 / 评论
- 不做"和别人的用量对比"（隐私敏感）

## Research References

- [`research/cursor-pricing.md`](research/cursor-pricing.md) — Cursor 官方完整模型定价表
- [`research/csv-format.md`](research/csv-format.md) — Cursor 导出 CSV 的字段语义和边界值
- [`research/similar-tools.md`](research/similar-tools.md) — Cursor Stats / CursorLens / DevDaily 等类似工具的可视化模式
- [`research/base-projects-design-system.md`](research/base-projects-design-system.md) — oh-my-open-ui & writing_aassist 的设计令牌、组件库、Brand 系统

## Technical Notes

### 关键设计决策候选

**架构**：✅ 已确认 pnpm monorepo（路径 1）

**Monorepo 结构（最终）**：

```
cursor_usage/
├── apps/
│   └── playground/          Vite 6 + React 19 入口（v0 仅这一个 app）
├── packages/
│   ├── tokens/              CSS Vars + 复用 base 暖色 + 新增 chart tokens
│   ├── motion/              复用 base 的 spring 系统
│   ├── icons/               复用 base 的 Lucide 子集
│   ├── brand/               复用 base 的 BrandProvider，加 1-2 个 brand
│   ├── ui/                  复用 base 的 primitives + shell + modals
│   ├── data/                ⭐ CSV 解析 + UsageRow 类型 + Aggregator
│   ├── pricing/             ⭐ Cursor 模型定价表 + cost 计算引擎（纯函数）
│   └── charts/              ⭐ Heatmap / WeekHourHeatmap / Sparkline / SmallMultiples / TokenBreakdown / CostBreakdown / KpiCard / ModelBadge / BurnStoryCard / DataTable
├── input/                   用户的 usage-events-*.csv（不入版本控制）
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
├── biome.json
└── README.md
```

**图表库选择**：✅ 决定走 **D3 + 自己封装**（不用 recharts/visx/ECharts）

理由：
- 方向 D 的 Bloomberg/Tufte 风格需要极高自由度，recharts 的视觉模板化会败坏 aesthetic
- visx 是 D3 + React primitives，但额外抽象一层反而增加复杂度
- ECharts 风格偏中性，不易调出 warm tool aesthetic
- D3 的核心模块（d3-scale / d3-array / d3-time / d3-format）相当稳定，自己封装的 React wrapper ~200 行就能搞定 heatmap

**包依赖**：
- D3 模块：`d3-scale`, `d3-array`, `d3-time-format`, `d3-format`, `d3-interpolate`
- TanStack Table（虚拟滚动）：`@tanstack/react-table`, `@tanstack/react-virtual`
- CSV 解析：`papaparse` + `@types/papaparse`
- 日期：`date-fns`（轻量、tree-shakable）
- 状态：`zustand`（与 base 一致）

**热力图**（核心组件）：
- GitHub 365 天 contribution graph 风格
- 颜色映射 0-3 阶梯（accentSoft → accent → accentHover）
- hover 显示当日 cost / requests
- 点击当日 → 跳到明细表筛选该日

**虚拟滚动**：2335 行，TanStack Table + virtual rows

### 数据隐私

- CSV 在浏览器内 100% 处理，不发任何网络请求
- localStorage 只存"最近一次的统计摘要"和"用户偏好"，不存原始 CSV
- 截图分享时可选 mask 金额功能

### 反 AI Slop 自检

- 不用紫色渐变、不用 emoji bullet、不用圆角卡片+左 border accent 的 SaaS 模板
- 不画 SVG 人物 / 装饰
- 数字字体专门用 JetBrains Mono（数据 HUD 信号）
- 一处「值得截图」的细节：可能是热力图本身，或者 Top 1 烧钱请求的呈现方式

## 实施计划（小 PR 拆分）

### PR1 · 工程脚手架 + 设计令牌（~1.5h）✅ DONE 2026-05-14

**目标**：能 `pnpm install && pnpm playground` 启动一个空白 Vite + React 19 应用，主题切换工作

- monorepo: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `biome.json`, `tsconfig.base.json`, `.gitignore`
- `packages/tokens`：从 base 复制 + 删 editor.css/suggestion.css（writing-only）
- `packages/motion`：从 base 复制（@scribe → @cu）
- `packages/icons`：精简 curated lucide subset，新增 `CuMark` brand glyph 替换 ScribeMark
- `packages/brand`：3 个 built-in brand：`cu-bloomberg`（默认暗色，cream + 暖橙 #db8460）/ `cu-warm`（亮色，赤土橙 #c96f4a）/ `cu-mono`（监视器灰 + 蓝绿 accent）
- `packages/ui`：从 base 复制 primitives + shell + theme provider；删 workbench/、4 个 writing-only modals、CommandPalette、KeyboardCheatsheetModal
- `apps/playground`：Vite + React 19 + Tailwind v4，inline `<head>` script 防 FOUC（默认 dark = #1d1b17）
- `apps/playground/src/pages/WelcomePage.tsx`：hero（CuMark + 大标题"把你的 Cursor 用量 算清楚"）+ CSV 占位拖区 + 「设计系统预览」3 张 KPI mock 卡片（Source Serif 4 数字 + JetBrains Mono 元数据）
- 顶栏：BrandSwitcher（3 个色点）+ ThemeSwitcher + 当前 theme badge
- `README.md`：项目说明 + 隐私声明 + 6 个 PR 路线图

**Acceptance** （全部通过）：
- ✅ `pnpm install` 无报错（153 deps, 15.6s）
- ✅ `pnpm typecheck` 6/6 packages 全过
- ✅ `pnpm lint` 0 errors（17 个 organize-imports 已 auto-fix）
- ✅ `pnpm playground` http://localhost:5173 启动欢迎页
- ✅ Dark → Light 切换正常，inline head 脚本防 FOUC
- ✅ Source Serif 4 + Inter + JetBrains Mono 三套字体加载
- ✅ Brand glyph CuMark 渲染（橙色 [ıl] bracket+barchart）
- ✅ Bloomberg 风 KPI 卡片用 mock 数据展示了"信息密集"系统语言

### PR2 · 数据层 + 定价引擎（~2h）✅ DONE 2026-05-14

**目标**：CSV 拖入 → 解析 → 算 cost → 摘要 JSON 输出 console + 真数据写到 KPI 卡片

- `packages/data`：
  - `types.ts`：UsageRow / EventKind (Included/Errored,No Charge/Aborted,Not Charged/Free) /
    RequestsValue (discriminated union: units|free|errored) / TokenCounts / ParseResult
  - `csvParser.ts`：papaparse + 严格 cell coercion，行内错误不抛而是收集到 `failures[]`
  - `aggregators.ts`：byModel / byDay (YYYY-MM-DD UTC) / byHourWeekday (7×24) / byProvider /
    topBurns / cacheHitStats / dateRange，单 pass 聚合，纯函数
  - `classifyProvider`：Anthropic/OpenAI/Google/xAI/Cursor/DeepSeek/Moonshot/Qwen/Other
  - 单测 **25 个**，覆盖：normal/fractional Requests/Free/errored/comma-in-Kind/
    unknown-Kind/missing-header/混合成功失败
- `packages/pricing`：
  - `pricingTable.ts`：**32 个** 官方模型条目（Anthropic 4-Sonnet/4.5-Sonnet/4.6-Sonnet/3.7-Sonnet
    / 4.1-Opus/4.5-Opus/4.6-Opus/4.7-Opus + Fast tier 6x / 4.5-Haiku；OpenAI GPT-5/5.1/5.2/5.3/5.4/5.5/4o + Fast；
    Cursor Composer 1/1.5/2/2-fast/Auto/code-supernova；Google Gemini 2.5/3/3.1；xAI Grok 4/4-fast/grok-code-fast-1）
  - `modelMatcher.ts`：
    - `reorderClaudeFamily`: `claude-opus-4-7-...` → `claude-4.7-opus-...`（处理 Cursor 老命名变体）
    - `STRIP_SUFFIXES`：strip -max/-high/-medium/-low/-xhigh/-thinking 各组合 + -preview/-exp/-extra-high
    - 5 步匹配：直接 → fast 变体 → 剥 suffix → 前缀匹配 → Auto 池兜底（estimated=true）
  - `calcCost.ts`：纯函数 `(row, pricing) → CostBreakdown`，free/errored 返回 0，
    cacheWrite=null 时退化为 input 价计费
  - 单测 **86 个**：12 个 matcher、6 个 calcCost、**68 个真实 CSV sweep**（覆盖全部 36 个真实 model）
- `apps/playground`：
  - `useCsvIngest` hook：state machine idle/parsing/success/error + 全摘要 console.groupCollapsed
  - WelcomePage 拖区接通真实 file input + dragdrop + 上传成功后用真数据替换 mock KPI
  - 顶栏 badge 升级 `V0.2 · PR2 DATA LAYER`，footer 升级 `PR2/6 DATA LAYER READY`

**Acceptance** （全部通过）：
- ✅ `pnpm typecheck` 8/8 packages 全过（严格模式 + noUncheckedIndexedAccess）
- ✅ `pnpm lint` 0 errors（22 个 format/organizeImports 自动修复）
- ✅ data 25/25 测试 ✓ + pricing 86/86 测试 ✓ = **111/111 tests passing**
- ✅ `scripts/verify-pr2.mts` 真实 CSV 跑通：**2335 行全解析（0 failures）**，总耗时 **63ms**
  （read 1.7ms + parse 30.4ms + cost 15.1ms + aggregate 16.1ms）
- ✅ **总成本 $3486.47**，**3471 request units**，**4.27B tokens**，**94.1% cache hit**
- ✅ **costPartiallyEstimated: false**（36 个模型全部精准匹配 PRICING_TABLE，零 Auto pool 兜底）
- ✅ E2E Playwright 拖入真实 CSV：浏览器 console 收到 `[cu] ingested ... 2335 rows · $3486.47 · 53ms`
- ✅ Dark/Light 截图：3 张 KPI 卡片正确显示真数据 $3486.47 / $51.01 / claude-4.6-opus-max-thinking

**首屏数据快照**（用户的真实数据）：
- 时间跨度：2025-04-16 → 2026-05-13（393 天）
- 总成本：$3486.47 USD
- Anthropic 占 $3422.96 / 1772 行 = **98.2% of cost**
- Top burn（单次最贵）：**$51.01** claude-opus-4-7-thinking-xhigh on 2026-04-28
- Top model by cost：claude-4.6-opus-max-thinking 占 **27.3%** ($953.53 / 257 行)
- 单日烧钱最狠：2026-05-07 $227.45 / 2026-04-28 $206.61

### PR3 · charts 库基础组件（~3h）✅ DONE 2026-05-14

**目标**：每个 chart 组件在 Storybook（或简易 demo 页）能独立渲染

- `packages/charts`：
  - `Heatmap.tsx` —— GitHub 风格 calendar，5 阶配色，cost ↔ requests metric 切换 via prop，hover 显示日期+值+meta
  - `WeekHourHeatmap.tsx` —— 7×24 小热图，独立 hover 状态
  - `Sparkline.tsx` —— monotoneX curve + last/peak dots + 可选填充
  - `SmallMultiples.tsx` —— 4 列网格 sparkline，每张卡 hover/click 触发 onSelect
  - `StackBar.tsx` —— 横向堆叠条（TokenBreakdown + CostBreakdown 共用此组件），过滤 0 值段、自动百分比图例
  - `Treemap.tsx` —— d3-hierarchy squarified tiling，太小的 leaf 自动隐藏 label
  - `adapters.ts` —— `daysToHeatmap` / `hourWeekdayToCells` / `daysToSparkline` /
    `modelsToSmallMultiples` / `tokensToStackSegments` / `providersToStackSegments` / `modelsToTreemap`
  - `utils.ts` —— `fmtUSD` / `fmtUSDCompact` / `fmtTokens` / `fmtPercent` / `quantileBreakpoints` / `bucketize`
  - 所有组件用 D3 scales + React 渲染 SVG（不用 D3 操纵 DOM）
  - 颜色全部从 `--cu-heat-*` / `--cu-cat-*` / `--color-*` CSS vars 读取，自动跟随主题
- `packages/tokens`：新增 `charts.css`，定义 **6 阶 heatmap palette**（暖橙阶梯，dark/light 各一套，按视觉亮度对齐而非 hex）+ **6 个 categorical 色**（provider/stack 段用）
- `apps/playground`：
  - `src/components/ChartsPreview.tsx`：六图组合面板，包含 Daily activity / Hour×weekday / Token breakdown / Cost by provider / Model cost share / Top 8 models 小倍数
  - `useCsvIngest` hook 增加 `rows: RowWithCost[]` 字段（charts 需要 per-day per-model trend）
  - 顶栏 badge 升级 `V0.3 · PR3 CHARTS PREVIEW`，footer `PR3/6 CHARTS LIBRARY READY`

**Acceptance** （全部通过）：
- ✅ `pnpm -r typecheck` 9/9 packages 全过（charts 包含 d3-hierarchy 紧类型 `HierarchyRectangularNode`）
- ✅ `pnpm exec biome check` 14 文件 0 errors（3 个 noArrayIndexKey 误报用 biome-ignore + reason 处理）
- ✅ `scripts/e2e-pr3.mjs` Playwright E2E 通过：拖入真实 CSV → `Charts 预览 · PR3` heading 显现 → cost↔requests toggle 切换正常 → dark↔light 切换全部 chart 重渲染、**零 page error**
- ✅ 6 张截图覆盖：initial-dark / uploaded-dark fullPage / charts-only dark / charts-only dark (requests metric) / charts-only light / uploaded-light fullPage
- ✅ 真实数据视觉验证：
  - Daily activity 365 天范围，能看到周末空缺 + 月份分布 + 4/5 月密集烧钱
  - Hour×weekday 显示工作时段集中在 06:00-12:00（用户在 +8 时区）
  - Treemap 显示 Claude opus 三个变体 (4.6-max / 4.7-xhigh / 4.7-max) 合计占 74.5% cost
  - Top 8 small multiples 每个 model 显示 daily cost 趋势 + peak/last dot

**遗留小问题**（不阻塞 PR3 验收，挪到 PR4 polishing）：~~已在 PR3 polish 一并解决~~

### PR3 polish · 2026-05-14（同日补丁）

应用户反馈，先 polish 再进 PR4。三个改动：

1. **新增 `StatGrid` 组件**（`packages/charts/src/StatGrid.tsx`）
   - 微统计网格：每段 `LABEL / 大数字 / share% · sub / 横向 bar`
   - `scaleAgainstMax`（默认 true）让 bar 相对 max(items)，而不是 share-of-total —— 这样 93.5% 那个填满 bar，0.7% 那个还能看见
   - ChartsPreview 的 Token breakdown / Cost by provider 改用 StatGrid 替代 StackBar
   - 同时给 provider 卡加 `rows` 子信息（信息密度提升）

2. **StackBar 新增 `minSegmentWidth` prop**（默认 6px）
   - "Rob from the rich" 算法：小段强制到 6px，从最大段扣掉 debt，保留 rank order
   - StackBar 保留为通用组件，未来若想强调 dominance 可设 `minSegmentWidth={0}`

3. **`modelsToTreemap` 增加 `otherThresholdPct`**（默认 1%）
   - 小于阈值的 model 自动聚合成 "Other · N models" 单一 leaf，颜色用 `--cu-cat-6` (中性灰)
   - 用户的 36 个模型→ headliners 9 个 + Other (26 models, 2.2%, $76.01)

视觉前后对比（同一 CSV）：

| 区域 | 前 | 后 |
|---|---|---|
| Token breakdown | 横条 4 段（cacheRead 占 93.5% 视觉吞掉其他三段）| 4 张 micro-stat 卡：INPUT 84M · CACHE WRITE 170M · CACHE READ 4G · OUTPUT 28M，share% + bar |
| Cost by provider | 横条（Anthropic 占 98.2% 吞掉其他）| 6 张 micro-stat 卡：每张含 cost + rows + share%，OTHER provider 也独立成卡 |
| Model treemap | 36 个 leaves，尾部 26 个挤成色彩斑斓的小方块 | 9 个 headliners + 1 个 "Other · 26 models" 灰色块（$76.01, 2.2%）|

**验收**（polish 二次跑）：
- ✅ `pnpm -r typecheck` 9/9 ✓
- ✅ `pnpm exec biome check` 0 errors
- ✅ Playwright E2E `scripts/e2e-pr3.mjs` 0 page error
- ✅ Dark/Light 全部 chart 重渲染正常
- ✅ Polish 后截图：`_temp/pr3-screenshots/03-charts-dark.png` & `05-charts-light.png`

### PR4 · 概览页（~2.5h）

**目标**：路由 1 / 概览页跑通真实数据

- `apps/playground/src/routes/Overview.tsx` 三行布局
- KpiCard 组件 + 三个变体（带 sparkline / 带迷你 breakdown / 纯数据）
- BurnStoryCard 组件（Top 5 烧钱请求）
- 「等于平时 N 次 Sonnet」对比文案
- Filter（默认全部 60 天）

**Acceptance**：
- 拖入用户 CSV 后概览页 1 秒内渲染完成
- 总成本数字与手算一致（误差 ≤ $0.01）
- BurnStoryCard 对 4400 万 token 那条请求有特殊视觉强调

### PR5 · 明细页 + 模型页 + 时段页（~3h）

**目标**：剩下 3 个路由全部完成

- DataTable + virtual scroll + Filter + Drawer
- Models 路由：每个模型的卡片网格
- Activity 路由：大 7×24 热图
- 统一的 FilterBar 组件（在 4 个页面共享）

**Acceptance**：
- 2335 行明细表流畅滚动（FPS ≥ 50）
- 筛选实时生效（≤ 100ms）
- 抽屉打开有 spring 动效
- 4 个路由切换无 FOUC

### PR6 · 收尾 + 隐私脱敏 + README（~1.5h）

- 隐私脱敏开关（金额显示为 ▒▒▒▒）
- 拖入 CSV 后 localStorage 存"最近一次的统计摘要 hash"做提示
- README：使用说明、数据隐私声明、技术架构图
- 截图（暗色 + 亮色）放 README

**Acceptance**：
- 所有 lint / typecheck 通过
- README 完整
- 浏览器 console 无任何 error / warning
