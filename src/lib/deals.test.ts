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

describe('real Tranchi deal export', () => {
  it('contains 26 unique production records across all three preview markets', () => {
    expect(dealDataset.recordCount).toBe(26);
    expect(tranchiDeals).toHaveLength(26);
    expect(new Set(tranchiDeals.map(deal => deal.id)).size).toBe(26);
    expect(new Set(tranchiDeals.map(deal => `${deal.address.city}, ${deal.address.state}`))).toEqual(new Set([
      'Cleveland, OH', 'Bastrop, TX', 'Lehigh Acres, FL',
    ]));
    expect(dealDataset.categoryCounts).toEqual({ land_bank: 6, motivated_seller: 4, on_market: 8, tax_lien: 8 });
  });

  it('links every card to its real production ID and preserves price provenance', () => {
    for (const deal of tranchiDeals) {
      expect(deal.id).toBeGreaterThan(0);
      expect(deal.tranchiUrl).toBe(`https://tranchi.ai/properties/on-market?highlight=${deal.id}`);
      expect(deal.priceLabel.length).toBeGreaterThan(0);
      expect(deal.price).not.toBeNull();
    }
    expect(tranchiDeals.filter(deal => deal.categoryGroup === 'on_market').every(deal => deal.priceLabel === 'List price')).toBe(true);
    expect(tranchiDeals.filter(deal => deal.categoryGroup === 'tax_lien').every(deal => deal.priceLabel === 'Opening bid')).toBe(true);
    expect(tranchiDeals.filter(deal => deal.categoryGroup === 'motivated_seller').every(deal => deal.priceLabel === 'Tax-assessed reference')).toBe(true);
  });

  it('uses only public HTTPS media and source links', () => {
    for (const deal of tranchiDeals) {
      expect(deal.images.every(url => url.startsWith('https://'))).toBe(true);
      if (deal.sourceUrl) {
        expect(deal.sourceUrl).toMatch(/^https?:\/\//);
        expect(deal.sourceUrl).not.toContain('property_uploads');
        expect(deal.sourceUrl).not.toContain('myplace.cuyahogacounty.us');
      }
    }
    expect(tranchiDeals.some(deal => deal.sourceUrl?.includes('cuyahogalandbank.org'))).toBe(true);
    expect(tranchiDeals.some(deal => deal.sourceUrl?.includes('dln.com'))).toBe(true);
  });

  it('contains no owner contact, private-note, or distress-metadata fields', () => {
    expect(forbiddenKeys(dealDataset)).toEqual([]);
    expect(dealDataset.privacy).toContain('No owner names');
  });
});
