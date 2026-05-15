import { execSync, spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * End-to-end Electron packaging for `@cu/desktop`.
 *
 * The naive `pnpm build && electron-builder` flow trips over pnpm's
 * isolated linker — `apps/desktop/node_modules/@cu/storage` is a
 * junction into `packages/storage`, which has its own dev/turbo files
 * outside `apps/desktop/`, and electron-builder's asar packer chokes
 * the moment it walks one of those out-of-root paths.
 *
 * The fix is to materialize a self-contained prod tree first via
 * `pnpm deploy`, then run electron-builder there. The deployed tree
 * keeps all junctions *inside* the deploy dir, and only prod deps are
 * present (no .turbo, no devDependencies, no vitest configs).
 *
 * Steps (all paths repo-root-relative):
 *
 *   1. `pnpm --filter @cu/desktop build` (esbuild main + vite renderer)
 *   2. `pnpm --filter @cu/desktop deploy --prod _temp/desktop-pack`
 *   3. Copy `apps/desktop/dist/` → `_temp/desktop-pack/dist/`
 *   4. Copy `apps/playground/dist/` → `_temp/desktop-pack/renderer/`
 *      and rewrite `electron-builder.yml` extraResources accordingly
 *   5. Run `electron-builder` from `_temp/desktop-pack/`
 *   6. Move artifacts back to `apps/desktop/release/`
 *
 * Flags:
 *   --dir     Build an unpacked folder (fast smoke); skips installer
 *   --win     Force Windows target (NSIS installer; default: current OS)
 *   --mac     Force macOS target (.dmg, x64 + arm64)
 *   --linux   Force Linux target (.AppImage x64)
 *
 * Cross-OS notes:
 *   - macOS builds require running on macOS for code signing + notarisation.
 *     This script will *attempt* unsigned builds when invoked from
 *     Windows/Linux (electron-builder downloads a stub), useful for
 *     smoke-testing the YAML config but not shippable.
 *   - Linux builds run from any host that has fuse + AppImageTool deps.
 *   - For real release artifacts use the matching CI runner OS per
 *     target (typically macos-latest / ubuntu-latest / windows-latest).
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(desktopRoot, '../..');
const packDir = path.join(repoRoot, '_temp', 'desktop-pack');
const releaseSrc = path.join(packDir, 'release');
const releaseDst = path.join(desktopRoot, 'release');

const argv = process.argv.slice(2);
const dirOnly = argv.includes('--dir');
const forceWin = argv.includes('--win');
const forceMac = argv.includes('--mac');
const forceLinux = argv.includes('--linux');

function step(label: string) {
  process.stdout.write(`\n\u001b[36m▶ ${label}\u001b[0m\n`);
}

function run(cmd: string, cwd: string) {
  const result = spawnSync(cmd, {
    cwd,
    stdio: 'inherit',
    shell: true,
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(`command failed (exit ${result.status}): ${cmd}`);
  }
}

step('1/5 · clean previous pack');
rmSync(packDir, { recursive: true, force: true });
rmSync(releaseDst, { recursive: true, force: true });

step('2/5 · build main + renderer in source tree');
run('pnpm --filter @cu/desktop build', repoRoot);

step('3/5 · pnpm deploy --prod into _temp/desktop-pack');
run(`pnpm --filter @cu/desktop deploy --prod "${packDir}"`, repoRoot);

step('4/5 · stage dist + renderer + rewrite electron-builder.yml');

// The deployed tree omits `dist/` (it's .gitignored). Copy the freshly
// built main bundle over so electron-builder sees `dist/main/main.js`.
cpSync(path.join(desktopRoot, 'dist'), path.join(packDir, 'dist'), {
  recursive: true,
});

// Stage the renderer next to the desktop pack so extraResources is a
// simple sibling path — avoids any pnpm symlink leak into ../../.
const stagedRenderer = path.join(packDir, 'renderer');
cpSync(path.join(repoRoot, 'apps', 'playground', 'dist'), stagedRenderer, {
  recursive: true,
});

// `pnpm deploy --prod` strips devDependencies, but Electron is one of
// them — electron-builder can't infer the runtime version without it.
// Read the version from the source package.json + pin it into the
// deployed YAML so electron-builder downloads the matching binary.
const srcPkg = JSON.parse(readFileSync(path.join(desktopRoot, 'package.json'), 'utf-8')) as {
  devDependencies?: Record<string, string>;
};
const electronRange = srcPkg.devDependencies?.electron;
if (!electronRange) throw new Error('electron not in apps/desktop devDependencies');
// Resolve range (e.g. "^40.0.0") to the actual installed version via
// the workspace's node_modules. We already have a getElectronVersion
// helper in install-natives.mts; keep this self-contained here.
function resolveElectronVersion(): string {
  const pnpmDir = path.join(repoRoot, 'node_modules', '.pnpm');
  if (existsSync(pnpmDir)) {
    for (const entry of readdirSync(pnpmDir)) {
      if (entry.startsWith('electron@')) {
        const pkg = path.join(pnpmDir, entry, 'node_modules', 'electron', 'package.json');
        if (existsSync(pkg)) {
          return (JSON.parse(readFileSync(pkg, 'utf-8')) as { version: string }).version;
        }
      }
    }
  }
  throw new Error(`could not resolve electron version (range: ${electronRange})`);
}
const electronVersion = resolveElectronVersion();

// Rewrite extraResources `from: ../playground/dist` → `from: renderer`
// (resolved as `{packDir}/renderer` — no more climbing above the pack
// root), and pin the Electron version so the prod deploy can package
// without devDependencies installed.
const ymlPath = path.join(packDir, 'electron-builder.yml');
let yml = readFileSync(ymlPath, 'utf-8');
yml = yml.replace('from: ../playground/dist', 'from: renderer');
yml = `${yml.trimEnd()}\n\nelectronVersion: ${electronVersion}\n`;
writeFileSync(ymlPath, yml, 'utf-8');

// Make sure the deployed package.json points main at dist/main/main.js
// (which it does, but assert for safety since electron-builder uses it).
const deployedPkgPath = path.join(packDir, 'package.json');
const deployedPkg = JSON.parse(readFileSync(deployedPkgPath, 'utf-8')) as {
  main?: string;
};
if (!deployedPkg.main?.includes('dist/main/main.js')) {
  throw new Error(`unexpected package.json#main in pack: ${deployedPkg.main ?? 'missing'}`);
}

step('5/5 · electron-builder');
const builderArgs: string[] = [];
if (dirOnly) builderArgs.push('--dir');
if (forceWin) builderArgs.push('--win');
if (forceMac) builderArgs.push('--mac');
if (forceLinux) builderArgs.push('--linux');
const builderCmd = `electron-builder ${builderArgs.join(' ')}`.trim();

// electron-builder needs to be invoked from a directory that has its
// own node_modules so it can find @electron/rebuild + asar etc. The
// deploy tree only carries prod deps, so we run from the repo root
// and pass --config + --projectDir to point at the pack.
const cfgFlag = `--config "${ymlPath}"`;
const projFlag = `--projectDir "${packDir}"`;
run(`pnpm exec ${builderCmd} ${cfgFlag} ${projFlag}`, repoRoot);

step('done · moving artifacts back to apps/desktop/release/');
if (existsSync(releaseSrc)) {
  mkdirSync(path.dirname(releaseDst), { recursive: true });
  cpSync(releaseSrc, releaseDst, { recursive: true });
  process.stdout.write(
    `\n\u001b[32m✔ Artifacts at: ${path.relative(repoRoot, releaseDst)}\u001b[0m\n`,
  );
} else {
  process.stdout.write(
    '\n\u001b[33m! No release dir found — check electron-builder output\u001b[0m\n',
  );
}
