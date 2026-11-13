import { describe, expect, it } from 'vitest';
import { landRecords, dataset } from '../data/land';
import { analyzeLand, DEFAULT_COMP_SETTINGS, DEFAULT_FILTERS, filterLandRecords, findLandComps, landSellerSignal, median, nonNegativeAmount } from './analysis';

const subject = landRecords.find(record => record.validation.status === 'verified_vacant') ?? landRecords[0];

describe('real Cleveland dataset', () => {
  it('exports the expected share-safe records', () => {
    expect(dataset.recordCount).toBe(556);
    expect(landRecords).toHaveLength(556);
    const forbidden = new Set(['mailingaddress', 'phone', 'email', 'ownername', 'fullname']);
    const scan = (value: unknown): void => {
      if (Array.isArray(value)) { value.forEach(scan); return; }
      if (value && typeof value === 'object') {
        for (const [key, nested] of Object.entries(value)) {
          expect(forbidden.has(key.toLowerCase())).toBe(false);
          scan(nested);
        }
      }
    };
    scan(dataset);
  });

  it('every record has real map coordinates and acreage', () => {
    for (const record of landRecords) {
      expect(Number.isFinite(record.address.lat)).toBe(true);
      expect(Number.isFinite(record.address.lng)).toBe(true);
      expect(record.lot.acres).toBeGreaterThan(0);
      expect(record.flags).toContain('vacantLot');
    }
  });

  it('does not apply the residential vacantLot penalty', () => {
    expect(landSellerSignal(subject).score).toBeGreaterThanOrEqual(0);
  });

  it('filters real records by acreage', () => {
    const max = subject.lot.acres!;
    const filtered = filterLandRecords(landRecords, { ...DEFAULT_FILTERS, maxAcres: String(max) });
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every(r => r.lot.acres! <= max)).toBe(true);
  });

  it('produces real comp sets and honest analysis', () => {
    const comps = findLandComps(subject, landRecords, DEFAULT_COMP_SETTINGS, new Date(dataset.generatedAt));
    const analysis = analyzeLand(subject, comps);
    expect(comps.length).toBeGreaterThanOrEqual(3);
    expect(analysis.available).toBe(true);
    expect(analysis.estimatedValue).toBeGreaterThan(0);
    expect(comps.every(c => c.record.sale.transactionTypeCode === 'B')).toBe(true);
  });

  it('keeps improved and unclear parcels out of land comps and valuation', () => {
    const validComps = findLandComps(subject, landRecords, DEFAULT_COMP_SETTINGS, new Date(dataset.generatedAt));
    const improved = {
      ...validComps[0].record,
      id: 'improved-comp',
      validation: { ...validComps[0].record.validation, status: 'improved' as const },
    };
    const unclear = {
      ...validComps[0].record,
      id: 'unclear-comp',
      validation: { ...validComps[0].record.validation, status: 'unclear' as const },
    };
    const comps = findLandComps(subject, [...landRecords, improved, unclear], DEFAULT_COMP_SETTINGS, new Date(dataset.generatedAt));
    expect(comps.some(comp => ['improved-comp', 'unclear-comp'].includes(comp.record.id))).toBe(false);

    const improvedSubject = { ...subject, validation: { ...subject.validation, status: 'improved' as const } };
    expect(findLandComps(improvedSubject, landRecords, DEFAULT_COMP_SETTINGS, new Date(dataset.generatedAt))).toEqual([]);
    expect(analyzeLand(improvedSubject, validComps).available).toBe(false);
  });

  it('rejects missing coordinates from comp subjects and candidates', () => {
    const noCoordinates = { ...subject, address: { ...subject.address, lat: null, lng: null } };
    expect(findLandComps(noCoordinates, landRecords, DEFAULT_COMP_SETTINGS, new Date(dataset.generatedAt))).toEqual([]);
    const poolWithMissing = landRecords.map(record => record.id === subject.id ? record : { ...record, address: { ...record.address, lat: null, lng: null } });
    expect(findLandComps(subject, poolWithMissing, DEFAULT_COMP_SETTINGS, new Date(dataset.generatedAt))).toEqual([]);
  });

  it('normalizes offer inputs to finite nonnegative amounts', () => {
    expect(nonNegativeAmount(-10000)).toBe(0);
    expect(nonNegativeAmount('not-a-number')).toBe(0);
    expect(nonNegativeAmount('Infinity')).toBe(0);
    expect(nonNegativeAmount(Number.POSITIVE_INFINITY)).toBe(0);
    expect(nonNegativeAmount('1500')).toBe(1500);
  });

  it('refuses to estimate with fewer than three comps', () => {
    const analysis = analyzeLand(subject, []);
    expect(analysis.available).toBe(false);
    expect(analysis.estimatedValue).toBeNull();
  });
});

describe('median', () => {
  it('handles odd and even sets', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});
