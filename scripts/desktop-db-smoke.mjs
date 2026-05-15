/**
 * PR16 desktop DB smoke — verifies the full main-process SQLite
 * persistence chain end-to-end:
 *
 *   1. Launch Electron with an isolated `--user-data-dir` so we never
 *      touch the real `cursor-usage.db`.
 *   2. From the renderer, call `window.bridge.db.importRows` with a
 *      deterministic synthetic batch and assert the dedup result.
 *   3. Call again with overlapping rows + a fresh file SHA and assert
 *      `added < total` (natural-key dedup works).
 *   4. Call again with the *same* file SHA and assert `isDuplicateFile`.
 *   5. Close the app, re-launch it with the same userData, assert the
 *      row count survived restart (real persistence!).
 *   6. List batches, undo the second batch, assert row count drops by
 *      exactly its row_count_added.
 *
 * Each assertion logs `[smoke] OK …` or throws.
 */

import { spawn } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron as electron } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const desktopRoot = join(repoRoot, 'apps/desktop');
const userDataDir = join(repoRoot, '_temp', 'pr16-userdata');

const isWindows = process.platform === 'win32';
const pnpmCmd = isWindows ? 'pnpm.cmd' : 'pnpm';

function log(area, color, line) {
  process.stdout.write(`\u001b[${color}m[${area}]\u001b[0m ${line}\n`);
}

function assert(cond, msg) {
  if (!cond) throw new Error(`assert failed: ${msg}`);
  log('smoke', '32', `OK · ${msg}`);
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

// Wipe the test userData on each run so the smoke is deterministic.
rmSync(userDataDir, { recursive: true, force: true });
mkdirSync(userDataDir, { recursive: true });

log('smoke', '36', 'Ensuring better-sqlite3 ABI matches Electron...');
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

log('smoke', '36', 'Building main + preload bundles...');
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

// We need a renderer for the BrowserWindow to load; reuse the same
// vite-on-:5176 pattern from PR15 smoke so concurrent dev servers don't
// collide.
const RENDERER_PORT = 5176;
const rendererUrl = `http://localhost:${RENDERER_PORT}`;
log('smoke', '36', `Starting renderer dev at ${rendererUrl}...`);
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
log('smoke', '36', 'renderer up');

/**
 * Generates a deterministic batch of rows. `seed` makes every row's
 * primary key unique so two different seeds never dedupe-collide.
 */
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
      // Note: structured-clone will preserve Date instances across IPC
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

async function launch(label) {
  log('smoke', '36', `Launching Electron (${label})...`);
  const app = await electron.launch({
    cwd: desktopRoot,
    args: ['.', `--user-data-dir=${userDataDir}`],
    env: {
      ...process.env,
      RENDERER_DEV_URL: rendererUrl,
      NODE_ENV: 'development',
    },
    timeout: 30_000,
  });
  // Wait for the *real* renderer window (not the splash data: URL or
  // DevTools). The bridge only lives on the renderer window.
  let renderWin = null;
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    for (const w of app.windows()) {
      if (w.url().startsWith(rendererUrl)) {
        renderWin = w;
        break;
      }
    }
    if (renderWin) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  if (!renderWin) throw new Error('renderer window did not open within 15s');
  await renderWin.waitForLoadState('domcontentloaded');
  return { app, win: renderWin };
}

let exitCode = 0;
try {
  // -------- Run 1: import batch A, verify counts ---------------------
  {
    const { app, win } = await launch('run 1');

    const rowsA = rowFactory(1, 5);
    const importResultA = await win.evaluate(
      ({ rows, sha }) =>
        // eslint-disable-next-line no-undef
        window.bridge.db.importRows(rows, { filename: 'a.csv', fileSha256: sha }),
      { rows: rowsA, sha: 'sha-A' },
    );
    assert(importResultA.added === 5, `import A added 5 (got ${importResultA.added})`);
    assert(importResultA.skipped === 0, 'import A skipped 0');
    assert(importResultA.isDuplicateFile === false, 'import A not a duplicate');

    const countsA = await win.evaluate(() => window.bridge.db.counts());
    assert(countsA.rowCount === 5, `counts after A = 5 (got ${countsA.rowCount})`);
    assert(countsA.batchCount === 1, `batches after A = 1 (got ${countsA.batchCount})`);

    // -------- partial overlap import (B = 3 new + 2 overlapping with A) -
    const rowsBOverlap = [...rowFactory(1, 2), ...rowFactory(2, 3)];
    const importResultB = await win.evaluate(
      ({ rows, sha }) => window.bridge.db.importRows(rows, { filename: 'b.csv', fileSha256: sha }),
      { rows: rowsBOverlap, sha: 'sha-B' },
    );
    assert(importResultB.added === 3, `import B added 3 (got ${importResultB.added})`);
    assert(importResultB.skipped === 2, `import B skipped 2 (got ${importResultB.skipped})`);

    // -------- duplicate file SHA short-circuit -------------------------
    const importResultDup = await win.evaluate(
      ({ rows, sha }) => window.bridge.db.importRows(rows, { filename: 'b.csv', fileSha256: sha }),
      { rows: rowsBOverlap, sha: 'sha-B' },
    );
    assert(importResultDup.isDuplicateFile === true, 'dup-file detected');
    assert(importResultDup.added === 0, 'dup-file added 0');

    const countsAfter = await win.evaluate(() => window.bridge.db.counts());
    assert(countsAfter.rowCount === 8, `counts after A+B+dup = 8 (got ${countsAfter.rowCount})`);

    // -------- query catalog smoke -------------------------------------
    const byDay = await win.evaluate(() => window.bridge.db.query('byDay'));
    assert(Array.isArray(byDay) && byDay.length > 0, 'byDay returns rows');
    const byModel = await win.evaluate(() => window.bridge.db.query('byModel'));
    assert(byModel.length === 2, `byModel has 2 entries (got ${byModel.length})`);
    const topBurns = await win.evaluate(() => window.bridge.db.query('topBurns', { limit: 3 }));
    assert(topBurns.length === 3, `topBurns limit=3 (got ${topBurns.length})`);
    assert(
      topBurns[0].cost >= topBurns[1].cost && topBurns[1].cost >= topBurns[2].cost,
      'topBurns sorted by cost desc',
    );

    // -------- PR17 · previewImport + allRowsCosted IPC ----------------
    const rowsC = rowFactory(3, 4);
    const previewC = await win.evaluate(
      ({ rows, sha }) =>
        window.bridge.db.previewImport(rows, { filename: 'c.csv', fileSha256: sha }),
      { rows: rowsC, sha: 'sha-C' },
    );
    assert(previewC.wouldAdd === 4, `preview C wouldAdd 4 (got ${previewC.wouldAdd})`);
    assert(previewC.wouldSkip === 0, 'preview C wouldSkip 0');
    assert(previewC.isDuplicateFile === false, 'preview C not a duplicate');
    // Preview must NOT change the on-disk state.
    const countsAfterPreview = await win.evaluate(() => window.bridge.db.counts());
    assert(
      countsAfterPreview.rowCount === 8,
      `preview did not persist (rowCount still 8, got ${countsAfterPreview.rowCount})`,
    );

    // Preview against an existing file SHA should short-circuit.
    const previewDup = await win.evaluate(
      ({ rows, sha }) =>
        window.bridge.db.previewImport(rows, { filename: 'b.csv', fileSha256: sha }),
      { rows: rowsBOverlap, sha: 'sha-B' },
    );
    assert(previewDup.isDuplicateFile === true, 'preview dup-file detected');

    const allRows = await win.evaluate(() => window.bridge.db.allRowsCosted());
    assert(
      Array.isArray(allRows) && allRows.length === 8,
      `allRowsCosted returns 8 rows (got ${allRows?.length})`,
    );
    assert('dateISO' in allRows[0] && 'tokens' in allRows[0], 'allRowsCosted shape carries tokens');

    log('smoke', '36', 'Closing app (run 1)...');
    await app.close();
  }

  // -------- Run 2: re-launch with same userData, expect persistence ---
  {
    const { app, win } = await launch('run 2 · persistence check');
    const counts = await win.evaluate(() => window.bridge.db.counts());
    assert(
      counts.rowCount === 8,
      `persistence: rowCount after restart = 8 (got ${counts.rowCount})`,
    );
    assert(counts.batchCount === 2, `persistence: batchCount = 2 (got ${counts.batchCount})`);

    // -------- listBatches + undoBatch ---------------------------------
    const batches = await win.evaluate(() => window.bridge.db.listBatches());
    assert(batches.length === 2, `listBatches = 2 (got ${batches.length})`);
    // newest first → batch B
    assert(batches[0].sourceFilename === 'b.csv', 'newest batch is b.csv');
    const batchB = batches[0];

    const undone = await win.evaluate((id) => window.bridge.db.undoBatch(id), batchB.id);
    assert(
      undone.removedRows === batchB.rowCountAdded,
      `undo removed ${batchB.rowCountAdded} rows (got ${undone.removedRows})`,
    );

    const finalCounts = await win.evaluate(() => window.bridge.db.counts());
    assert(finalCounts.rowCount === 5, `after undo: rowCount = 5 (got ${finalCounts.rowCount})`);
    assert(
      finalCounts.batchCount === 1,
      `after undo: batchCount = 1 (got ${finalCounts.batchCount})`,
    );

    log('smoke', '36', 'Closing app (run 2)...');
    await app.close();
  }

  log('smoke', '32', 'ALL PASS · IPC + SQLite + persistence + dedup + undo verified');
} catch (err) {
  console.error(err);
  exitCode = 1;
} finally {
  renderer.kill();
}

process.exit(exitCode);
