import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
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
 * time, so this script flips the prebuild as needed. Run it any time you
 * switch contexts (e.g. before vitest after running desktop:dev, or before
 * desktop:dev after a fresh `pnpm install`).
 *
 * Usage:
 *
 *   tsx scripts/install-natives.mts                # default: electron (for desktop dev)
 *   tsx scripts/install-natives.mts --runtime=electron
 *   tsx scripts/install-natives.mts --runtime=node # restore Node binary for vitest
 *
 * PR19 will collapse this into the production packaging flow (electron-builder
 * `install-app-deps`) so end users never see this knob.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');

const NATIVE_DEPS = [{ name: 'better-sqlite3', tagPrefix: 'v' }] as const;

type Runtime = 'electron' | 'node';

function parseRuntime(argv: string[]): Runtime {
  const flag = argv.find((a) => a.startsWith('--runtime='));
  const value = flag?.split('=')[1] ?? 'electron';
  if (value !== 'electron' && value !== 'node') {
    throw new Error(`unsupported --runtime=${value} (expected "electron" or "node")`);
  }
  return value;
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

const runtime = parseRuntime(process.argv.slice(2));
const target = runtime === 'electron' ? getElectronVersion() : process.versions.node;
console.log(`[install-natives] runtime=${runtime} target=${target}`);

for (const dep of NATIVE_DEPS) {
  const dirs = findPnpmStores(dep.name);
  if (dirs.length === 0) {
    console.warn(`[install-natives] ${dep.name} not in node_modules/.pnpm — skipping`);
    continue;
  }
  for (const dir of dirs) {
    console.log(`[install-natives] ${dep.name} @ ${dir}`);
    try {
      execSync(
        `npx prebuild-install --runtime=${runtime} --target=${target} --tag-prefix=${dep.tagPrefix}`,
        {
          cwd: dir,
          stdio: 'inherit',
          shell: process.platform === 'win32' ? 'powershell' : '/bin/sh',
        },
      );
      const out = path.join(dir, 'build', 'Release');
      console.log(`[install-natives] ${dep.name} → ${out}`);
    } catch (err) {
      console.error(`[install-natives] ${dep.name} (${dir}) failed:`, (err as Error).message);
      process.exitCode = 1;
    }
  }
}
