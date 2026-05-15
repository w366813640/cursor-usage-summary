/**
 * PR18 visual smoke — boots the desktop in a fresh userData, seeds
 * rows that span 14 months across two calendar years, then captures
 * screenshots of the new "Year" route:
 *
 *   1. Year-in-review panel (current year selected, with year picker
 *      because >1 calendar year is present)
 *   2. Year-in-review panel after picking the previous year
 *   3. Cross-month trends panel (scrolled into view) — rolling 30d
 *      sparkline + last-month overview + top-5 model MoM table
 *
 * Output: `_temp/pr18-screenshots/<name>.png`. This is a visual
 * regression check, not a logic check — the data pipeline is covered
 * by component-level tests + `desktop-db-smoke.mjs`.
 */

import { spawn } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron as electron } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const desktopRoot = join(repoRoot, 'apps/desktop');
const userDataDir = join(repoRoot, '_temp', 'pr18-userdata');
const screenshotDir = join(repoRoot, '_temp', 'pr18-screenshots');

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

const RENDERER_PORT = 5178;
const rendererUrl = `http://localhost:${RENDERER_PORT}`;
log('year-smoke', '36', `Starting renderer at ${rendererUrl}...`);
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
log('year-smoke', '36', 'renderer up');

/**
 * Build a wide row factory: spread across 14 months so we get both
 * a year-in-review pane (with month bars + quarter strip) and a
 * cross-month trends pane (with enough history for MoM deltas).
 *
 * Months 2025-04 .. 2026-05, 1–4 rows per day on random days,
 * three model families so the top-5 model table has movement.
 */
function buildSeed() {
  const rows = [];
  const models = [
    'claude-4-sonnet-thinking',
    'gpt-5-thinking',
    'gemini-2.5-pro',
    'claude-3.5-sonnet',
    'o4-mini',
  ];
  let counter = 0;
  for (let i = 0; i < 14; i++) {
    // 2025-04 .. 2026-05
    const year = i < 9 ? 2025 : 2026;
    const month = i < 9 ? 4 + i : i - 8;
    const monthStr = `${year}-${String(month).padStart(2, '0')}`;
    // Random-ish 8–22 rows per month, escalating slightly in 2026
    const rowsThisMonth = 8 + ((i * 5) % 14) + (year === 2026 ? 4 : 0);
    for (let r = 0; r < rowsThisMonth; r++) {
      counter++;
      const day = ((r * 3 + i * 2) % 27) + 1;
      const hour = (r * 7 + i) % 24;
      const dateISO = `${monthStr}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:00:00.000Z`;
      // Bias model mix so claude-4 climbs MoM and gpt-5 falls in 2026,
      // which makes the MoM delta column actually have interesting
      // signed values rather than ~0% everywhere.
      const m =
        year === 2026
          ? r % 3 === 0
            ? models[0]
            : r % 3 === 1
              ? models[1]
              : models[r % models.length]
          : models[(r + i) % models.length];
      rows.push({
        id: `seed-${counter}`,
        dateISO,
        date: new Date(dateISO),
        cloudAgentId: '',
        automationId: '',
        kind: 'Included',
        model: m,
        maxMode: r % 7 === 0,
        tokens: {
          inputWithCacheWrite: 1200 + r * 80,
          inputWithoutCacheWrite: 600 + r * 40,
          cacheRead: 800 + r * 60,
          output: 500 + r * 30,
          total: 3100 + r * 210,
        },
        requests: { kind: 'units', value: 1 },
        // Roughly $0.02–$0.20 per row, with claude-4 a bit pricier
        cost: 0.04 + (r % 5) * 0.03 + (m === models[0] ? 0.06 : 0),
        costEstimated: false,
      });
    }
  }
  return rows;
}

let exitCode = 0;
try {
  log('year-smoke', '36', 'Launching Electron...');
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

  log('year-smoke', '36', 'Seeding 14 months of usage rows via the bridge...');
  await win.evaluate(
    ({ rows }) =>
      window.bridge.db.importRows(rows, {
        filename: 'year-review-seed.csv',
        fileSha256: 'pr18-seed-sha',
      }),
    { rows: buildSeed() },
  );

  await win.reload();
  await win.waitForLoadState('domcontentloaded');
  await win.waitForSelector('text=import', { timeout: 10_000 });
  await new Promise((r) => setTimeout(r, 600));

  log('year-smoke', '36', 'Navigating to the Year tab...');
  // NavTabs renders LABELS in serif title case ("Year", "Overview", ...).
  await win.getByRole('button', { name: 'Year', exact: true }).first().click();
  await win.waitForSelector('text=in review', { timeout: 5_000 });
  await new Promise((r) => setTimeout(r, 600));

  await win.screenshot({
    path: join(screenshotDir, '01-year-current.png'),
    fullPage: false,
  });
  log('year-smoke', '32', 'captured 01-year-current.png');

  // Pick the previous year (2025) via the YearPicker; it renders all
  // available years as <button> children of the panel's action slot.
  log('year-smoke', '36', 'Switching to previous year...');
  const prevYearBtn = win.locator('button:has-text("2025")').first();
  await prevYearBtn.click();
  await new Promise((r) => setTimeout(r, 400));
  await win.screenshot({
    path: join(screenshotDir, '02-year-2025.png'),
    fullPage: false,
  });
  log('year-smoke', '32', 'captured 02-year-2025.png');

  // Switch back to the current year so the MoM table reflects the
  // most active months; then scroll the trends panel into view.
  await win.locator('button:has-text("2026")').first().click();
  await new Promise((r) => setTimeout(r, 300));

  log('year-smoke', '36', 'Capturing cross-month trends panel...');
  await win.evaluate(() => {
    const panels = document.querySelectorAll('h1, h2, div');
    for (const el of panels) {
      if (el.textContent?.trim().startsWith('Cross-month trends')) {
        el.scrollIntoView({ behavior: 'instant', block: 'start' });
        break;
      }
    }
  });
  await new Promise((r) => setTimeout(r, 500));
  await win.screenshot({
    path: join(screenshotDir, '03-cross-month-trends.png'),
    fullPage: false,
  });
  log('year-smoke', '32', 'captured 03-cross-month-trends.png');

  // Full-page capture for an at-a-glance review of the whole route.
  await win.evaluate(() => window.scrollTo(0, 0));
  await new Promise((r) => setTimeout(r, 300));
  await win.screenshot({
    path: join(screenshotDir, '04-year-full.png'),
    fullPage: true,
  });
  log('year-smoke', '32', 'captured 04-year-full.png');

  log('year-smoke', '36', 'Closing app...');
  await app.close();
  log('year-smoke', '32', 'ALL PASS · Year route captured (current + prev + trends + full)');
} catch (err) {
  console.error(err);
  exitCode = 1;
} finally {
  renderer.kill();
}

process.exit(exitCode);
