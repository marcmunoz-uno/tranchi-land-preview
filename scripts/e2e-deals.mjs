import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const base = process.env.BASE_URL || 'http://127.0.0.1:3213/';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));

try {
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Real deals', exact: true }).click();
  await page.locator('.deal-card').first().waitFor();
  assert.equal(await page.locator('.deal-card').count(), 26);
  assert.match(await page.locator('.deal-feed-heading').innerText(), /26 of 26 share-safe production records/);
  assert.match(await page.locator('.deal-feed-heading').innerText(), /active in the source system/);
  console.log('PASS 26 real production deal cards with source-system count');

  await page.getByLabel('Deal market').selectOption('Bastrop, TX');
  assert.equal(await page.locator('.deal-card').count(), 2);
  assert.match(await page.locator('.deal-card').first().innerText(), /Bastrop, TX/);
  console.log('PASS Bastrop real-deal coverage');

  await page.getByLabel('Deal market').selectOption('all');
  await page.getByLabel('Deal type').selectOption('land_bank');
  assert.equal(await page.locator('.deal-card').count(), 6);
  await page.locator('.deal-card-main').first().click();
  await page.locator('.deal-detail').waitFor();
  assert.match(await page.locator('.deal-detail').innerText(), /Land bank/);
  assert.match(await page.locator('.deal-detail').innerText(), /TAX-ASSESSED REFERENCE/i);
  assert.match(await page.locator('.deal-detail').innerText(), /Tranchi #/i);
  assert.match(await page.locator('.deal-detail').innerText(), /View public source/);
  const sourceHref = await page.locator('.deal-detail-links a').last().getAttribute('href');
  assert.match(sourceHref || '', /cuyahogalandbank\.org/);
  console.log('PASS land-bank detail, provenance, production ID, and public source');

  await page.getByRole('button', { name: 'Close real deal details' }).click();
  await page.getByLabel('Deal type').selectOption('all');
  await page.getByLabel('Search real deals').fill('152040');
  assert.equal(await page.locator('.deal-card').count(), 1);
  assert.match(await page.locator('.deal-card').first().innerText(), /2756 West Blvd/);
  assert.match(await page.locator('.deal-card-footer a').getAttribute('href') || '', /highlight=152040/);
  console.log('PASS search by real production ID and direct Tranchi link');

  await page.getByLabel('Search real deals').fill('not-a-real-deal-id');
  assert.match(await page.locator('.deal-empty').innerText(), /No real deals match/);
  await page.getByRole('button', { name: /Reset deal filters/ }).click();
  assert.equal(await page.locator('.deal-card').count(), 26);
  console.log('PASS empty state and reset');

  await page.waitForFunction(() => Array.from(document.querySelectorAll('.deal-card img')).some(image => image.complete && image.naturalWidth > 0), { timeout: 20000 });
  const loadedImages = await page.locator('.deal-card img').evaluateAll(images => images.filter(image => image.complete && image.naturalWidth > 0).length);
  assert.ok(loadedImages > 0);
  console.log(`PASS real property photos load (${loadedImages} visible at check time)`);

  const dealsUrl = new URL(base);
  dealsUrl.searchParams.set('workspace', 'deals');
  await page.goto(dealsUrl.toString(), { waitUntil: 'networkidle' });
  await page.locator('.deal-card').first().waitFor();
  assert.equal(await page.locator('.deal-card').count(), 26);
  console.log('PASS real-deals workspace is directly shareable');

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mobilePage = await mobile.newPage();
  mobilePage.on('pageerror', error => errors.push(error.message));
  await mobilePage.goto(dealsUrl.toString(), { waitUntil: 'networkidle' });
  await mobilePage.locator('.deal-card').first().waitFor();
  assert.equal(await mobilePage.evaluate(() => document.body.scrollWidth <= innerWidth), true);
  await mobilePage.locator('.deal-card-main').first().click();
  await mobilePage.locator('.deal-detail').waitFor();
  const box = await mobilePage.locator('.deal-detail').boundingBox();
  assert.equal(Math.round(box.width), 390);
  await mobilePage.getByRole('button', { name: 'Close real deal details' }).click();
  await mobilePage.getByRole('button', { name: 'Land parcels', exact: true }).click();
  await mobilePage.locator('.land-marker').first().waitFor();
  console.log('PASS mobile real-deal cards, full-width detail, and return to land workspace');
  await mobile.close();

  assert.deepEqual(errors, []);
  console.log('PASS zero JavaScript errors');
} finally {
  await context.close();
  await browser.close();
}
