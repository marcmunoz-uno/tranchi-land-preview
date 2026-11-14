import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bookmark, BookmarkCheck, BookmarkPlus, BadgeDollarSign, Check, ChevronDown, Download, FileDown, Filter, Info, List, Map, Mountain, Share2, X } from 'lucide-react';
import { dataset } from './data/land';
import { dealDataset } from './data/deals';
import { acresLabel, addressLabel, DEFAULT_FILTERS, filterLandRecords, landSellerSignal } from './lib/analysis';
import type { FilterState, LandRecord } from './types';
import { LandMap } from './components/LandMap';
import { FiltersPanel } from './components/FiltersPanel';
import { ParcelList } from './components/ParcelList';
import { ParcelDetail } from './components/ParcelDetail';
import { ShortlistPanel } from './components/ShortlistPanel';
import { CompareParcels } from './components/CompareParcels';
import { CompOfferDialog } from './components/CompOfferDialog';
import { DealFeed } from './components/DealFeed';
import {
  buildWorkspaceUrl,
  loadShortlist,
  MAX_COMPARE,
  parseWorkspaceUrl,
  persistShortlist,
  toggleShortlist,
} from './lib/shortlist';

const STORAGE_KEY = 'tranchi.land.savedSearches.v1';
const VALID_PARCEL_IDS = new Set(dataset.records.map(record => record.id));
const VALID_FILTER_VALUES = {
  zoning: new Set(dataset.records.map(record => record.lot.zoning).filter((value): value is string => Boolean(value))),
  topography: new Set(dataset.records.map(record => record.lot.topography).filter((value): value is string => Boolean(value))),
  markets: new Set(dataset.markets.map(market => market.id)),
};
type SavedSearch = { name: string; filters: FilterState };
type ViewMode = 'map' | 'list';
type WorkspaceTab = 'land' | 'deals';

function loadSavedSearches(): SavedSearch[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(item => typeof item?.name === 'string' && item?.filters).slice(0, 20) : [];
  } catch { return []; }
}

function csvCell(value: unknown) {
  const text = value == null ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

async function copyText(value: string) {
  try { await navigator.clipboard.writeText(value); }
  catch {
    const input = document.createElement('textarea');
    input.value = value;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    input.remove();
  }
}

export default function App() {
  const [initialUrl] = useState(() => parseWorkspaceUrl(window.location.search, VALID_PARCEL_IDS, VALID_FILTER_VALUES));
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>(() => new URLSearchParams(window.location.search).get('workspace') === 'deals' ? 'deals' : 'land');
  const [view, setView] = useState<ViewMode>(initialUrl.view);
  const [filters, setFilters] = useState<FilterState>(initialUrl.filters);
  const [selectedId, setSelectedId] = useState<string | null>(initialUrl.selectedId ?? dataset.records[0]?.id ?? null);
  const [detailOpen, setDetailOpen] = useState(Boolean(initialUrl.selectedId));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>(loadSavedSearches);
  const [searchName, setSearchName] = useState('');
  const [saveOpen, setSaveOpen] = useState(false);
  const [shortlistedIds, setShortlistedIds] = useState<string[]>(() => initialUrl.hasShortlistParam ? initialUrl.shortlistedIds : loadShortlist(localStorage, VALID_PARCEL_IDS));
  const [compareIds, setCompareIds] = useState<string[]>(initialUrl.compareIds);
  const [shortlistOnly, setShortlistOnly] = useState(initialUrl.shortlistOnly);
  const [shortlistOpen, setShortlistOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(initialUrl.compareOpen);
  const [offerRecord, setOfferRecord] = useState<LandRecord | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [urlWarningDismissed, setUrlWarningDismissed] = useState(false);
  const [shared, setShared] = useState(false);

  const allFiltered = useMemo(() => filterLandRecords(dataset.records, filters), [filters]);
  const filtered = useMemo(() => shortlistOnly ? allFiltered.filter(record => shortlistedIds.includes(record.id)) : allFiltered, [allFiltered, shortlistOnly, shortlistedIds]);
  const selected = dataset.records.find(record => record.id === selectedId) ?? null;
  const shortlistedRecords = useMemo(() => shortlistedIds.flatMap(id => {
    const record = dataset.records.find(item => item.id === id);
    return record ? [record] : [];
  }), [shortlistedIds]);
  const compareRecords = useMemo(() => compareIds.flatMap(id => {
    const record = dataset.records.find(item => item.id === id);
    return record && shortlistedIds.includes(id) ? [record] : [];
  }), [compareIds, shortlistedIds]);
  const latestCache = useMemo(() => dataset.records.map(r => r.cachedAt).sort().at(-1)?.slice(0, 10), []);

  useEffect(() => {
    if (selectedId && !filtered.some(record => record.id === selectedId)) {
      setSelectedId(filtered[0]?.id ?? null);
      setDetailOpen(false);
    }
  }, [filtered, selectedId]);

  useEffect(() => {
    persistShortlist(localStorage, shortlistedIds);
  }, [shortlistedIds]);

  useEffect(() => {
    const url = buildWorkspaceUrl(window.location.href, {
      filters, shortlistedIds, compareIds, compareOpen, shortlistOnly, view, selectedId,
    });
    if (workspaceTab === 'deals') url.searchParams.set('workspace', 'deals');
    else url.searchParams.delete('workspace');
    window.history.replaceState({}, '', url);
  }, [filters, shortlistedIds, compareIds, compareOpen, shortlistOnly, view, selectedId, workspaceTab]);

  useEffect(() => {
    if (compareOpen && compareRecords.length < 2) setCompareOpen(false);
  }, [compareOpen, compareRecords.length]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 6000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const selectParcel = useCallback((id: string) => {
    setSelectedId(id);
    setDetailOpen(true);
  }, []);

  const changeView = (next: ViewMode) => setView(next);
  const changeWorkspace = (next: WorkspaceTab) => {
    setWorkspaceTab(next);
    setFiltersOpen(false);
    setDetailOpen(false);
    setShortlistOpen(false);
    setCompareOpen(false);
    setOfferRecord(null);
  };
  const resetFilters = () => setFilters(DEFAULT_FILTERS);
  const saveSearch = () => {
    const name = searchName.trim().slice(0, 60);
    if (!name) return;
    const next = [...savedSearches.filter(item => item.name.toLowerCase() !== name.toLowerCase()), { name, filters }].sort((a, b) => a.name.localeCompare(b.name));
    setSavedSearches(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* the current session still works */ }
    setSearchName(''); setSaveOpen(false); setToast(`Saved “${name}” on this device`);
  };
  const deleteSearch = (name: string) => {
    const next = savedSearches.filter(item => item.name !== name);
    setSavedSearches(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* no-op */ }
  };

  const toggleParcel = (record: LandRecord) => {
    const removing = shortlistedIds.includes(record.id);
    setShortlistedIds(ids => toggleShortlist(ids, record.id, VALID_PARCEL_IDS));
    if (removing) setCompareIds(ids => ids.filter(id => id !== record.id));
    setToast(removing ? 'Removed from shortlist' : 'Added to shortlist');
  };
  const removeParcel = (id: string) => {
    setShortlistedIds(ids => ids.filter(savedId => savedId !== id));
    setCompareIds(ids => ids.filter(compareId => compareId !== id));
    setToast('Removed from shortlist');
  };
  const clearShortlist = () => {
    setShortlistedIds([]);
    setCompareIds([]);
    setCompareOpen(false);
    setToast('Shortlist cleared on this device');
  };
  const toggleCompare = (id: string) => {
    setCompareIds(ids => ids.includes(id) ? ids.filter(compareId => compareId !== id) : ids.length < MAX_COMPARE ? [...ids, id] : ids);
  };
  const openComparison = () => {
    if (compareIds.length < 2) return;
    setShortlistOpen(false);
    setCompareOpen(true);
  };
  const shareSearch = async () => {
    const url = buildWorkspaceUrl(window.location.href, {
      filters, shortlistedIds, compareIds, compareOpen, shortlistOnly, view, selectedId,
    });
    window.history.replaceState({}, '', url);
    await copyText(url.toString());
    setToast(`Search link copied with ${shortlistedIds.length} shortlisted parcel${shortlistedIds.length === 1 ? '' : 's'}`);
  };
  const shareParcel = async () => {
    if (!selected) return;
    const url = buildWorkspaceUrl(window.location.href, {
      filters, shortlistedIds, compareIds, compareOpen, shortlistOnly, view, selectedId: selected.id,
    });
    await copyText(url.toString());
    setShared(true); setToast('Parcel and search link copied'); window.setTimeout(() => setShared(false), 2200);
  };
  const exportCsv = () => {
    const headers = ['Address', 'APN', 'City', 'State', 'ZIP', 'Acres', 'Square feet', 'Zoning', 'Topography', 'Frontage feet', 'Assessor land value', 'Last sale price', 'Last sale date', 'Seller signal', 'Vacancy status', 'Vacancy score', 'Field completeness', 'Motivation flags', 'Latitude', 'Longitude'];
    const rows = filtered.map(record => [addressLabel(record), record.apn, record.address.city, record.address.state, record.address.zip, record.lot.acres, record.lot.squareFeet, record.lot.zoning, record.lot.topography, record.lot.frontageFeet, record.assessment.landMarketValue, record.sale.price, record.sale.date, landSellerSignal(record).score, record.validation.status, record.validation.score, `${record.validation.fieldCompleteness}%`, record.flags.join('|'), record.address.lat, record.address.lng]);
    const csv = [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `tranchi-land-${filtered.length}-parcels.csv`; link.click(); URL.revokeObjectURL(link.href);
    setToast(`Exported ${filtered.length} parcels without owner contact details`);
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand-block">
          <div className="brand-mark"><Mountain size={20} /></div>
          <div><span className="brand-name">TRANCHI <span>LAND</span></span><span className="brand-subtitle">Land flipping workspace</span></div>
        </div>
        <div className="dataset-pill"><span className="live-dot" /> {workspaceTab === 'deals' ? `${dealDataset.recordCount} real production deals` : <>Interactive preview <span>·</span> {dataset.markets.length} markets</>}</div>
        <div className="workspace-switch" aria-label="Workspace"><button className={workspaceTab === 'land' ? 'active' : ''} aria-pressed={workspaceTab === 'land'} onClick={() => changeWorkspace('land')}><Mountain size={14} /> Land parcels</button><button className={workspaceTab === 'deals' ? 'active' : ''} aria-pressed={workspaceTab === 'deals'} onClick={() => changeWorkspace('deals')}><BadgeDollarSign size={14} /> Real deals</button></div>
        {workspaceTab === 'land' && <div className="header-actions">
          <button className="secondary-button shortlist-header-button" onClick={() => setShortlistOpen(true)} aria-label={`Open shortlist, ${shortlistedIds.length} parcels`}><Bookmark size={16} /><span className="header-button-label">Shortlist</span><span className="shortlist-count">{shortlistedIds.length}</span></button>
          <button className="secondary-button share-search-button" onClick={shareSearch} aria-label="Share search"><Share2 size={16} /><span className="header-button-label">Share search</span></button>
          <button className="secondary-button export-button" onClick={exportCsv} disabled={!filtered.length}><Download size={16} /> Export CSV</button>
          <button className="mobile-filter-button" onClick={() => setFiltersOpen(true)}><Filter size={17} /> Filters</button>
        </div>}
      </header>

      {workspaceTab === 'deals' ? <DealFeed /> : <>
      <div className="workspace-toolbar">
        <div>
          <h1>Find the land. See the math.</h1>
          <p>{filtered.length} of {dataset.recordCount} real cached parcels{shortlistOnly ? ' in your shortlist' : ''}{latestCache ? ` · cached through ${latestCache}` : ''}</p>
        </div>
        <div className="toolbar-actions">
          <div className="saved-search-wrap">
            <button className="secondary-button" onClick={() => setSaveOpen(!saveOpen)}><Bookmark size={15} /> Save search <ChevronDown size={14} /></button>
            {saveOpen && <div className="save-popover">
              <label>Name this filter set<div className="save-input-row"><input autoFocus value={searchName} onChange={e => setSearchName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveSearch(); }} placeholder="e.g. Small absentee lots" /><button className="primary-button" onClick={saveSearch} disabled={!searchName.trim()}>Save</button></div></label>
              {savedSearches.length > 0 && <div className="saved-list">{savedSearches.map(item => <div key={item.name}><button onClick={() => { setFilters(item.filters); setSaveOpen(false); }}>{item.name}</button><button className="icon-button" onClick={() => deleteSearch(item.name)} aria-label={`Delete ${item.name}`}><X size={13} /></button></div>)}</div>}
            </div>}
          </div>
          <div className="view-toggle" aria-label="Workspace layout">
            <button className={view === 'map' ? 'active' : ''} onClick={() => changeView('map')}><Map size={16} /> Map</button>
            <button className={view === 'list' ? 'active' : ''} onClick={() => changeView('list')}><List size={16} /> List</button>
          </div>
        </div>
      </div>

      <div className="data-notice"><Info size={14} /><span>Real cached public records from Cleveland OH, Bastrop TX, and Lehigh Acres FL. No owner contact details, skip tracing, contracts, or outbound actions.</span></div>
      <div className="shortlist-scope-bar">
        <div className="scope-toggle" aria-label="Parcel browsing scope">
          <button className={!shortlistOnly ? 'active' : ''} aria-pressed={!shortlistOnly} onClick={() => setShortlistOnly(false)}>All parcels</button>
          <button className={shortlistOnly ? 'active' : ''} aria-pressed={shortlistOnly} onClick={() => setShortlistOnly(true)}><Bookmark size={14} /> Shortlist only <span>{shortlistedIds.length}</span></button>
        </div>
        <span>{shortlistOnly ? 'Browsing only shortlisted parcels · all filters still apply' : 'Select a parcel below, then add it to your shortlist'}</span>
      </div>

      <main className={`workspace ${view === 'list' ? 'list-view' : 'map-view'}${selected && detailOpen ? ' has-detail' : ''}`}>
        <div className={`filters-container${filtersOpen ? ' mobile-open' : ''}`}>
          <div className="mobile-drawer-heading"><strong>Filters</strong><button className="icon-button" onClick={() => setFiltersOpen(false)} aria-label="Close filters"><X size={19} /></button></div>
          <FiltersPanel records={dataset.records} filters={filters} onChange={setFilters} onReset={resetFilters} />
        </div>
        {filtersOpen && <button className="drawer-backdrop" onClick={() => setFiltersOpen(false)} aria-label="Close filters overlay" />}
        <section className="results-workspace">
          {selected && <div className="selected-action-bar">
            <div><span>Selected parcel</span><strong>{selected.address.street ?? selected.apn ?? 'Land parcel'}</strong><small>{acresLabel(selected.lot.acres)} · {selected.lot.zoning ?? 'Zoning unknown'}</small></div>
            <div className="selected-parcel-actions">
              <button className={`secondary-button${shortlistedIds.includes(selected.id) ? ' is-shortlisted' : ''}`} aria-pressed={shortlistedIds.includes(selected.id)} onClick={() => toggleParcel(selected)}>{shortlistedIds.includes(selected.id) ? <BookmarkCheck size={16} /> : <BookmarkPlus size={16} />}<span>{shortlistedIds.includes(selected.id) ? 'Shortlisted' : 'Add to shortlist'}</span></button>
              <button className="secondary-button" onClick={() => setOfferRecord(selected)}><FileDown size={16} /><span>Comp / offer PDF</span></button>
            </div>
          </div>}
          <div className="parcel-stage">
            {shortlistOnly && !filtered.length ? <div className="empty-state shortlist-browse-empty">
              <Bookmark size={30} />
              <h3>{shortlistedIds.length ? 'No shortlisted parcels match these filters' : 'Your shortlist is empty'}</h3>
              <p>{shortlistedIds.length ? 'Clear or widen the filters to see your saved parcels again.' : 'Browse all parcels, select one on the map or in the list, and add it to your shortlist.'}</p>
              <button className="secondary-button" onClick={shortlistedIds.length ? resetFilters : () => setShortlistOnly(false)}>{shortlistedIds.length ? 'Reset filters' : 'Browse all parcels'}</button>
            </div> : view === 'map' ? <LandMap records={filtered} selectedId={selectedId} onSelect={selectParcel} /> : <ParcelList records={filtered} selectedId={selectedId} onSelect={selectParcel} onReset={resetFilters} />}
          </div>
        </section>
        {selected && detailOpen && <ParcelDetail record={selected} onClose={() => setDetailOpen(false)} onShare={shareParcel} shared={shared} />}
      </main>
      </>}

      <footer className="app-footer"><span>Tranchi Land · product concept preview</span><span>Public records can be wrong or stale. Verify before making an offer.</span></footer>
      {shortlistOpen && <ShortlistPanel records={shortlistedRecords} compareIds={compareIds} onClose={() => setShortlistOpen(false)} onSelect={id => { selectParcel(id); setShortlistOpen(false); }} onRemove={removeParcel} onClear={clearShortlist} onToggleCompare={toggleCompare} onCompare={openComparison} />}
      {compareOpen && !offerRecord && compareRecords.length >= 2 && <CompareParcels records={compareRecords} onClose={() => setCompareOpen(false)} onRemove={id => setCompareIds(ids => ids.filter(compareId => compareId !== id))} onOfferPdf={setOfferRecord} />}
      {offerRecord && <CompOfferDialog record={offerRecord} onClose={() => setOfferRecord(null)} onDownloaded={filename => setToast(`PDF downloaded · ${filename}`)} />}
      {initialUrl.recovered && !urlWarningDismissed && <div className="toast url-warning" role="alert"><span>Some shared-link values were invalid and were safely reset.</span><button onClick={() => setUrlWarningDismissed(true)}>Dismiss</button></div>}
      {toast && <div className="toast" role="status"><Check size={16} />{toast}</div>}
    </div>
  );
}
