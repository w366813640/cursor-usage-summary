import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const assetsDir = path.join(root, 'apps/playground/dist/assets');

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

const allAssets = readAssets();
const assets = allAssets.filter(
  (asset) => asset.name.endsWith('.js') || asset.name.endsWith('.css'),
);
const fontAssets = allAssets.filter((asset) => /\.(woff2?|ttf|otf)$/.test(asset.name));
const initial = assets.find((asset) => /^index-.*\.js$/.test(asset.name));
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
for (const asset of assets.slice(0, 14)) {
  console.log(`${asset.name.padEnd(48)} ${kb(asset.bytes).padStart(10)}`);
}
console.log('');

if (!initial) {
  console.error('Missing initial index JS chunk.');
  process.exitCode = 1;
} else {
  console.log(`Initial JS: ${kb(initial.bytes)} / ${kb(INITIAL_JS_LIMIT)} budget`);
  if (initial.bytes > INITIAL_JS_LIMIT) {
    console.error(`Initial JS exceeds budget by ${kb(initial.bytes - INITIAL_JS_LIMIT)}.`);
    process.exitCode = 1;
  }
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
