import type { FilterState, LandRecord } from '../types';
import { marketId } from './markets';

export function passesVacancyFilter(record: LandRecord, filter: FilterState['vacancy']) {
  if (filter === 'all') return true;
  if (filter === 'include_unclear') return record.validation.status !== 'improved';
  return record.validation.status === 'verified_vacant' || record.validation.status === 'probable_vacant';
}

export function passesMarketFilter(record: LandRecord, filter: FilterState['market']) {
  return filter === 'all' || marketId(record) === filter;
}

export const VACANCY_LABELS = {
  verified_vacant: 'Vacant on record',
  probable_vacant: 'Likely vacant',
  improved: 'Improved',
  unclear: 'Needs review',
} as const;
