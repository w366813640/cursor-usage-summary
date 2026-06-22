import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const distDir = path.join(root, 'apps/playground/dist');
const assetsDir = path.join(distDir, 'assets');
const indexHtmlPath = path.join(distDir, 'index.html');

// Budget is on the *true* first-paint JS: the entry chunk plus every chunk
// the entry preloads (modulepreload). That is what the browser must fetch
// before the app is interactive, regardless of how Rollup names the chunks.
const INITIAL_JS_LIMIT = 650 * 1024;
const ROUTE_CHUNKS = ['AnomaliesPage', 'DetailsPage', 'ModelsPage', 'YearReviewPage', 'HoursPage'];
// Overlay surfaces split out in perf plan 4.1 — regression here means an
// eager import crept back in and the drawer code ships in the first paint.
const OVERLAY_CHUNKS = [
  'SettingsDrawer',
  'ImportHistoryDrawer',
  'ImportPreviewDrawer',
  'OnboardingTour',
];
// zh dictionary chunk (perf plan 4.3) — must stay out of the initial JS.
const ZH_DICT_PATTERN = /dictionaries[._-]zh/;
// Latin + latin-ext subsets × 3 families (perf plan 4.2). More woff2 files
// than this means someone re-imported a full @fontsource index.css.
const MAX_FONT_FILES = 6;

function kb(bytes) {
  return `${(bytes / 1024).toFixed(1)} kB`;
}

function gzipBytes(fullPath) {
  return gzipSync(readFileSync(fullPath)).length;
}

function readAssets() {
  try {
    return readdirSync(assetsDir)
      .map((name) => {
        const fullPath = path.join(assetsDir, name);
        return { name, bytes: statSync(fullPath).size };
      })
      .sort((a, b) => b.bytes - a.bytes);
  } catch (err) {
    throw new Error(
      `Cannot read ${assetsDir}. Run "pnpm --filter @cu/playground build" before bundle:report. ${err}`,
    );
  }
}

/**
 * The first-paint set is whatever index.html makes the browser fetch up
 * front: the module entry `<script src>` plus every `<link
 * rel="modulepreload">`. Parsing the HTML (instead of hardcoding chunk
 * names) keeps this honest as Rollup's manualChunks evolve — a new eager
 * vendor chunk shows up here automatically.
 */
function readFirstPaintRefs() {
  let html;
  try {
    html = readFileSync(indexHtmlPath, 'utf8');
  } catch (err) {
    throw new Error(
      `Cannot read ${indexHtmlPath}. Run "pnpm --filter @cu/playground build" before bundle:report. ${err}`,
    );
  }
  const js = new Set();
  const css = new Set();
  for (const m of html.matchAll(/<script[^>]+\bsrc="\.\/assets\/([^"]+\.js)"/g)) js.add(m[1]);
  for (const m of html.matchAll(
    /<link[^>]+rel="modulepreload"[^>]+href="\.\/assets\/([^"]+\.js)"/g,
  )) {
    js.add(m[1]);
  }
  for (const m of html.matchAll(
    /<link[^>]+rel="stylesheet"[^>]+href="\.\/assets\/([^"]+\.css)"/g,
  )) {
    css.add(m[1]);
  }
  return { js: [...js], css: [...css] };
}

function measure(names) {
  const rows = names
    .map((name) => {
      const fullPath = path.join(assetsDir, name);
      return { name, bytes: statSync(fullPath).size, gzip: gzipBytes(fullPath) };
    })
    .sort((a, b) => b.bytes - a.bytes);
  const raw = rows.reduce((acc, r) => acc + r.bytes, 0);
  const gzip = rows.reduce((acc, r) => acc + r.gzip, 0);
  return { rows, raw, gzip };
}

const allAssets = readAssets();
const assets = allAssets.filter(
  (asset) => asset.name.endsWith('.js') || asset.name.endsWith('.css'),
);
const fontAssets = allAssets.filter((asset) => /\.(woff2?|ttf|otf)$/.test(asset.name));

const firstPaint = readFirstPaintRefs();
const eagerJs = measure(firstPaint.js);
const eagerCss = measure(firstPaint.css);
const entry = eagerJs.rows.find((r) => /^index-.*\.js$/.test(r.name));

const missingRoutes = ROUTE_CHUNKS.filter(
  (chunk) =>
    !assets.some((asset) => asset.name.startsWith(`${chunk}-`) && asset.name.endsWith('.js')),
);
const missingOverlays = OVERLAY_CHUNKS.filter(
  (chunk) =>
    !assets.some((asset) => asset.name.startsWith(`${chunk}-`) && asset.name.endsWith('.js')),
);
const zhChunk = assets.find((asset) => ZH_DICT_PATTERN.test(asset.name));

console.log('Bundle report: apps/playground/dist/assets');
console.log('');
console.log('First-paint JS (entry + modulepreload):');
for (const row of eagerJs.rows) {
  console.log(
    `  ${row.name.padEnd(40)} ${kb(row.bytes).padStart(10)}  gzip ${kb(row.gzip).padStart(9)}`,
  );
}
console.log('');

if (eagerJs.rows.length === 0 || !entry) {
  console.error('Could not resolve the first-paint JS set from index.html.');
  process.exitCode = 1;
} else {
  console.log(
    `Initial JS (first paint): ${kb(eagerJs.raw)} raw / ${kb(eagerJs.gzip)} gzip  ` +
      `(${eagerJs.rows.length} chunks) / ${kb(INITIAL_JS_LIMIT)} budget`,
  );
  if (eagerJs.raw > INITIAL_JS_LIMIT) {
    console.error(`First-paint JS exceeds budget by ${kb(eagerJs.raw - INITIAL_JS_LIMIT)}.`);
    process.exitCode = 1;
  }
}
console.log(
  `First-paint CSS: ${kb(eagerCss.raw)} raw / ${kb(eagerCss.gzip)} gzip (${eagerCss.rows.length} files)`,
);
console.log('');

const largestLazy = assets
  .filter((a) => !firstPaint.js.includes(a.name) && !firstPaint.css.includes(a.name))
  .slice(0, 8);
if (largestLazy.length > 0) {
  console.log('Largest lazy chunks:');
  for (const asset of largestLazy) {
    console.log(`  ${asset.name.padEnd(40)} ${kb(asset.bytes).padStart(10)}`);
  }
  console.log('');
}

if (missingRoutes.length > 0) {
  console.error(`Missing lazy route chunks: ${missingRoutes.join(', ')}`);
  process.exitCode = 1;
} else {
  console.log(`Lazy route chunks present: ${ROUTE_CHUNKS.join(', ')}`);
}

if (missingOverlays.length > 0) {
  console.error(
    `Missing lazy overlay chunks (eager import regression?): ${missingOverlays.join(', ')}`,
  );
  process.exitCode = 1;
} else {
  console.log(`Lazy overlay chunks present: ${OVERLAY_CHUNKS.join(', ')}`);
}

if (!zhChunk) {
  console.error('Missing lazy zh dictionary chunk — it may have been inlined into the initial JS.');
  process.exitCode = 1;
} else {
  console.log(`zh dictionary chunk: ${zhChunk.name} (${kb(zhChunk.bytes)})`);
}

const fontTotal = fontAssets.reduce((acc, f) => acc + f.bytes, 0);
console.log(`Fonts: ${fontAssets.length} files / ${MAX_FONT_FILES} budget (${kb(fontTotal)})`);
if (fontAssets.length > MAX_FONT_FILES) {
  console.error(
    'Font file count exceeds budget — only latin/latin-ext subsets should ship (see src/fonts.css).',
  );
  process.exitCode = 1;
}
