# @cu/desktop

Electron shell for Cursor Usage — wraps `@cu/playground` (the React +
Vite renderer in `apps/playground`) into a Windows / macOS / Linux
desktop application with a branded splash, system title-bar overlay,
and a context-isolated preload bridge.

This package is the v1.0 desktop entry point for `cursor-usage-viz`.
PR15 (this PR) wires up the shell only; PR16 will add `@cu/storage` and
SQLite persistence, and PR17 will move CSV ingest off `idb-keyval` and
onto the main-process database.

## Status

- [x] Electron 40 + electron-builder 25 + electron-updater 6.3
- [x] Branded splash with five-bar usage mark, soft pulse animation,
      dark-mode aware palette
- [x] Hidden title bar + Windows titleBarOverlay (Claude Desktop style)
- [x] AppUserModelID set before the first window so the Windows taskbar
      identifies the app as `com.cursorusage.desktop`
- [x] preload bridge with `window` / `theme` / `app` namespaces
      (`contextIsolation: true`, `sandbox: true`)
- [x] dev orchestrator (`pnpm dev`) that boots playground at :5173,
      compiles main, launches Electron pointed at the dev URL
- [ ] SQLite (PR16)
- [ ] CSV import via IPC + drag-and-drop merge preview (PR17)
- [ ] Year-in-review + cross-month trends (PR18)
- [ ] `.exe` / `.dmg` / `.AppImage` packaging + smoke E2E (PR19)

## Scripts

```bash
pnpm --filter @cu/desktop dev          # start the desktop shell in dev
pnpm --filter @cu/desktop build        # compile main + build renderer
pnpm --filter @cu/desktop package      # produce an installer (current OS)
pnpm --filter @cu/desktop typecheck    # tsc --noEmit
```

Or, from the repo root:

```bash
pnpm desktop:dev       # equivalent shortcut
pnpm desktop:build
```

## Layout

```text
apps/desktop/
├── electron-builder.yml      installer config (NSIS / DMG / AppImage)
├── package.json              electron + electron-builder + tsx
├── scripts/
│   └── dev.mts               waits for :5173, compiles main, spawns electron
├── src/
│   ├── main.ts               BrowserWindow + IPC + jumplist + titleBarOverlay
│   ├── preload.ts            contextBridge → window.bridge
│   ├── splash.ts             frameless transparent splash window
│   └── updater.ts            electron-updater stub (off until CU_AUTO_UPDATE=1)
├── tsconfig.json             type-check only
└── tsconfig.main.json        compile main → dist/main/
```

## Preload bridge

Exposed as `window.bridge` in every renderer context. Shape (PR15):

```ts
window.bridge = {
  window: { minimize(), toggleMaximize(), close(), isMaximized() },
  theme:  { getSystem(), set(mode), onSystemChanged(cb) },
  app:    { getInfo() → { platform, isDesktop, version, appName } },
  platform: 'win32' | 'darwin' | 'linux',
};
```

PR16 will add `bridge.db.{importCsv, query, listBatches, undoBatch}`.

## Data location

PR16 lands the SQLite database at:

- Windows: `%APPDATA%/Cursor Usage/cursor-usage.db`
- macOS:   `~/Library/Application Support/Cursor Usage/cursor-usage.db`
- Linux:   `~/.config/Cursor Usage/cursor-usage.db`

These map to `app.getPath('userData')`. Uninstalling the app on Windows
keeps this folder by default (deliberately — your usage history shouldn't
vanish when you reinstall).
