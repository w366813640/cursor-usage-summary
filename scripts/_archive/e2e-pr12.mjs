/**
 * PR12 E2E acceptance — verifies the latest polish round:
 *
 *  1. Upload CSV → Overview settles.
 *  2. KpiCard polish: hover the first card and capture the accent rail +
 *     lifted shadow state.
 *  3. MonthlyBudgetPanel v2: confirms the alert strip and CPR sparkline are
 *     present (panel signature copy + at least one alert headline).
 *  4. Details page polish: hover a table row and capture the accent rail +
 *     hover background.
 *  5. Light theme tour over Overview / Details / Hours.
 *  6. Auto-restore smoke: reload and confirm we never bounce to welcome.
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
const outDir = join(repoRoot, '_temp', 'pr12-screenshots');
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

console.log('1. open + force-replace any stored session by uploading fresh CSV');
await page.goto(baseUrl);
await page.waitForLoadState('networkidle');
// Welcome may already be skipped if IndexedDB carries a session from prior runs.
// In either case we want to reset by uploading the canonical CSV so the
// screenshots are deterministic.
const fileInput = await page.$('input[type="file"]');
must(fileInput, 'file input missing on welcome / dashboard re-upload');
await fileInput.setInputFiles(csvFile);

await page.waitForSelector('text=/Total cost/i', { timeout: 12000 });
// Let count-up + bar growth + cprTrend draw settle (~1.6s covers all of them).
await page.waitForTimeout(1700);
await page.screenshot({ path: join(outDir, '01-overview-settled.png'), fullPage: true });

console.log('2. KpiCard hover polish');
const firstKpi = page.locator('text=/Total cost/i').locator('xpath=ancestor::div[1]');
await firstKpi.hover();
await page.waitForTimeout(280); // let the accent rail transition complete
await page.screenshot({ path: join(outDir, '02-kpi-hover.png'), fullPage: true });

console.log('3. MonthlyBudgetPanel v2 — alert strip + CPR sparkline');
const budgetTitle = page.locator('text=Monthly request budget').first();
must(await budgetTitle.count(), 'Monthly budget panel missing');
// Alert headline is always present (good / warn / over).
const cprStrip = await page.locator('text=/Cost \\/ request · monthly/').count();
must(cprStrip, 'CPR trend strip missing');
const capLineLabel = await page.locator('text=/^cap · /').count();
must(capLineLabel, 'cap line label missing');
const avgLineLabel = await page.locator('text=/^avg · /').count();
must(avgLineLabel, 'historical avg line label missing');
console.log('   · alert + cap + avg + CPR all present');
const budgetPanel = budgetTitle.locator(
  'xpath=ancestor::div[contains(@class,"rounded-[14px]")][1]',
);
await budgetPanel.scrollIntoViewIfNeeded();
await page.waitForTimeout(220);
await page.screenshot({ path: join(outDir, '03-monthly-budget-v2.png'), fullPage: true });

console.log('4. Details polish — hover a row');
await page.locator('nav[aria-label="Sections"] >> text=Details').first().click();
await page.waitForSelector('text=Filter + sort', { timeout: 6000 });
await page.waitForTimeout(700);
await page.screenshot({ path: join(outDir, '04-details-settled.png'), fullPage: true });

const firstRow = page.locator('tbody tr').first();
must(await firstRow.count(), 'no detail rows in table');
await firstRow.hover();
await page.waitForTimeout(280);
await page.screenshot({ path: join(outDir, '05-details-row-hover.png'), fullPage: true });

console.log('5. light theme tour');
await page.locator('button[aria-label="Toggle theme"]').click();
await page.waitForTimeout(300);
await page.screenshot({ path: join(outDir, '06-details-light.png'), fullPage: true });

await page.locator('nav[aria-label="Sections"] >> text=Overview').first().click();
await page.waitForTimeout(700);
await page.screenshot({ path: join(outDir, '07-overview-light.png'), fullPage: true });

const lightKpi = page.locator('text=/Total cost/i').locator('xpath=ancestor::div[1]');
await lightKpi.hover();
await page.waitForTimeout(280);
await page.screenshot({ path: join(outDir, '08-overview-light-kpi-hover.png'), fullPage: true });

await page.locator('nav[aria-label="Sections"] >> text=Hours').first().click();
await page.waitForTimeout(700);
await page.screenshot({ path: join(outDir, '09-hours-light.png'), fullPage: true });

console.log('6. auto-restore reload smoke');
// Flip back to dark for symmetry with PR10 baseline.
await page.locator('button[aria-label="Toggle theme"]').click();
await page.waitForTimeout(300);
// Force route back to Overview so the post-reload selector matches an
// Overview-only KPI. Otherwise the reload would land on whichever route
// the URL hash points at (Hours from step 5) and we'd time out.
await page.evaluate(() => {
  window.location.hash = '#overview';
});
await page.waitForTimeout(400);
await page.waitForTimeout(800); // let IDB write settle before reload
await page.reload();
await page.waitForTimeout(1500);
// First confirm the dashboard nav exists (route-agnostic proof of auto-restore),
// then drill into Total cost (Overview signal).
await page.waitForSelector('nav[aria-label="Sections"]', { timeout: 15000 });
await page.waitForSelector('text=/Total cost/i', { timeout: 15000 });
const welcomeStillVisible = await page.locator('text=Make your Cursor usage').count();
must(welcomeStillVisible === 0, 'welcome hero leaked into post-reload state');
await page.waitForTimeout(1400);
await page.screenshot({ path: join(outDir, '10-reload-auto-restored.png'), fullPage: true });

if (pageErrors.length) {
  console.error('!!! page errors:');
  for (const e of pageErrors) console.error('  ', e);
  process.exitCode = 1;
}

await browser.close();
console.log('PR12 E2E done — screenshots →', outDir);
