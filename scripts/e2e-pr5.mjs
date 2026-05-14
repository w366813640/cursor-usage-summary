/**
 * Playwright UI verification for PR5 — 4-route shell (Overview / Models /
 * Details / Hours). Uploads the real CSV, navigates each tab, screenshots
 * dark + light, fails the run on any pageerror.
 */

import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const csvFile = join(repoRoot, 'input', 'usage-events-2026-05-14.csv');
const outDir = join(repoRoot, '_temp', 'pr5-screenshots');
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 2200 },
  colorScheme: 'dark',
  deviceScaleFactor: 1,
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

// Wait for the shell — NavTabs renders a "Overview" + "Models" button pair.
await page.waitForFunction(
  () => {
    const buttons = Array.from(document.querySelectorAll('button'));
    return (
      buttons.some((b) => b.textContent?.includes('Overview')) &&
      buttons.some((b) => b.textContent?.includes('Models'))
    );
  },
  { timeout: 15_000 },
);

await page.waitForTimeout(400);
await page.screenshot({ path: join(outDir, '01-overview-dark.png'), fullPage: true });

/** Click a NavTabs button by its English label. */
async function gotoTab(label, fileBase) {
  const btn = page.locator(`nav button:has-text("${label}")`);
  await btn.click();
  await page.waitForFunction(
    (expected) => window.location.hash.includes(expected),
    label.toLowerCase(),
  );
  await page.waitForTimeout(380);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: join(outDir, `${fileBase}-dark.png`), fullPage: true });
}

await gotoTab('Models', '02-models');
await gotoTab('Details', '03-details');
await gotoTab('Hours', '04-hours');

// Back to overview + flip theme.
await gotoTab('Overview', '05-overview-revisit');

await page.locator('button[aria-label="Toggle theme"]').click();
await page.waitForFunction(() => document.documentElement.getAttribute('data-theme') === 'light', {
  timeout: 5000,
});
await page.waitForTimeout(300);
await page.screenshot({ path: join(outDir, '06-overview-light.png'), fullPage: true });

await gotoTab('Models', '07-models-light');

console.log('\n=== captured page console (first 50 lines) ===');
for (const l of logs.slice(0, 50)) console.log(l);

if (pageErrors.length > 0) {
  console.log('\n=== PAGE ERRORS ===');
  for (const e of pageErrors) console.log(e);
} else {
  console.log('\nno page errors — all 4 routes mount cleanly');
}

console.log(`\nscreenshots → ${outDir}\n`);

await browser.close();

if (pageErrors.length > 0) process.exit(1);
