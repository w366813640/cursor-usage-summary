import { execSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Switches every native dep's prebuilt `*.node` binary to a target runtime.
 *
 * Background: `better-sqlite3` ships *two* sets of prebuilds — one indexed
 * by Node ABI (the default `prebuild-install` target), and one indexed by
 * Electron version (`--runtime=electron --target=X`). `pnpm install` only
 * lays down the Node-flavored one, so:
 *
 *   - Pure-Node consumers (vitest in `@cu/storage`, scripts under Node)
 *     need `--runtime=node` binaries.
 *   - The Electron main process needs `--runtime=electron` binaries.
 *
 * Loading the wrong flavor throws `NODE_MODULE_VERSION` mismatch at require
 * time, so this script flips the prebuild as needed. PR21 made this
 * idempotent via a marker file at `build/Release/.cu-runtime.json`, so
 * `--ensure` invocations are ~no-ops when the binary is already correct.
 *
 * Usage:
 *
 *   tsx scripts/install-natives.mts                      # default: electron (for desktop dev)
 *   tsx scripts/install-natives.mts --runtime=electron
 *   tsx scripts/install-natives.mts --runtime=node       # restore Node binary for vitest
 *   tsx scripts/install-natives.mts --runtime=electron --ensure
 *                                                         # idempotent: only swap if marker
 *                                                         # disagrees with the requested runtime
 *
 * PR19 collapsed the production packaging flow into electron-builder's
 * `install-app-deps`, so end users never see this knob. PR21 wired
 * `--ensure` into `desktop:dev` (pre-flight) and `@cu/storage` pretest,
 * so contributors don't have to remember to flip the binary manually.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');
const desktopRoot = path.resolve(__dirname, '..');

const NATIVE_DEPS = [{ name: 'better-sqlite3', tagPrefix: 'v' }] as const;

type Runtime = 'electron' | 'node';

/**
 * prebuild-install fetches release tarballs from GitHub by default — a
 * notoriously flaky path from CN networks (the user's terminal log showed
 * "Request timed out" after the default 30s window). We do four things:
 *
 *   1. Bump the per-request timeout via `--timeout` so a slow-but-alive
 *      mirror still completes.
 *   2. Cycle through a list of mirror hosts on each retry — first attempt
 *      uses the upstream default (works instantly outside CN), then
 *      drop-in GitHub mirrors that 1:1 map every release URL. The user
 *      can override the list via BETTER_SQLITE3_BINARY_HOST.
 *   3. Each host gets its own retry with linear backoff.
 *   4. Fall back to `electron-rebuild` (build-from-source via @electron/
 *      rebuild) on the very last failure. The fallback emits a clear
 *      message so the user knows whether to install MSVC tools or just
 *      configure a different mirror.
 *
 * Override the host(s) via env:
 *
 *   BETTER_SQLITE3_BINARY_HOST=https://github.com.your.mirror/
 *     # single host (comma-separated also accepted); passed to
 *     # `prebuild-install --download-host=...`. When set, the bundled
 *     # CN mirror cycle is skipped.
 *   CU_PREBUILD_RETRIES=3              # attempts PER host, default 2
 *   CU_PREBUILD_TIMEOUT_MS=120000      # default 120s per attempt
 *   CU_DISABLE_REBUILD_FALLBACK=1      # skip the build-from-source step
 */
const PREBUILD_RETRIES = Number(process.env.CU_PREBUILD_RETRIES ?? '2');
const PREBUILD_TIMEOUT_MS = Number(process.env.CU_PREBUILD_TIMEOUT_MS ?? '120000');
const DISABLE_REBUILD_FALLBACK = process.env.CU_DISABLE_REBUILD_FALLBACK === '1';

/**
 * Drop-in GitHub mirrors used when the user hasn't set
 * BETTER_SQLITE3_BINARY_HOST. All entries 1:1 map release URLs so
 * prebuild-install builds the correct path without any URL surgery.
 * Ordered cheapest → costliest from the project author's perspective:
 *
 *   - ''           : empty string = prebuild-install's own default
 *                    (github.com). Works instantly outside CN, costs us
 *                    zero retries when the network is healthy.
 *   - kkgithub.com : community-maintained 1:1 github mirror, generally
 *                    reachable from CN without auth.
 *   - bgithub.xyz  : alternative 1:1 mirror, used as a second backup.
 *
 * Mirrors come and go; bake in 2–3 here, and let users override with
 * env when none of them work.
 */
const DEFAULT_MIRROR_CYCLE = ['', 'https://kkgithub.com/', 'https://bgithub.xyz/'];

function buildHostCycle(): string[] {
  const env = process.env.BETTER_SQLITE3_BINARY_HOST?.trim();
  if (!env) return DEFAULT_MIRROR_CYCLE;
  return env
    .split(',')
    .map((h) => h.trim())
    .filter((h) => h.length > 0);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

interface RuntimeMarker {
  runtime: Runtime;
  target: string;
  ts: string;
}

const MARKER_FILENAME = '.cu-runtime.json';

function parseRuntime(argv: string[]): Runtime {
  const flag = argv.find((a) => a.startsWith('--runtime='));
  const value = flag?.split('=')[1] ?? 'electron';
  if (value !== 'electron' && value !== 'node') {
    throw new Error(`unsupported --runtime=${value} (expected "electron" or "node")`);
  }
  return value;
}

function isEnsureMode(argv: string[]): boolean {
  return argv.includes('--ensure');
}

function readJson(p: string): unknown {
  return JSON.parse(readFileSync(p, 'utf-8'));
}

function findPnpmStores(packageName: string): string[] {
  const pnpmDir = path.join(repoRoot, 'node_modules', '.pnpm');
  if (!existsSync(pnpmDir)) return [];
  // Return *every* matching version. pnpm can keep older copies of a
  // package around even after we bump the version (left as orphans
  // until `pnpm prune` runs), and if we only swap the binary inside
  // the first one we find, we may end up touching the wrong copy.
  const out: string[] = [];
  for (const entry of readdirSync(pnpmDir)) {
    // Skip @types/ packages — they're type-only, no native binary.
    if (entry.startsWith('@types+')) continue;
    if (entry.startsWith(`${packageName}@`)) {
      const candidate = path.join(pnpmDir, entry, 'node_modules', packageName);
      if (existsSync(candidate)) out.push(candidate);
    }
  }
  return out;
}

function getElectronVersion(): string {
  // Try the hoisted location first (for npm/yarn-style layouts), then
  // fall back to the pnpm virtual store. pnpm doesn't surface electron
  // at the workspace root because no top-level package depends on it
  // directly — only `@cu/desktop` does.
  const hoisted = path.join(repoRoot, 'node_modules', 'electron', 'package.json');
  if (existsSync(hoisted)) {
    return (readJson(hoisted) as { version: string }).version;
  }

  const pnpmDir = path.join(repoRoot, 'node_modules', '.pnpm');
  if (existsSync(pnpmDir)) {
    for (const entry of readdirSync(pnpmDir)) {
      if (entry.startsWith('electron@')) {
        const pkg = path.join(pnpmDir, entry, 'node_modules', 'electron', 'package.json');
        if (existsSync(pkg)) {
          return (readJson(pkg) as { version: string }).version;
        }
      }
    }
  }

  throw new Error('electron not installed yet — run `pnpm install` first');
}

/**
 * Returns the resolved version of `packageName` as declared in our own
 * workspace's package.json files (apps/* and packages/*). We use this
 * to decide which pnpm-store copy is the "canonical" one — anything else
 * is an orphan (e.g. a transitive dep from an earlier install that pnpm
 * left around). Orphans don't always have prebuilds for the runtime we
 * care about, so treat their failures as soft warnings instead of hard
 * errors.
 */
function getCanonicalVersions(packageName: string): Set<string> {
  const out = new Set<string>();
  const tryRead = (pkgPath: string) => {
    if (!existsSync(pkgPath)) return;
    const pkg = readJson(pkgPath) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const v = pkg.dependencies?.[packageName] ?? pkg.devDependencies?.[packageName];
    if (v) {
      // Strip range specifiers (^/~/>=) — pnpm names dirs by exact version.
      out.add(v.replace(/^[^\d]*/, ''));
    }
  };
  for (const sub of ['apps', 'packages']) {
    const base = path.join(repoRoot, sub);
    if (!existsSync(base)) continue;
    for (const entry of readdirSync(base)) {
      tryRead(path.join(base, entry, 'package.json'));
    }
  }
  return out;
}

function readMarker(buildReleaseDir: string): RuntimeMarker | null {
  const markerPath = path.join(buildReleaseDir, MARKER_FILENAME);
  if (!existsSync(markerPath)) return null;
  try {
    const raw = readJson(markerPath) as Partial<RuntimeMarker>;
    if (
      (raw.runtime === 'electron' || raw.runtime === 'node') &&
      typeof raw.target === 'string' &&
      typeof raw.ts === 'string'
    ) {
      return { runtime: raw.runtime, target: raw.target, ts: raw.ts };
    }
    return null;
  } catch {
    return null;
  }
}

function writeMarker(buildReleaseDir: string, marker: RuntimeMarker): void {
  const markerPath = path.join(buildReleaseDir, MARKER_FILENAME);
  writeFileSync(markerPath, `${JSON.stringify(marker, null, 2)}\n`, 'utf-8');
}

function isBinaryPresent(buildReleaseDir: string, depName: string): boolean {
  // better-sqlite3's prebuilt artifact lives at build/Release/<name>.node.
  // We check for *.node existence as a coarse proof-of-life — the marker
  // file carries the runtime metadata.
  const candidate = path.join(buildReleaseDir, 'better_sqlite3.node');
  if (depName === 'better-sqlite3') return existsSync(candidate);
  return existsSync(buildReleaseDir);
}

const argv = process.argv.slice(2);
const runtime = parseRuntime(argv);
const ensure = isEnsureMode(argv);
const target = runtime === 'electron' ? getElectronVersion() : process.versions.node;

if (ensure) {
  console.log(`[install-natives] runtime=${runtime} target=${target} (ensure mode)`);
} else {
  console.log(`[install-natives] runtime=${runtime} target=${target}`);
}

let didAnyWork = false;

for (const dep of NATIVE_DEPS) {
  const dirs = findPnpmStores(dep.name);
  if (dirs.length === 0) {
    console.warn(`[install-natives] ${dep.name} not in node_modules/.pnpm — skipping`);
    continue;
  }
  const canonical = getCanonicalVersions(dep.name);
  for (const dir of dirs) {
    // dir = .../.pnpm/<name>@<version>/node_modules/<name>; extract the version.
    const segment = path.basename(path.resolve(dir, '../..'));
    const version = segment.startsWith(`${dep.name}@`) ? segment.slice(dep.name.length + 1) : '';
    const isCanonical = canonical.has(version);
    const label = isCanonical ? '' : ' [orphan]';
    const buildReleaseDir = path.join(dir, 'build', 'Release');

    if (ensure && isBinaryPresent(buildReleaseDir, dep.name)) {
      const marker = readMarker(buildReleaseDir);
      if (marker && marker.runtime === runtime && marker.target === target) {
        if (isCanonical) {
          console.log(
            `[install-natives] ${dep.name}@${version} already on ${runtime}@${target} — skip`,
          );
        }
        continue;
      }
    }

    console.log(`[install-natives] ${dep.name}@${version}${label} @ ${dir}`);
    const ok = await tryInstall(dep.name, dep.tagPrefix, dir, runtime, target, isCanonical);
    if (ok) {
      writeMarker(buildReleaseDir, { runtime, target, ts: new Date().toISOString() });
      didAnyWork = true;
      console.log(`[install-natives] ${dep.name}@${version} → ${buildReleaseDir}`);
    }
  }
}

if (ensure && !didAnyWork && process.exitCode !== 1) {
  console.log('[install-natives] all canonical native deps already on requested runtime');
}

/* --------------------------------------------------------------- *
 *  Install pipeline — prebuild-install (with retry + mirror) then
 *  electron-rebuild fallback when prebuilds are unreachable.
 * --------------------------------------------------------------- */

async function tryInstall(
  name: string,
  tagPrefix: string,
  dir: string,
  runtime: Runtime,
  target: string,
  isCanonical: boolean,
): Promise<boolean> {
  const hosts = buildHostCycle();
  const totalAttempts = hosts.length * PREBUILD_RETRIES;
  let attempt = 0;
  // --- cycle through mirrors, each with PREBUILD_RETRIES attempts ---
  for (const host of hosts) {
    for (let perHost = 1; perHost <= PREBUILD_RETRIES; perHost++) {
      attempt += 1;
      const args = [
        'prebuild-install',
        `--runtime=${runtime}`,
        `--target=${target}`,
        `--tag-prefix=${tagPrefix}`,
        `--timeout=${PREBUILD_TIMEOUT_MS}`,
      ];
      if (host) args.push(`--download-host=${host}`);
      const cmd = `npx ${args.join(' ')}`;
      const label = host || 'upstream github.com (default)';
      try {
        console.log(
          `[install-natives] attempt ${attempt}/${totalAttempts} via ${label}\n  $ ${cmd}`,
        );
        execSync(cmd, {
          cwd: dir,
          stdio: 'inherit',
          shell: process.platform === 'win32' ? 'powershell' : '/bin/sh',
        });
        return true;
      } catch (err) {
        const msg = (err as Error).message;
        const firstLine = msg.split('\n')[0];
        const isLastAttempt = attempt === totalAttempts;
        if (!isLastAttempt) {
          const backoff = perHost * 2000;
          console.warn(
            `[install-natives] ${name} attempt ${attempt}/${totalAttempts} via ${label} failed (${firstLine}). Retrying in ${backoff}ms...`,
          );
          await sleep(backoff);
        } else {
          console.warn(
            `[install-natives] ${name} prebuild exhausted ${totalAttempts} attempts across ${hosts.length} host(s): ${firstLine}`,
          );
        }
      }
    }
  }

  // --- final fallback: build from source via @electron/rebuild ---
  if (DISABLE_REBUILD_FALLBACK) {
    if (isCanonical) {
      const giveUpMessage = [
        `[install-natives] ${name} install failed and CU_DISABLE_REBUILD_FALLBACK=1, giving up.`,
        '  To recover: ensure GitHub releases are reachable, OR set',
        '    BETTER_SQLITE3_BINARY_HOST=<mirror>',
        '  OR run `pnpm --filter @cu/desktop rebuild-natives` to build from source.',
      ].join('\n');
      console.error(giveUpMessage);
      process.exitCode = 1;
    } else {
      console.warn(`[install-natives] ${name} (orphan) skipped after retries (no fallback).`);
    }
    return false;
  }

  if (runtime !== 'electron') {
    // electron-rebuild is electron-specific. For node-runtime requests we
    // simply propagate the failure (vitest can fall back to its own
    // resolver) and let the canonical/orphan branches decide.
    if (isCanonical) process.exitCode = 1;
    return false;
  }

  console.log(
    `[install-natives] ${name} prebuilds unreachable — falling back to electron-rebuild (build from source, may take ~60s).`,
  );
  const rebuild = spawnSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['electron-rebuild', '-w', name, '-f'],
    {
      cwd: desktopRoot,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    },
  );
  if (rebuild.status === 0) {
    console.log(`[install-natives] ${name} rebuilt from source against Electron ${target}.`);
    return true;
  }
  if (isCanonical) {
    const diagnose = [
      `[install-natives] ${name} electron-rebuild fallback also failed (exit ${rebuild.status}).`,
      '  Diagnose:',
      '    1. Confirm Python 3 + C++ build tools are installed (Windows: VS 2022 Build Tools w/ "Desktop dev with C++").',
      '    2. Or get prebuilds working: set BETTER_SQLITE3_BINARY_HOST=<your-mirror>, or',
      '       temporarily disable any VPN/proxy that intercepts GitHub release downloads.',
    ].join('\n');
    console.error(diagnose);
    process.exitCode = 1;
  } else {
    console.warn(`[install-natives] ${name} (orphan) rebuild skipped after retries + fallback.`);
  }
  return false;
}
