import { describe, expect, it } from 'vitest';
import { dealDataset, tranchiDeals } from '../data/deals';

const FORBIDDEN = /^(ownerName|ownerEmail|ownerPhone|ownerMailingAddress|distressMeta|qcNotes|conditionNotes|listingDescription)$/i;

function forbiddenKeys(value: unknown): string[] {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(forbiddenKeys);
  return Object.entries(value).flatMap(([key, child]) => [
    ...(FORBIDDEN.test(key) ? [key] : []),
    ...forbiddenKeys(child),
  ]);
}

const FORBIDDEN_VALUE_PATTERNS = [
  /douglas[-\s]+a[-\s]+franklin/i,
  /kenneth[-\s]+b[-\s]+knick/i,
  /county-treasurer-vs-/i,
  /dln\.com/i,
];

function forbiddenValues(value: unknown): string[] {
  if (typeof value === 'string') return FORBIDDEN_VALUE_PATTERNS.filter(pattern => pattern.test(value)).map(pattern => pattern.source);
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(forbiddenValues);
  return Object.values(value).flatMap(forbiddenValues);
}

describe('real Tranchi deal export', () => {
  it('contains 18 unique source-backed records with supplied price provenance', () => {
    expect(dealDataset.recordCount).toBe(18);
    expect(tranchiDeals).toHaveLength(18);
    expect(new Set(tranchiDeals.map(deal => deal.id)).size).toBe(18);
    expect(new Set(tranchiDeals.map(deal => `${deal.address.city}, ${deal.address.state}`))).toEqual(new Set([
      'Cleveland, OH', 'Lehigh Acres, FL',
    ]));
    expect(dealDataset.categoryCounts).toEqual({ land_bank: 6, motivated_seller: 4, tax_lien: 8 });
    expect(tranchiDeals.every(deal => deal.categoryGroup !== 'on_market')).toBe(true);
    expect(tranchiDeals.every(deal => deal.priceSource !== null)).toBe(true);
  });

  it('links every card to its real production ID and preserves verified price provenance', () => {
    for (const deal of tranchiDeals) {
      expect(deal.id).toBeGreaterThan(0);
      expect(deal.tranchiUrl).toBe(`https://tranchi.ai/properties/on-market?highlight=${deal.id}`);
      expect(deal.priceSource).not.toBeNull();
      expect(deal.priceLabel).not.toBe('List price');
    }
    expect(tranchiDeals.filter(deal => deal.categoryGroup === 'tax_lien').every(deal => deal.priceLabel === 'Opening bid' && deal.priceSource === 'opening_bid')).toBe(true);
    expect(tranchiDeals.filter(deal => deal.categoryGroup === 'motivated_seller').every(deal => deal.priceLabel === 'Tax-assessed reference' && deal.priceSource === 'tax_assessed')).toBe(true);
    expect(tranchiDeals.filter(deal => deal.categoryGroup === 'land_bank').every(deal => deal.priceLabel === 'Tax-assessed reference' && deal.priceSource === 'tax_assessed')).toBe(true);
  });

  it('uses only public HTTPS media and PII-free source links', () => {
    for (const deal of tranchiDeals) {
      expect(deal.images.every(url => url.startsWith('https://'))).toBe(true);
      if (deal.sourceUrl) {
        expect(deal.sourceUrl).toMatch(/^https?:\/\//);
        expect(deal.sourceUrl).not.toContain('property_uploads');
        expect(deal.sourceUrl).not.toContain('myplace.cuyahogacounty.us');
        expect(deal.sourceUrl).not.toContain('dln.com');
        expect(deal.sourceUrl).not.toContain('county-treasurer-vs-');
      }
    }
    expect(tranchiDeals.some(deal => deal.sourceUrl?.includes('cuyahogalandbank.org'))).toBe(true);
  });

  it('contains no owner contact, private-note, distress-metadata, or party-name values', () => {
    expect(forbiddenKeys(dealDataset)).toEqual([]);
    expect(forbiddenValues(dealDataset)).toEqual([]);
    expect(dealDataset.privacy).toContain('No owner identity/contact fields');
    expect(dealDataset.privacy).toContain('only documented deal/price fields');
  });
});
