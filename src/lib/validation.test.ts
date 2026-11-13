import { describe, expect, it } from 'vitest';
import rawDataset from '../../data/cleveland-land.json';
import type { LandDataset, LandRecord } from '../types';
import { findForbiddenFields, validateLandRecord } from './validation';

const baseRecord: Omit<LandRecord, 'validation'> = {
  id: 'parcel-1',
  apn: '123-45-678',
  address: {
    street: '1 Example St', city: 'Cleveland', state: 'OH', zip: '44101',
    county: 'Cuyahoga', countyFips: '39035', lat: 41.5, lng: -81.7,
    geoStatus: 'Parcel Centroid',
  },
  propertyTypeDetail: 'Vacant Land',
  landUseCode: 'R43',
  lot: {
    acres: 0.25, squareFeet: 10890, frontageFeet: 50, depthFeet: 217.8,
    zoning: '1F', topography: 'Level grade',
  },
  building: {
    livingArea: null, buildingArea: null, yearBuilt: null, units: null,
    stories: null, bedrooms: null, bathrooms: null, totalRooms: null,
  },
  assessment: { landMarketValue: 10000, totalMarketValue: 10000, assessedLandValue: 3500 },
  sale: {
    price: null, date: null, transactionType: null, transactionTypeCode: null,
    priceCodeDescription: null,
  },
  flags: ['vacant', 'vacantLot'],
  ownerOccupied: false,
  cachedAt: '2026-01-01T00:00:00Z',
};

function recordWith(
  overrides: Partial<Omit<LandRecord, 'validation'>> = {},
): Omit<LandRecord, 'validation'> {
  return { ...baseRecord, ...overrides };
}

describe('validateLandRecord', () => {
  it('verifies agreeing vacant evidence with complete confidence and completeness', () => {
    const result = validateLandRecord(baseRecord);
    expect(result).toMatchObject({ status: 'verified_vacant', score: 100, fieldCompleteness: 100 });
    expect(result.reasons.join(' ')).toMatch(/verified vacant/i);
  });

  it('uses probable_vacant when the candidate and type agree but vacant evidence is absent', () => {
    const result = validateLandRecord(recordWith({ flags: ['vacantLot'] }));
    expect(result.status).toBe('probable_vacant');
    expect(result.score).toBe(80);
    expect(result.reasons.join(' ')).toMatch(/vacant indicator is absent/i);
  });

  it.each([null, '', 'General', 'Unknown'])('marks ambiguous property type %s unclear', propertyTypeDetail => {
    const result = validateLandRecord(recordWith({ propertyTypeDetail }));
    expect(result.status).toBe('unclear');
    expect(result.score).toBeLessThan(50);
  });

  it.each([
    'Apartment House (5+ Units)',
    'Government Administrative Office',
    'Commercial/Office/Residential (Mixed Use)',
    'Residential Parking Garage',
  ])('marks non-vacant property type %s improved despite vacantLot', propertyTypeDetail => {
    const result = validateLandRecord(recordWith({ propertyTypeDetail }));
    expect(result.status).toBe('improved');
    expect(result.score).toBeLessThan(20);
    expect(result.reasons.join(' ')).toContain(propertyTypeDetail);
  });

  it.each([
    ['livingArea', 1200],
    ['buildingArea', 800],
    ['units', 2],
    ['stories', 1],
    ['bedrooms', 3],
    ['bathrooms', 1],
    ['totalRooms', 5],
  ])('treats positive building.%s as improvement evidence', (field, value) => {
    const result = validateLandRecord(recordWith({
      building: { ...baseRecord.building, [field]: value },
    }));
    expect(result.status).toBe('improved');
    expect(result.reasons.join(' ')).toMatch(/building|year built/i);
  });

  it('uses a material total-versus-land assessment gap as improvement evidence', () => {
    const result = validateLandRecord(recordWith({
      assessment: { landMarketValue: 10000, totalMarketValue: 30000, assessedLandValue: 3500 },
    }));
    expect(result.status).toBe('improved');
    expect(result.reasons.join(' ')).toMatch(/assessed total value exceeds land value/i);
  });

  it.each([
    ['apn', null],
    ['apn', ''],
  ])('requires a usable APN (%s=%s)', (apn, value) => {
    expect(validateLandRecord(recordWith({ apn: value })).status).toBe('unclear');
  });

  it.each([null, 0, -1, Number.NaN])('requires positive finite acreage (%s)', acres => {
    const result = validateLandRecord(recordWith({ lot: { ...baseRecord.lot, acres } }));
    expect(result.status).toBe('unclear');
    expect(result.reasons.join(' ')).toMatch(/acreage/i);
  });

  it.each([
    [Number.NaN, -81.7], [91, -81.7], [41.5, Number.NaN], [41.5, -181],
  ])('requires valid coordinates (%s, %s)', (lat, lng) => {
    const result = validateLandRecord(recordWith({
      address: { ...baseRecord.address, lat, lng },
    }));
    expect(result.status).toBe('unclear');
    expect(result.reasons.join(' ')).toMatch(/coordinates/i);
  });

  it('requires the candidate seed and does not treat it as proof by itself', () => {
    const withoutSeed = validateLandRecord(recordWith({ flags: ['vacant'] }));
    expect(withoutSeed.status).toBe('unclear');
    expect(withoutSeed.reasons.join(' ')).toMatch(/candidate.*absent/i);
  });

  it('computes fieldCompleteness independently from vacancy confidence', () => {
    const result = validateLandRecord(recordWith({
      landUseCode: null,
      address: { ...baseRecord.address, geoStatus: null },
      lot: { ...baseRecord.lot, squareFeet: null, zoning: null, frontageFeet: null, depthFeet: null },
    }));
    expect(result.status).toBe('verified_vacant');
    expect(result.score).toBe(95);
    expect(result.fieldCompleteness).toBe(40);
  });

  it('returns zero completeness for an empty parcel payload', () => {
    const result = validateLandRecord(recordWith({
      apn: null, propertyTypeDetail: null, landUseCode: null,
      address: { ...baseRecord.address, lat: Number.NaN, lng: Number.NaN, geoStatus: null },
      lot: { acres: null, squareFeet: null, frontageFeet: null, depthFeet: null, zoning: null, topography: null },
      flags: [],
    }));
    expect(result.fieldCompleteness).toBe(0);
    expect(result.status).toBe('unclear');
    expect(result.score).toBe(0);
  });

  it('does not treat a yearBuilt value alone as proof of an improvement', () => {
    const result = validateLandRecord(recordWith({
      building: { ...baseRecord.building, yearBuilt: 1950 },
    }));
    expect(result.status).toBe('verified_vacant');
  });

  it.each(['Recreational', 'Range Land'])('treats %s as land-compatible, not improved', propertyTypeDetail => {
    const result = validateLandRecord(recordWith({ propertyTypeDetail }));
    expect(result.status).toBe('probable_vacant');
    expect(result.reasons.join(' ')).toMatch(/land-compatible/i);
  });

  it('does not treat owner occupancy as evidence against vacant land', () => {
    const result = validateLandRecord(recordWith({ ownerOccupied: true }));
    expect(result.status).toBe('verified_vacant');
    expect(result.score).toBe(100);
  });

  it('downgrades contradictory acreage and square-foot source values', () => {
    const result = validateLandRecord(recordWith({
      lot: { ...baseRecord.lot, squareFeet: 5000 },
    }));
    expect(result.status).toBe('probable_vacant');
    expect(result.reasons.join(' ')).toMatch(/do not agree/i);
  });
});

describe('findForbiddenFields', () => {
  it('finds owner contact fields recursively, including normalized key variants', () => {
    const value = {
      ownerName: 'hidden',
      nested: [{ 'mailing_address': 'hidden', contact: { phone_number: 'hidden' } }],
      emailAddress: 'hidden',
      safe: { ownerOccupied: false },
      flags: ['mailingAddressVacant'],
    };
    expect(findForbiddenFields(value)).toEqual([
      'ownerName', 'nested[0].mailing_address', 'nested[0].contact.phone_number', 'emailAddress',
    ]);
  });

  it('handles null, arrays, primitives, and safe ownership flags', () => {
    expect(findForbiddenFields(null)).toEqual([]);
    expect(findForbiddenFields(['ownerOccupied', null, 3])).toEqual([]);
    expect(findForbiddenFields({ ownerOccupied: true, flags: ['vacantLot'] })).toEqual([]);
  });
});

describe('generated multi-market validation', () => {
  const dataset = rawDataset as LandDataset;

  it('recomputes every exported validation and keeps all 556 candidate records', () => {
    expect(dataset.recordCount).toBe(556);
    expect(dataset.records).toHaveLength(556);
    for (const record of dataset.records) {
      expect(validateLandRecord(record)).toEqual(record.validation);
      expect(record.validation.score).toBeGreaterThanOrEqual(0);
      expect(record.validation.score).toBeLessThanOrEqual(100);
      expect(record.validation.fieldCompleteness).toBeGreaterThanOrEqual(0);
      expect(record.validation.fieldCompleteness).toBeLessThanOrEqual(100);
      expect(record.validation.reasons.length).toBeGreaterThan(0);
    }
    expect(findForbiddenFields(dataset)).toEqual([]);
  });

  it.each([
    ['118-09-054', 'Apartment House (5+ Units)'],
    ['144-07-010', 'Government Administrative Office'],
    ['102-28-151', 'Commercial/Office/Residential (Mixed Use)'],
    ['004-09-084', 'Residential Parking Garage'],
  ])('marks real non-vacant seed %s improved', (apn, propertyTypeDetail) => {
    const record = dataset.records.find(candidate => candidate.apn === apn);
    expect(record?.propertyTypeDetail).toBe(propertyTypeDetail);
    expect(record?.validation.status).toBe('improved');
  });
});
