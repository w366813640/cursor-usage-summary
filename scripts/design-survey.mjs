/**
 * One-off design survey — boots the desktop app with seeded data and
 * captures every route (overview / year / anomalies / models / details /
 * day) in dark + light so a redesign proposal can reference the real
 * current state. Output: _temp/design-survey/<route>-<theme>.png
 */
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron as electron } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const desktopRoot = join(repoRoot, 'apps/desktop');
const userDataDir = join(repoRoot, '_temp', 'design-survey-userdata');
const shotDir = join(repoRoot, '_temp', 'design-survey');

const isWindows = process.platform === 'win32';
const pnpmCmd = isWindows ? 'pnpm.cmd' : 'pnpm';

function log(line) {
  process.stdout.write(`\u001b[36m[survey]\u001b[0m ${line}\n`);
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
  throw new Error(`Renderer not reachable at ${url}`);
}

rmSync(userDataDir, { recursive: true, force: true });
mkdirSync(userDataDir, { recursive: true });
rmSync(shotDir, { recursive: true, force: true });
mkdirSync(shotDir, { recursive: true });

// Pre-flight: correct ABI + fresh main bundle.
for (const script of ['install-natives:ensure', 'build:main']) {
  await new Promise((resolveFn, rejectFn) => {
    const child = spawn(pnpmCmd, ['--filter', '@cu/desktop', script], {
      cwd: repoRoot,
      stdio: ['ignore', 'inherit', 'inherit'],
      shell: isWindows,
    });
    child.on('exit', (code) =>
      code === 0 ? resolveFn() : rejectFn(new Error(`${script} exited ${code}`)),
    );
  });
}

const RENDERER_PORT = 5179;
const rendererUrl = `http://localhost:${RENDERER_PORT}`;
log(`Starting renderer at ${rendererUrl}...`);
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
renderer.stdout?.on('data', () => {});
renderer.stderr?.on('data', (b) => process.stderr.write(`[renderer:err] ${b}`));

await waitForUrl(rendererUrl);
log('renderer up');

// ~90 days of plausible data: 3 models, agents, max-mode mix, weekend dips.
function buildSeed() {
  const rows = [];
  const models = [
    ['claude-4-sonnet-thinking', 0.9],
    ['gpt-5-thinking', 0.7],
    ['claude-opus-4-7', 2.4],
    ['composer-2.5', 0.35],
  ];
  let counter = 0;
  const today = new Date('2026-06-09T00:00:00Z');
  for (let d = 89; d >= 0; d--) {
    const day = new Date(today.getTime() - d * 86_400_000);
    const dow = day.getUTCDay();
    const weekday = dow !== 0 && dow !== 6;
    const baseN = weekday ? 9 : 3;
    const n = baseN + ((d * 7) % 5);
    for (let i = 0; i < n; i++) {
      counter++;
      const hour = weekday ? 9 + ((i * 3 + d) % 11) : 11 + (i % 6);
      const iso = `${day.toISOString().slice(0, 10)}T${String(hour).padStart(2, '0')}:${String((i * 13) % 60).padStart(2, '0')}:00.000Z`;
      const [model, costBase] = models[(i + d) % models.length];
      const maxMode = (i + d) % 9 === 0;
      const cacheRead = 40_000 + ((i * 911 + d * 313) % 220_000);
      const inputFresh = 8_000 + ((i * 433) % 30_000);
      const inputCw = 6_000 + ((i * 211) % 22_000);
      const output = 2_500 + ((i * 157 + d * 71) % 12_000);
      const cost = Number((costBase * (0.4 + ((i + d) % 7) / 6) * (maxMode ? 2 : 1)).toFixed(3));
      rows.push({
        id: `seed-${counter}`,
        dateISO: iso,
        date: new Date(iso),
        cloudAgentId: (i + d) % 11 === 0 ? `cloud-agent-${(i % 3) + 1}` : '',
        automationId: (i + d) % 17 === 0 ? `automation-${(i % 2) + 1}` : '',
        kind: 'Included',
        model,
        maxMode,
        tokens: {
          inputWithCacheWrite: inputCw,
          inputWithoutCacheWrite: inputFresh,
          cacheRead,
          output,
          total: inputCw + inputFresh + cacheRead + output,
        },
        requests: { kind: 'units', value: Number((0.5 + (i % 4) * 0.25).toFixed(2)) },
        cost,
        costEstimated: false,
      });
    }
  }
  return rows;
}

let exitCode = 0;
try {
  log('Launching Electron...');
  const app = await electron.launch({
    cwd: desktopRoot,
    args: ['.', `--user-data-dir=${userDataDir}`],
    env: {
      ...process.env,
      RENDERER_DEV_URL: rendererUrl,
      NODE_ENV: 'development',
      CU_NO_TRAY: '1',
    },
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
  if (!win) throw new Error('renderer window did not open');
  await win.waitForLoadState('domcontentloaded');
  await win.setViewportSize({ width: 1600, height: 1000 });

  log('Seeding 90 days of rows...');
  await win.evaluate(
    ({ rows }) =>
      window.bridge.db.importRows(rows, { filename: 'survey.csv', fileSha256: 'survey-sha' }),
    { rows: buildSeed() },
  );
  // Suppress the onboarding tour + quick tips so captures are unobstructed.
  await win.evaluate(() => {
    localStorage.setItem('cu:onboardingV1Done', '1');
  });
  await win.reload();
  await win.waitForLoadState('domcontentloaded');
  await win.waitForSelector('text=Manage data', { timeout: 15_000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 1500));

  const routes = ['overview', 'year', 'anomalies', 'models', 'details', 'day'];
  for (const route of routes) {
    await win.evaluate((r) => {
      window.location.hash = `#/${r}`;
    }, route);
    await new Promise((r) => setTimeout(r, 1800));
    await win.screenshot({ path: join(shotDir, `${route}-dark.png`), fullPage: false });
    log(`captured ${route}-dark.png`);
  }

  // Overview mid-scroll: hero chart + activity rhythm live below the fold.
  await win.evaluate(() => {
    window.location.hash = '#/overview';
  });
  await new Promise((r) => setTimeout(r, 1200));
  await win.evaluate(() => {
    const els = Array.from(document.querySelectorAll('div'));
    const target = els.find((el) => el.textContent?.startsWith('Daily cost'));
    target?.scrollIntoView({ block: 'start' });
  });
  await new Promise((r) => setTimeout(r, 900));
  await win.screenshot({ path: join(shotDir, 'overview-dark-scroll.png'), fullPage: false });
  log('captured overview-dark-scroll.png');

  // Light theme pass on overview + models only (enough for palette review).
  // Key must match STORAGE_KEY in @cu/ui theme.tsx ('cu-ui-theme').
  await win.evaluate(() => {
    localStorage.setItem('cu-ui-theme', 'light');
    document.documentElement.dataset.theme = 'light';
  });
  await win.reload();
  await win.waitForLoadState('domcontentloaded');
  await new Promise((r) => setTimeout(r, 1800));
  for (const route of ['overview', 'models']) {
    await win.evaluate((r) => {
      window.location.hash = `#/${r}`;
    }, route);
    await new Promise((r) => setTimeout(r, 1500));
    await win.screenshot({ path: join(shotDir, `${route}-light.png`), fullPage: false });
    log(`captured ${route}-light.png`);
  }

  await app.close();
  log('DONE');
} catch (err) {
  console.error(err);
  exitCode = 1;
} finally {
  renderer.kill();
}
process.exit(exitCode);
