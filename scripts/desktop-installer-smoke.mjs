/**
 * PR19 smoke — boots the packaged `Cursor Usage.exe` from
 * `apps/desktop/release/win-unpacked/` and verifies:
 *
 *   1. The Electron process starts without crashing.
 *   2. The renderer window loads (BrowserWindow URL not blank).
 *   3. `app.getPath('userData')/cursor-usage.db` gets created
 *      after a bridge importRows call (proves IPC + SQLite work
 *      end-to-end in the packaged build, not just in dev).
 *   4. A screenshot lands in `_temp/pr19-screenshots/01-packaged-boot.png`.
 *
 * Uses Playwright._electron with `executablePath` pointed at the
 * packaged exe, so this is testing the actual artifact the user will
 * install — not the dev shell.
 *
 * Skip on non-Windows (the artifact path is windows-specific in this
 * smoke; macOS/Linux can extend with their own paths in future PRs).
 */

import { existsSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron as electron } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const exePath = join(repoRoot, 'apps/desktop/release/win-unpacked/Cursor Usage.exe');
const screenshotDir = join(repoRoot, '_temp', 'pr19-screenshots');
const userDataDir = join(repoRoot, '_temp', 'pr19-userdata');

function log(area, color, line) {
  process.stdout.write(`\u001b[${color}m[${area}]\u001b[0m ${line}\n`);
}

if (process.platform !== 'win32') {
  log('pr19-smoke', '33', `skipping (platform=${process.platform}, expected win32)`);
  process.exit(0);
}

if (!existsSync(exePath)) {
  log(
    'pr19-smoke',
    '31',
    `missing ${exePath} — run \`pnpm --filter @cu/desktop package:dir\` first`,
  );
  process.exit(1);
}

rmSync(userDataDir, { recursive: true, force: true });
mkdirSync(userDataDir, { recursive: true });
rmSync(screenshotDir, { recursive: true, force: true });
mkdirSync(screenshotDir, { recursive: true });

let exitCode = 0;
try {
  log('pr19-smoke', '36', `Launching packaged exe: ${exePath}`);
  const app = await electron.launch({
    executablePath: exePath,
    args: [`--user-data-dir=${userDataDir}`],
    timeout: 30_000,
  });

  let win = null;
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    for (const w of app.windows()) {
      const url = w.url();
      // The packaged app loads file:///.../resources/app/renderer/index.html
      if (url.startsWith('file://') && url.includes('index.html')) {
        win = w;
        break;
      }
    }
    if (win) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  if (!win) throw new Error('renderer window did not open within 20s');
  await win.waitForLoadState('domcontentloaded');
  log('pr19-smoke', '32', `OK · renderer loaded (${win.url()})`);

  // Probe the bridge — confirms preload + IPC + SQLite are wired in
  // the packaged build, not just under `desktop:dev`.
  const counts0 = await win.evaluate(() => window.bridge.db.counts());
  log('pr19-smoke', '32', `OK · bridge.db.counts() = ${JSON.stringify(counts0)}`);

  await win.evaluate(
    ({ row }) => window.bridge.db.importRows([row], { filename: 'pr19.csv', fileSha256: 'pr19' }),
    {
      row: {
        id: 'pr19-1',
        dateISO: '2026-05-15T10:00:00.000Z',
        cloudAgentId: '',
        automationId: '',
        kind: 'Included',
        model: 'claude-4-sonnet-thinking',
        maxMode: false,
        tokens: {
          inputWithCacheWrite: 100,
          inputWithoutCacheWrite: 50,
          cacheRead: 20,
          output: 80,
          total: 250,
        },
        requests: { kind: 'units', value: 1 },
        cost: 0.05,
        costEstimated: false,
      },
    },
  );
  const counts1 = await win.evaluate(() => window.bridge.db.counts());
  if (counts1.rowCount !== 1)
    throw new Error(`expected rowCount=1 after import, got ${counts1.rowCount}`);
  log('pr19-smoke', '32', `OK · bridge.db.importRows persisted (rowCount = ${counts1.rowCount})`);

  // Snap the onboarding state first (renderer doesn't auto-rehydrate
  // mid-session — that's by design, hydrate-on-mount only fires once).
  await new Promise((r) => setTimeout(r, 600));
  const bootShot = join(screenshotDir, '01-packaged-boot.png');
  await win.screenshot({ path: bootShot, fullPage: false });
  log('pr19-smoke', '32', `OK · boot screenshot captured (${bootShot})`);

  // Now reload — that triggers useDesktopIngest's hydrate-on-mount,
  // which pulls the row we just imported and switches to the dashboard.
  await win.reload();
  await win.waitForLoadState('domcontentloaded');
  await win.waitForSelector('text=import', { timeout: 10_000 });
  await new Promise((r) => setTimeout(r, 600));
  const dashboardShot = join(screenshotDir, '02-packaged-dashboard.png');
  await win.screenshot({ path: dashboardShot, fullPage: false });
  log('pr19-smoke', '32', `OK · dashboard hydrated after reload (${dashboardShot})`);

  // Verify the SQLite file actually lives at the expected location.
  const dbPath = join(userDataDir, 'cursor-usage.db');
  if (!existsSync(dbPath)) throw new Error(`expected DB at ${dbPath}`);
  const dbStat = statSync(dbPath);
  if (dbStat.size <= 0) throw new Error('DB file is empty');
  log('pr19-smoke', '32', `OK · DB exists at ${dbPath} (size = ${dbStat.size} bytes)`);

  log('pr19-smoke', '36', 'Closing app...');
  await app.close();
  log('pr19-smoke', '32', 'ALL PASS · packaged exe boots + IPC + SQLite + window render');
} catch (err) {
  console.error(err);
  exitCode = 1;
}

process.exit(exitCode);
