/**
 * Playwright UI verification for PR4 (OverviewPage + BurnStoryCard).
 *
 *   1. Open the running playground.
 *   2. Upload the real CSV.
 *   3. Wait for the Top 5 burn stories section (the post-PR4 marker).
 *   4. Capture: initial-dark, overview-dark, burns-only-dark, overview-light.
 *   5. Toggle calendar metric and theme to confirm reactivity.
 *   6. Fail the run if any pageerror fires.
 */

import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const csvFile = join(repoRoot, 'input', 'usage-events-2026-05-14.csv');
const outDir = join(repoRoot, '_temp', 'pr4-screenshots');
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 2000 },
  colorScheme: 'dark',
  deviceScaleFactor: 1,
});
const page = await ctx.newPage();

await ctx.addInitScript(() => {
  try {
    window.localStorage.setItem('cu-ui-theme', 'dark');
  } catch {
    /* incognito */
  }
});

const logs = [];
const pageErrors = [];
page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
page.on('pageerror', (err) => pageErrors.push(`[pageerror] ${err.message}`));

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.screenshot({ path: join(outDir, '01-initial-dark.png'), fullPage: true });

const input = await page.$('input[type="file"]');
if (!input) throw new Error('file input not found on the page');
await input.setInputFiles(csvFile);

// PR4 marker — "Top 5 烧钱请求" only appears in OverviewPage's Act 3.
await page.waitForFunction(
  () =>
    Array.from(document.querySelectorAll('h2')).some((h) =>
      h.textContent?.includes('Top 5 烧钱请求'),
    ),
  { timeout: 15_000 },
);

// Give the layered framer-motion delays a beat to settle.
await page.waitForTimeout(450);
await page.screenshot({ path: join(outDir, '02-overview-dark.png'), fullPage: true });

// Scroll to and screenshot the burns section alone.
const burnsHeader = await page.locator('h2:has-text("Top 5 烧钱请求")');
await burnsHeader.scrollIntoViewIfNeeded();
await page.waitForTimeout(150);
const burnsSection = await page.locator('section', {
  has: page.locator('h2:has-text("Top 5 烧钱请求")'),
});
await burnsSection.screenshot({ path: join(outDir, '03-burns-dark.png') });

// Flip the calendar metric to confirm interaction works.
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(100);
const requestsToggle = await page.locator('button:has-text("requests")').first();
await requestsToggle.click();
await page.waitForTimeout(200);

// Switch to light theme.
await page.locator('button[aria-label="Toggle theme"]').click();
await page.waitForFunction(() => document.documentElement.getAttribute('data-theme') === 'light', {
  timeout: 5000,
});
await page.waitForTimeout(200);
await page.screenshot({ path: join(outDir, '04-overview-light.png'), fullPage: true });
await burnsHeader.scrollIntoViewIfNeeded();
await page.waitForTimeout(150);
await burnsSection.screenshot({ path: join(outDir, '05-burns-light.png') });

console.log('\n=== captured page console (first 50 lines) ===');
for (const l of logs.slice(0, 50)) console.log(l);

if (pageErrors.length > 0) {
  console.log('\n=== PAGE ERRORS ===');
  for (const e of pageErrors) console.log(e);
} else {
  console.log('\nno page errors — PR4 overview mounts cleanly');
}

console.log(`\nscreenshots → ${outDir}\n`);

await browser.close();

if (pageErrors.length > 0) {
  process.exit(1);
}
