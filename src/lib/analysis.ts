import type { CompSettings, FilterState, LandComp, LandRecord } from '../types';

export const DEFAULT_FILTERS: FilterState = {
  search: '', minAcres: '', maxAcres: '', zoning: 'all', topography: 'all',
  motivation: 'all', armsLengthOnly: false, sort: 'score',
};
export const DEFAULT_COMP_SETTINGS: CompSettings = { radiusMiles: 25, maxAgeMonths: 120, acreageTolerance: 4 };

const INTENT: Record<string, number> = { failedListing: 3, expiredListing: 3, canceledListing: 3, listedBelowMarketPrice: 2, forSaleByOwner: 2 };
const PRESSURE: Record<string, number> = { preforeclosure: 4, noticeOfDefault: 4, noticeOfLisPendens: 4, noticeOfSale: 4, activeAuction: 4, taxDefault: 3, involuntaryLien: 3, openLien: 2 };
const MOTIVATION: Record<string, number> = { vacant: 2, mailingAddressVacant: 2, tiredLandlord: 2, inherited: 2, absenteeOwner: 1, absenteeOwnerOutOfState: 1, outOfStateOwner: 1, seniorOwner: 1, corporateOwned: 1, trustOwned: 1 };
const EQUITY: Record<string, number> = { highEquity: 1, freeAndClear: 1 };
const hasAny = (record: LandRecord, flags: string[]) => flags.some(f => record.flags.includes(f));
const sumWeights = (record: LandRecord, weights: Record<string, number>) => record.flags.reduce((sum, flag) => sum + (weights[flag] ?? 0), 0);

export function landSellerSignal(record: LandRecord) {
  const intent = sumWeights(record, INTENT);
  const pressure = sumWeights(record, PRESSURE);
  const motivation = sumWeights(record, MOTIVATION);
  const equity = sumWeights(record, EQUITY);
  const reasons: string[] = [];
  if (hasAny(record, ['failedListing', 'expiredListing', 'canceledListing'])) reasons.push('Previously tried to sell');
  else if (intent) reasons.push('Sale-intent signal');
  if (pressure) reasons.push('Financial or legal pressure');
  if (hasAny(record, ['absenteeOwner', 'outOfStateOwner', 'absenteeOwnerOutOfState'])) reasons.push('Absentee owner');
  if (hasAny(record, ['corporateOwned', 'trustOwned'])) reasons.push('Entity ownership');
  if (equity) reasons.push('Room to discount');
  if (!reasons.length) reasons.push('No extra motivation flag in this record');
  return { score: 3 * intent + 2 * pressure + motivation + equity, reasons, intent, pressure, motivation, equity };
}

export function addressLabel(record: LandRecord) {
  const street = record.address.street || record.apn || 'Land parcel';
  return `${street}, ${record.address.city ?? ''}, ${record.address.state ?? ''}`.replace(/, ,/g, ',').replace(/,\s*$/, '');
}

export function passesMotivation(record: LandRecord, filter: FilterState['motivation']) {
  if (filter === 'all') return true;
  if (filter === 'absentee') return hasAny(record, ['absenteeOwner', 'outOfStateOwner', 'absenteeOwnerOutOfState']);
  if (filter === 'failed') return hasAny(record, ['failedListing', 'expiredListing', 'canceledListing', 'forSaleByOwner']);
  if (filter === 'pressure') return Object.keys(PRESSURE).some(f => record.flags.includes(f));
  if (filter === 'entity') return hasAny(record, ['corporateOwned', 'trustOwned']);
  return hasAny(record, Object.keys(EQUITY));
}

export function filterLandRecords(records: LandRecord[], filters: FilterState) {
  const query = filters.search.trim().toLowerCase();
  const min = filters.minAcres === '' ? null : Number(filters.minAcres);
  const max = filters.maxAcres === '' ? null : Number(filters.maxAcres);
  return records.filter(record => {
    if (query && !`${addressLabel(record)} ${record.apn ?? ''} ${record.address.zip ?? ''}`.toLowerCase().includes(query)) return false;
    if (min !== null && (record.lot.acres === null || record.lot.acres < min)) return false;
    if (max !== null && (record.lot.acres === null || record.lot.acres > max)) return false;
    if (filters.zoning !== 'all' && record.lot.zoning !== filters.zoning) return false;
    if (filters.topography !== 'all' && record.lot.topography !== filters.topography) return false;
    if (!passesMotivation(record, filters.motivation)) return false;
    if (filters.armsLengthOnly && record.sale.transactionTypeCode !== 'B') return false;
    return true;
  }).sort((a, b) => {
    if (filters.sort === 'acresAsc') return (a.lot.acres ?? Infinity) - (b.lot.acres ?? Infinity);
    if (filters.sort === 'acresDesc') return (b.lot.acres ?? -1) - (a.lot.acres ?? -1);
    if (filters.sort === 'landValue') return (b.assessment.landMarketValue ?? -1) - (a.assessment.landMarketValue ?? -1);
    if (filters.sort === 'recentSale') return (b.sale.date ?? '').localeCompare(a.sale.date ?? '');
    return landSellerSignal(b).score - landSellerSignal(a).score || addressLabel(a).localeCompare(addressLabel(b));
  });
}

export function distanceMiles(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = Math.PI / 180;
  const lat1 = a.lat * rad, lat2 = b.lat * rad;
  const dLat = lat2 - lat1, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 3958.7613 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

function monthsBetween(from: Date, to: Date) {
  return Math.max(0, (to.getTime() - from.getTime()) / (30.4375 * 24 * 60 * 60 * 1000));
}

export function findLandComps(subject: LandRecord, records: LandRecord[], settings: CompSettings, asOf: Date): LandComp[] {
  if (!subject.lot.acres || subject.lot.acres <= 0 || subject.validation?.status === 'improved' || subject.validation?.status === 'unclear') return [];
  return records.flatMap(record => {
    if (record.id === subject.id || record.validation?.status === 'improved' || record.validation?.status === 'unclear' || !record.lot.acres || !record.sale.price || !record.sale.date || record.sale.transactionTypeCode !== 'B') return [];
    const ratio = record.lot.acres / subject.lot.acres!;
    if (ratio < 1 / settings.acreageTolerance || ratio > settings.acreageTolerance) return [];
    const distance = distanceMiles(subject.address, record.address);
    if (distance > settings.radiusMiles) return [];
    const ageMonths = monthsBetween(new Date(record.sale.date), asOf);
    if (ageMonths > settings.maxAgeMonths) return [];
    return [{ record, distanceMiles: distance, ageMonths, pricePerAcre: record.sale.price / record.lot.acres }];
  }).sort((a, b) => a.distanceMiles - b.distanceMiles || a.ageMonths - b.ageMonths).slice(0, 12);
}

export function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function analyzeLand(subject: LandRecord, comps: LandComp[]) {
  if (!subject.lot.acres || subject.validation?.status === 'improved' || subject.validation?.status === 'unclear' || comps.length < 3) return { available: false as const, estimatedValue: null, pricePerAcre: null };
  const pricePerAcre = median(comps.map(c => c.pricePerAcre));
  if (pricePerAcre === null || pricePerAcre <= 0) return { available: false as const, estimatedValue: null, pricePerAcre: null };
  return { available: true as const, pricePerAcre, estimatedValue: pricePerAcre * subject.lot.acres };
}

export const money = (value: number | null | undefined, digits = 0) => value == null || !Number.isFinite(value)
  ? 'Unavailable'
  : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: digits }).format(value);
export const number = (value: number | null | undefined, digits = 2) => value == null || !Number.isFinite(value)
  ? 'Unknown'
  : value.toLocaleString('en-US', { maximumFractionDigits: digits });
export const acresLabel = (value: number | null) => value == null ? 'Unknown' : `${number(value)} ac`;
export const dateLabel = (value: string | null) => {
  if (!value) return 'Unknown';
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? 'Unknown' : new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date);
};
