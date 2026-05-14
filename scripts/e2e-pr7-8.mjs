/**
 * PR7+8 E2E smoke verification:
 *
 *  1. Upload CSV, capture the animated KPI hero (mid-animation + settled).
 *  2. Sanity-check Chinese-first labels are visible (no English "Total cost" etc).
 *  3. Switch between routes — verify each animates / lands cleanly.
 *  4. Toggle light / dark theme and capture both.
 *  5. Reload the page → expect the "继续上次的看板" hint card to surface.
 *  6. Click "继续上次的看板" → expect the dashboard to come back hydrated.
 *  7. Clear local storage from the toolbar → expect the idle screen.
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
const outDir = join(repoRoot, '_temp', 'pr7-8-screenshots');
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

const baseUrl = 'http://localhost:5174';

console.log('1. open welcome');
await page.goto(baseUrl);
await page.waitForLoadState('networkidle');
await page.screenshot({ path: join(outDir, '01-welcome-dark.png'), fullPage: true });

const heroText = await page.locator('h1').first().innerText();
if (!heroText.includes('Cursor')) {
  console.warn('  ! hero text did not contain "Cursor":', heroText);
}

console.log('2. upload CSV');
const input = await page.$('input[type="file"]');
if (!input) throw new Error('file input missing');
await input.setInputFiles(csvFile);
await page.waitForSelector('text=总花费 USD', { timeout: 12000 });

// Catch the count-up animation mid-flight by sampling within the first 600ms.
await page.waitForTimeout(220);
await page.screenshot({ path: join(outDir, '02-kpi-midanim.png'), fullPage: false });
await page.waitForTimeout(1300);
await page.screenshot({ path: join(outDir, '03-overview-settled-dark.png'), fullPage: true });

// Inspect Chinese tokens to confirm i18n.
const navText = await page.locator('nav[aria-label="Sections"]').innerText();
console.log('  nav:', navText.replace(/\s+/g, ' '));
for (const expected of ['总览', '模型', '明细', '时段']) {
  if (!navText.includes(expected)) {
    throw new Error(`nav missing Chinese label "${expected}": ${navText}`);
  }
}

console.log('3. tour routes');
for (const [route, expectedHeader] of [
  ['models', '模型表现'],
  ['details', '所有请求 · 明细'],
  ['hours', '时段画像'],
]) {
  await page.click(
    `nav button:has-text("${route === 'models' ? '模型' : route === 'details' ? '明细' : '时段'}")`,
  );
  await page.waitForSelector(`text=${expectedHeader}`, { timeout: 6000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(outDir, `04-${route}-dark.png`), fullPage: true });
}

console.log('4. back to overview + light theme');
await page.click('nav button:has-text("总览")');
await page.waitForSelector('text=总花费 USD');
await page.waitForTimeout(400);
await page.click('button[aria-label="Toggle theme"]');
await page.waitForTimeout(300);
await page.screenshot({ path: join(outDir, '05-overview-light.png'), fullPage: true });

console.log('5. reload → expect restore card');
await page.reload();
await page.waitForLoadState('networkidle');
await page.waitForSelector('text=检测到本地有上次的数据', { timeout: 6000 });
await page.screenshot({ path: join(outDir, '06-welcome-restore-light.png'), fullPage: true });

console.log('6. click 继续上次的看板');
await page.click('button:has-text("继续上次的看板")');
await page.waitForSelector('text=已从本地恢复上次的数据', { timeout: 6000 });
await page.waitForTimeout(800);
await page.screenshot({ path: join(outDir, '07-restored-dashboard.png'), fullPage: true });

console.log('7. clear local storage from toolbar');
// Toggle to dark before destructive test so the screenshot reads better.
await page.click('button[aria-label="Toggle theme"]');
await page.waitForTimeout(300);
await page.click('button:has-text("清空本地")');
await page.waitForSelector('text=确认清空本地数据？', { timeout: 4000 });
await page.screenshot({ path: join(outDir, '08-confirm-clear-dark.png'), fullPage: false });
await page.click('button:has-text("确认清空")');
await page.waitForSelector('text=把 CSV 拖到这里', { timeout: 6000 });
await page.waitForTimeout(400);
await page.screenshot({ path: join(outDir, '09-cleared-idle-dark.png'), fullPage: true });

// The restore hint should be gone now.
const hintVisible = await page.isVisible('text=检测到本地有上次的数据');
if (hintVisible) throw new Error('restore hint still visible after clear');

console.log('\nscreenshots →', outDir);
if (pageErrors.length > 0) {
  console.log('\n=== PAGE ERRORS (FAIL) ===');
  for (const e of pageErrors) console.log(e);
  process.exit(1);
} else {
  console.log('\nno page errors — PR7/PR8 smoke ok');
}

await browser.close();
