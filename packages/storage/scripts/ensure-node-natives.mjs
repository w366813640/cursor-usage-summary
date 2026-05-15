/**
 * Pretest hook for `@cu/storage` — guarantees better-sqlite3 has the
 * Node-ABI binary before vitest spawns. If it doesn't (e.g. the user
 * just ran `pnpm desktop:dev`, which leaves an Electron-ABI binary
 * behind), we shell out to the desktop app's `install-natives:ensure-node`
 * script, which is idempotent and ~no-op when the binary is already
 * correct (it reads a marker file at build/Release/.cu-runtime.json).
 *
 * The alternative — failing the test run with a NODE_MODULE_VERSION
 * mismatch — was the #1 reported confusion point during PR15–PR19, so
 * trading a ~200ms preflight for a clean DX is worth it.
 */

import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../../..');
const isWindows = process.platform === 'win32';

await new Promise((resolveFn, rejectFn) => {
  const child = spawn(
    isWindows ? 'pnpm.cmd' : 'pnpm',
    ['--filter', '@cu/desktop', 'install-natives:ensure-node'],
    {
      cwd: repoRoot,
      stdio: 'inherit',
      shell: isWindows,
    },
  );
  child.on('exit', (code) => {
    if (code === 0) resolveFn();
    else rejectFn(new Error(`ensure-node-natives exited ${code ?? 'null'}`));
  });
});
