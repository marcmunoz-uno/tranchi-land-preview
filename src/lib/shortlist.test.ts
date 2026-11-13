import { describe, expect, it } from 'vitest';
import { DEFAULT_FILTERS } from './analysis';
import {
  addToShortlist,
  buildWorkspaceUrl,
  loadShortlist,
  MAX_COMPARE,
  parseWorkspaceUrl,
  persistShortlist,
  removeFromShortlist,
  sanitizeShortlist,
  SHORTLIST_STORAGE_KEY,
  toggleShortlist,
  type WorkspaceUrlState,
} from './shortlist';

const validIds = new Set(['parcel-a', 'parcel-b', 'parcel-c', 'parcel-d', 'parcel-e', 'parcel-f']);

function memoryStorage(initial: string | null = null) {
  let value = initial;
  return {
    getItem: (key: string) => key === SHORTLIST_STORAGE_KEY ? value : null,
    setItem: (key: string, next: string) => { if (key === SHORTLIST_STORAGE_KEY) value = next; },
  };
}

describe('shortlist state', () => {
  it('adds, removes, and toggles only known parcel IDs without duplicates', () => {
    let ids: string[] = [];
    ids = addToShortlist(ids, 'parcel-a', validIds);
    ids = addToShortlist(ids, 'parcel-a', validIds);
    ids = addToShortlist(ids, 'not-a-parcel', validIds);
    expect(ids).toEqual(['parcel-a']);
    ids = addToShortlist(ids, 'parcel-b', validIds);
    expect(removeFromShortlist(ids, 'parcel-a')).toEqual(['parcel-b']);
    expect(toggleShortlist(ids, 'parcel-b', validIds)).toEqual(['parcel-a']);
    expect(toggleShortlist(ids, 'parcel-c', validIds)).toEqual(['parcel-a', 'parcel-b', 'parcel-c']);
  });

  it('sanitizes malformed persisted values and survives storage failures', () => {
    expect(sanitizeShortlist({ parcel: 'parcel-a' }, validIds)).toEqual([]);
    expect(sanitizeShortlist(['parcel-a', 'parcel-a', 4, null, 'unknown', 'parcel-b'], validIds)).toEqual(['parcel-a', 'parcel-b']);
    expect(loadShortlist(memoryStorage('{broken json'), validIds)).toEqual([]);
    expect(loadShortlist(memoryStorage('null'), validIds)).toEqual([]);
    expect(loadShortlist(null, validIds)).toEqual([]);
    expect(persistShortlist({ setItem: () => { throw new Error('quota'); } }, ['parcel-a'])).toBe(false);
  });

  it('round-trips persistent shortlist state', () => {
    const storage = memoryStorage();
    expect(persistShortlist(storage, ['parcel-a', 'parcel-c'])).toBe(true);
    expect(loadShortlist(storage, validIds)).toEqual(['parcel-a', 'parcel-c']);
  });
});

describe('shareable workspace URLs', () => {
  it('round-trips filters, shortlist, compare view, scope, layout, and selected parcel', () => {
    const state: WorkspaceUrlState = {
      filters: {
        search: 'Cleveland 44105', market: 'Bastrop, TX', vacancy: 'include_unclear', minAcres: '0.1', maxAcres: '2.5', zoning: 'Residential',
        topography: 'Level', motivation: 'absentee', armsLengthOnly: true, sort: 'landValue',
      },
      shortlistedIds: ['parcel-a', 'parcel-b', 'parcel-c'],
      compareIds: ['parcel-c', 'parcel-a'],
      compareOpen: true,
      shortlistOnly: true,
      view: 'list',
      selectedId: 'parcel-c',
    };
    const url = buildWorkspaceUrl('https://example.test/land?stale=keep', state);
    expect(url.searchParams.get('stale')).toBe('keep');
    expect(parseWorkspaceUrl(url.search, validIds)).toMatchObject({ ...state, hasShortlistParam: true, recovered: false });
  });

  it('round-trips an explicitly empty shortlist', () => {
    const url = buildWorkspaceUrl('https://example.test/', {
      filters: DEFAULT_FILTERS, shortlistedIds: [], compareIds: [], compareOpen: false,
      shortlistOnly: false, view: 'map', selectedId: null,
    });
    expect(url.searchParams.get('saved')).toBe('');
    expect(parseWorkspaceUrl(url.search, validIds)).toMatchObject({ shortlistedIds: [], hasShortlistParam: true, recovered: false });
  });

  it('falls back safely for corrupt values, unknown IDs, and invalid compare state', () => {
    const parsed = parseWorkspaceUrl(
      '?q=x&min=-2&max=nope&motivation=hack&sort=hack&arms=maybe&saved=unknown,parcel-a,parcel-a&compare=unknown&scope=hack&layout=hack&parcel=unknown',
      validIds,
    );
    expect(parsed.filters).toEqual({ ...DEFAULT_FILTERS, search: 'x' });
    expect(parsed.shortlistedIds).toEqual(['parcel-a']);
    expect(parsed.compareIds).toEqual([]);
    expect(parsed.compareOpen).toBe(false);
    expect(parsed.shortlistOnly).toBe(false);
    expect(parsed.view).toBe('map');
    expect(parsed.selectedId).toBeNull();
    expect(parsed.recovered).toBe(true);
  });

  it('resets unsupported market, zoning, and topography values instead of silently returning no parcels', () => {
    const parsed = parseWorkspaceUrl(
      '?zoning=not-a-zone&topo=not-terrain&market=not-a-market',
      validIds,
      { zoning: new Set(['R1']), topography: new Set(['Level']), markets: new Set(['Cleveland, OH']) },
    );
    expect(parsed.filters.zoning).toBe(DEFAULT_FILTERS.zoning);
    expect(parsed.filters.topography).toBe(DEFAULT_FILTERS.topography);
    expect(parsed.filters.market).toBe(DEFAULT_FILTERS.market);
    expect(parsed.recovered).toBe(true);
  });

  it('keeps compare limited to five shortlisted parcels', () => {
    const saved = [...validIds];
    const parsed = parseWorkspaceUrl(`?saved=${saved.join(',')}&compare=${saved.join(',')}`, validIds);
    expect(parsed.compareIds).toHaveLength(MAX_COMPARE);
    expect(parsed.compareOpen).toBe(true);
    expect(parsed.recovered).toBe(true);
  });
});
