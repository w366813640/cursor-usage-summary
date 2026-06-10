# 性能优化计划（Performance Optimization Plan）

> 任务：`06-10-perf-optimization`
> 背景：用户反馈应用"感觉卡卡的"。本 PRD 基于对 renderer / 数据层 / 图表层 / Electron 主进程 / CSS 的全量代码 review，定位卡顿根因并给出分阶段优化方案。
> 现状基线：主 bundle 611.9 kB（gzip 181.4 kB）、CSS 117.4 kB、vendor-motion 114.7 kB、vendor-radix 137.8 kB；数据全量驻留 renderer 内存，所有分析在 UI 线程同步计算。

---

## 一、问题清单（按用户感知症状分组）

### 症状 A：切页 / 进入 Overview 时整页顿挫（最可能的"卡"源头）

**A1. 路由切换 = 全量重挂载 + 全量重计算 + 全量动画重放**
- `DashboardShell.tsx` 用 `<div key={route}>` 包住页面，且页面用条件渲染——每次导航都卸载/重建整页。
- Overview 一次挂载要做 **~13 次全数据集遍历**（见 A2），且全部在 UI 线程同步执行。
- 同时重放所有入场动画：8 个 `motion.section` 串行 fade/slide、365 个热力图格子的 staggered scale 动画（`charts.css` 的 `cu-heatmap-cell-in`，delay 最长 900ms）、Sparkline 描线动画、KPI 数字 count-up。
- `KpiCard.tsx` 的 `useCountUp` 用 `setState`-per-RAF-frame 跑 1.2s —— 4 张卡 ≈ **288 次 React 重渲染**集中在首屏 1.2 秒内，叠加上面的计算和动画就是顿挫感的直接来源。

**A2. Overview 重复计算严重（同一份数据算两遍）**
- `ActionFeed` → `computeActionInsights()` 内部已经调用 `detectAllAnomalies` + `computeEfficiency` + forecast（`packages/data/src/insights.ts`）。
- 但 `OverviewActivity` 又单独调 `detectAllAnomalies`，`EfficiencyCard` 又单独调 `computeEfficiency`，`ForecastPanel` 又单独调 `buildForecast`。
- 即：异常检测 ×2、效率分析 ×2、预测 ×2，外加 weekSummary / dailyStack / smallMultiples / cacheSavings / medianSonnetCost / scenarios / compareRanges / dayIndex 各一遍。
- 这些 `useMemo` 以 `rows` 为依赖分散在各组件里，路由切回 Overview 时组件重挂载，memo 全部失效从头算。

**A3. KeyboardShortcutsProvider 的 context 抖动放大重渲染**
- `packages/ui/src/shortcuts/KeyboardShortcuts.tsx`：每次 `register/unregister` 都 `setTick` → context value 重建 → **所有调用 `useShortcut` 的组件全部重渲染**。
- `DashboardShell` 自身注册 7+ 个快捷键（导航 6 个 + settings），挂载时连环 tick；任何 modal/页面注册退册快捷键都会再次触发 DashboardShell 级别的重渲染（= 整个仪表盘子树）。

### 症状 B：滚动卡顿

**B1. 三层 sticky + backdrop-blur 叠加**
- 顶栏 `WelcomePage.tsx` `blur(8px)` + `FileToolbar`（sticky top-12, backdrop-blur）+ `SectionHeader`（sticky top-[88px], backdrop-blur）。
- 滚动时每帧都要重栅格化三段模糊区域，Windows 上是经典的滚动掉帧配方。表格页 `<thead>` 还有第四层 backdrop-blur。

**B2. 背景渐变画了两遍**
- `styles.css` 的 `body::before`（fixed 双 radial-gradient）与 `WelcomePage.tsx` PageChrome 内联 style 的双 radial-gradient 重复，多付一次大面积合成成本。

**B3. 大面积多层阴影 + hover 时动画 box-shadow**
- `--shadow-glass`（3 层阴影）铺满几十个 Panel 本身可接受，但 `KpiCard` hover 用 `transition-[box-shadow,...]` 动画阴影 + `whileHover` y 位移，hover 扫过时重绘区域大。

### 症状 C：图表 hover 卡

**C1. `StackedAreaChart.tsx` hover 重渲染整棵 SVG**
- `onPointerMove` → `setHoverIdx` → 整个组件（所有 path/gridline/legend/tooltip）reconcile，鼠标横扫一次最多触发 365 次重渲染。
- 总量线带 `style={{ filter: 'blur(4px)' }}` —— SVG 滤镜逐帧重栅格化，开销远超普通描边。

**C2. 热力图 hover 状态提升到父组件**
- `Heatmap.tsx` hover 时父组件重渲染（cells 已 memo，可接受），但 outlier rects + legend 每次重算；tooltip 用内联绝对定位，无节流。

### 症状 D：输入卡（Details 页搜索）

**D1. 每个键击全量 filter + sort**
- `DetailsPage.tsx`：`filtered` memo 依赖 `query`，每键击对全部 rows 做 filter（每行拼接字符串 + toLowerCase）+ O(n log n) sort，无 debounce / `useDeferredValue`。数据量大时打字明显卡。

### 症状 E：导入 / 启动慢

**E1. 全表 IPC + UI 线程聚合**
- `useDesktopIngest.ts`：hydrate / commit / undo 都走 `loadAllRows()`（结构化克隆整张表跨 IPC）→ `hydrateRows`（全量 map 复制 + new Date）→ `aggregate()`（再一遍全量 + 一次 O(n log n) sort）。10 万行级别时 renderer 主线程阻塞数百毫秒，期间整个 UI 冻结。
- 全量 `rows` 常驻 React state，内存占用高，且作为 props 穿透所有页面。

**E2. useSettings 一变八连发**
- `useSettings.ts` 无共享缓存，8 个调用点各自 mount-fetch；任何 `save()` 广播 `cu:settings-change` → 8 个实例各自再发一次 IPC `getSettings()` → 8 处异步 setState，从树的不同位置掀起多波重渲染（DashboardShell / OverviewPage / ActionFeed / BudgetUrgencyBanner…）。

**E3. 主 bundle 偏大、首屏解析慢**
- index 611.9 kB：`SettingsDrawer`（59 kB 源码）、i18n dictionaries（49 kB）、kbar、所有 overview 组件都打进主 chunk；4 套可变字体多子集全量引入。Electron 本地加载缓解了网络成本，但解析/执行成本仍在首屏。

---

## 二、优化方案（按阶段交付）

### Phase 1 — 重渲染与计算去重（先解决"切页卡"）✅ 优先级最高

| # | 改动 | 触点 | 预期收益 |
|---|------|------|---------|
| 1.1 | **Overview 洞察统一计算**：在 `OverviewPage`（或专用 hook `useOverviewInsights`）一次性算出 anomalies / efficiency / forecast / actionInsights / weekSummary，向下传 props；`computeActionInsights` 增加可注入预计算结果的参数，消除 ×2 重复 | `OverviewPage.tsx`、`insights.ts`、4 个 overview 子组件 | Overview 挂载计算量约砍半 |
| 1.2 | **跨路由结果缓存**：以 `rows` 引用为 key 的模块级 WeakMap 缓存（或把 insights 提升到 DashboardShell 的 useMemo），路由切回 Overview 不再从头算 | `DashboardShell.tsx` 或新 hook | 二次进入 Overview 接近 0 计算 |
| 1.3 | **快捷键 registry 去抖动**：拆分 context——`register` 走 stable context（ref 存储，不随 tick 变化），cheatsheet 列表改用订阅模式（`useSyncExternalStore`），删除 tick 驱动的 value 重建 | `KeyboardShortcuts.tsx` | 消除注册/退册引发的全树重渲染 |
| 1.4 | **入场动画只放一次**：动画状态记录"本会话已播放"（module-level flag 或 sessionStorage），路由二次进入直接落最终帧；KPI count-up 仅首次数据落地时播放 | `OverviewPage.tsx`、`KpiCard.tsx`、`charts.css`（heatmap stagger 同理） | 切页立即可交互 |
| 1.5 | **KpiCard count-up 降频**：RAF 内直接写 DOM 文本节点（ref）而非 setState/帧，或用 framer-motion `animate()` + `useMotionValue` | `KpiCard.tsx` | 首屏减少 ~288 次重渲染 |
| 1.6 | **DetailsPage 搜索防抖**：`useDeferredValue(query)` + 预构建 lowercase 检索列（随 rows memo 一次）+ filter/sort 拆分 memo | `DetailsPage.tsx` | 打字不再卡 |

### Phase 2 — 渲染/合成成本（解决"滚动卡、hover 卡"）

| # | 改动 | 触点 |
|---|------|------|
| 2.1 | sticky 栏去 backdrop-blur：FileToolbar / SectionHeader / 表格 thead 改为不透明 `color-mix(bg, 96%)` 实底（顶部主栏可保留唯一一处 blur），消除滚动逐帧栅格化 | `FileToolbar.tsx`、`SectionHeader.tsx`、3 个表格页 |
| 2.2 | 删除 PageChrome 重复的 radial-gradient（保留 `body::before` 一份） | `WelcomePage.tsx` |
| 2.3 | StackedAreaChart：几何层拆成 memo 子组件，hover 只渲染 crosshair/tooltip 覆盖层；`blur(4px)` SVG 滤镜替换为宽描边低透明度的"伪光晕"（双 stroke 已有，只去 filter）；hover setState 用 rAF 节流 | `StackedAreaChart.tsx` |
| 2.4 | KpiCard hover 不动画 box-shadow：阴影放伪元素上 transition opacity；保留 transform 位移 | `KpiCard.tsx` |
| 2.5 | Heatmap：outlier ring/legend 拆 memo；tooltip 定位走 transform | `Heatmap.tsx` |

### Phase 3 — 数据通路（解决"导入/启动慢"，量大时质变）

| # | 改动 | 触点 |
|---|------|------|
| 3.1 | **聚合下沉**：`aggregate()` 移到主进程（better-sqlite3 SQL GROUP BY 或 Node 侧执行 aggregate），IPC 只传 `UsageSummary` + 各页按需查询（Details 分页查询、Day 按日查询已具备 `db:query` 通道）。渐进式：先加 `db:summary` 通道，rows 仍可选传 | `apps/desktop/src/db.ts`、`usageDb.ts`、`useDesktopIngest.ts` |
| 3.2 | 过渡方案（如 3.1 暂缓）：`hydrateRows` 去掉全量 map（dateISO 惰性解析），`aggregate` 移入 Web Worker | `desktopStorage.ts`、`@cu/data` |
| 3.3 | **SettingsProvider 单例化**：一次 fetch + 一个事件监听，8 个调用点改读 context | `useSettings.ts`、`App.tsx` |

### Phase 4 — 启动体积与加载

| # | 改动 | 触点 |
|---|------|------|
| 4.1 | `SettingsDrawer` / `ImportHistoryDrawer` / `ImportPreviewDrawer` / `OnboardingTour` / `CompareBatchesModal` 改 `lazy()`（打开时才加载） | `WelcomePage.tsx` 等 |
| 4.2 | 字体瘦身：只引 latin / latin-ext 子集（fontsource 支持按子集导入），4 族 → 评估去掉未用族 | `styles.css`、`package.json` |
| 4.3 | i18n 字典按 locale 动态 import（en 内联，zh 懒加载） | `packages/ui/src/i18n` |
| 4.4 | `bundle:report` 接阈值检查进 `release:smoke`（防回归） | `scripts/bundle-report.mjs` |

### Phase 0 — 度量先行（与 Phase 1 并行做）

1. `performance.mark/measure` 包住：hydrate→success、route switch→首帧、aggregate 耗时，开发模式输出到 console。
2. 生成 10 万行合成 CSV fixture（脚本放 `scripts/`），作为压测数据集。
3. 验收口径：
   - 路由切换 script 时间 < 100ms（10 万行数据集）
   - Details 搜索键击 → 渲染 < 50ms
   - 滚动 / 图表 hover 不掉帧（DevTools Performance 无长任务、无大面积 paint）
   - 主 bundle gzip < 150 kB（Phase 4 后）

---

## 三、风险与不做的事

- **不引入虚拟滚动**：Details 已分页（50/页），表格本身不是瓶颈；不为假设性需求加 react-virtual。
- **不重写路由/状态库**：hash 路由和 props 传递保持现状，只加缓存层，避免大爆炸式重构。
- **动画风格不降级**：只改"重放策略"和实现方式（DOM 写入 / transform 化），视觉规格不变；`prefers-reduced-motion` 路径已存在，保持。
- 3.1（聚合下沉）影响面最大，放最后单独做，带回归测试（`packages/data` 现有测试做对照：SQL 聚合结果 vs `aggregate()` 结果全等断言）。

## 四、实施顺序建议

```
Phase 0（度量）→ Phase 1（重渲染/计算，1.1–1.6）→ Phase 2（合成/绘制）
→ Phase 4（体积）→ Phase 3（数据通路，含 3.3 可提前）
```

每个 Phase 一个独立 commit 序列，Phase 完成后用 Phase 0 的度量复测并记录前后对比。

---

## 五、实施状态（2026-06-10）

全部阶段已实施完毕，质量门通过（lint / typecheck / test / build / bundle:report 全绿）。

| 项 | 状态 | 实际落点 |
|---|------|---------|
| 0.1 度量 | ✅ | `apps/playground/src/utils/perf.ts`（`perfSpan` / `reportRoutePaint`），打点：`hydrateFromDb`、`hydrate.summaryCosted`、`overviewInsights`、route→paint |
| 0.2 压测数据 | ✅ | `scripts/gen-perf-fixture.mjs`（10 万行合成 CSV） |
| 1.1/1.2 计算去重+缓存 | ✅ | 新 hook `useOverviewInsights`（WeakMap 以 rows 引用为 key，按 locale 二级缓存）；`computeActionInsights` 支持 `precomputed` 注入；`getCachedAnomalies` 供 AnomaliesPage 复用 |
| 1.3 快捷键去抖动 | ✅ | `KeyboardShortcuts.tsx` 拆 `ShortcutsApiContext`（终身稳定）+ `CheatsheetOpenContext`；列表订阅走 `useSyncExternalStore`（`useShortcutList`） |
| 1.4 动画只播一次 | ✅ | `useEntranceOnce`（module-level Set，按路由 key）+ `EntranceContext` 下发；`charts.css` 增加 `.cu-charts-no-anim` 直落最终帧 |
| 1.5 count-up 降频 | ✅ | `KpiCard` 改 `useCountUpRef`，RAF 直写 `textContent`，零重渲染 |
| 1.6 搜索防抖 | ✅ | `DetailsPage` 用 `useDeferredValue` + 随 rows 预构建 lowercase 检索列 |
| 2.1 sticky 去 blur | ✅ | FileToolbar / SectionHeader / 三个表格 thead 改不透明实底 |
| 2.2 重复渐变 | ✅ | PageChrome 内联 radial-gradient 删除，保留 `body::before` 一份 |
| 2.3 图表 hover | ✅ | `StackedAreaChart` 几何拆 memo `GeometrySvg`，hover 走独立覆盖层 SVG；`blur(4px)` 滤镜换三层描边伪光晕；pointermove rAF 节流 |
| 2.4 KpiCard 阴影 | ✅ | box-shadow 移出 transition 列表（只 transition border/bg） |
| 2.5 Heatmap | ✅ | outlier rects 拆 memo `OutlierRects` |
| 3.1 聚合下沉 | ✅ | 新 IPC `db:summaryCosted`：主进程跑 `aggregate()`（lazy require `@cu/data`），一次往返回 rows+summary；renderer `loadSummaryCosted()` 带旧主进程回退；hydrate/commit 均改走该通道 |
| 3.2 Worker 过渡 | 跳过 | 3.1 直接落地，无需过渡方案 |
| 3.3 Settings 单例 | ✅ | `useSettings.ts` 重写为模块级 store + `useSyncExternalStore`：1 次启动 fetch、save 后零重复 IPC（原 6 消费点 × N 次） |
| 4.1 懒加载 | ✅ | SettingsDrawer / ImportHistoryDrawer（含 CompareBatchesModal）/ ImportPreviewDrawer / OnboardingTour 全部 `lazy()` + `useLatch` 保退场动画 |
| 4.2 字体瘦身 | ✅ | `apps/playground/src/fonts.css` 仅 latin/latin-ext ×3 族（6 个 woff2，224.8 kB）；删未用 source-serif-4 依赖 |
| 4.3 字典拆分 | ✅ | `dictionaries.zh.ts` 独立 chunk（17.7 kB），`loadDictionary()` 动态 import，en 内联兜底 |
| 4.4 bundle 阈值 | ✅ | `bundle-report.mjs` 新增：overlay chunk 存在性、zh 字典 chunk 存在性、字体文件数 ≤6 |

### Bundle 前后对比

| 指标 | 基线 | 现在 |
|------|------|------|
| 主 chunk | 611.9 kB（gzip 181.4） | 534.0 kB（gzip 163.7） |
| 字体文件 | 全子集（数十个） | 6 个 / 224.8 kB |
| 懒加载 chunk | 5 个路由页 | + 4 个 overlay + zh 字典 |

> gzip 150 kB 的最终目标未完全达成（163.7 kB）；剩余大头是 kbar、overview 全家桶在主 chunk。可作为后续任务（懒加载 CommandPalette / overview 次级面板）再收口。

### 验收复测（待用户实测）

合成 10 万行数据集下的 route-switch / 搜索键击 / 滚动帧率需要在桌面端实测；打点已就位（dev console 可见 `[perf]` 输出）。
