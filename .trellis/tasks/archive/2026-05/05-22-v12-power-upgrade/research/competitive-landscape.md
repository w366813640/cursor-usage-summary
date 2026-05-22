# 竞品对标：Cursor 使用统计 / dashboard 产品横向对比

> 来源：web search + 直接读 README + Cursor 官方 Analytics API doc（2026-05-22）

## 1. cursor-usage-tracker (GitHub ofershap, 19★)

**定位**：Cursor Enterprise team 的 cost 监控 + 异常告警

**核心能力**：

### 三层 Anomaly Detection
| Layer | Method | What it catches |
|---|---|---|
| **Thresholds** | Static limits | 硬上限（默认 off） |
| **Z-Score** | Statistical | 用户日花费 ≥ 2.5σ above team mean |
| **Trends** | Spend-based | 日 spend spike vs personal avg；cycle spend vs team median |
| **Expensive Model** | Cost/request | $/req 跳变（catch max-thinking 等 model 切换） |

### Incident Lifecycle (MTTD/MTTI/MTTR)
- MTTD: 系统多快发现
- MTTI: 人多快 acknowledge
- MTTR: 多快 resolve

### Proactive Notifications
| 类型 | 触发条件 |
|---|---|
| Anomaly alerts | within the hour |
| Plan exhaustion | daily, when users exceed plan |
| Cycle summary | 3 days before billing cycle ends |

### Settings 可配
- Z-score multiplier (default 2.5)
- Spend spike multiplier (default 5.0×)
- Cycle outlier multiplier (default 10.0×)
- Cost/req spike multiplier (default 3.0×)
- Cost/req min daily spend (default $20，过滤低 spend 噪声)

**我们要学的**：
- z-score 系数 2.5 是行业经验值
- 异常分级（severity）+ 自动 narrative（"Bob's daily spend spiked to $214, 4.2× his 7-day avg of $51"）
- 关键 trick：过滤 active users only / min daily spend 过滤噪声

**我们不学的**：
- Slack/Email 通知（我们是本地工具，桌面 Notification 已经够；不引外部依赖）
- Incident MTTD/MTTI/MTTR（team 工具才需要，个人/小团队无意义）

---

## 2. PostHog Insights & LLM Analytics

**核心能力**：

### Anomaly Detection Alerts
- 13 种算法（Z-score, MAD, Isolation Forest 等）
- **Simulate** 功能：保存前可预览检测器在历史数据上的表现
- 提示词支持自然语言："Create an anomaly detection alert on my pageviews insight using Z-score"

### Request Clustering
- 输入：traces / generations（7d window）
- 算法：embedding → 2D 投影 → cluster
- 每个 cluster 自动生成 title + description（AI）
- 指标：average cost / latency / tokens / error rate / total cost per cluster
- Outliers cluster（不属于任何 cluster 的请求）

**我们要学的**：
- Anomaly 选 Z-score + MAD 两种（MAD 对 outlier 更 robust）
- 提供 "Simulate" 功能：用户调整阈值时实时显示历史数据上会标出多少异常点

**我们不学的**：
- LLM-based cluster naming（违反 local-only）
- Embedding scatter（本地无 embedding 模型 / 不调外部，且 UX 复杂）

---

## 3. Vercel & Linear Design Systems

### Vercel
- 单色严格：ink `#171717` + 200-step grayscale
- **没有任何 chromatic accent**——ink IS the brand
- Geist + Geist Mono 字体
- 9 种 corner radius（0 - 9999px）
- 100px pill marketing CTA（signature）
- 堆叠 shadow > 单 drop
- 卡片：`-12% black opacity layered with an inset hairline ring`

### Linear
- bg `#010102`（faint blue cast，never pure `#000000`）
- 4-step surface ladder: `#0f1011` / `#141516` / `#18191a` / `#191a1b`
- 单 chromatic accent: lavender `#5e6ad2`（仅 brand mark / focus / 1 primary CTA per section）
- Hairline: `#23252a` → `#34343a` → `#3e3e44`
- 没有 atmosphere gradient / spotlight card
- 用 surface lift + hairline 表达层级，不靠 shadow
- 字体：Linear Display / Text / Mono
- 极致 negative tracking（-3.0px at 80px → 0 at body）

**我们要学的**：
- 单 accent 哲学（我们已经做了 — `#DB8460`）
- 4-step surface ladder（替代单 `--color-surface`，让层级更密）
- 极致 hairline（多种 border 颜色台阶）
- mono 字体场景隔离（数字/code/timestamp）

**我们要新增的 theme**：
- `cu-linear-night`：Linear 配色直接 port，作为深色 power 模式
- `cu-mono`：Vercel 风的极致 grayscale，作为极简模式

---

## 4. ModelMeter / TokenTop / OpenUsage (个人单机工具家族)

### 共性
- 多 provider 聚合（OpenAI/Anthropic/Cursor/Copilot/Codex/...）
- live polling vs 静态 CSV
- budget guardrails（daily/weekly/monthly limit + visual warning）
- adaptive sidebar by model/project/agent
- efficiency insights（cache leverage, output verbosity, cost-per-request）

### TokenTop 特别
- TUI 终端界面
- 11 providers
- responsive layout（ultrawide → laptop 自动 reflow）

### OpenUsage 特别
- terminal-first（`openusage` 一条命令直接出 dashboard）
- 17 providers
- 自动检测 API key（zero config）

**我们要学的**：
- "live burn rate"（不只是历史，还要 current pace）
- adaptive sidebar：sidebar 内容根据当前选中的 model/project/agent 动态变
- responsive reflow：当前 Overview 在窄屏不够 graceful

**我们不学的**：
- 多 provider 聚合（我们专注 Cursor）
- terminal UI（违反产品定位）

---

## 5. Cloudflare Custom Dashboards (2026-04-22 GA)

- 100+ GraphQL 数据源
- Log Explorer integration：saved query → visualization
- Template gallery：Bot monitoring / API Security / Account takeover / Performance monitoring
- Chart types: Timeseries / Bar / Donut / Map / Stat / Percentage / Top N

**我们要学的**：
- Template gallery 思路：可以做 "v1.2 demo views"（Power user / Team lead / Finance / Curious 4 个模板预设）
- Chart type 完整度（我们少 Map / Donut，但本场景用不上 Map，Donut 已经有 Treemap 替代）

**我们不学的**：
- 用户自定义 dashboard（v1.2 不做，复杂度爆炸）

---

## 6. Cursor 官方 Analytics API（Enterprise only）

### 团队级 endpoints
- `/analytics/team/agent-edits` — agent edits
- `/analytics/team/tabs` — tab usage
- `/analytics/team/dau` — DAU
- `/analytics/team/models` — model usage
- `/analytics/team/top-file-extensions`
- `/analytics/team/mcp` — MCP adoption
- `/analytics/team/commands` — commands adoption
- `/analytics/team/plans` — Plan mode adoption
- `/analytics/team/skills` — skills adoption
- `/analytics/team/ask-mode` — Ask mode adoption
- `/analytics/team/conversation-insights` — aggregate (不是 raw 内容)
- `/analytics/team/leaderboard` — top users
- `/analytics/team/bugbot` — Bugbot PR analytics

### By-user endpoints（同上 metric，每个加 `/by-user`）

**Rate limit**: 100 req/min (analytics) + 20 req/min (admin)

**我们要不要接？**

不接。理由：
1. **隐私优先**: 我们的产品哲学是 "100% local, no backend, no API calls"
2. **Enterprise only**: 仅企业版可用，个人用户用不了
3. **当前 CSV 导出已经覆盖核心场景**: Cursor 的 CSV 字段已经包含 cost/model/tokens/agent ID，
   我们 + 自己的 pricing engine 完全可以做到 enterprise tracker 80% 的能力
4. **维护成本**: 接 API 意味着 schema 变更 / rate limit / auth 都要追

但 **API 路径名给了我们启示**：MCP adoption / Plans adoption / Skills adoption / Ask-mode
这些都是"Cursor 用户实际在用什么 feature"的统计，可以从 CSV 里推导（比如根据 `tool_use_kind`
字段）；本 task 不做但留作 v1.3 思路。

---

## Gap 总结：我们 vs 市面最好

| Gap | 谁做了 | 我们的解法（v1.2） |
|---|---|---|
| **Anomaly detection** | cursor-usage-tracker, PostHog | PR2 新路由 `#anomalies`，3 类 detector |
| **Expensive-model alert** | cursor-usage-tracker | PR3 blacklist + budget guard |
| **Action recommendations** | cursor-usage-tracker（savings calculator） | PR3 efficiency calculator |
| **Command Palette** | Linear, Vercel, Cursor 自己 | PR1 用 `kbar` |
| **Left collapsible nav** | Linear, Datadog, Cloudflare, Vercel | PR4 新 SideNav |
| **Focus mode** | Datadog, Grafana | PR5 Panel + portal |
| **Multiple themes** | 多数 power dashboards | PR5 加 `cu-mono` + `cu-linear-night` |
| **Outlier ring on chart** | Grafana, PostHog | PR5 chart 组件加 prop |
| **Monthly PDF report** | Stripe, AWS Cost Explorer | PR6 `react-pdf` |
| **Cost story timeline** | Datadog event timeline | PR7 |
| **Goal tracking** | RescueTime, Stripe | PR7 |
| **Time-of-day efficiency heatmap** | WakaTime, Toggl | PR8 |
| **Data health page** | Datadog Agent Status | PR8 |
| **Request clustering** | PostHog | v1.3 推迟 |
| **CSV auto-fetch** | cursor-usage-tracker (via API) | 永久不做（隐私） |

## 我们已经做对的（不要破坏）

| 能力 | 我们已有 | 说明 |
|---|---|---|
| GitHub-style 年度 heatmap | YearReviewPanel | 设计已经精致 |
| 30d 线性回归 Forecast + 置信带 | ForecastPanel | 数学正确 |
| Compare ranges | CompareRangesPanel | 4 项 delta + 并排 bar |
| Compare batches modal | CompareBatchesModal | A vs B 三栏 |
| Top 5 burns 叙事卡 | BurnStoryCard + burnCaption | 比 cursor-usage-tracker 的"alert text"更可读 |
| Bloomberg/Tufte 美学 | 整体 | 这是我们的差异化，别学 Vercel 的纯灰 |
| 100% local + no backend | 架构 | 是我们的护城河 |
| 桌面 SQLite + 双层去重 + Undo | @cu/storage | 工程已成熟，不动 |

---

## 关键发现：v1.2 的 "Why" 写在用户语境里

我们的目标用户（个人 / 小团队 Cursor 重度用户）每天打开 dashboard 时心里的问题：

1. **"今天花了多少？"** — Overview KPI ✅ 已答
2. **"今天 vs 我平时一样吗？"** — **PR2 Anomaly 答**（当前没答）
3. **"为什么贵？"** — PR1 burn caption + PR2 anomaly explanation 答
4. **"怎么省？"** — **PR3 Efficiency calculator 答**（当前没答）
5. **"会不会超预算？"** — MonthlyBudgetPanel + PR3 pace gauge 答
6. **"我能不能演示给老板看？"** — **PR6 Monthly PDF 答**（当前只能 PNG 单图）

v1.0 答对 1，v1.2 把 2/3/4/6 也答上。
