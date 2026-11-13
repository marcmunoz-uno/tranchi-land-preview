import { DEFAULT_FILTERS } from './analysis';
import type { FilterState, MotivationFilter, SortMode } from '../types';

export const SHORTLIST_STORAGE_KEY = 'tranchi.land.shortlist.v1';
export const MAX_COMPARE = 5;

const MOTIVATIONS = new Set<MotivationFilter>(['all', 'absentee', 'failed', 'pressure', 'entity', 'equity']);
const SORTS = new Set<SortMode>(['score', 'acresAsc', 'acresDesc', 'landValue', 'recentSale']);
const SHARE_PARAMS = ['q', 'market', 'vacancy', 'min', 'max', 'zoning', 'topo', 'motivation', 'arms', 'sort', 'saved', 'compare', 'scope'] as const;

export type WorkspaceUrlState = {
  filters: FilterState;
  shortlistedIds: string[];
  compareIds: string[];
  compareOpen: boolean;
  shortlistOnly: boolean;
  view: 'map' | 'list';
  selectedId: string | null;
};

export type ParsedWorkspaceUrl = WorkspaceUrlState & {
  hasShortlistParam: boolean;
  recovered: boolean;
};

export function sanitizeShortlist(value: unknown, validIds: ReadonlySet<string>): string[] {
  if (!Array.isArray(value)) return [];
  const result: string[] = [];
  for (const id of value) {
    if (typeof id !== 'string' || !validIds.has(id) || result.includes(id)) continue;
    result.push(id);
    if (result.length === validIds.size) break;
  }
  return result;
}

export function addToShortlist(ids: string[], id: string, validIds: ReadonlySet<string>): string[] {
  return validIds.has(id) && !ids.includes(id) ? [...ids, id] : ids;
}

export function removeFromShortlist(ids: string[], id: string): string[] {
  return ids.filter(savedId => savedId !== id);
}

export function toggleShortlist(ids: string[], id: string, validIds: ReadonlySet<string>): string[] {
  return ids.includes(id) ? removeFromShortlist(ids, id) : addToShortlist(ids, id, validIds);
}

export function loadShortlist(storage: Pick<Storage, 'getItem'> | null, validIds: ReadonlySet<string>): string[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(SHORTLIST_STORAGE_KEY);
    return raw ? sanitizeShortlist(JSON.parse(raw), validIds) : [];
  } catch {
    return [];
  }
}

export function persistShortlist(storage: Pick<Storage, 'setItem'> | null, ids: string[]): boolean {
  if (!storage) return false;
  try {
    storage.setItem(SHORTLIST_STORAGE_KEY, JSON.stringify(ids));
    return true;
  } catch {
    return false;
  }
}

function parseIds(raw: string | null, validIds: ReadonlySet<string>) {
  if (raw === null) return { ids: [] as string[], invalid: false };
  const parts = raw === '' ? [] : raw.split(',');
  const ids = sanitizeShortlist(parts, validIds);
  return { ids, invalid: ids.length !== new Set(parts).size };
}

function validAcreage(value: string | null) {
  if (value === null || value === '') return '';
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? value : null;
}

export function parseWorkspaceUrl(search: string, validIds: ReadonlySet<string>): ParsedWorkspaceUrl {
  const params = new URLSearchParams(search);
  const filters: FilterState = { ...DEFAULT_FILTERS };
  let recovered = false;

  const query = params.get('q');
  const market = params.get('market');
  if (market !== null) {
    if (market.length <= 100 && !/[\u0000-\u001f]/.test(market)) filters.market = market;
    else recovered = true;
  }
  const vacancy = params.get('vacancy');
  if (vacancy !== null) {
    if (vacancy === 'likely' || vacancy === 'include_unclear' || vacancy === 'all') filters.vacancy = vacancy;
    else recovered = true;
  }
  if (query !== null) {
    if (query.length <= 120) filters.search = query;
    else recovered = true;
  }
  for (const [param, key] of [['min', 'minAcres'], ['max', 'maxAcres']] as const) {
    const value = validAcreage(params.get(param));
    if (value === null) recovered = true;
    else filters[key] = value;
  }
  for (const [param, key] of [['zoning', 'zoning'], ['topo', 'topography']] as const) {
    const value = params.get(param);
    if (value === null) continue;
    if (value.length <= 80 && !/[\u0000-\u001f]/.test(value)) filters[key] = value;
    else recovered = true;
  }
  const motivation = params.get('motivation');
  if (motivation !== null) {
    if (MOTIVATIONS.has(motivation as MotivationFilter)) filters.motivation = motivation as MotivationFilter;
    else recovered = true;
  }
  const sort = params.get('sort');
  if (sort !== null) {
    if (SORTS.has(sort as SortMode)) filters.sort = sort as SortMode;
    else recovered = true;
  }
  const arms = params.get('arms');
  if (arms !== null) {
    if (arms === '1' || arms === '0') filters.armsLengthOnly = arms === '1';
    else recovered = true;
  }

  const saved = parseIds(params.get('saved'), validIds);
  const compare = parseIds(params.get('compare'), validIds);
  const compareIds = compare.ids.filter(id => saved.ids.includes(id)).slice(0, MAX_COMPARE);
  if (saved.invalid || compare.invalid || compareIds.length !== compare.ids.length) recovered = true;
  const compareOpen = params.has('compare') && compareIds.length >= 2;
  if (params.has('compare') && !compareOpen) recovered = true;

  const scope = params.get('scope');
  if (scope !== null && scope !== 'all' && scope !== 'shortlist') recovered = true;
  const layout = params.get('layout');
  if (layout !== null && layout !== 'map' && layout !== 'list') recovered = true;
  const parcel = params.get('parcel');
  const selectedId = parcel && validIds.has(parcel) ? parcel : null;
  if (parcel && !selectedId) recovered = true;

  return {
    filters,
    shortlistedIds: saved.ids,
    compareIds,
    compareOpen,
    shortlistOnly: scope === 'shortlist',
    view: layout === 'list' ? 'list' : 'map',
    selectedId,
    hasShortlistParam: params.has('saved'),
    recovered,
  };
}

export function buildWorkspaceUrl(base: string | URL, state: WorkspaceUrlState): URL {
  const url = new URL(base);
  SHARE_PARAMS.forEach(param => url.searchParams.delete(param));
  const { filters } = state;
  if (filters.search !== DEFAULT_FILTERS.search) url.searchParams.set('q', filters.search.slice(0, 120));
  if (filters.market !== DEFAULT_FILTERS.market) url.searchParams.set('market', filters.market);
  if (filters.vacancy !== DEFAULT_FILTERS.vacancy) url.searchParams.set('vacancy', filters.vacancy);
  if (filters.minAcres !== DEFAULT_FILTERS.minAcres) url.searchParams.set('min', filters.minAcres);
  if (filters.maxAcres !== DEFAULT_FILTERS.maxAcres) url.searchParams.set('max', filters.maxAcres);
  if (filters.zoning !== DEFAULT_FILTERS.zoning) url.searchParams.set('zoning', filters.zoning);
  if (filters.topography !== DEFAULT_FILTERS.topography) url.searchParams.set('topo', filters.topography);
  if (filters.motivation !== DEFAULT_FILTERS.motivation) url.searchParams.set('motivation', filters.motivation);
  if (filters.armsLengthOnly !== DEFAULT_FILTERS.armsLengthOnly) url.searchParams.set('arms', '1');
  if (filters.sort !== DEFAULT_FILTERS.sort) url.searchParams.set('sort', filters.sort);
  url.searchParams.set('saved', state.shortlistedIds.join(','));
  if (state.compareOpen && state.compareIds.length >= 2) {
    url.searchParams.set('compare', state.compareIds.slice(0, MAX_COMPARE).join(','));
  } else {
    url.searchParams.delete('compare');
  }
  if (state.shortlistOnly) url.searchParams.set('scope', 'shortlist');
  if (state.view === 'list') url.searchParams.set('layout', 'list');
  else url.searchParams.delete('layout');
  if (state.selectedId) url.searchParams.set('parcel', state.selectedId);
  else url.searchParams.delete('parcel');
  return url;
}
