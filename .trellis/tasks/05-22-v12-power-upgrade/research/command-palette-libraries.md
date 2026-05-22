# Command Palette 库选型

> 用于 PR1 R1: Cmd/Ctrl+K palette

## 候选

### 1. `kbar` ⭐ 推荐

- ~10KB gzipped
- React-native API（hooks + provider 模式）
- 内建：fuzzy search、nested actions、ARIA / keyboard nav、search shortcut hint
- 维护活跃，社区大（issues + examples 丰富）
- Linear / Vercel / Raycast 风格的"action 中心化"理念

```tsx
import { KBarProvider, KBarPortal, KBarPositioner, KBarAnimator, KBarSearch, useMatches, KBarResults } from 'kbar';

const actions = [
  {
    id: 'overview',
    name: 'Go to Overview',
    shortcut: ['g', 'o'],
    keywords: 'overview home',
    perform: () => navigate('overview'),
    icon: <BarChart size={14} />,
  },
  // ...
];

function App() {
  return (
    <KBarProvider actions={actions}>
      <KBarPortal>
        <KBarPositioner>
          <KBarAnimator>
            <KBarSearch />
            <RenderResults />
          </KBarAnimator>
        </KBarPositioner>
      </KBarPortal>
      {/* rest of app */}
    </KBarProvider>
  );
}
```

### 2. `cmdk`（shadcn / vercel）

- 蜗壳更轻量（~7KB），primitive 抽象
- 但没有内建 Portal/Animator/Positioner，要自己 wire shadcn 的 Dialog
- 主题适配需要自己写 CSS
- 更"小工具"风格，少 opinion

**结论**：kbar 更适合我们这种"有强烈设计系统"的项目，把 styling 写一次就完了。
cmdk 更适合 shadcn 用户。

### 3. 自写

- 大约 200-300 行 React
- 完全控制
- 但维护成本（fuzzy search / arrow key / focus management / portal / ARIA）

**结论**：不值得自写。kbar 的所有麻烦它都做了。

## 选定：kbar

### 我们的 actions 规划

#### Navigation (7 个)
- Overview / Year / Models / Agents / Anomalies / Details / Hours

#### Data actions (4 个)
- Import CSV
- Open Import History
- Export current view as PNG
- Generate Monthly Report (PDF) [PR6 后启用]

#### Settings (3 个)
- Open Settings drawer
- Toggle theme (cycle through brands)
- Toggle side nav collapse

#### Search / drill (动态 actions)
- Search models（输入 model name → 跳到 Models page 并 expand 该行）
- Search day（输入 YYYY-MM-DD → 跳到 Hours page 并 select 该日）

### Shortcut 设计

- 主开关：`Cmd+K` (mac) / `Ctrl+K` (win/linux)
- 二级 shortcut（kbar 支持）：
  - `g o` → Overview
  - `g y` → Year
  - `g m` → Models
  - `g a` → Agents
  - `g n` → Anomalies (new)
  - `g d` → Details
  - `g h` → Hours
  - `,` → Open Settings
  - `t` → Toggle theme
  - `e` → Export PNG (current page)

### Styling 适配

复用现有 design token：
- bg: `var(--color-surface-raised)`
- border: `var(--color-border-strong)`
- accent for hover/selected: `var(--color-accent)`
- font: `var(--font-mono)` for shortcut hints, `var(--font-sans)` for action labels
- radius: `var(--radius-md)` for the animator container

### ARIA + keyboard

kbar 内建：
- `<KBarSearch>` 是 textbox role
- 列表项是 listbox + option role
- Arrow up/down + Enter / Escape 全部正确
- 关闭后 focus return to last element

## 风险

- kbar 不维护？— 最近 commit 2025-11，活跃
- bundle size？— 10KB gzipped，可接受（我们 vendor chunk 已经 131KB）
- 与 Framer Motion 冲突？— kbar 内部用 framer，version match 一下就 OK

## 决定

✅ 安装 `kbar`
✅ 包在 `App.tsx` 最外层
✅ actions 定义在 `apps/playground/src/components/CommandPalette.tsx`
✅ 复用现有 `useRoute` navigate
✅ 复用现有 design token（CSS variable 直接吃）
