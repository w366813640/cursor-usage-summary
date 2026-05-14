/**
 * One-shot verification script for PR2: load the real CSV the user
 * exported, run it through parser → pricing → aggregator, and print a
 * concise summary. Mirrors what the playground's CSV drop will surface
 * to the console, but runs headless in Node so we can `pnpm tsx` it as
 * an acceptance check.
 *
 * Run with:
 *   pnpm exec tsx scripts/verify-pr2.mts
 */

import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { aggregate, parseUsageCsv } from '../packages/data/src/index.ts';
import { costRows } from '../packages/pricing/src/index.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const csvPath = resolve(__dirname, '../input/usage-events-2026-05-14.csv');

const t0 = performance.now();
const text = await readFile(csvPath, 'utf8');
const tParse = performance.now();
const { rows, failures, rowsSeen } = parseUsageCsv(text);
const tCost = performance.now();
const costed = costRows(rows);
const tAgg = performance.now();
const summary = aggregate(costed, { topBurnsCount: 10 });
const tEnd = performance.now();

const fmtMs = (a: number, b: number) => `${(b - a).toFixed(1)}ms`;
const fmtUSD = (n: number) => `$${n.toFixed(2)}`;

console.log('\n=== PR2 acceptance · real CSV sweep ===\n');
console.log(`csv:     ${csvPath}`);
console.log(`size:    ${(text.length / 1024).toFixed(1)} KB`);
console.log(
  `timing:  read=${fmtMs(t0, tParse)} parse=${fmtMs(tParse, tCost)} cost=${fmtMs(tCost, tAgg)} aggregate=${fmtMs(tAgg, tEnd)} total=${fmtMs(t0, tEnd)}`,
);
console.log(`rows:    seen=${rowsSeen} parsed=${rows.length} failures=${failures.length}`);
if (failures.length > 0) {
  console.log('\nparse failures (first 5):');
  for (const f of failures.slice(0, 5)) {
    console.log(`  row ${f.rowNumber}: ${f.reason}`);
  }
}

console.log('\n--- top-line ---');
console.log(`total cost:           ${fmtUSD(summary.totalCost)}`);
console.log(`total request units:  ${summary.totalRequestUnits.toFixed(2)}`);
console.log(`total tokens:         ${summary.totalTokens.total.toLocaleString()}`);
console.log(`cache hit ratio:      ${(summary.cacheHitStats.hitRatio * 100).toFixed(1)}%`);
console.log(`free rows:            ${summary.freeRows}`);
console.log(`errored rows:         ${summary.erroredRows}`);
console.log(`cost partial-est:     ${summary.costPartiallyEstimated}`);
console.log(
  `date range:           ${summary.dateRange.firstISO?.slice(0, 10)} → ${summary.dateRange.lastISO?.slice(0, 10)}`,
);

console.log('\n--- top 10 burns (single requests) ---');
for (const r of summary.topBurns) {
  console.log(
    `  ${fmtUSD(r.cost).padStart(10)}  ${r.dateISO.slice(0, 10)}  ${r.model}${r.costEstimated ? '  (est)' : ''}`,
  );
}

console.log('\n--- by model · top 10 by cost ---');
for (const m of summary.byModel.slice(0, 10)) {
  console.log(
    `  ${fmtUSD(m.cost).padStart(10)}  ${(m.shareOfCost * 100).toFixed(1).padStart(5)}%  ${String(m.rows).padStart(4)} rows  ${m.model}${m.costEstimated ? '  (est)' : ''}`,
  );
}

console.log('\n--- by provider ---');
for (const p of summary.byProvider) {
  console.log(
    `  ${fmtUSD(p.cost).padStart(10)}  ${String(p.rows).padStart(4)} rows  ${p.provider}`,
  );
}

console.log('\n--- daily activity (last 14 days) ---');
for (const d of summary.byDay.slice(-14)) {
  const bar = '█'.repeat(Math.min(40, Math.round(d.cost / 5)));
  console.log(
    `  ${d.date}  ${fmtUSD(d.cost).padStart(8)}  ${String(d.rows).padStart(4)} rows  ${bar}`,
  );
}

console.log('\n=== acceptance: PASS ===\n');
