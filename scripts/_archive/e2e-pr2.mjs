/**
 * Playwright-driven UI verification for PR2.
 *
 *  1. Open the running playground (assumes `pnpm playground` is up).
 *  2. setInputFiles() on the hidden <input type="file"> with the real CSV.
 *  3. Wait for the KPI cards to flip from mock numbers to "你的用量速览"
 *     with real totals.
 *  4. Screenshot dark + light theme.
 *  5. Dump the page console log so we can verify the `console.groupCollapsed`
 *     summary actually printed.
 */

import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const csvFile = join(repoRoot, 'input', 'usage-events-2026-05-14.csv');
const outDir = join(repoRoot, '_temp', 'pr2-screenshots');

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 1400 },
  colorScheme: 'dark',
});
const page = await ctx.newPage();

const logs = [];
page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.screenshot({ path: join(outDir, '01-initial-dark.png'), fullPage: true });

const input = await page.$('input[type="file"]');
if (!input) throw new Error('file input not found on the page');
await input.setInputFiles(csvFile);

await page.waitForFunction(
  () =>
    Array.from(document.querySelectorAll('h2')).some((h) => h.textContent?.includes('用量速览')),
  { timeout: 10_000 },
);

await page.screenshot({ path: join(outDir, '02-uploaded-dark.png'), fullPage: true });

await page.click('button[aria-label="Toggle theme"]');
await page.waitForTimeout(200);
await page.screenshot({ path: join(outDir, '03-uploaded-light.png'), fullPage: true });

console.log('\n=== captured page console (first 40 lines) ===');
for (const l of logs.slice(0, 40)) console.log(l);
console.log(`\nscreenshots → ${outDir}\n`);

await browser.close();
