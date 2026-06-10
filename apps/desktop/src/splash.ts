import { BrowserWindow, nativeTheme } from 'electron';

/**
 * Lightweight branded splash. Renders inline HTML via a data: URL so it
 * appears in <50ms — no preload bundle, no renderer round-trip. The
 * inline SVG mark uses the same violet accent the dashboard uses
 * (--color-accent), so the splash feels like the same product as the
 * window it precedes.
 *
 * The splash is frameless, transparent, always-on-top during startup,
 * and self-destructs via `close()` once the main window emits both
 * `ready-to-show` AND `did-finish-load` (see main.ts).
 */

function inlineSplashHtml(dark: boolean): string {
  const bg = dark ? '#0A0B0F' : '#F5F6FA';
  const surface = dark ? '#12141A' : '#FFFFFF';
  const border = dark ? '#23262F' : '#E3E5EE';
  const text = dark ? '#EDEEF4' : '#15171E';
  const muted = dark ? '#6E7180' : '#9094A3';
  const accent = dark ? '#8B5CF6' : '#7C3AED';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Loading…</title>
  <style>
    :root { color-scheme: ${dark ? 'dark' : 'light'}; }
    html, body { margin:0; padding:0; height:100%; width:100%; background:transparent; -webkit-user-select:none; }
    body { display:flex; align-items:center; justify-content:center; font:13px -apple-system, "Segoe UI", system-ui, sans-serif; color:${text}; }
    .panel {
      width: calc(100% - 24px);
      height: calc(100% - 24px);
      border-radius: 18px;
      background: ${surface};
      border: 1px solid ${border};
      box-shadow:
        0 1px 0 rgba(0,0,0,${dark ? '0.35' : '0.04'}),
        0 8px 24px -8px rgba(0,0,0,${dark ? '0.55' : '0.18'}),
        0 24px 48px -16px rgba(0,0,0,${dark ? '0.65' : '0.20'});
      display: grid;
      place-items: center;
      animation: fadeIn 240ms ease-out both;
    }
    .stack { display:flex; flex-direction:column; align-items:center; gap:16px; }
    .mark {
      width: 56px; height: 56px;
      animation: pulse 1.8s ease-in-out infinite;
      transform-origin: 50% 50%;
      filter: drop-shadow(0 4px 14px rgba(139,92,246, 0.45));
    }
    .mark rect { fill: ${accent}; }
    .label { color: ${muted}; letter-spacing: 0.12em; text-transform: uppercase; font-size: 10px; }
    .name { font-family: "Space Grotesk", "Segoe UI", system-ui, sans-serif; font-weight: 600; font-size: 18px; color: ${text}; letter-spacing: 0.01em; }
    @keyframes pulse {
      0%, 100% { transform: scale(1); opacity: 0.85; }
      50% { transform: scale(1.08); opacity: 1; }
    }
    @keyframes fadeIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
    @media (prefers-reduced-motion: reduce) {
      .mark { animation: none; }
      .panel { animation: none; }
    }
  </style>
</head>
<body style="background:${bg};">
  <div class="panel">
    <div class="stack">
      <!-- Five-bar "usage bars" mark — echoes the bar charts the dashboard is built around. -->
      <svg class="mark" viewBox="0 0 56 56" aria-hidden="true">
        <rect x="6"  y="32" width="6" height="18" rx="1.4" />
        <rect x="16" y="22" width="6" height="28" rx="1.4" />
        <rect x="26" y="12" width="6" height="38" rx="1.4" />
        <rect x="36" y="20" width="6" height="30" rx="1.4" />
        <rect x="46" y="28" width="6" height="22" rx="1.4" />
      </svg>
      <div class="name">Cursor Usage</div>
      <div class="label">starting up</div>
    </div>
  </div>
</body>
</html>`;
}

export interface SplashHandle {
  window: BrowserWindow;
  close: () => void;
}

export function showSplash(): SplashHandle {
  const dark = nativeTheme.shouldUseDarkColors;
  const splash = new BrowserWindow({
    width: 380,
    height: 240,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    closable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    hasShadow: false,
    backgroundColor: '#00000000',
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });

  const html = inlineSplashHtml(dark);
  splash.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

  splash.once('ready-to-show', () => splash.show());

  let closed = false;
  const close = () => {
    if (closed || splash.isDestroyed()) return;
    closed = true;
    // Soft fade-out via JS class swap — most platforms ignore window
    // opacity transitions, but the panel transform still gives a nice
    // exit on systems that *do* honor it. Either way, the destroy()
    // 180ms later guarantees we never strand a stale splash next to
    // the real window.
    try {
      splash.webContents
        .executeJavaScript(
          `
          (() => {
            const p = document.querySelector('.panel');
            if (p) { p.style.transition = 'opacity 160ms ease, transform 160ms ease'; p.style.opacity = '0'; p.style.transform = 'scale(0.98)'; }
          })()
        `,
        )
        .catch(() => undefined);
    } catch {
      /* ignore */
    }
    setTimeout(() => {
      if (!splash.isDestroyed()) splash.destroy();
    }, 180);
  };

  return { window: splash, close };
}
