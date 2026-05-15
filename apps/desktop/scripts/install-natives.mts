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

function findPnpmStore(packageName: string): string | null {
  const pnpmDir = path.join(repoRoot, 'node_modules', '.pnpm');
  if (!existsSync(pnpmDir)) return null;
  for (const entry of readdirSync(pnpmDir)) {
    if (entry.startsWith(`${packageName}@`)) {
      const candidate = path.join(pnpmDir, entry, 'node_modules', packageName);
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}

function getElectronVersion(): string {
  const electronPkg = path.join(repoRoot, 'node_modules', 'electron', 'package.json');
  if (!existsSync(electronPkg)) {
    throw new Error('electron not installed yet — run `pnpm install` first');
  }
  const { version } = readJson(electronPkg) as { version: string };
  return version;
}

const runtime = parseRuntime(process.argv.slice(2));
const target = runtime === 'electron' ? getElectronVersion() : process.versions.node;
console.log(`[install-natives] runtime=${runtime} target=${target}`);

for (const dep of NATIVE_DEPS) {
  const dir = findPnpmStore(dep.name);
  if (!dir) {
    console.warn(`[install-natives] ${dep.name} not in node_modules/.pnpm — skipping`);
    continue;
  }
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
    console.error(`[install-natives] ${dep.name} failed:`, (err as Error).message);
    process.exitCode = 1;
  }
}
