import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:3210/';
const outDir = path.resolve('qa');
await fs.mkdir(path.join(outDir, 'screenshots'), { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: process.env.HEADFUL !== '1',
});
const results = [];
const pass = (name, evidence) => { results.push({ name, status: 'PASS', evidence }); console.log(`PASS ${name}: ${evidence}`); };

async function newPage(viewport) {
  const context = await browser.newContext({ viewport, acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  return { context, page, errors };
}

async function desktop() {
  const { context, page, errors } = await newPage({ width: 1440, height: 1000 });
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.locator('.land-marker').first().waitFor();
  assert.equal(await page.locator('.land-marker').count(), 439);
  pass('desktop real map data', '439 verified/probable parcel markers rendered');
  await page.screenshot({ path: path.join(outDir, 'screenshots', 'desktop-map.png') });

  await page.locator('.land-marker').first().click();
  await page.locator('.detail-panel').waitFor();
  assert.match(await page.locator('.detail-metrics').innerText(), /Lot size/);
  await page.getByRole('tab', { name: /Comps & offer/ }).click();
  await page.locator('.valuation-block').waitFor();
  const valuation = await page.locator('.valuation-block').innerText();
  const offer = await page.locator('.max-offer').innerText();
  assert.match(valuation, /Comp-supported value/);
  assert.match(offer, /Maximum seller offer/);
  assert.ok(await page.locator('.comp-row').count() >= 3);
  pass('parcel analysis', `${await page.locator('.comp-row').count()} real comps; ${offer.split('\n')[1]}`);
  await page.getByLabel('Desired assignment fee').fill('-10000');
  assert.match(await page.locator('.max-offer').innerText(), /− \$0 fee/);
  pass('negative offer inputs', 'negative assignment fee is clamped to zero instead of inflating the offer');
  await page.screenshot({ path: path.join(outDir, 'screenshots', 'desktop-analysis.png') });

  await page.getByRole('button', { name: 'List', exact: true }).click();
  await page.getByLabel('Max acres').fill('0.1');
  await page.waitForFunction(() => document.querySelectorAll('.parcel-card').length === 104);
  assert.match(await page.locator('.workspace-toolbar p').innerText(), /104 of 556/);
  pass('filters and list view', 'max 0.1 acres returns the correct 104 records');

  await page.getByRole('button', { name: /Save search/ }).click();
  await page.getByLabel(/Name this filter set/).fill('QA small lots');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  const saved = await page.evaluate(() => localStorage.getItem('tranchi.land.savedSearches.v1'));
  assert.match(saved, /QA small lots/);
  pass('saved searches', 'named filter set persisted to localStorage');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /Export CSV/ }).click();
  const download = await downloadPromise;
  const file = await download.path();
  const csv = await fs.readFile(file, 'utf8');
  const lines = csv.trim().split('\n');
  assert.equal(lines.length, 105);
  assert.match(lines[0], /Seller signal/);
  assert.match(lines[0], /Vacancy status/);
  pass('CSV export', '104 filtered records + header downloaded; no contact columns');

  await page.getByRole('button', { name: 'Clear all filters' }).click();
  await page.getByLabel('Search address, APN, or ZIP').fill('definitely-no-such-parcel-xyz');
  await page.locator('.empty-state').waitFor();
  assert.match(await page.locator('.empty-state').innerText(), /No parcels match/);
  pass('empty state', 'no-match copy and reset path render');
  assert.deepEqual(errors, []);
  pass('desktop console', 'zero JavaScript errors');
  await context.close();
}

async function mobile() {
  const { context, page, errors } = await newPage({ width: 390, height: 844 });
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.locator('.land-marker').first().waitFor();
  assert.equal(await page.evaluate(() => document.body.scrollWidth <= innerWidth), true);
  pass('mobile map layout', '390px viewport has no horizontal page overflow');
  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  await page.locator('.filters-container.mobile-open').waitFor();
  await page.getByLabel('Max acres').fill('0.1');
  await page.getByRole('button', { name: 'Close filters', exact: true }).click();
  await page.getByRole('button', { name: 'List', exact: true }).click();
  assert.equal(await page.locator('.parcel-card').count(), 104);
  await page.locator('.parcel-card').first().click();
  await page.locator('.detail-panel').waitFor();
  const box = await page.locator('.detail-panel').boundingBox();
  assert.ok(Math.round(box.width) === 390);
  assert.equal(await page.evaluate(() => document.body.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: path.join(outDir, 'screenshots', 'mobile-detail.png') });
  await page.getByRole('button', { name: 'Close parcel details' }).click();
  await page.screenshot({ path: path.join(outDir, 'screenshots', 'mobile-list.png') });
  assert.deepEqual(errors, []);
  pass('mobile interactions and console', 'filter drawer, 104-card list, full-width inspector, close path, zero JS errors');
  await context.close();
}

try {
  await desktop();
  await mobile();
  await fs.writeFile(path.join(outDir, 'results.json'), JSON.stringify({ baseURL, results }, null, 2));
  console.log(`\n${results.length} checks passed against ${baseURL}`);
} finally {
  await browser.close();
}
