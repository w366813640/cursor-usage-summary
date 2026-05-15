import { rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

/**
 * Bundle the Electron main + preload entry points with esbuild.
 *
 * We bundle (vs `tsc` straight emit) because the main process now
 * imports a workspace package (`@cu/storage`) whose source is TypeScript
 * shipping no `dist/`. Bundling collapses everything into a single
 * `dist/main/main.js` so the runtime never needs to resolve TS files.
 *
 * Externals:
 *
 *   - `electron` — provided by the Electron runtime itself; bundling
 *     it would break the host-supplied `app` / `BrowserWindow`.
 *   - `electron-updater` — keep dynamically importable, gated behind
 *     CU_AUTO_UPDATE=1 in updater.ts so the cold start doesn't pull it.
 *   - `better-sqlite3` — native module (.node binary); must stay
 *     external so dlopen() at runtime can find it under
 *     node_modules/better-sqlite3/build/Release/.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(__dirname, '..');
const outDir = path.join(desktopRoot, 'dist', 'main');

rmSync(outDir, { recursive: true, force: true });

const shared = {
  bundle: true,
  platform: 'node' as const,
  target: 'node20',
  format: 'cjs' as const,
  sourcemap: true,
  external: ['electron', 'electron-updater', 'better-sqlite3'],
  logLevel: 'info' as const,
};

await Promise.all([
  esbuild.build({
    ...shared,
    entryPoints: [path.join(desktopRoot, 'src', 'main.ts')],
    outfile: path.join(outDir, 'main.js'),
  }),
  esbuild.build({
    ...shared,
    entryPoints: [path.join(desktopRoot, 'src', 'preload.ts')],
    outfile: path.join(outDir, 'preload.js'),
  }),
]);
