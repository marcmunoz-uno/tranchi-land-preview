import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
});
const base = process.env.BASE_URL || 'http://127.0.0.1:3212/';
const origin = new URL(base).origin;
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));

try {
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.locator('.land-marker').first().waitFor();
  await page.getByRole('button', { name: 'Add to shortlist', exact: true }).click();
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('tranchi.land.shortlist.v1')).length), 1);
  await page.getByRole('button', { name: 'List', exact: true }).click();
  await page.locator('.parcel-card').nth(1).click();
  await page.getByRole('button', { name: 'Add to shortlist', exact: true }).click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('tranchi.land.shortlist.v1')));
  assert.equal(saved.length, 2);
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.locator('.shortlist-card').count(), 0);
  assert.match(await page.getByRole('button', { name: /Open shortlist/ }).innerText(), /2/);
  console.log('PASS shortlist add + localStorage reload persistence');

  await page.getByRole('button', { name: /Open shortlist/ }).click();
  assert.equal(await page.locator('.shortlist-card').count(), 2);
  const compareChecks = page.getByRole('checkbox', { name: /^Compare / });
  await compareChecks.nth(0).check();
  await compareChecks.nth(1).check();
  await page.getByRole('button', { name: /Compare selected \(2\)/ }).click();
  await page.locator('.compare-overlay').waitFor();
  assert.equal(await page.locator('.compare-table thead th').count(), 3);
  assert.match(await page.locator('.compare-table').innerText(), /Assessor land value/);
  assert.match(await page.locator('.compare-table').innerText(), /Sale validation/);
  assert.match(await page.url(), /compare=/);
  const compareUrl = page.url();
  console.log('PASS two-parcel comparison + compare state in URL');

  await page.getByRole('button', { name: 'Close comparison' }).click();
  await page.getByRole('button', { name: /Share search/ }).click();
  const sharedUrl = await page.evaluate(() => navigator.clipboard.readText());
  assert.ok(sharedUrl.includes('saved='));
  assert.ok(sharedUrl.includes('layout=') || sharedUrl.includes('saved='));
  await page.goto(sharedUrl, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Open shortlist/ }).click();
  assert.equal(await page.locator('.shortlist-card').count(), 2);
  await page.getByRole('button', { name: 'Close shortlist', exact: true }).click();
  console.log('PASS shared search restores shortlisted parcel IDs');

  await page.goto(compareUrl, { waitUntil: 'networkidle' });
  await page.locator('.compare-overlay').waitFor();
  assert.equal(await page.locator('.compare-table thead th').count(), 3);
  await page.getByRole('button', { name: 'Close comparison' }).click();
  console.log('PASS shared compare URL reopens comparison');

  await page.getByRole('button', { name: /Comp \/ offer PDF/ }).first().click();
  await page.locator('.offer-dialog').waitFor();
  assert.ok(await page.locator('.offer-comp').count() >= 3);
  let downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download comp / offer PDF', exact: true }).click();
  let download = await downloadPromise;
  const estimatedPath = '/tmp/tranchi-estimated-offer.pdf';
  await download.saveAs(estimatedPath);
  const estimatedPdf = await fs.readFile(estimatedPath);
  assert.equal(estimatedPdf.subarray(0, 4).toString(), '%PDF');
  assert.ok(estimatedPdf.length > 10000);
  await page.getByRole('button', { name: 'Clear all', exact: true }).click();
  await page.getByText('Not enough usable comps', { exact: true }).waitFor();
  downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download PDF without estimate', exact: true }).click();
  download = await downloadPromise;
  const insufficientPath = '/tmp/tranchi-insufficient-offer.pdf';
  await download.saveAs(insufficientPath);
  const insufficientPdf = await fs.readFile(insufficientPath);
  assert.equal(insufficientPdf.subarray(0, 4).toString(), '%PDF');
  assert.ok(insufficientPdf.length > 8000);
  console.log(`PASS real PDF downloads (${estimatedPdf.length} bytes with estimate; ${insufficientPdf.length} bytes honest insufficient state)`);
  await page.getByRole('button', { name: 'Close comp and offer worksheet', exact: true }).click();
  await page.getByRole('button', { name: /Comp \/ offer PDF/ }).first().click();
  await page.locator('.offer-dialog').waitFor();
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.offer-dialog').count(), 0);
  console.log('PASS Escape closes the comp and offer dialog');

  await page.goto(`${base}?min=-2&motivation=invalid&saved=unknown&compare=unknown`, { waitUntil: 'networkidle' });
  await page.locator('.land-marker').first().waitFor();
  assert.equal(await page.locator('.land-marker').count(), 439);
  assert.match(await page.locator('.toast').innerText(), /invalid and were safely reset/);
  console.log('PASS corrupt shared URL safely falls back to all parcels');

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mobilePage = await mobile.newPage();
  mobilePage.on('pageerror', error => errors.push(error.message));
  await mobilePage.goto(compareUrl, { waitUntil: 'networkidle' });
  assert.ok(await mobilePage.getByRole('button', { name: 'Share search', exact: true }).count() > 0);
  console.log('PASS mobile share control has an accessible name');
  await mobilePage.locator('.compare-overlay').waitFor();
  assert.equal(await mobilePage.evaluate(() => document.body.scrollWidth <= innerWidth), true);
  await mobilePage.getByRole('button', { name: 'Close comparison' }).click();
  await mobilePage.getByRole('button', { name: 'Close parcel details' }).click();
  await mobilePage.getByRole('button', { name: /Open shortlist/ }).click();
  await mobilePage.locator('.shortlist-panel').waitFor();
  assert.equal(await mobilePage.evaluate(() => document.body.scrollWidth <= innerWidth), true);
  await mobilePage.getByRole('button', { name: 'Close shortlist', exact: true }).click();
  await mobilePage.getByRole('button', { name: /Shortlist only/ }).click();
  await mobilePage.waitForFunction(() => document.querySelectorAll('.parcel-card').length === 2, { timeout: 10000 });
  assert.equal(await mobilePage.locator('.parcel-card').count(), 2);
  assert.equal(await mobilePage.evaluate(() => document.body.scrollWidth <= innerWidth), true);
  await mobile.close();
  console.log('PASS mobile shortlist-only, shortlist drawer, and comparison without page overflow');

  assert.deepEqual(errors, []);
  console.log('PASS zero browser JavaScript errors');
} finally {
  await context.close();
  await browser.close();
}
