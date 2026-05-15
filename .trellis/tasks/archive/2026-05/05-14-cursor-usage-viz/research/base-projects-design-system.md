# Base 项目的设计系统（oh-my-open-ui & writing_aassist）

> 用户指定参考 `F:\vibe_project\oh-my-open-ui` 和 `F:\vibe_project\writing_aassist`
> 两者由同一个架构师做的，共享 80% 的设计语言和 90% 的工具链。

## 共享的工具链

| 维度 | 选型 | 版本 |
|------|------|------|
| 包管理 | pnpm + workspace | 9.15.9 |
| 构建编排 | turbo | 2.3.3 |
| Lint/Format | biome | 1.9.4 |
| TypeScript | tsc | 5.6.3 |
| 框架 | React | 19.0.0 |
| 构建器 | Vite | 6.0.5 |
| 样式 | Tailwind CSS v4 (`@tailwindcss/vite`) | ^4.0.0 |
| 动画 | Framer Motion | 11.15.0 |
| 状态 | zustand | 5.0.2 (writing_aassist) |
| 桌面 | Electron | 33 |
| Storybook | Storybook | 9.x |

## 共享的 Monorepo 结构

```
project/
├── apps/
│   ├── desktop/        Electron main + splash + preload + electron-builder
│   └── playground/     Vite + React 19 (browser-first)
├── packages/
│   ├── tokens/         CSS Vars + TS exports + Tailwind v4 preset
│   ├── motion/         Framer Motion 春系/variants/transitions/shimmer
│   ├── icons/          Curated Lucide subset + brand mark
│   ├── brand/          BrandProvider + 几个 built-in brand
│   ├── ui/             Primitives + Shell + Modals + Layouts
│   └── （writing_aassist 多了 editor / suggestions）
├── stories/            Storybook 9（Foundation + Patterns）
└── docs/               Architecture / Foundation / Brand / Electron
```

## 共享的设计令牌（warm-restrained）

### Light Theme（来自 writing_aassist `tokens/colors.css`）

```css
--color-bg: #f7f3ea;              /* 奶白底，有米色调 */
--color-surface: #fffaf2;         /* 卡片底 */
--color-surface-muted: #efe8dc;   /* 二级容器 */
--color-surface-raised: #ffffff;  /* 强调容器 */
--color-surface-sunken: #ebe3d5;  /* 凹陷容器 */

--color-text: #2b2926;            /* 主文字（暖灰，不是纯黑）*/
--color-text-muted: #7b746b;      /* 次要文字 */
--color-text-subtle: #a8a096;     /* 辅助文字 */

--color-border: #e2d9cb;          /* 默认边 */
--color-border-strong: #cfc4b2;   /* 强调边 */

--color-accent: #c96f4a;          /* 赤土橙 */
--color-accent-hover: #b85f3d;
--color-accent-soft: #f7e7d9;
--color-accent-text: #ffffff;

--color-destructive: #d14343;
--color-success: #3f9871;
--color-warning: #c8862a;
--color-info: #5577b8;
```

### Dark Theme

```css
--color-bg: #1d1b17;              /* 深棕底 */
--color-surface: #25231f;
--color-surface-muted: #2e2b25;
--color-surface-raised: #36332c;
--color-surface-sunken: #161412;

--color-text: #f1ece2;            /* 暖白 */
--color-text-muted: #b8af9f;
--color-text-subtle: #877e70;

--color-accent: #db8460;          /* 暖橙（亮一些）*/
--color-accent-hover: #e9946f;
--color-accent-soft: #3f2c22;
```

### Suggestion Category Colors（writing_aassist 专属）

```ts
suggestionCategoryColors = {
  light: {
    correctness: '#C4493A',  // 红
    clarity: '#2F74C7',      // 蓝
    engagement: '#6B4EC1',   // 紫
    delivery: '#2F8F6E',     // 绿
    tone: '#B07024',         // 橙
    citation: '#4A667A',     // 蓝灰
  },
  dark: { ... }
}
```

→ **可以借鉴这种"主题色 + 一组 categorical 色板"模式**，给我们的 6 个 model provider（Anthropic / OpenAI / Google / xAI / Moonshot / Cursor）配色。

### 字体栈

```ts
fontFamily = {
  serif: "'Source Serif 4', 'Source Serif Pro', 'Tiempos Headline', 'Iowan Old Style', 'Apple Garamond', Georgia, 'Times New Roman', serif",
  sans: "'Inter', system-ui, -apple-system, 'Segoe UI', 'Roboto', 'Helvetica Neue', sans-serif",
  mono: "'JetBrains Mono', 'Fira Code', 'IBM Plex Mono', 'SF Mono', Menlo, Consolas, monospace",
}
```

→ **Source Serif 4 用在 display / 大数字 / 标题；Inter 用在 body；JetBrains Mono 用在 token 数 / cost 数 / 模型 ID**。

### 字号阶梯

```ts
fontSize = {
  '2xs': 11px / 14,
  xs:    12px / 16,
  sm:    13px / 18,
  base:  14px / 21,    // 默认
  md:    15px / 23,
  lg:    17px / 26,
  xl:    20px / 28,
  '2xl': 24px / 32,
  '3xl': 30px / 38,
  '4xl': 38px / 46,
}
```

→ KPI 卡的大数字用 `3xl` 或 `4xl` Source Serif 4。

### 圆角

```ts
radius = {
  none: 0,
  xs: 6,
  sm: 8,
  md: 10,
  lg: 14,
  xl: 18,
  '2xl': 24,
  full: 9999,
}
```

→ **不用尖角**（`none`）也**不用过圆**（`2xl`）；卡片用 `md`/`lg`，KPI 大块用 `xl`。

### 阴影（含 brown undertone）

```ts
shadow = {
  xs: '0 1px 2px rgba(53, 41, 28, 0.05)',
  composer: '0 1px 0 rgba(53,41,28,0.04), 0 8px 24px -12px rgba(53,41,28,0.10)',
  composerFocus: '0 1px 0 rgba(53,41,28,0.06), 0 12px 32px -10px rgba(53,41,28,0.14)',
  popover: '0 8px 28px -8px rgba(53,41,28,0.18), 0 2px 6px rgba(53,41,28,0.06)',
  modal: '0 24px 64px -16px rgba(53,41,28,0.28), 0 8px 16px -8px rgba(53,41,28,0.10)',
  card: '0 1px 2px rgba(53, 41, 28, 0.04)',
}
```

→ 注意 shadow 颜色是棕色 `rgba(53,41,28,...)`，**不是冷色 `rgba(0,0,0,...)`**。这是关键的"暖色 tool aesthetic"信号。

### Motion

```ts
motion.spring = {
  gentle: { stiffness: 220, damping: 26, mass: 0.9 },
  snappy: { stiffness: 380, damping: 30, mass: 0.8 },
  bouncy: { stiffness: 320, damping: 18, mass: 1 },
}
motion.duration = {
  instant: 60ms, fast: 120ms, base: 180ms, medium: 240ms, slow: 320ms, slower: 480ms,
}
motion.easing = {
  standard:    'cubic-bezier(0.2, 0, 0, 1)',     // 默认
  emphasized:  'cubic-bezier(0.3, 0, 0, 1)',     // 强调
  decelerate:  'cubic-bezier(0, 0, 0.2, 1)',
  accelerate:  'cubic-bezier(0.4, 0, 1, 1)',
  spring:      'cubic-bezier(0.34, 1.56, 0.64, 1)',
}
```

→ 卡片淡入用 `gentle` spring；侧边栏滑出用 `snappy`；数字 count-up 用 `decelerate`。

## BrandProvider 系统

`packages/brand` 提供 `<BrandProvider brand={myBrand}>`，注入 CSS vars 来 swap accent 色 / 字体。

```ts
interface BrandTheme {
  id: string;
  name: string;
  logo: ReactNode;
  palette: { accent, accentHover, accentSoft, mark };
  fonts?: { sans?, serif?, mono? };
}
```

`writing_aassist` built-in brands:
- `scribe` - 默认 warm-restrained，赤土橙 `#c96f4a`
- `quill-mono` - 黑白克制，charcoal `#3b3633`
- `sage-serif` - 沙绿学术 `#5e8b6a`

`oh-my-open-ui` built-in brands:
- `aurora` - 默认（原创）
- `claude-tribute` - Claude 致敬色（仅本地参考）
- `sage`, `indigo`

→ **本任务可以做 1-3 个 brand**：默认走 scribe 暖色调，备一个 dark-only 的"power user" brand，再备一个浅色 minimal brand。

## 关键组件库（writing_aassist `packages/ui`）

复用价值高的：
- `primitives/Button.tsx`, `IconButton.tsx`, `Badge.tsx`, `Tabs.tsx`, `Switch.tsx`, `Tooltip.tsx`, `Popover.tsx`, `DropdownMenu.tsx`, `Dialog.tsx`, `AlertDialog.tsx`, `Toast.tsx`, `Kbd.tsx`, `Avatar.tsx`, `ScrollArea.tsx`, `Input.tsx`, `BrandMark.tsx`
- `shell/AppShell.tsx`, `Sidebar.tsx`, `TitleBar.tsx`, `MainArea.tsx`
- `modals/ModalStack.tsx`, `SettingsModal.tsx`
- `shortcuts/CommandPalette.tsx`, `KeyboardCheatsheetModal.tsx`

→ 我们可以**完整复用**这些组件，只需要新建 `packages/charts` 和 `packages/data` 即可。

## 反 AI Slop 的内置基因

两个 base 项目本身就有反 AI slop 的设计取向：
- 不用紫渐变（用赤土橙）
- 不用 Material 圆角卡 + 左 border accent
- 数字字体专门用 mono
- shadow 用 brown undertone（不是 generic 冷色）
- Source Serif 4 的衬线感（不是又一个 Inter 全场）
- 整体气质是"工具，给认真做事的人"，不是"SaaS landing"

→ **本任务必须保持这个气质**——做 cursor usage 可视化是给 power user 看自己用量的工具，不是给 SaaS 销售部看的报表。
