import type { LandRecord, ParcelValidation, ParcelValidationStatus } from '../types';

export type ParcelValidationInput = Omit<LandRecord, 'validation'>;

const AMBIGUOUS_TYPES = new Set(['', 'general', 'unknown', 'unspecified', 'other', 'n/a', 'null']);
const LAND_COMPATIBLE_TYPES = new Set(['recreational', 'range land', 'agricultural', 'farm', 'ranch', 'forest', 'undeveloped land', 'unimproved land']);
const IMPROVED_TYPE_TOKENS = ['apartment', 'office', 'mixed use', 'parking garage', 'church', 'worship', 'government'];
const COMPLETENESS_FIELDS = 10;

function present(value: string | null): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function positive(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function validCoordinates(record: ParcelValidationInput): boolean {
  const { lat, lng } = record.address;
  return Number.isFinite(lat) && Math.abs(lat) <= 90 && Number.isFinite(lng) && Math.abs(lng) <= 180;
}

function completeness(record: ParcelValidationInput): number {
  const checks = [
    present(record.apn),
    present(record.propertyTypeDetail),
    present(record.landUseCode),
    positive(record.lot.acres),
    positive(record.lot.squareFeet),
    validCoordinates(record),
    present(record.address.geoStatus),
    present(record.lot.zoning),
    positive(record.lot.frontageFeet),
    positive(record.lot.depthFeet),
  ];
  return Math.round((checks.filter(Boolean).length / COMPLETENESS_FIELDS) * 100);
}

function buildingImprovements(record: ParcelValidationInput): string[] {
  const building = record.building;
  const fields = [
    ['livingArea', 'living area'],
    ['buildingArea', 'building area'],
    ['units', 'unit count'],
    ['stories', 'story count'],
    ['bedrooms', 'bedroom count'],
    ['bathrooms', 'bathroom count'],
    ['totalRooms', 'room count'],
  ] as const;
  const improvements = fields.flatMap(([field, label]) =>
    positive(building?.[field]) ? [`Building ${label} is present (${building[field]}).`] : [],
  );
  return improvements;
}

function assessmentImprovement(record: ParcelValidationInput): boolean {
  const land = record.assessment.landMarketValue;
  const total = record.assessment.totalMarketValue;
  return positive(land) && positive(total) && total > land * 1.25 + 5000;
}

function acreageConflict(record: ParcelValidationInput): boolean {
  const acres = record.lot.acres;
  const squareFeet = record.lot.squareFeet;
  if (!positive(acres) || !positive(squareFeet)) return false;
  return Math.abs(squareFeet - acres * 43560) / (acres * 43560) > 0.15;
}

/**
 * Classifies vacancy confidence without treating the vacantLot list seed as proof.
 * Improved evidence always wins; incomplete or contradictory evidence is retained
 * and labelled rather than silently removed.
 */
export function validateLandRecord(record: ParcelValidationInput): ParcelValidation {
  const type = record.propertyTypeDetail?.trim() ?? '';
  const normalizedType = type.toLowerCase();
  const vacantType = normalizedType.includes('vacant');
  const landCompatible = vacantType || LAND_COMPATIBLE_TYPES.has(normalizedType);
  const knownImprovedType = IMPROVED_TYPE_TOKENS.some(token => normalizedType.includes(token));
  const ambiguousType = AMBIGUOUS_TYPES.has(normalizedType);
  const hasCandidate = record.flags.includes('vacantLot');
  const hasVacantFlag = record.flags.includes('vacant');
  const hasApn = present(record.apn);
  const hasAcreage = positive(record.lot.acres);
  const hasCoordinates = validCoordinates(record);
  const improvements = buildingImprovements(record);
  const hasAssessmentImprovement = assessmentImprovement(record);
  const hasAcreageConflict = acreageConflict(record);

  let score = 0;
  if (vacantType) score += 45;
  else if (landCompatible) score += 25;
  else if (ambiguousType) score += present(record.propertyTypeDetail) ? 5 : 0;
  else score -= 20;
  score += hasCandidate ? 15 : -20;
  if (hasVacantFlag) score += 20;
  if (hasAcreage) score += 5;
  if (hasCoordinates) score += 5;
  if (hasApn) score += 5;
  if (present(record.landUseCode)) score += 2;
  if (present(record.lot.zoning)) score += 1;
  if (present(record.address.geoStatus)) score += 2;
  if (hasAcreageConflict) score -= 10;

  const reasons: string[] = [];
  let status: ParcelValidationStatus;

  if (knownImprovedType || improvements.length > 0 || hasAssessmentImprovement) {
    status = 'improved';
    if (knownImprovedType) reasons.push(`Improved: property type is ${type}.`);
    reasons.push(...improvements.map(reason => `Improved: ${reason}`));
    if (hasAssessmentImprovement) {
      reasons.push('Improved: assessed total value exceeds land value by a material margin.');
    }
    if (hasCandidate) reasons.push('The vacantLot candidate flag conflicts with the improvement evidence.');
    score = Math.min(score, 19);
  } else {
    const missing: string[] = [];
    if (!hasApn) missing.push('APN');
    if (!hasAcreage) missing.push('positive lot acreage');
    if (!hasCoordinates) missing.push('valid coordinates');

    if (ambiguousType || !landCompatible || !hasCandidate || missing.length > 0) {
      status = 'unclear';
      if (ambiguousType) {
        reasons.push(`Unclear: property type ${type ? `"${type}"` : 'is missing'} does not establish vacant land.`);
      } else if (!landCompatible) {
        reasons.push(`Unclear: property type "${type}" is not recognized as land or a known improvement.`);
      }
      if (!hasCandidate) reasons.push('Unclear: vacantLot candidate flag is absent.');
      if (missing.length > 0) reasons.push(`Missing required parcel evidence: ${missing.join(', ')}.`);
      score = Math.min(score, 49);
    } else if (!vacantType || !hasVacantFlag || hasAcreageConflict) {
      status = 'probable_vacant';
      if (!vacantType) reasons.push(`Probable vacant: ${type} is a land-compatible use, not an explicit vacant-land label.`);
      if (!hasVacantFlag) {
        reasons.push('Probable vacant: property type and candidate flag agree, but the independent vacant indicator is absent.');
      }
      if (hasAcreageConflict) {
        reasons.push('Source conflict: lot acreage and square feet do not agree; confidence is capped.');
      }
      score = Math.min(score, 84);
    } else {
      status = 'verified_vacant';
      reasons.push('Verified vacant: property type, vacant indicator, candidate flag, APN, acreage, and coordinates agree.');
    }
  }

  if (reasons.length === 0) reasons.push('Unclear: available source evidence is insufficient.');
  return {
    status,
    score: Math.max(0, Math.min(100, Math.round(score))),
    reasons,
    fieldCompleteness: completeness(record),
  };
}

function forbiddenKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
  return normalized === 'owner'
    || normalized.includes('ownername')
    || (normalized.startsWith('owner') && normalized.includes('name'))
    || normalized.includes('fullname')
    || normalized.startsWith('mailing')
    || normalized.includes('phone')
    || normalized.includes('telephone')
    || normalized.includes('email');
}

/** Returns paths to contact fields that must never appear in a share-safe export. */
export function findForbiddenFields(value: unknown): string[] {
  const forbidden: string[] = [];
  const visit = (nested: unknown, path = ''): void => {
    if (Array.isArray(nested)) {
      nested.forEach((item, index) => visit(item, `${path}[${index}]`));
      return;
    }
    if (!nested || typeof nested !== 'object') return;
    for (const [key, child] of Object.entries(nested)) {
      const childPath = path ? `${path}.${key}` : key;
      if (forbiddenKey(key)) forbidden.push(childPath);
      visit(child, childPath);
    }
  };
  visit(value);
  return forbidden;
}
