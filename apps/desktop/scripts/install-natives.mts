import { execSync } from 'node:child_process';
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

const NATIVE_DEPS = [{ name: 'better-sqlite3', tagPrefix: 'v' }] as const;

type Runtime = 'electron' | 'node';

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
    try {
      execSync(
        `npx prebuild-install --runtime=${runtime} --target=${target} --tag-prefix=${dep.tagPrefix}`,
        {
          cwd: dir,
          stdio: 'inherit',
          shell: process.platform === 'win32' ? 'powershell' : '/bin/sh',
        },
      );
      writeMarker(buildReleaseDir, { runtime, target, ts: new Date().toISOString() });
      didAnyWork = true;
      console.log(`[install-natives] ${dep.name}@${version} → ${buildReleaseDir}`);
    } catch (err) {
      const msg = (err as Error).message;
      if (isCanonical) {
        console.error(`[install-natives] ${dep.name}@${version} failed:`, msg);
        process.exitCode = 1;
      } else {
        console.warn(`[install-natives] ${dep.name}@${version} (orphan) skipped:`, msg);
      }
    }
  }
}

if (ensure && !didAnyWork && process.exitCode !== 1) {
  console.log('[install-natives] all canonical native deps already on requested runtime');
}
