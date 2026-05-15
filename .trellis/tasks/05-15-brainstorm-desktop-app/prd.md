# brainstorm: cursor-usage desktop app (Electron)

## Goal

把 `cursor-usage-viz` 从 "导入 CSV 后浏览器临时可视化"，升级为 **Claude
Desktop 风格的 Windows 桌面 app**：

- 用 Electron 包成正经桌面 app（Windows 主战场，macOS / Linux 顺手）
- **CSV 导入只是一个入口**，真正的核心是把数据**持久化到本地数据库**
- 后续可以**追加导入 + 自动去重**，不会被浏览器缓存清掉
- 信息密度和专业度向 claude.ai desktop / Bloomberg Terminal 看齐
- 复用 `writing_aassist` / `oh-my-open-ui` 同款 Electron 脚手架（Electron 33
  + electron-builder + electron-updater + 自带 splash + Windows
  titleBarOverlay + AppUserModelID + jumplist）

## What I already know

### 现状（`cursor_usage` v0.9 / commit `8e75494`）

- pnpm monorepo · `apps/playground` + 8 个 `packages/` (brand · charts ·
  data · pricing · tokens · motion · icons · ui)
- React 19 + Vite 6 + Tailwind v4 + Framer Motion 11 + Zustand 5
- 已实现 4 个路由（Overview / Models / Details / Hours），每条都已经做过
  PR1–PR14 的设计 polish + 动画 + 月度预算 + CompareRangesPanel + Export
  PNG + 自动恢复 + DateRangeFilter + SelectionDetailPanel
- 存储 = `idb-keyval` 在 IndexedDB，浏览器清缓存会丢

### 两个参考项目共同特征（**直接抄就行**）

- 都有 `apps/desktop`，**就是 Electron 33 + electron-builder 25 +
  electron-updater 6.3 + tsx 4.19 + typescript 5.6**
- 主进程模式：
  - `BrowserWindow` 用 `titleBarStyle: 'hidden'` + `titleBarOverlay`
    （Claude Desktop 同款 Windows 系统标题栏）
  - 双 gate 启动（`ready-to-show` ∧ `did-finish-load`）+ 5s fallback，
    彻底消除"白屏一闪"
  - 启动期插一个 frameless transparent splash window（内联 HTML data:
    URL，<50ms 出现）
  - Windows 专用：`setAppUserModelId` + `setUserTasks`（jumplist）
- preload bridge 模式：`contextBridge.exposeInMainWorld('bridge', ...)`，
  暴露 `window.minimize/toggleMaximize/close/isMaximized` + `theme` +
  `platform`，渲染进程跑 sandbox + contextIsolation
- 打包：electron-builder.yml — Win NSIS、Mac DMG、Linux AppImage；
  renderer 通过 `extraResources` 走 `process.resourcesPath/app/renderer/`
- 开发：`scripts/dev.mts` — 先起 Vite 在 :5173，等 healthcheck，再 tsc
  编主进程，再启 electron `RENDERER_DEV_URL=http://localhost:5173`
- **writing_aassist 还多了 `net.fetch` IPC 隧道（`ai:open` / `ai:chunk`
  / `ai:end` / `ai:abort`）来绕过 CORS** — 我们不一定需要

### 这些可以 100% 沿用，不重写

- `packages/data` 的 CSV parser + dedupeKey + aggregate
- `packages/pricing` 的全部模型定价 + cache-savings + equivalence
- `packages/charts` / `packages/ui` / `packages/tokens` / `packages/motion`
  全部组件
- 所有 4 个 page 组件 + Panel/KpiCard/SectionHeader/CompareRangesPanel/
  MonthlyBudgetPanel/BurnStoryCard/...
- 整套 Framer Motion 动画 + 主题切换 + 路由

### 这些需要替换 / 新写

- `idb-keyval` IndexedDB 存储 → **本地数据库**（持久 · 跨升级 · 跨设备
  备份）
- 上传 CSV 的 hook (`useCsvIngest`) → 从"文件 input + 浏览器解析"换成
  "Electron 系统级 file picker + 走 IPC 把行写进 DB"
- 增量去重逻辑 → 从 `Map<dedupeKey, row>` 内存 dedup 换成"DB 主键 +
  `INSERT OR IGNORE`"，O(1) 而非 O(n²)
- 主菜单 / 系统集成（窗口控件 · 系统通知 · 重新导入 · 备份 · 设置）

### Claude Desktop Windows app 的实际技术栈（验证过）

- Electron 40.4.1（我们用 33 就够，差别不大；可以晚点升）
- React + Lit + Tailwind + RxJS + Zod + Winston + fs-extra（**就是我们
  现在已经有的那套，加上 zod / winston / fs-extra**）
- 416 MB on Windows（包含 Chromium runtime）
- winget / Chocolatey 分发
- 没做代码签名 ← 我们的 MVP 也先不签

## Assumptions (temporary)

- 你想要的是 **single-user, single-machine** 桌面 app（不需要登录 / 多设
  备同步 / 多账号）
- 所有数据 100% 本地，CSV 解析也在本地，不发任何网络（除了 auto-update
  自检和将来可能的"在线版定价表更新"）
- Windows 是主战场，macOS / Linux 顺手做（electron-builder.yml 反正三平台
  都能跑）
- 目标用户是 "我自己 + 类似我这种重度 Cursor 用户"，不是 SaaS 产品，所以
  不需要授权 / 计费 / SSO

## Research References

- [Why is Claude an Electron App? · dbreunig.com](https://www.dbreunig.com/2026/02/21/why-is-claude-an-electron-app.html)
- [Desktop Insights: Claude · desktopinsights.com](https://desktopinsights.com/apps/claude?platform=windows) — Electron 40.4.1 / React + Lit / Tailwind / RxJS / Zod / Winston / fs-extra
- [DuckDB vs SQLite for embedded analytical workloads](https://motherduck.com/learn/duckdb-vs-sqlite-databases/)
- [@rf-/better-sqlite3-electron-20](https://www.npmjs.com/package/@rf-/better-sqlite3-electron-20) — Electron-prebuilt better-sqlite3

## Research Notes

### 本地持久化的三个 feasible approaches

**Approach A: better-sqlite3 + Electron main process · 推荐**

- 怎么做：
  - `packages/storage`（新）封装一个 `UsageDb` 类
  - 主进程 `import Database from 'better-sqlite3'`，DB 文件落到
    `app.getPath('userData')/cursor-usage.db`
  - schema：`rows` 表 + 复合主键 `(date, model, cloud_agent_id,
    automation_id, input, input_cache, cache_read, output, total,
    requests, max_mode)` → 自然 dedup
  - 增量导入：`INSERT OR IGNORE`（O(1) per row）
  - 读：预写好 8 个查询（byDay · byModel · byHour · byMonth · ...），
    通过 IPC 暴露 `db:query(name, params)`，结构化 clone 回 renderer
- Pros：
  - 真正持久化，不依赖浏览器缓存，备份 = 拷一个 .db 文件
  - prebuilt Electron 二进制成熟（`better-sqlite3` 主仓库 6.0+ 已经支持
    Electron 33–40，不再需要 electron-rebuild）
  - 1 万行 GROUP BY 在 50–100 ms 出结果，对我们这种"个人 1 年用量 ≤
    50 万行"完全够
  - sync API，主进程上下文里写起来跟内存 Map 没区别
- Cons：
  - 主进程 import native 模块需要在 electron-builder 里声明 `asarUnpack`
    + 拷贝二进制（一次性 config 工作）
  - 跨平台需要分别 prebuilt（Windows / macOS / Linux 各一个 .node）

**Approach B: DuckDB-WASM 在 renderer**

- 怎么做：
  - 不动主进程，把 IndexedDB 换成 DuckDB-WASM（OPFS 持久化）
  - 还能直接 `SELECT * FROM 'usage.csv'`，把 CSV 当表查
- Pros：
  - 不用 native build，CI 简单
  - 列式 + 向量化，分析查询飞快
- Cons：
  - 包大 ~10 MB（runtime + wasm）
  - 还是浏览器存储（OPFS），用户清浏览器数据可能丢（虽然 OPFS 比
    IndexedDB 抗清得多）
  - 主进程功能（系统 file picker / 文件夹 watcher / 系统通知）拿不到
  - **本质还是个网页**，违背"打造桌面 app"这个 goal

**Approach C: 纯文件存储（JSON / NDJSON / Parquet）**

- 怎么做：每月一个 `2026-05.ndjson`，主进程负责读写
- Pros：极简、人类可读、git-diff 友好
- Cons：去重要全表扫，查询要全部 load 到内存，伸缩不好

**Recommendation: A (better-sqlite3)** — 真正解决你说的"持久化 +
追加 + 去重"三个核心痛点；DuckDB-WASM 路径其实只是把存储位置从
IndexedDB 换成 OPFS，不能给你"桌面 app"的体验。

### Electron 脚手架的两种 feasible approaches

**Approach 1: 整包复用 oh-my-open-ui/apps/desktop · 推荐**

- 复制整个 `apps/desktop/` 目录到我们这边
- 改 4 处：appId / productName / preload 暴露的 bridge / electron-builder
  output 文件夹
- 不要 writing_aassist 的 `ai:*` IPC（我们不调外部 LLM）
- 新增：`db:*` IPC（importCsv / query / backup / clear）+ `file:*` IPC
  （pickCsv / watchInbox）
- 工时：1 个 PR 把 desktop 跑起来 + 1 个 PR 接 SQLite，2 个 PR 共 ~6h

**Approach 2: 从零写 Electron shell**

- 完全自己设计 main/preload，没有 splash / titleBarOverlay / dev
  orchestrator
- 工时：3+ PR，~12h
- Pros：可以完全按自己想法
- Cons：白白浪费两个参考项目里已经 polish 过的细节（splash / 双 gate
  启动 / Windows taskbar 集成 / dev hot reload）

**Recommendation: 1** — 两个参考项目已经把"防止白屏闪烁 / Windows
titleBar / jumplist / dev orchestrator"踩过的坑都填好了，原样抄。

### 增量导入 / 去重的 UX 三个 feasible approaches

**UX-A: 手动按钮（最简单）**

- 顶部有个 "Import CSV"，点开 file picker，可以多选；选完弹一个 "Import
  preview" 抽屉，告诉你"这次将新增 X 行，跳过 Y 行重复"

**UX-B: 监听文件夹（最自动）**

- 设置里指定一个 inbox 文件夹（默认 `~/Downloads`）；主进程用
  `chokidar` watch `usage-events-*.csv` 模式，新文件落地自动导入 + 通知
- 风险：用户从 cursor.com 下载 CSV 默认会落到下载文件夹，但你可能不希望
  它**自动**导入（隐私 / 误触发）

**UX-C: 系统拖拽 + 长按合并预览（推荐折中）**

- 拖一个或多个 CSV 进窗口 → 主进程 IPC 读取 → 解析 → 弹 "Import
  preview"：每个文件一行显示 "+1234 new / 56 skipped / latest date 2026-05-13"
- 用户确认才入库；UX 跟 Notion / Linear 一致
- 顶部也保留 file picker 入口

**Recommendation: C** — 主流 + 安全 + 不自作主张。

## Feasible Approaches (rolled up)

| 决策 | 选项 | 推荐 |
|---|---|---|
| 桌面 shell | A1（复用 oh-my-open-ui 脚手架） / A2（从零写） | **A1** |
| 本地存储 | B1（better-sqlite3 在主进程） / B2（DuckDB-WASM 在 renderer） / B3（NDJSON 文件） | **B1** |
| 导入 UX | C1（手动按钮） / C2（监听文件夹） / C3（拖拽 + 合并预览，保留按钮） | **C3** |
| 自动更新 | D1（不接 electron-updater，纯本地） / D2（接 electron-updater，未来发版用） | **D2**（脚手架已经写好，留着不花钱） |
| Renderer 复用 | E1（playground 整包搬进 desktop） / E2（拆 renderer 共用包 + desktop-only entry） | **E1**（最简单） |
| 数据库 schema | F1（一张 `rows` 大宽表 + 索引） / F2（normalized：rows + models + days） | **F1**（OLAP 个人量级，宽表更快） |

## Open Questions（按重要性排序，会用 interactive_feedback 一次问一个）

按 1 个一问的顺序，准备问你这些（先问最关键的 1–2 个，其它根据答复决定要不要细问）：

1. **scope 优先级**：完整桌面 app（A1+B1+C3 全套）vs 先把 SQLite 装进
   playground 当 web app 用、桌面 shell 之后做 → 拍板这个决定整盘工时
2. **Electron 版本**：直接 33（跟参考项目对齐，最稳）vs 40（跟 Claude
   Desktop 同款，最新但参考项目没踩过）
3. **导入 UX**：C3（拖拽 + 合并预览）够不够，还是想要 C2（监听
   ~/Downloads 自动导入）作为可开关的高级选项
4. **是否要做"导入历史"**：每次导入留一条记录（哪个文件 / 何时 / 新增多少
   行 / 是哪个月的数据），UI 里能看到、能撤销
5. **是否要做"在线定价更新"**：把 `packages/pricing` 的定价 fallback 成主
   进程定时拉 cursor.com/docs/models-and-pricing（涉及网络）
6. **Renderer 入口策略**：playground 现状直接搬进 desktop 启动 vs 给桌面
   一个独立 entry（不显示 welcome dropzone，直接进 dashboard，把 dropzone
   做成顶栏的 "Import" 按钮）
7. **MVP 出口标准**：什么算"桌面 app v1 验收通过"？（建议：能 build 出
   .exe / 能 import / 能持久化 / 能再次启动看到数据 / 能拖第二张 CSV 触发
   dedup preview）

## Requirements (evolving)

### 已确认

1. **Q1 → A：All-in 桌面 app**（一次到位）
   - 抄 oh-my-open-ui `apps/desktop` 整套脚手架进来
   - better-sqlite3 装在主进程
   - CSV import 改走 IPC + Drag-and-drop merge preview
   - electron-builder 出 .exe / .dmg / .AppImage

2. **Q2 → C3：拖拽 + 点击 + 合并预览**
   - 拖一到多个 CSV 进窗口 → 主进程解析 → 弹 preview 抽屉
   - preview 显示：文件名 · +new / skipped · 覆盖日期范围 · 100% 重复时
     显示 "All rows already imported" 并 disable Import 按钮
   - 顶栏保留 "Import" 按钮入口
   - 不做自动监听文件夹（避免误吸入家人/同事的 CSV）

6. **Q6 → F：v1.0 desktop 发布时 5 个新数据能力都要**
   （Q7 收敛后调整：MVP 先 ship 其中 2 个，剩下 3 个排进 v1.1+）
   - A. **Year-in-review 仪表盘**（spotify-wrapped 风格）
     - 今年最狠的 prompt · 最高产的周 · 80% cost 集中在哪几个模型 · 模型
       迁移叙事 · 总 burnt = 一杯多少多少咖啡的 fun fact
     - 入口：顶栏新增 "Year" tab，或 Overview 顶部 "Open year recap"
   - B. **跨月趋势面板**
     - MoM cost trend · request-units trend · 模型 mix 随时间漂移
       （stacked area）· cache hit rate 演化
   - C. **预算服务**
     - 设置里输入 monthly request quota 和 / 或 monthly USD budget
     - 跑到 80% warn / 95% critical
     - 系统通知（`new Notification` API）+ 桌面 tray icon 颜色变化
       （绿/橙/红，需要 `Tray` API + 静态 png）
   - D. **超大请求 sentinel**
     - 单一请求 > P95 × 10 = 触发 "this single request burned X% of
       your weekly budget" 提示，沉淀到 "Sentinel log" 列表
   - E. **What-if 模型重映射**
     - "如果上月 Opus 全换 Sonnet-thinking" 推演面板
     - 重算 `costRows(rows, { remap: { ... } })`，pricing 包已经有原料

7. **Q7 → B：MVP 含 2 个 Q6 能力**
   - 推荐落地 **A (Year-in-review) + B (跨月趋势)**
     - 都吃 SQLite 跨月查询能力，最能体现 v0.9 → v1.0 desktop 的飞跃
     - 都是纯前端 + 一个新 IPC query，零外部依赖（不需要通知 / tray /
       签名 / 设置面板）
     - 一个偏 "嗨" / 一个偏 "深"，配比好看
   - C / D / E 排到 v1.1+（C 需要 Notification + Tray + Settings 三件
     套，D 需要历史 P95 累积，E 需要做新的可视化叙事）

5. **Q5 → B：Electron 40（跟 Claude Desktop 同代）**
   - 参考项目用的 33，我们升到 40
   - better-sqlite3 主线 12.x 已经支持 Electron 30+；如果 prebuilt 没现
     成的话用 `electron-rebuild` 落地 + 在 electron-builder.yml 里
     `asarUnpack` 一下 .node 文件
   - 升 Electron 顺手把 electron-builder 升到 25.x（参考项目同款）

4. **Q4 → B：默认进 dashboard，按需 onboarding**
   - 启动主进程先 `SELECT COUNT(*) FROM rows`
   - 空库 → renderer 路由跳 `#onboarding`（dropzone + 小教程）
   - 非空 → renderer 直接 `#overview`
   - 顶栏 "Import" 按钮永远可用（无论空库非空库）

3. **Q3 → B：导入历史 + 单批次可撤销**
   - SQLite 多一张表 `import_batches`：`batch_id` · `source_filename`
     · `imported_at` · `row_count_added` · `row_count_skipped` ·
     `date_min` · `date_max` · `file_sha256`
   - `rows` 表加一列 `batch_id`（FK）
   - 新增一个 Settings / History 路由，列出全部批次，每条带 "Undo this
     import" 按钮（一行 `DELETE FROM rows WHERE batch_id = ?`）
   - `file_sha256` 用来在 preview 阶段就能告诉用户 "你以前导入过这个完
     全一样的文件"

## Acceptance Criteria (v1.0 desktop MVP)

### 桌面壳子

- [ ] `pnpm desktop:dev` 能本地跑：splash → main window 无白屏闪烁
- [ ] `pnpm desktop:build` 出 Win NSIS `.exe` + Mac DMG + Linux AppImage
- [ ] Windows 标题栏用 `titleBarStyle: 'hidden' + titleBarOverlay`（跟
      Claude Desktop 同款）
- [ ] AppUserModelID 注册，Windows taskbar 不显示 "electron.exe"
- [ ] preload bridge 跑 `contextIsolation: true` + `sandbox: true` +
      `nodeIntegration: false`

### 数据 / 导入

- [ ] CSV 导入走主进程 IPC，写入 `userData/cursor-usage.db`
- [ ] **关闭 app 再开还能看见数据**（基础持久化）
- [ ] 重复导入同一 CSV 产生 `+0 new / N skipped`，主键 dedup 正常
- [ ] 拖入新 CSV 弹 preview 抽屉，确认后才入库
- [ ] `import_batches` 表记录每次导入，History 页能看到，每条可 Undo
- [ ] 主进程崩溃不能把数据库写坏（开 WAL + IMMEDIATE 事务）

### 渲染

- [ ] 启动后：空库 → `#onboarding`；非空 → `#overview`
- [ ] v0.9 已有的 4 个 page + monthly budget + compare ranges + export
      PNG 全部不破坏
- [ ] 新增 **Year-in-review** 路由（Q6.A）
- [ ] 新增 **跨月趋势** 面板（Q6.B），可作为 Overview 的新 section 或
      独立 Trends 路由

### 工程

- [ ] biome + tsc + 现有 PR14 e2e 全绿
- [ ] 新增 `desktop-smoke.mjs`：spawn electron / open window / IPC 注入
      一个测试 CSV / 验证 row count，pass
- [ ] README 加 "Desktop" 章节（dev 命令 / build 命令 / .db 文件位置 /
      备份恢复 / 卸载是否清数据）
- [ ] 一篇 ADR-lite：为什么 better-sqlite3 不选 DuckDB（写进 PRD 的
      Decision 段）

## Definition of Done

- 所有新增代码通过 biome + tsc + 现有 e2e 套件
- 新增 1 套 desktop-e2e（最少 smoke：spawn electron / open window / file
  picker → 行数 +1）
- README 加 desktop 章节（dev 命令 / build 命令 / 数据库文件位置 / 备份
  恢复 / 卸载是否清数据）
- 内部记录一个 ADR-lite：为什么选 better-sqlite3 不选 DuckDB

## Decision (ADR-lite)

**Context**: 把现有 v0.9 web app 升级成 Claude-Desktop-级别的 Windows
桌面 app，核心痛点是"数据真正持久化 + 追加 + 去重"，CSV import 只是
入口。

**Decision**:
- 桌面 shell = **Electron 40** + electron-builder 25 + electron-updater
  6.3，整套抄 `oh-my-open-ui/apps/desktop`
- 本地存储 = **better-sqlite3 主进程**（不选 DuckDB / 不选
  IndexedDB / 不选 NDJSON）
- 数据库文件 = `app.getPath('userData')/cursor-usage.db`，宽表
  `rows` 用复合主键自然 dedup，`import_batches` 表记录每次导入支持
  Undo
- 导入 UX = **拖拽 + 点击 + 合并预览**，preview 抽屉显示 +new/skipped
  并按文件分组
- Renderer 默认入口 = **dashboard（DB 非空时）/ onboarding（空库）**
- MVP 新数据能力 = **Year-in-review** + **跨月趋势**；预算 / sentinel /
  what-if 排进 v1.1+

**Consequences**:
- 优点：真正解决持久化痛点；O(1) 去重；备份 = 拷一个 .db；可以无限
  追加历史 CSV；为 v1.1+ 的所有 SQL-heavy 分析铺好路
- 取舍：第一次出 prebuilt for Electron 40 + better-sqlite3 需要花
  半天调；包体积从 ~1MB 涨到 ~150MB（Chromium runtime）
- 风险：跨平台 native module 在 CI 上需要分别 prebuild（macOS / Linux
  暂时只在 dev 机本地构）

## Out of Scope (v1.0)

- 多账户 / 登录 / 云同步（个人 single-machine app）
- macOS 代码签名 / Windows EV 代码签名（个人项目先不签，accept the
  SmartScreen 警告）
- 在线 LLM / API 调用（不是 Claude 客户端，只是看自己用了多少）
- 多语言（v0.9 已定纯英文）
- 自动监听文件夹导入（Q2.C2，留作 v1.1+ 可开关高级选项）
- 桌面 tray icon + 系统通知（Q6.C 预算服务里再做）
- "上线版定价表" 主进程定时拉取（保留 packages/pricing 的静态表）

## Implementation Plan (small PRs)

预估 6 个 PR，~10–14h 总工时，分 2–3 次着陆。

| PR | 范围 | 验收 |
|---|---|---|
| **PR15** | `apps/desktop` 脚手架：抄 oh-my-open-ui 整套（main / preload / splash / dev.mts / electron-builder.yml），改 4 处配置 | `pnpm desktop:dev` 能在本地起一个空 Electron 窗口加载 playground，splash 正常 |
| **PR16** | `packages/storage` + 主进程 SQLite 集成：better-sqlite3 + schema migration + IPC `db:query/import/listBatches/undoBatch` + preload 暴露 `window.bridge.db.*` | 单元测：5 条假 CSV 导入，dedup count 正确，undo 单批次后行数恢复 |
| **PR17** | Renderer 改造：`useCsvIngest` → 走 IPC；onboarding 路由；drag-and-drop preview 抽屉；History 路由 | 拖入 CSV 看到 preview / 确认后 row count 涨 / History 页能看到批次 / Undo 工作 |
| **PR18** | Year-in-review 路由 + 跨月趋势面板（在 Overview 加 Trends section） | 跨月数据出来：cost MoM stacked area / model mix drift / year recap 故事卡 5 张 |
| **PR19** | `electron-builder` 打 .exe + DMG + AppImage；asarUnpack `better_sqlite3.node`；smoke e2e（spawn electron + 注入 CSV + 验证持久化）；README desktop 章节 | `pnpm desktop:build` 出包；安装后能跑；e2e 跑通 |
| **PR20** | （可选）UI polish round：tray 图标 / 菜单 / 关于对话框 / Settings panel 占位 | 主观验收 |

## Technical Notes

- 参考项目 Electron 主进程模板：
  `F:\vibe_project\oh-my-open-ui\apps\desktop\src\main.ts` (146 行)
- 参考项目 preload bridge 模板：
  `F:\vibe_project\oh-my-open-ui\apps\desktop\src\preload.ts` (27 行)
- 参考项目 splash window 模板：
  `F:\vibe_project\oh-my-open-ui\apps\desktop\src\splash.ts` (144 行)
- 参考项目 dev orchestrator：
  `F:\vibe_project\oh-my-open-ui\apps\desktop\scripts\dev.mts` (94 行)
- 参考项目 electron-builder 配置：
  `F:\vibe_project\oh-my-open-ui\apps\desktop\electron-builder.yml` (57 行)
- writing_aassist 的 IPC 拓展（net.fetch 隧道）：
  `F:\vibe_project\writing_aassist\apps\desktop\src\main.ts` 88–241 行
  （MVP 不需要，但 schema 是个好参考）
- 现有 CSV ingest 入口：
  `f:\vibe_project\cursor_usage\apps\playground\src\hooks\useCsvIngest.ts`
- 现有 dedup key 生成：`packages/data/src/dedupeKey.ts`（待重读，但应已实现）
- 现有 persistence 模块：
  `f:\vibe_project\cursor_usage\apps\playground\src\storage\persistence.ts`
