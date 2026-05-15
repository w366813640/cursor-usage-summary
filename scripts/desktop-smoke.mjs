/**
 * PR15 desktop smoke — launches the packaged Electron entry point via
 * Playwright's `_electron` driver, waits for the main window, and
 * captures two screenshots:
 *
 *   1. The branded splash window (frameless, transparent, eight-bar
 *      mark with soft pulse animation).
 *   2. The main BrowserWindow once it's painted (hidden title bar,
 *      titleBarOverlay, dashboard rendered via the playground bundle).
 *
 * Run pre-reqs: `pnpm --filter @cu/desktop build:main` and a renderer
 * dev server reachable at the URL passed via RENDERER_DEV_URL.
 *
 * We boot the renderer ourselves (vite preview at :5176, isolated from
 * any concurrent dev server) so the run is fully self-contained.
 */

import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron as electron } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const desktopRoot = join(repoRoot, 'apps/desktop');
const outDir = join(repoRoot, '_temp', 'pr15-screenshots');
mkdirSync(outDir, { recursive: true });

const isWindows = process.platform === 'win32';
const pnpmCmd = isWindows ? 'pnpm.cmd' : 'pnpm';

function log(area, color, line) {
  process.stdout.write(`\u001b[${color}m[${area}]\u001b[0m ${line}\n`);
}

async function waitForUrl(url, timeoutMs = 30_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 404) return;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Renderer not reachable at ${url} within ${timeoutMs}ms`);
}

// Use port 5176 so we don't fight with `pnpm desktop:dev` (5173) or
// `pnpm preview` (5174).
const RENDERER_PORT = 5176;
const rendererUrl = `http://localhost:${RENDERER_PORT}`;

log('smoke', '36', 'Starting renderer dev server at :5176...');
const renderer = spawn(
  pnpmCmd,
  ['--filter', '@cu/playground', 'exec', 'vite', '--port', String(RENDERER_PORT), '--strictPort'],
  {
    cwd: repoRoot,
    env: { ...process.env, FORCE_COLOR: '0' },
    shell: isWindows,
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);
renderer.stdout?.on('data', (b) => process.stdout.write(`[renderer] ${b}`));
renderer.stderr?.on('data', (b) => process.stderr.write(`[renderer:err] ${b}`));

let exitCode = 0;
try {
  await waitForUrl(rendererUrl);
  log('smoke', '36', `renderer up at ${rendererUrl}`);

  log('smoke', '36', 'Launching Electron via Playwright...');
  const app = await electron.launch({
    cwd: desktopRoot,
    args: ['.'],
    env: {
      ...process.env,
      RENDERER_DEV_URL: rendererUrl,
      NODE_ENV: 'development',
    },
    timeout: 30_000,
  });

  // First window can be either the splash or the main window depending
  // on which one reports `ready-to-show` first. Capture every window
  // we can see for ~5s so we have material for both screenshots.
  log('smoke', '36', 'Waiting for first window...');
  const first = await app.firstWindow();
  await first.waitForLoadState('domcontentloaded').catch(() => undefined);
  await first.screenshot({ path: join(outDir, '01-first-window.png') }).catch((e) => {
    log('smoke', '31', `first window screenshot failed: ${e.message}`);
  });

  // The main window typically opens a few hundred ms after the splash;
  // wait a generous 3s then enumerate all open windows.
  await new Promise((r) => setTimeout(r, 3500));
  const windows = app.windows();
  log('smoke', '36', `${windows.length} window(s) open`);

  for (let i = 0; i < windows.length; i++) {
    const w = windows[i];
    const title = await w.title().catch(() => 'unknown');
    const url = w.url();
    log('smoke', '32', `  window ${i}: title="${title}" url=${url}`);
    await w
      .screenshot({
        path: join(
          outDir,
          `02-window-${i}-${title.replace(/[^a-z0-9]+/gi, '_').toLowerCase() || 'untitled'}.png`,
        ),
      })
      .catch((e) => log('smoke', '31', `  screenshot failed: ${e.message}`));
  }

  // Final settled screenshot — gives the main window time to fully
  // paint and any splash to dismiss.
  await new Promise((r) => setTimeout(r, 2500));
  const finalWindow = app.windows().find((w) => w.url().startsWith(rendererUrl));
  if (finalWindow) {
    await finalWindow.screenshot({ path: join(outDir, '03-main-settled.png') });
    log('smoke', '32', `main window settled — title: ${await finalWindow.title()}`);
  } else {
    log('smoke', '31', 'no main window pointing at renderer URL — settled screenshot skipped');
  }

  log('smoke', '36', 'Closing app...');
  await app.close();
} catch (err) {
  console.error(err);
  exitCode = 1;
} finally {
  renderer.kill();
}

log('smoke', '36', `done — screenshots → ${outDir}`);
process.exit(exitCode);
