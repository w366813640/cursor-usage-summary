/**
 * Playwright UI verification for PR6 — privacy redaction (downloadable CSV)
 * and multi-CSV merge (`+ 合并 CSV` button). Uses the same CSV as PR5 but
 * uploads it twice so we can prove dedup logic.
 */

import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const csvFile = join(repoRoot, 'input', 'usage-events-2026-05-14.csv');
const outDir = join(repoRoot, '_temp', 'pr6-screenshots');
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 2200 },
  colorScheme: 'dark',
  deviceScaleFactor: 1,
  acceptDownloads: true,
});
const page = await ctx.newPage();

await ctx.addInitScript(() => {
  try {
    window.localStorage.setItem('cu-ui-theme', 'dark');
  } catch {
    /* ignore */
  }
});

const logs = [];
const pageErrors = [];
page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
page.on('pageerror', (err) => pageErrors.push(`[pageerror] ${err.message}`));

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });

const input = await page.$('input[type="file"]');
if (!input) throw new Error('file input missing');
await input.setInputFiles(csvFile);

await page.waitForFunction(
  () =>
    Array.from(document.querySelectorAll('button')).some((b) =>
      b.textContent?.includes('Overview'),
    ),
  { timeout: 15_000 },
);
await page.waitForTimeout(400);
await page.screenshot({ path: join(outDir, '01-toolbar-buttons.png'), fullPage: false });

// Look up the original CSV's row count so we can double-check dedup later.
const originalCsv = readFileSync(csvFile, 'utf8');
const originalLines = originalCsv.split(/\r?\n/).filter((l) => l.trim().length > 0).length;
console.log(`original CSV non-empty lines: ${originalLines}`);

// === Test 1: export redacted CSV ===
const [redactedDownload] = await Promise.all([
  page.waitForEvent('download'),
  page.locator('button:has-text("导出脱敏 CSV")').click(),
]);
const redactedPath = await redactedDownload.path();
console.log(`redacted CSV saved to: ${redactedPath}`);
const redactedText = readFileSync(redactedPath, 'utf8');
const redactedLines = redactedText.split(/\r?\n/).filter((l) => l.trim().length > 0).length;
console.log(`redacted CSV non-empty lines: ${redactedLines}`);

const headerRow = redactedText.split(/\r?\n/)[0];
console.log(`redacted header: ${headerRow}`);
const sample = redactedText.split(/\r?\n/).slice(1, 4).join('\n');
console.log('redacted sample rows:');
console.log(sample);

const hasAlias = /agent-[a-z0-9]{6}|auto-[a-z0-9]{6}/.test(redactedText);
console.log(`alias present: ${hasAlias}`);

// === Test 2: merge same CSV → should dedup to same row count ===
await page.locator('button:has-text("+ 合并 CSV")').click();
const inputForMerge = await page.$('input[type="file"]');
if (!inputForMerge) throw new Error('hidden file input gone');
await inputForMerge.setInputFiles(csvFile);

// Wait for the merge to settle — toolbar should show "2 files merged".
await page.waitForFunction(
  () =>
    Array.from(document.querySelectorAll('span')).some((s) =>
      s.textContent?.includes('2 files merged'),
    ),
  { timeout: 10_000 },
);
await page.waitForTimeout(400);
await page.screenshot({ path: join(outDir, '02-after-merge.png'), fullPage: false });

// === Test 3: verify dedup — total rows displayed should still match
// the original parse, not double. Read the "X parsed" pill.
const parsedText = await page.locator('span:has-text("parsed")').first().textContent();
console.log(`parsed pill text: ${parsedText}`);

// === Test 4: merged hover tooltip shows both filenames ===
const filePill = await page.locator('span:has-text("2 files merged")').first();
const titleAttr = await filePill.getAttribute('title');
console.log(`merged tooltip title: ${titleAttr}`);

await page.screenshot({ path: join(outDir, '03-full-after-merge.png'), fullPage: true });

console.log('\n=== captured page console (first 40 lines) ===');
for (const l of logs.slice(0, 40)) console.log(l);

if (pageErrors.length > 0) {
  console.log('\n=== PAGE ERRORS ===');
  for (const e of pageErrors) console.log(e);
} else {
  console.log('\nno page errors');
}

console.log(`\nscreenshots → ${outDir}\n`);

await browser.close();

if (pageErrors.length > 0) process.exit(1);
