/**
 * PR17 visual smoke — boots the desktop in a fresh userData, pre-loads
 * some rows via the bridge so the dashboard renders, then captures
 * screenshots of:
 *
 *   1. The dashboard's FileToolbar in desktop mode (Import + History +
 *      Redacted buttons)
 *   2. The Import history drawer with one batch + per-batch undo
 *   3. The Import preview drawer (triggered by re-importing the same
 *      bytes via a synthetic File dropped from the renderer side)
 *
 * Output: `_temp/pr17-screenshots/<name>.png`.
 *
 * This is a visual regression check, not a logic check — the IPC +
 * persistence chain is covered by `desktop-db-smoke.mjs`.
 */

import { spawn } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron as electron } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const desktopRoot = join(repoRoot, 'apps/desktop');
const userDataDir = join(repoRoot, '_temp', 'pr17-userdata');
const screenshotDir = join(repoRoot, '_temp', 'pr17-screenshots');

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
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Renderer not reachable at ${url} within ${timeoutMs}ms`);
}

rmSync(userDataDir, { recursive: true, force: true });
mkdirSync(userDataDir, { recursive: true });
rmSync(screenshotDir, { recursive: true, force: true });
mkdirSync(screenshotDir, { recursive: true });

// Idempotent pre-flight — guarantees better-sqlite3 has the Electron
// ABI binary before we boot the app. Cheap (~200ms) if the marker
// file is already correct; downloads + swaps if a previous `pnpm test`
// left a Node ABI binary behind.
log('ui-smoke', '36', 'Ensuring better-sqlite3 ABI matches Electron...');
await new Promise((resolveFn, rejectFn) => {
  const child = spawn(pnpmCmd, ['--filter', '@cu/desktop', 'install-natives:ensure'], {
    cwd: repoRoot,
    stdio: ['ignore', 'inherit', 'inherit'],
    shell: isWindows,
  });
  child.on('exit', (code) =>
    code === 0 ? resolveFn() : rejectFn(new Error(`install-natives:ensure exited ${code}`)),
  );
});

// Rebuild main + preload so the smoke always tests current src/ code.
// Without this, edits to src/preload.ts or src/db.ts silently no-op
// because `electron.launch()` runs whatever is in `dist/main/`.
log('ui-smoke', '36', 'Building main + preload bundles...');
await new Promise((resolveFn, rejectFn) => {
  const child = spawn(pnpmCmd, ['--filter', '@cu/desktop', 'build:main'], {
    cwd: repoRoot,
    stdio: ['ignore', 'inherit', 'inherit'],
    shell: isWindows,
  });
  child.on('exit', (code) =>
    code === 0 ? resolveFn() : rejectFn(new Error(`build:main exited ${code}`)),
  );
});

const RENDERER_PORT = 5177;
const rendererUrl = `http://localhost:${RENDERER_PORT}`;
log('ui-smoke', '36', `Starting renderer at ${rendererUrl}...`);
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

await waitForUrl(rendererUrl);
log('ui-smoke', '36', 'renderer up');

function rowFactory(seed, count) {
  const rows = [];
  for (let i = 0; i < count; i++) {
    const n = seed * 100 + i;
    const day = `2026-05-${String((n % 28) + 1).padStart(2, '0')}`;
    const hour = String(n % 24).padStart(2, '0');
    const dateISO = `${day}T${hour}:00:00.000Z`;
    rows.push({
      id: `row-${n}`,
      dateISO,
      date: new Date(dateISO),
      cloudAgentId: `agent-${n}`,
      automationId: '',
      kind: 'Included',
      model: n % 2 === 0 ? 'claude-4-sonnet-thinking' : 'gpt-5-thinking',
      maxMode: n % 5 === 0,
      tokens: {
        inputWithCacheWrite: 100 * (n + 1),
        inputWithoutCacheWrite: 200 * (n + 1),
        cacheRead: 50 * (n + 1),
        output: 80 * (n + 1),
        total: 430 * (n + 1),
      },
      requests: { kind: 'units', value: 0.1 * (n + 1) },
      cost: 0.05 * (n + 1),
      costEstimated: false,
    });
  }
  return rows;
}

let exitCode = 0;
try {
  log('ui-smoke', '36', 'Launching Electron...');
  const app = await electron.launch({
    cwd: desktopRoot,
    args: ['.', `--user-data-dir=${userDataDir}`],
    env: { ...process.env, RENDERER_DEV_URL: rendererUrl, NODE_ENV: 'development' },
    timeout: 30_000,
  });

  let win = null;
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    for (const w of app.windows()) {
      if (w.url().startsWith(rendererUrl)) {
        win = w;
        break;
      }
    }
    if (win) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  if (!win) throw new Error('renderer window did not open within 15s');
  await win.waitForLoadState('domcontentloaded');

  // Seed the DB so the dashboard renders.
  await win.evaluate(
    ({ rows }) =>
      window.bridge.db.importRows(rows, { filename: 'sample.csv', fileSha256: 'sample-sha' }),
    { rows: rowFactory(1, 20) },
  );
  await win.evaluate(
    ({ rows }) =>
      window.bridge.db.importRows(rows, {
        filename: 'sample-2.csv',
        fileSha256: 'sample-sha-2',
      }),
    { rows: rowFactory(2, 10) },
  );

  // Force a hydrate by reloading the renderer — useDesktopIngest's
  // hydrate-on-mount only runs once per page load.
  await win.reload();
  await win.waitForLoadState('domcontentloaded');
  // Wait for the dashboard to actually render (FileToolbar appears).
  await win.waitForSelector('text=import', { timeout: 10_000 });
  await new Promise((r) => setTimeout(r, 600));

  await win.screenshot({
    path: join(screenshotDir, '01-dashboard-desktop.png'),
    fullPage: false,
  });
  log('ui-smoke', '32', 'captured 01-dashboard-desktop.png');

  // Open the History drawer.
  await win.getByText('history', { exact: true }).first().click();
  await win.waitForSelector('text=Import history', { timeout: 5_000 });
  await new Promise((r) => setTimeout(r, 600));
  await win.screenshot({
    path: join(screenshotDir, '02-history-drawer.png'),
    fullPage: false,
  });
  log('ui-smoke', '32', 'captured 02-history-drawer.png');

  // Click "Undo" on the newest batch to expose the confirm row.
  await win.getByText('Undo', { exact: true }).first().click();
  await new Promise((r) => setTimeout(r, 350));
  await win.screenshot({
    path: join(screenshotDir, '03-history-undo-confirm.png'),
    fullPage: false,
  });
  log('ui-smoke', '32', 'captured 03-history-undo-confirm.png');

  // Cancel and close.
  await win.getByText('Cancel', { exact: true }).first().click();
  await win.keyboard.press('Escape');
  await new Promise((r) => setTimeout(r, 250));
  // Click outside to close the drawer.
  await win.mouse.click(50, 200);
  await new Promise((r) => setTimeout(r, 250));

  // Drive the actual preview drawer by uploading a real CSV file
  // through the hidden <input type="file">. Synthesize the smallest
  // valid `usage-events-*.csv` so the renderer's parser + cost engine
  // + previewImport IPC all run for real.
  log('ui-smoke', '36', 'Triggering preview drawer by injecting a CSV via the hidden input...');
  const sampleCsv = [
    'Date,User,Kind,Max Mode,Model,Input (w/ Cache Write),Input (w/o Cache Write),Cache Read,Output Tokens,Total Tokens,Cost ($),Cloud Agent ID,Automation ID,Request Type,Requests',
    '"2026-05-09T10:00:00.000Z","me@example.com","Included","No","claude-4-sonnet-thinking","1000","500","200","800","2500","0.05","","","Usage","0.5"',
    '"2026-05-09T11:00:00.000Z","me@example.com","Included","No","gpt-5-thinking","800","400","100","600","1900","0.04","","","Usage","0.4"',
    '"2026-05-10T09:30:00.000Z","me@example.com","Included","Yes","claude-4-sonnet-thinking","2000","1500","500","1200","5200","0.18","","","Usage","1.0"',
  ].join('\n');

  const input = await win.locator('input[type="file"]').first();
  await input.setInputFiles({
    name: 'preview-demo.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(sampleCsv, 'utf-8'),
  });

  // Preview drawer renders when state becomes 'preview' — Import header
  // is the most stable selector.
  await win.waitForSelector('text=Import preview', { timeout: 5_000 });
  await new Promise((r) => setTimeout(r, 700));
  await win.screenshot({
    path: join(screenshotDir, '04-preview-drawer.png'),
    fullPage: false,
  });
  log('ui-smoke', '32', 'captured 04-preview-drawer.png');

  // Click Import to commit, capture the dashboard after the new rows land.
  const importBtn = win.locator('button:has-text("Import")', { hasText: /Import \d/ }).first();
  await importBtn.click();
  await new Promise((r) => setTimeout(r, 900));
  await win.screenshot({
    path: join(screenshotDir, '05-dashboard-after-import.png'),
    fullPage: false,
  });
  log('ui-smoke', '32', 'captured 05-dashboard-after-import.png');

  // Open the Settings drawer (PR22) and capture it. The cog icon
  // sits in the top header next to the theme toggle.
  await win.getByRole('button', { name: 'Open settings' }).first().click();
  await win.waitForSelector('text=Backup & restore', { timeout: 5_000 });
  await new Promise((r) => setTimeout(r, 500));
  await win.screenshot({
    path: join(screenshotDir, '06-settings-drawer.png'),
    fullPage: false,
  });
  log('ui-smoke', '32', 'captured 06-settings-drawer.png');

  // Close settings drawer.
  await win.keyboard.press('Escape');
  await win.mouse.click(50, 200);
  await new Promise((r) => setTimeout(r, 300));

  // PR24 — Forecast panel. Sits below Compare Ranges on the Overview.
  log('ui-smoke', '36', 'Capturing forecast panel (PR24)...');
  await win.evaluate(() => {
    const candidates = Array.from(document.querySelectorAll('div'));
    for (const el of candidates) {
      if (el.textContent?.startsWith('Forecast · next 30 days')) {
        el.scrollIntoView({ behavior: 'instant', block: 'center' });
        break;
      }
    }
  });
  await new Promise((r) => setTimeout(r, 800));
  await win.screenshot({
    path: join(screenshotDir, '07-forecast-panel.png'),
    fullPage: false,
  });
  log('ui-smoke', '32', 'captured 07-forecast-panel.png');

  // PR24 — Compare-batches modal. Open the history drawer, then click
  // the new compare button at the top, then capture the side-by-side modal.
  log('ui-smoke', '36', 'Capturing compare-batches modal (PR24)...');
  await win.evaluate(() => window.scrollTo(0, 0));
  await new Promise((r) => setTimeout(r, 300));
  await win.getByText('history', { exact: true }).first().click();
  await win.waitForSelector('text=Import history', { timeout: 5_000 });
  await new Promise((r) => setTimeout(r, 400));
  await win
    .getByRole('button', { name: /compare/i })
    .first()
    .click();
  await win.waitForSelector('text=Compare batches', { timeout: 5_000 });
  // Wait for the batch stats to finish loading.
  await new Promise((r) => setTimeout(r, 900));
  await win.screenshot({
    path: join(screenshotDir, '08-compare-batches.png'),
    fullPage: false,
  });
  log('ui-smoke', '32', 'captured 08-compare-batches.png');

  // PR25 — exercise the new IPC surfaces (budget reporter + update channel).
  // These don't produce screenshots — they validate that the wiring lands
  // in the main process at all. Without them an IPC typo would silently
  // no-op in the renderer's catch handler.
  log('ui-smoke', '36', 'Exercising budget + update IPC (PR25)...');
  const ipcProbe = await win.evaluate(async () => {
    const overReport = await window.bridge.budget.report({
      monthKey: '2026-05',
      monthLabel: 'May 2026',
      spendUSD: 42.18,
      requestUnits: 600,
      budgetRequests: 500,
      projectedRequests: 720,
    });
    const noopReport = await window.bridge.budget.report({
      monthKey: '2026-05',
      monthLabel: 'May 2026',
      spendUSD: 42.18,
      requestUnits: 600,
      budgetRequests: 500,
      projectedRequests: 720,
    });
    await window.bridge.budget.resetGuard();
    const guardState = await window.bridge.budget.getGuardState();
    const updateStatus = await window.bridge.update.status();
    const updateCheck = await window.bridge.update.check();
    return { overReport, noopReport, guardState, updateStatus, updateCheck };
  });

  if (!ipcProbe.overReport?.ok) {
    throw new Error(`budget:report failed: ${JSON.stringify(ipcProbe.overReport)}`);
  }
  if (ipcProbe.noopReport?.fired !== false) {
    throw new Error(
      `budget:report should dedupe within a month, got: ${JSON.stringify(ipcProbe.noopReport)}`,
    );
  }
  if (typeof ipcProbe.guardState?.thresholdsHit !== 'object' || !ipcProbe.guardState?.appVersion) {
    throw new Error(`budget:getGuardState payload missing: ${JSON.stringify(ipcProbe.guardState)}`);
  }
  if (ipcProbe.updateStatus?.kind !== 'disabled' || !ipcProbe.updateStatus?.reason) {
    throw new Error(
      `update:status should be disabled in dev, got: ${JSON.stringify(ipcProbe.updateStatus)}`,
    );
  }
  if (ipcProbe.updateCheck?.ok !== false) {
    throw new Error(
      `update:check should refuse in dev, got: ${JSON.stringify(ipcProbe.updateCheck)}`,
    );
  }
  log(
    'ui-smoke',
    '32',
    `OK · budget IPC fired (${ipcProbe.overReport.threshold}×) + deduped on repeat + update disabled in dev (${ipcProbe.updateStatus.reason})`,
  );

  log('ui-smoke', '36', 'Closing app...');
  await app.close();
  log(
    'ui-smoke',
    '32',
    'ALL PASS · dashboard + history + settings + forecast + compare-batches + PR25 IPC verified (8 PNGs)',
  );
} catch (err) {
  console.error(err);
  exitCode = 1;
} finally {
  renderer.kill();
}

process.exit(exitCode);
