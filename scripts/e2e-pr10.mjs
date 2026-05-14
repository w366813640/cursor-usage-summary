/**
 * PR10 E2E smoke verification:
 *
 *  1. Upload CSV, capture the dashboard (no count-up clipping).
 *  2. Verify English-first labels in NavTabs ("Overview", "Hours", …).
 *  3. Capture the Overview "Hour × Weekday" panel and confirm it stays
 *     inside its grid column (no horizontal overflow).
 *  4. Reload page → expect the dashboard to *auto-restore*, NOT to bounce
 *     back to the welcome / restore-card screen.
 *  5. Hours route → exercise the new date filter: presets + single-day
 *     calendar click + range click. Confirm the filter summary updates.
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
const outDir = join(repoRoot, '_temp', 'pr10-screenshots');
mkdirSync(outDir, { recursive: true });

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

const baseUrl = 'http://127.0.0.1:5174';

const must = (cond, msg) => {
  if (!cond) {
    throw new Error(`assertion failed: ${msg}`);
  }
};

console.log('1. open welcome');
await page.goto(baseUrl);
await page.waitForLoadState('networkidle');
// Welcome should be in English now. If a stored session exists (carry-over
// from PR7+8 run) the dashboard will load directly — handle both cases.
const heroH1 = await page
  .locator('h1')
  .first()
  .innerText()
  .catch(() => '');
if (heroH1.includes('Cursor usage')) {
  console.log('  · welcome rendered (no prior session)');
  must(heroH1.includes('Make your Cursor'), `hero copy unexpected: ${heroH1}`);
}

await page.screenshot({ path: join(outDir, '01-boot.png'), fullPage: true });

console.log('2. upload CSV (replace any stored session)');
const input = await page.$('input[type="file"]');
must(input, 'file input missing');
await input.setInputFiles(csvFile);

await page.waitForSelector('text=/Total cost/i', { timeout: 12000 });
await page.waitForTimeout(1600);
await page.screenshot({ path: join(outDir, '02-overview-settled.png'), fullPage: true });

console.log('2b. confirm Monthly budget panel renders');
const budgetPanel = page.locator('text=Monthly request budget').first();
must(await budgetPanel.count(), 'Monthly budget panel missing');
const monthsTracked = await page.locator('text=/months? tracked/').first().innerText();
console.log(`  · ${monthsTracked}`);

console.log('3. confirm English NavTabs');
const navText = await page.locator('nav[aria-label="Sections"]').innerText();
must(/Overview/.test(navText), `expected Overview in nav: ${navText}`);
must(/Hours/.test(navText), `expected Hours in nav: ${navText}`);

console.log('4. measure Hour × Weekday panel — must not overflow its column');
const weekHourTitle = page.locator('text=Hour × Weekday').first();
must(await weekHourTitle.count(), 'Hour × Weekday panel missing on overview');
// Panel is a div with rounded-[14px] class. Grab it as the bounding container,
// then the SVG inside it.
const panelHandle = weekHourTitle.locator(
  'xpath=ancestor::div[contains(@class,"rounded-[14px]")][1]',
);
const panelBox = await panelHandle.boundingBox();
const svgBox = await panelHandle.locator('svg[role="img"]').first().boundingBox();
must(panelBox && svgBox, 'failed to measure panel/svg boxes');
must(
  svgBox.width <= panelBox.width + 1,
  `overflow detected: svg width ${svgBox.width} > panel width ${panelBox.width}`,
);
console.log(`  · svg ${svgBox.width.toFixed(0)} px ≤ panel ${panelBox.width.toFixed(0)} px ✓`);
await page.screenshot({ path: join(outDir, '03-overview-no-overflow.png'), fullPage: true });

console.log('5. reload — expect auto-restore (no welcome flash)');
// Give the void saveSession() promise a beat to finish the IDB write before
// we yank the page out from under it.
await page.waitForTimeout(800);
await page.reload();
await page.waitForTimeout(1500);
await page.screenshot({ path: join(outDir, '04a-post-reload-eager.png'), fullPage: true });
await page.waitForSelector('text=/Total cost/i', { timeout: 15000 });
const welcomeStillVisible = await page.locator('text=Make your Cursor usage').count();
must(welcomeStillVisible === 0, 'welcome hero leaked into post-reload state');
await page.waitForTimeout(1400);
await page.screenshot({ path: join(outDir, '04-reload-auto-restored.png'), fullPage: true });

console.log('6. open Hours route + verify new date filter');
await page.locator('nav[aria-label="Sections"] >> text=Hours').first().click();
await page.waitForSelector('text=Hours · when the money burns', { timeout: 6000 });
await page.waitForTimeout(800);
await page.screenshot({ path: join(outDir, '05-hours-default.png'), fullPage: true });

const allLabel = await page.locator('text=Date filter').first();
must(await allLabel.count(), 'Date filter section missing on Hours');

console.log('   · apply "Last 7d" preset');
await page
  .getByRole('button', { name: /^Last 7d$/ })
  .first()
  .click();
await page.waitForTimeout(500);
const selectionLabelText = await page.locator('text=Date filter').locator('xpath=..').innerText();
must(/→/.test(selectionLabelText), `range arrow missing after Last 7d: ${selectionLabelText}`);
await page.screenshot({ path: join(outDir, '06-hours-last7d.png'), fullPage: true });

console.log('   · click a single day in the calendar grid');
const dayWithData = await page.locator('button[title*="click to select"]').first();
must(await dayWithData.count(), 'no day-with-data button found in calendar');
await dayWithData.click();
await page.waitForTimeout(400);
// Single-day click should also surface the "Requests in selection" detail
// panel at the bottom (PR10 follow-up).
await page.waitForSelector('text=Requests in selection', { timeout: 4000 });
const detailRowCount = await page
  .locator('text=Requests in selection')
  .locator('xpath=ancestor::div[contains(@class,"rounded-[14px]")][1]//tbody/tr')
  .count();
must(detailRowCount > 0, 'expected at least one detail row for single-day filter');
console.log(`     · detail panel shows ${detailRowCount} rows`);
await page.screenshot({ path: join(outDir, '07-hours-single-day.png'), fullPage: true });

console.log('   · click another day → forms a range');
const dayButtons = page.locator('button[title*="click to select"]');
const dayCount = await dayButtons.count();
must(dayCount >= 2, 'need ≥ 2 days with data to test range');
await dayButtons.nth(Math.min(dayCount - 1, 5)).click();
await page.waitForTimeout(500);
await page.screenshot({ path: join(outDir, '08-hours-range.png'), fullPage: true });

console.log('   · clear selection');
await page.getByRole('button', { name: /^Clear selection$/ }).click();
await page.waitForTimeout(400);
await page.screenshot({ path: join(outDir, '09-hours-cleared.png'), fullPage: true });

console.log('7. light theme smoke + nav tour');
await page.locator('button[aria-label="Toggle theme"]').click();
await page.waitForTimeout(300);
await page.screenshot({ path: join(outDir, '10-hours-light.png'), fullPage: true });

await page.locator('nav[aria-label="Sections"] >> text=Models').first().click();
await page.waitForTimeout(700);
await page.screenshot({ path: join(outDir, '11-models-light.png'), fullPage: true });

await page.locator('nav[aria-label="Sections"] >> text=Details').first().click();
await page.waitForTimeout(700);
await page.screenshot({ path: join(outDir, '12-details-light.png'), fullPage: true });

if (pageErrors.length) {
  console.error('!!! page errors:');
  for (const e of pageErrors) console.error('  ', e);
  process.exitCode = 1;
}

await browser.close();
console.log('PR10 E2E done — screenshots →', outDir);
