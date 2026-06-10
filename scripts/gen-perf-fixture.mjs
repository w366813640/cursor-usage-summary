/**
 * Synthetic usage-events CSV generator for performance testing (perf plan Phase 0).
 *
 *   node scripts/gen-perf-fixture.mjs [--rows 100000] [--days 365] [--out path.csv]
 *
 * Produces a CSV with the exact column set `parseUsageCsv` expects, using a
 * deterministic seeded RNG so two runs yield identical files (stable perf
 * comparisons). Model names are real Cursor model ids so the pricing
 * matcher takes its normal path instead of the Auto-pool fallback.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
function argOf(flag, fallback) {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : fallback;
}

const ROWS = Number(argOf('--rows', '100000'));
const DAYS = Number(argOf('--days', '365'));
const OUT = path.resolve(root, argOf('--out', '_temp/perf-fixture/usage-events-perf.csv'));

/** mulberry32 — tiny deterministic PRNG. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(0xc0ffee);

/** Weighted pick helper. */
function pick(entries) {
  const total = entries.reduce((acc, [, w]) => acc + w, 0);
  let roll = rand() * total;
  for (const [value, w] of entries) {
    roll -= w;
    if (roll <= 0) return value;
  }
  return entries[entries.length - 1][0];
}

const MODELS = [
  ['claude-4.5-sonnet-thinking', 30],
  ['claude-4-sonnet-thinking', 18],
  ['gpt-5', 14],
  ['auto', 12],
  ['gemini-2.5-pro', 8],
  ['claude-4.5-haiku', 7],
  ['o3', 4],
  ['grok-4', 3],
  ['deepseek-v3.1', 2],
  ['composer-1', 2],
];

const KINDS = [
  ['Included', 90],
  ['Errored, No Charge', 4],
  ['Aborted, Not Charged', 3],
  ['Free', 3],
];

/** Log-normal-ish token magnitude: most rows small, a fat tail of monsters. */
function tokenMagnitude() {
  const r = rand();
  if (r < 0.6) return 1;
  if (r < 0.9) return 6;
  if (r < 0.99) return 30;
  return 160;
}

const HEADER =
  'Date,Cloud Agent ID,Automation ID,Kind,Model,Max Mode,"Input (w/ Cache Write)","Input (w/o Cache Write)",Cache Read,Output Tokens,Total Tokens,Requests';

const endMs = Date.UTC(2026, 5, 1);
const startMs = endMs - DAYS * 86_400_000;

const lines = new Array(ROWS + 1);
lines[0] = HEADER;

for (let i = 0; i < ROWS; i++) {
  // Cluster activity into working hours-ish with day-level burstiness.
  const dayOffset = Math.floor(rand() * DAYS);
  const hour = Math.floor(6 + rand() * 16);
  const minute = Math.floor(rand() * 60);
  const second = Math.floor(rand() * 60);
  const ts = new Date(
    startMs + dayOffset * 86_400_000 + ((hour * 60 + minute) * 60 + second) * 1000,
  );

  const kind = pick(KINDS);
  const model = kind === 'Free' ? 'auto' : pick(MODELS);
  const maxMode = rand() < 0.08 ? 'Yes' : 'No';

  const mag = tokenMagnitude();
  const cacheRead = Math.floor(rand() * 90_000 * mag);
  const inputWithCacheWrite = Math.floor(rand() * 18_000 * mag);
  const inputWithoutCacheWrite = Math.floor(rand() * 4_000 * mag);
  const output = Math.floor(rand() * 6_000 * mag);
  const total = cacheRead + inputWithCacheWrite + inputWithoutCacheWrite + output;

  const requests =
    kind === 'Errored, No Charge' || kind === 'Aborted, Not Charged'
      ? '-'
      : kind === 'Free'
        ? 'Free'
        : (rand() < 0.85 ? 1 : Math.ceil(rand() * 4)).toFixed(0);

  lines[i + 1] =
    `${ts.toISOString()},,,"${kind}",${model},${maxMode},${inputWithCacheWrite},${inputWithoutCacheWrite},${cacheRead},${output},${total},${requests}`;
}

mkdirSync(path.dirname(OUT), { recursive: true });
writeFileSync(OUT, `${lines.join('\n')}\n`, 'utf-8');

console.log(`wrote ${ROWS} rows spanning ${DAYS} days → ${OUT}`);
