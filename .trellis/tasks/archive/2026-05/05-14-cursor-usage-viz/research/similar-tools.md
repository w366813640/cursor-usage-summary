# 类似工具的可视化模式调研

> 目的：偷学社区已经验证过的可视化模式，避免重新发明轮子；同时找差异化空间。

## Cursor 专属工具

### 1. Cursor Stats Extension （Chrome 扩展）
- 仓库：https://github.com/alexerm/cursor-stats-extension
- 特点：交互式 charts + calendar view、agent messages、accepted code suggestions、token usage、cost analytics
- v0.3.0（2026-01）新增：年份切换、月度预算追踪
- **学习点**：calendar 视图是 Cursor 用户的预期；月度预算追踪是刚需

### 2. CursorLens （Next.js + Postgres，393★）
- 仓库：https://github.com/HamedMP/CursorLens
- 特点：作为 proxy 在 Cursor 和 AI 提供商之间，记录所有交互；提供详细 cost analytics
- 多 AI provider 支持
- **学习点**：cost-per-request drill-down 是核心 value，UI 应该让"找到那条贵的请求"非常容易

### 3. Cursor Analytics Portal （Python）
- 仓库：https://github.com/galprz/cursor-analytics
- 特点：生成静态 HTML 报告、团队分组、CLI 灵活筛选
- **学习点**：静态 HTML 报告这条路也行得通（比起 SPA 更轻量）

### 4. OpenUsage （Go terminal）
- 仓库：https://github.com/janekbaraniewski/openusage
- 特点：跨 17 provider 的 terminal dashboard、零配置自动检测
- **学习点**：终端样式不适合本任务（用户要 huashu-design），但"跨 provider 一站式"的产品定位有意思

## 通用 Coding Analytics

### 5. DevDaily Dashboard （React 18 + Tailwind + Vite）
- 仓库：https://github.com/coder-ralph/devdaily-dashboard
- 特点：full-year GitHub-style heatmap、WakaTime 集成、Chart.js、gamified XP/level system
- **学习点**：full-year heatmap 已成业界共识；gamified 化倾向需要谨慎（容易变成 AI slop）

### 6. Wakadash （terminal）
- 仓库：https://github.com/b00y0h/wakadash
- 特点：9 个可视化面板（语言、项目、编辑器、heatmap、sparkline）、6 主题预设（Dracula/Nord/Gruvbox/Monokai/Solarized/Tokyo Night）、双列响应式
- **学习点**：multi-panel 网格布局、theme system

### 7. Wakatime Dashboard Pro （React + Vite + Ant Design + Ant Design Charts）
- 仓库：https://github.com/fangge/wakatime-dashboard-pro
- 特点：交互式柱状图、自定义日期范围、treemap 项目时间分配、可编辑项目摘要表
- **学习点**：treemap 适合表达"模型 cost 占比"，比 pie chart 更高级

### 8. Hakatime （self-hosted Wakatime）
- 仓库：https://github.com/mujx/hakatime
- 特点：项目/语言分解、星期 × 小时分析、活动时间线、per-file 时间追踪
- **学习点**：day-of-week × hour-of-day 的小热图（不是年度热图）适合表达"工作节奏"

## 共同模式总结

业界标配：
1. **Year-style heatmap**（GitHub contribution graph 风格）—— 概览页必备
2. **Multi-panel layout**（2-3 列网格，每个 panel 可独立读）
3. **Theme support**（至少 light/dark）
4. **Drill-down interaction**（点击 panel → 跳到明细）
5. **Filter bar**（日期范围、模型、kind）
6. **Top-N rankings**（top models / top days / top expensive requests）

进阶模式：
7. **Cost forecasting / 月度预算追踪**
8. **Sparkline 在 KPI 卡片里**（趋势暗示）
9. **Treemap 表达 cost 占比**
10. **Hour × Day-of-week 工作节奏热图**

## 我们能做的差异化

社区工具普遍用：
- Recharts / Chart.js（样式偏 generic）
- 蓝/紫主色（SaaS 默认）
- 圆角卡片+左 border accent（Material 残影）
- emoji 图标 / 装饰性 stats

我们要差异化的方向：
1. **暖色调** + 赤土橙 accent（继承 base 项目）—— Cursor 圈子里没有这种气质
2. **Source Serif 4 大数字** —— 数据本身有"打印质感"
3. **JetBrains Mono 在 token 数 / cost 数字上** —— "tools by tools" 信号
4. **凸显成本不对称**（一条 Max 请求 = 几百次 Sonnet）—— 这个洞察本身就有故事性
5. **请求级别叙事**（不只是聚合数据）—— Top 5 烧钱请求做成"卡片故事"，而不是 generic 表格行
6. **不用 emoji、不用紫渐变、不用装饰图标** —— 全场视觉签名一致

## 不要做的（slop 警示）

- ❌ 不要做 gamified XP / level / 成就徽章（DevDaily 的弯路，反 AI slop）
- ❌ 不要做"对比同行"（隐私敏感，且会变成虚荣指标）
- ❌ 不要做"AI 给你的代码评分"（无法证伪的指标）
- ❌ 不要每个 KPI 卡都配 emoji 图标
- ❌ 不要把 chart axis 颜色搞成彩虹色
