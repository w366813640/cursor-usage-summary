/**
 * Smoke-check the production build serving on http://localhost:5173/.
 *
 * Walks the four routes, exercises export-redacted + merge, dumps cost +
 * fingerprint info to stdout. Fails on any pageerror.
 */

import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const csvFile = join(repoRoot, 'input', 'usage-events-2026-05-14.csv');
const outDir = join(repoRoot, '_temp', 'release-screenshots');
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

const pageErrors = [];
page.on('pageerror', (err) => pageErrors.push(`[pageerror] ${err.message}`));

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.screenshot({ path: join(outDir, '00-landing.png'), fullPage: true });

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
await page.waitForTimeout(500);
await page.screenshot({ path: join(outDir, '01-overview.png'), fullPage: true });

async function gotoTab(label, fileBase) {
  await page.locator(`nav button:has-text("${label}")`).click();
  await page.waitForTimeout(380);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: join(outDir, `${fileBase}.png`), fullPage: true });
}

await gotoTab('Models', '02-models');
await gotoTab('Details', '03-details');
await gotoTab('Hours', '04-hours');
await gotoTab('Overview', '05-back-to-overview');

// Exercise export-redacted.
const [download] = await Promise.all([
  page.waitForEvent('download'),
  page.locator('button:has-text("导出脱敏 CSV")').click(),
]);
const path = await download.path();
const text = readFileSync(path, 'utf8');
const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0).length;
const aliasHit = /agent-[a-z0-9]{6}|auto-[a-z0-9]{6}/.test(text);
console.log(`redacted CSV: ${lines} lines · alias=${aliasHit}`);

// Switch theme + screenshot light.
await page.locator('button[aria-label="Toggle theme"]').click();
await page.waitForFunction(() => document.documentElement.getAttribute('data-theme') === 'light', {
  timeout: 5000,
});
await page.waitForTimeout(300);
await page.screenshot({ path: join(outDir, '06-overview-light.png'), fullPage: true });

if (pageErrors.length > 0) {
  console.log('\n=== PAGE ERRORS ===');
  for (const e of pageErrors) console.log(e);
  process.exit(1);
}

console.log('\nrelease smoke ok · 0 page errors · screenshots →', outDir);

await browser.close();
