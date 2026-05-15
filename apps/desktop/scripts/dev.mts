import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(desktopRoot, '../..');
const playgroundRoot = path.resolve(repoRoot, 'apps/playground');

const isWindows = process.platform === 'win32';
const pnpmCmd = isWindows ? 'pnpm.cmd' : 'pnpm';
const npxCmd = isWindows ? 'npx.cmd' : 'npx';

function log(area: string, color: string, line: string) {
  process.stdout.write(`\u001b[${color}m[${area}]\u001b[0m ${line}\n`);
}

function streamProcess(area: string, color: string, child: ReturnType<typeof spawn>) {
  child.stdout?.on('data', (data: Buffer) => {
    for (const line of data.toString().split(/\r?\n/)) {
      if (line.trim()) log(area, color, line);
    }
  });
  child.stderr?.on('data', (data: Buffer) => {
    for (const line of data.toString().split(/\r?\n/)) {
      if (line.trim()) log(area, color, line);
    }
  });
}

async function waitForUrl(url: string, timeoutMs = 30_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 404) return;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Renderer dev server did not respond at ${url} within ${timeoutMs}ms`);
}

async function main() {
  log('orchestrator', '36', 'Starting playground dev server...');
  const renderer = spawn(pnpmCmd, ['dev'], {
    cwd: playgroundRoot,
    env: { ...process.env, FORCE_COLOR: '1' },
    // Node ≥ 18.20 / 20.12 refuses to spawn .bat / .cmd without
    // shell: true (CVE-2024-27980). We always go through the shell on
    // Windows; POSIX doesn't need it for the bare `pnpm` binary.
    shell: isWindows,
  });
  streamProcess('renderer', '32', renderer);
  renderer.on('exit', (code) => {
    log('renderer', '32', `exited with code ${code ?? 'null'}`);
    process.exit(code ?? 0);
  });

  await waitForUrl('http://localhost:5173');

  log('orchestrator', '36', 'Bundling main + preload (esbuild)...');
  await new Promise<void>((resolve, reject) => {
    const builder = spawn(npxCmd, ['tsx', 'scripts/build-main.mts'], {
      cwd: desktopRoot,
      shell: isWindows,
    });
    streamProcess('main-build', '33', builder);
    builder.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`build-main exit ${code}`)),
    );
  });

  const mainEntry = path.join(desktopRoot, 'dist/main/main.js');
  if (!existsSync(mainEntry)) throw new Error(`Main process bundle missing: ${mainEntry}`);

  log('orchestrator', '36', 'Launching Electron...');
  const electronModule = await import('electron');
  const electronBin = (electronModule as unknown as { default: string }).default;
  // `electron` itself resolves to a real .exe / binary on disk, no
  // shell wrapper required even on Windows.
  const electron = spawn(electronBin, ['.'], {
    cwd: desktopRoot,
    env: { ...process.env, RENDERER_DEV_URL: 'http://localhost:5173', NODE_ENV: 'development' },
    shell: false,
  });
  streamProcess('electron', '35', electron);
  electron.on('exit', (code) => {
    log('electron', '35', `exited with code ${code ?? 'null'}`);
    renderer.kill();
    process.exit(code ?? 0);
  });
}

main().catch((err) => {
  log('orchestrator', '31', String(err));
  process.exit(1);
});
