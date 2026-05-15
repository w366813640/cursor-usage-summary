/**
 * PR13 E2E acceptance — verifies the Models + Hours polish round:
 *
 *  1. Upload CSV → Overview settles.
 *  2. Models route: capture sticky table + sort chip group, then expand the
 *     #1 row to confirm the new token-mix gradient drawer animation.
 *  3. Hours route: capture the date filter card, the peak-highlight bars,
 *     the upgraded #1 hot-slot card, then narrow to a single day and capture
 *     the SelectionDetailPanel summary chips + accent-rail rows.
 *  4. Light theme spot-check.
 *
 * Fails the run on any page error.
 */

import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const csvFile = join(repoRoot, 'input', 'usage-events-2026-05-14.csv');
const outDir = join(repoRoot, '_temp', 'pr13-screenshots');
mkdirSync(outDir, { recursive: true });

const baseUrl = 'http://127.0.0.1:5174';

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 1800 },
  colorScheme: 'dark',
  deviceScaleFactor: 1,
});
const page = await ctx.newPage();
const pageErrors = [];
page.on('pageerror', (err) => pageErrors.push(`[pageerror] ${err.message}`));
page.on('console', (msg) => {
  const t = msg.type();
  if (t === 'error' || t === 'warning') {
    console.log(`[console.${t}] ${msg.text()}`);
  }
});

const must = (cond, msg) => {
  if (!cond) throw new Error(`assertion failed: ${msg}`);
};

console.log('1. open + ingest CSV (force-replace any stored session)');
await page.goto(baseUrl);
await page.waitForLoadState('networkidle');
const fileInput = await page.$('input[type="file"]');
must(fileInput, 'file input missing');
await fileInput.setInputFiles(csvFile);

await page.waitForSelector('text=/Total cost/i', { timeout: 12000 });
await page.waitForTimeout(1700);
await page.screenshot({ path: join(outDir, '01-overview-settled.png'), fullPage: true });

console.log('2. Models route — sort chips + sticky thead');
await page.locator('nav[aria-label="Sections"] >> text=Models').first().click();
await page.waitForSelector('text=Models', { timeout: 6000 });
await page.waitForTimeout(700);
await page.screenshot({ path: join(outDir, '02-models-default.png'), fullPage: true });

console.log('   · expand #1 model row');
// Pick the first body row by clicking the model name cell.
const firstModelRow = page.locator('table >> tbody tr').first();
must(await firstModelRow.count(), 'no model rows rendered');
await firstModelRow.click();
await page.waitForTimeout(600);
await page.screenshot({ path: join(outDir, '03-models-row-expanded.png'), fullPage: true });

console.log('   · switch sort to tokens');
await page
  .getByRole('button', { name: /^tokens$/ })
  .first()
  .click();
await page.waitForTimeout(500);
await page.screenshot({ path: join(outDir, '04-models-sort-tokens.png'), fullPage: true });

console.log('3. Hours route — date filter + peak bars + hot slots');
await page.locator('nav[aria-label="Sections"] >> text=Hours').first().click();
await page.waitForSelector('text=Hours · when the money burns', { timeout: 6000 });
await page.waitForTimeout(900);
await page.screenshot({ path: join(outDir, '05-hours-default.png'), fullPage: true });

console.log('   · apply Last 7d preset');
await page
  .getByRole('button', { name: /^Last 7d$/ })
  .first()
  .click();
await page.waitForTimeout(500);
await page.screenshot({ path: join(outDir, '06-hours-last7d.png'), fullPage: true });

console.log('   · single-day click → Requests in selection panel');
const dayWithData = page.locator('button[title*="click to select"]').first();
must(await dayWithData.count(), 'no day-with-data button found');
await dayWithData.click();
await page.waitForTimeout(500);
await page.waitForSelector('text=Requests in selection', { timeout: 4000 });
const summaryStat = await page.locator('text=Avg / request').count();
must(summaryStat, 'selection summary stat missing');
await page.waitForTimeout(400);
await page.screenshot({ path: join(outDir, '07-hours-single-day-detail.png'), fullPage: true });

console.log('   · hover a row inside SelectionDetailPanel');
const detailRow = page
  .locator('text=Requests in selection')
  .locator('xpath=ancestor::div[contains(@class,"rounded-[14px]")][1]//tbody/tr')
  .first();
must(await detailRow.count(), 'no detail rows in selection panel');
await detailRow.hover();
await page.waitForTimeout(280);
await page.screenshot({ path: join(outDir, '08-hours-detail-row-hover.png'), fullPage: true });

console.log('4. light-theme spot check (Hours + Models)');
await page.locator('button[aria-label="Toggle theme"]').click();
await page.waitForTimeout(300);
await page.screenshot({ path: join(outDir, '09-hours-light.png'), fullPage: true });

await page.locator('nav[aria-label="Sections"] >> text=Models').first().click();
await page.waitForTimeout(600);
await page.screenshot({ path: join(outDir, '10-models-light.png'), fullPage: true });

if (pageErrors.length) {
  console.error('!!! page errors:');
  for (const e of pageErrors) console.error('  ', e);
  process.exitCode = 1;
}

await browser.close();
console.log('PR13 E2E done — screenshots →', outDir);
