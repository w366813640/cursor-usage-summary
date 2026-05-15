import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
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

/**
 * Asks the OS for a free TCP port by binding to port 0 and reading
 * the assigned port back. Used to avoid the `Port 5173 already in
 * use` crash when a stale dev server (or anything else) is squatting
 * on the default port — strictPort: true in vite.config means we
 * can't just let vite roll forward to the next port itself.
 */
/**
 * Tries to bind on both the IPv4 and IPv6 loopback for a port — vite
 * listens on 'localhost' which on Windows resolves to ::1 (IPv6), so a
 * pure 127.0.0.1 probe would miss conflicts and we'd hand vite a port
 * that the OS still refuses. If either family is busy, fall back to a
 * random free port.
 */
function probeBoth(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const v4 = createServer();
    v4.unref();
    let v4Done = false;
    let v6Done = false;
    let busy = false;
    const finish = () => {
      if (v4Done && v6Done) resolve(!busy);
    };
    v4.once('error', () => {
      busy = true;
      v4Done = true;
      finish();
    });
    v4.listen(port, '127.0.0.1', () => {
      v4Done = true;
      v4.close(finish);
    });
    const v6 = createServer();
    v6.unref();
    v6.once('error', () => {
      busy = true;
      v6Done = true;
      finish();
    });
    v6.listen(port, '::1', () => {
      v6Done = true;
      v6.close(finish);
    });
  });
}

async function findFreePort(preferred: number): Promise<number> {
  if (await probeBoth(preferred)) return preferred;
  return new Promise<number>((resolve, reject) => {
    const s = createServer();
    s.unref();
    s.on('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const addr = s.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      s.close(() => resolve(port));
    });
  });
}

async function waitForUrl(url: string, timeoutMs = 30_000, rendererAlive?: () => boolean) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (rendererAlive && !rendererAlive()) {
      throw new Error(
        `Renderer dev server exited before becoming reachable at ${url}. Check the [renderer] output above for the real error (port conflict, vite plugin crash, etc.).`,
      );
    }
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

let electronStarted = false;

/**
 * Idempotent pre-flight: makes sure better-sqlite3 has been compiled
 * against the Electron 40 ABI before we boot the main process. If the
 * binary is already correct (marker file matches), this exits in
 * ~200ms; if it's stale (e.g. just ran vitest, which writes the Node
 * ABI), this swaps the binary via prebuild-install.
 *
 * Without this guard the user gets a cryptic
 * "Module compiled against different Node.js version" stack on the
 * very first IPC call — confusing and avoidable.
 */
function ensureElectronNatives(): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      npxCmd,
      ['tsx', 'scripts/install-natives.mts', '--runtime=electron', '--ensure'],
      {
        cwd: desktopRoot,
        env: { ...process.env, FORCE_COLOR: '1' },
        shell: isWindows,
      },
    );
    streamProcess('natives', '34', child);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`install-natives --ensure exited ${code ?? 'null'}`));
      }
    });
  });
}

async function main() {
  log('orchestrator', '36', 'Pre-flight · ensuring better-sqlite3 native matches Electron ABI...');
  await ensureElectronNatives();

  const port = await findFreePort(5173);
  const rendererUrl = `http://localhost:${port}`;
  if (port !== 5173) {
    log('orchestrator', '33', `Port 5173 busy — using ${port} instead`);
  }

  log('orchestrator', '36', `Starting playground dev server on ${rendererUrl}...`);
  let rendererExited = false;
  const renderer = spawn(pnpmCmd, ['dev'], {
    cwd: playgroundRoot,
    // PORT is read by vite.config.ts via `process.env.PORT ?? '5173'`.
    env: { ...process.env, FORCE_COLOR: '1', PORT: String(port) },
    // Node ≥ 18.20 / 20.12 refuses to spawn .bat / .cmd without
    // shell: true (CVE-2024-27980). We always go through the shell on
    // Windows; POSIX doesn't need it for the bare `pnpm` binary.
    shell: isWindows,
  });
  streamProcess('renderer', '32', renderer);
  renderer.on('exit', (code) => {
    rendererExited = true;
    log('renderer', '32', `exited with code ${code ?? 'null'}`);
    // Only short-circuit the orchestrator on early exit — once the
    // Electron window is up, the renderer may be killed deliberately
    // during shutdown, which we don't want to treat as an error.
    if (code !== 0 && !electronStarted) {
      process.exit(code ?? 1);
    }
  });

  await waitForUrl(rendererUrl, 30_000, () => !rendererExited);

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
  electronStarted = true;
  const electron = spawn(electronBin, ['.'], {
    cwd: desktopRoot,
    env: { ...process.env, RENDERER_DEV_URL: rendererUrl, NODE_ENV: 'development' },
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
