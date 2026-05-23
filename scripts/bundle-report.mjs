import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const assetsDir = path.join(root, 'apps/playground/dist/assets');

const INITIAL_JS_LIMIT = 650 * 1024;
const ROUTE_CHUNKS = ['AnomaliesPage', 'DetailsPage', 'ModelsPage', 'YearReviewPage', 'HoursPage'];

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
      .filter((asset) => asset.name.endsWith('.js') || asset.name.endsWith('.css'))
      .sort((a, b) => b.bytes - a.bytes);
  } catch (err) {
    throw new Error(
      `Cannot read ${assetsDir}. Run "pnpm --filter @cu/playground build" before bundle:report. ${err}`,
    );
  }
}

const assets = readAssets();
const initial = assets.find((asset) => /^index-.*\.js$/.test(asset.name));
const missingRoutes = ROUTE_CHUNKS.filter(
  (chunk) =>
    !assets.some((asset) => asset.name.startsWith(`${chunk}-`) && asset.name.endsWith('.js')),
);

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
