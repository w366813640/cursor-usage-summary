/**
 * Playwright-driven UI verification for PR3 (@cu/charts).
 *
 *  1. Open the running playground (assumes `pnpm playground` is up).
 *  2. Upload the real CSV via the hidden file input.
 *  3. Wait for the Charts Preview section to appear (heading 'Charts 预览').
 *  4. Capture: initial-dark, after-upload-dark, charts-section-dark,
 *     charts-section-light.
 *  5. Toggle 'cost ↔ requests' on the calendar heatmap to verify reactivity.
 *  6. Dump page console + any pageerror so we can confirm zero runtime errors.
 */

import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const csvFile = join(repoRoot, 'input', 'usage-events-2026-05-14.csv');
const outDir = join(repoRoot, '_temp', 'pr3-screenshots');
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 1800 },
  colorScheme: 'dark',
  deviceScaleFactor: 1,
});
const page = await ctx.newPage();

const logs = [];
const pageErrors = [];
page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
page.on('pageerror', (err) => pageErrors.push(`[pageerror] ${err.message}`));

// Force the explicit 'dark' theme before first paint so that subsequent
// `toggle()` calls deterministically flip dark↔light (the default 'system'
// mode would otherwise need two clicks).
await ctx.addInitScript(() => {
  try {
    window.localStorage.setItem('cu-ui-theme', 'dark');
  } catch {
    /* incognito */
  }
});

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.screenshot({ path: join(outDir, '01-initial-dark.png'), fullPage: true });

const input = await page.$('input[type="file"]');
if (!input) throw new Error('file input not found on the page');
await input.setInputFiles(csvFile);

// Wait for KPIs first (cheap), then the Charts Preview heading.
await page.waitForFunction(
  () =>
    Array.from(document.querySelectorAll('h2')).some((h) => h.textContent?.includes('用量速览')),
  { timeout: 15_000 },
);
await page.waitForFunction(
  () =>
    Array.from(document.querySelectorAll('h2')).some((h) => h.textContent?.includes('Charts 预览')),
  { timeout: 15_000 },
);

// Give framer-motion a beat to settle before capturing.
await page.waitForTimeout(400);
await page.screenshot({ path: join(outDir, '02-uploaded-dark.png'), fullPage: true });

// Scroll Charts Preview into view and capture just that section.
const chartsHeader = await page.locator('h2:has-text("Charts 预览")');
await chartsHeader.scrollIntoViewIfNeeded();
await page.waitForTimeout(150);
const chartsSection = await page.locator('section', {
  has: page.locator('h2:has-text("Charts 预览")'),
});
await chartsSection.screenshot({ path: join(outDir, '03-charts-dark.png') });

// Flip calendar metric: cost → requests.
const requestsToggle = await page.locator('button:has-text("requests")').first();
await requestsToggle.click();
await page.waitForTimeout(200);
await chartsSection.screenshot({ path: join(outDir, '04-charts-dark-requests.png') });

// Switch to light theme via the theme toggle in the top chrome. The toggle
// lives in a sticky-ish header — scroll to top first so the click target is
// guaranteed visible regardless of where Charts Preview ended up.
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(100);
await page.locator('button[aria-label="Toggle theme"]').click();
await page.waitForFunction(() => document.documentElement.getAttribute('data-theme') === 'light', {
  timeout: 5000,
});
await page.waitForTimeout(200);
await chartsHeader.scrollIntoViewIfNeeded();
await page.waitForTimeout(150);
await chartsSection.screenshot({ path: join(outDir, '05-charts-light.png') });
await page.screenshot({ path: join(outDir, '06-uploaded-light.png'), fullPage: true });

console.log('\n=== captured page console (first 50 lines) ===');
for (const l of logs.slice(0, 50)) console.log(l);

if (pageErrors.length > 0) {
  console.log('\n=== PAGE ERRORS (FAIL) ===');
  for (const e of pageErrors) console.log(e);
} else {
  console.log('\nno page errors — PR3 charts mount cleanly');
}

console.log(`\nscreenshots → ${outDir}\n`);

await browser.close();

if (pageErrors.length > 0) {
  process.exit(1);
}
