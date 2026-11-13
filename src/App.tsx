import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bookmark, Check, ChevronDown, Download, Filter, Info, List, Map, Mountain, X } from 'lucide-react';
import { dataset } from './data/land';
import { addressLabel, DEFAULT_FILTERS, filterLandRecords, landSellerSignal } from './lib/analysis';
import type { FilterState } from './types';
import { LandMap } from './components/LandMap';
import { FiltersPanel } from './components/FiltersPanel';
import { ParcelList } from './components/ParcelList';
import { ParcelDetail } from './components/ParcelDetail';

const STORAGE_KEY = 'tranchi.land.savedSearches.v1';
type SavedSearch = { name: string; filters: FilterState };
type ViewMode = 'map' | 'list';

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

export default function App() {
  const params = new URLSearchParams(window.location.search);
  const initialParcel = params.get('parcel');
  const [view, setView] = useState<ViewMode>(params.get('layout') === 'list' ? 'list' : 'map');
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(() => dataset.records.some(r => r.id === initialParcel) ? initialParcel : dataset.records[0]?.id ?? null);
  const [detailOpen, setDetailOpen] = useState(Boolean(initialParcel));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>(loadSavedSearches);
  const [searchName, setSearchName] = useState('');
  const [saveOpen, setSaveOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [shared, setShared] = useState(false);

  const filtered = useMemo(() => filterLandRecords(dataset.records, filters), [filters]);
  const selected = dataset.records.find(record => record.id === selectedId) ?? null;
  const latestCache = useMemo(() => dataset.records.map(r => r.cachedAt).sort().at(-1)?.slice(0, 10), []);

  useEffect(() => {
    if (selectedId && !filtered.some(record => record.id === selectedId)) {
      setSelectedId(filtered[0]?.id ?? null);
      setDetailOpen(false);
    }
  }, [filtered, selectedId]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const selectParcel = useCallback((id: string) => {
    setSelectedId(id);
    setDetailOpen(true);
    const url = new URL(window.location.href);
    url.searchParams.set('parcel', id);
    window.history.replaceState({}, '', url);
  }, []);

  const changeView = (next: ViewMode) => {
    setView(next);
    const url = new URL(window.location.href);
    if (next === 'list') url.searchParams.set('layout', 'list'); else url.searchParams.delete('layout');
    window.history.replaceState({}, '', url);
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
  const shareParcel = async () => {
    if (!selected) return;
    const url = new URL(window.location.href);
    url.searchParams.set('parcel', selected.id);
    try { await navigator.clipboard.writeText(url.toString()); }
    catch {
      const input = document.createElement('textarea'); input.value = url.toString(); document.body.appendChild(input); input.select(); document.execCommand('copy'); input.remove();
    }
    setShared(true); setToast('Parcel link copied'); window.setTimeout(() => setShared(false), 2200);
  };
  const exportCsv = () => {
    const headers = ['Address', 'APN', 'City', 'State', 'ZIP', 'Acres', 'Square feet', 'Zoning', 'Topography', 'Frontage feet', 'Assessor land value', 'Last sale price', 'Last sale date', 'Seller signal', 'Motivation flags', 'Latitude', 'Longitude'];
    const rows = filtered.map(record => [addressLabel(record), record.apn, record.address.city, record.address.state, record.address.zip, record.lot.acres, record.lot.squareFeet, record.lot.zoning, record.lot.topography, record.lot.frontageFeet, record.assessment.landMarketValue, record.sale.price, record.sale.date, landSellerSignal(record).score, record.flags.join('|'), record.address.lat, record.address.lng]);
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
        <div className="dataset-pill"><span className="live-dot" /> Interactive preview <span>·</span> Cleveland, OH</div>
        <div className="header-actions">
          <button className="secondary-button export-button" onClick={exportCsv} disabled={!filtered.length}><Download size={16} /> Export CSV</button>
          <button className="mobile-filter-button" onClick={() => setFiltersOpen(true)}><Filter size={17} /> Filters</button>
        </div>
      </header>

      <div className="workspace-toolbar">
        <div>
          <h1>Find the land. See the math.</h1>
          <p>{filtered.length} of {dataset.recordCount} real cached parcels{latestCache ? ` · cached through ${latestCache}` : ''}</p>
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

      <div className="data-notice"><Info size={14} /><span>Real public-record sample, not a live nationwide feed. No owner contact details, skip tracing, contracts, or outbound actions.</span></div>

      <main className={`workspace ${view === 'list' ? 'list-view' : 'map-view'}${selected && detailOpen ? ' has-detail' : ''}`}>
        <div className={`filters-container${filtersOpen ? ' mobile-open' : ''}`}>
          <div className="mobile-drawer-heading"><strong>Filters</strong><button className="icon-button" onClick={() => setFiltersOpen(false)} aria-label="Close filters"><X size={19} /></button></div>
          <FiltersPanel records={dataset.records} filters={filters} onChange={setFilters} onReset={resetFilters} />
        </div>
        {filtersOpen && <button className="drawer-backdrop" onClick={() => setFiltersOpen(false)} aria-label="Close filters overlay" />}
        <section className="results-workspace">
          {view === 'map' ? <LandMap records={filtered} selectedId={selectedId} onSelect={selectParcel} /> : <ParcelList records={filtered} selectedId={selectedId} onSelect={selectParcel} onReset={resetFilters} />}
        </section>
        {selected && detailOpen && <ParcelDetail record={selected} onClose={() => setDetailOpen(false)} onShare={shareParcel} shared={shared} />}
      </main>

      <footer className="app-footer"><span>Tranchi Land · product concept preview</span><span>Public records can be wrong or stale. Verify before making an offer.</span></footer>
      {toast && <div className="toast" role="status"><Check size={16} />{toast}</div>}
    </div>
  );
}
