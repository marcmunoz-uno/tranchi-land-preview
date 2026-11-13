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
  await page.getByLabel('Filter by market').selectOption('Lehigh Acres, FL');
  await page.getByRole('button', { name: 'List', exact: true }).click();
  await page.locator('.parcel-card').first().waitFor();
  const lehighCount = await page.locator('.parcel-card').count();
  assert.ok(lehighCount > 0 && lehighCount <= 60);
  const addresses = await page.locator('.parcel-address').allInnerTexts();
  assert.ok(addresses.every(address => address.includes('Lehigh Acres')));
  assert.ok(await page.locator('.validation-badge').count() > 0);
  console.log(`PASS Lehigh Acres filter: ${lehighCount} likely-vacant records with evidence badges`);

  await page.getByRole('button', { name: /Share search/ }).click();
  assert.match(page.url(), /market=Lehigh\+Acres%2C\+FL/);
  console.log('PASS market selection is encoded in the share URL');

  await page.getByLabel('Filter by market').selectOption('all');
  await page.getByLabel('Parcel evidence').selectOption('all');
  await page.waitForFunction(() => document.querySelectorAll('.parcel-card').length > 60);
  assert.match(await page.locator('.workspace-toolbar p').innerText(), /556 real cached parcels/);
  console.log('PASS improved records are available only after explicitly including all candidates');

  await page.getByLabel('Parcel evidence').selectOption('include_unclear');
  await page.waitForFunction(() => document.querySelectorAll('.parcel-card').length === 442);
  console.log('PASS review records are included only by choice (439 likely + 3 unclear)');
  assert.deepEqual(errors, []);
  console.log('PASS zero JavaScript errors');

  const unsupportedZoningUrl = new URL(base);
  unsupportedZoningUrl.searchParams.set('zoning', 'not-a-real-zone');
  await page.goto(unsupportedZoningUrl.toString(), { waitUntil: 'networkidle' });
  await page.locator('.url-warning').waitFor();
  assert.match(await page.locator('.url-warning').innerText(), /invalid and were safely reset/);
  assert.equal(await page.locator('.land-marker').count(), 439);
  console.log('PASS unsupported zoning resets with a visible warning instead of an empty state');
} finally {
  await context.close();
  await browser.close();
}
