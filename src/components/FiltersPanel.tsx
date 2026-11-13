import { RotateCcw, Search } from 'lucide-react';
import type { FilterState, LandRecord, MotivationFilter, SortMode } from '../types';
import { DEFAULT_FILTERS } from '../lib/analysis';

export function FiltersPanel({ records, filters, onChange, onReset }: {
  records: LandRecord[];
  filters: FilterState;
  onChange: (next: FilterState) => void;
  onReset: () => void;
}) {
  const update = <K extends keyof FilterState>(key: K, value: FilterState[K]) => onChange({ ...filters, [key]: value });
  const zoning = [...new Set(records.map(r => r.lot.zoning).filter((v): v is string => Boolean(v)))].sort();
  const topography = [...new Set(records.map(r => r.lot.topography).filter((v): v is string => Boolean(v)))].sort();
  return (
    <aside className="filters-panel" aria-label="Land filters">
      <div className="filters-heading">
        <div><span className="eyebrow">Search the dataset</span><h2>Find your angle</h2></div>
        <button className="icon-button" onClick={onReset} title="Reset filters" aria-label="Reset filters"><RotateCcw size={16} /></button>
      </div>
      <label className="search-field">
        <Search size={16} />
        <input value={filters.search} onChange={e => update('search', e.target.value)} placeholder="Address, APN, or ZIP" aria-label="Search address, APN, or ZIP" />
      </label>
      <div className="field-group">
        <span className="field-label">Lot size</span>
        <div className="field-row">
          <label><span>Min acres</span><input type="number" min="0" step="0.01" value={filters.minAcres} onChange={e => update('minAcres', e.target.value)} placeholder="0" /></label>
          <label><span>Max acres</span><input type="number" min="0" step="0.01" value={filters.maxAcres} onChange={e => update('maxAcres', e.target.value)} placeholder="Any" /></label>
        </div>
      </div>
      <label className="field-group"><span className="field-label">Zoning</span>
        <select value={filters.zoning} onChange={e => update('zoning', e.target.value)}>
          <option value="all">All zoning codes</option>
          {zoning.map(value => <option key={value} value={value}>{value}</option>)}
        </select>
      </label>
      <label className="field-group"><span className="field-label">Topography</span>
        <select value={filters.topography} onChange={e => update('topography', e.target.value)}>
          <option value="all">All terrain</option>
          {topography.map(value => <option key={value} value={value}>{value}</option>)}
        </select>
      </label>
      <label className="field-group"><span className="field-label">Seller angle</span>
        <select value={filters.motivation} onChange={e => update('motivation', e.target.value as MotivationFilter)}>
          <option value="all">Any seller situation</option>
          <option value="absentee">Absentee / out of state</option>
          <option value="failed">Tried to sell before</option>
          <option value="pressure">Financial or legal pressure</option>
          <option value="entity">Corporate or trust owned</option>
          <option value="equity">High equity / free and clear</option>
        </select>
      </label>
      <label className="toggle-row">
        <span><strong>Arms-length sale history</strong><small>Only parcels with a recorded standard sale</small></span>
        <input type="checkbox" checked={filters.armsLengthOnly} onChange={e => update('armsLengthOnly', e.target.checked)} />
      </label>
      <label className="field-group"><span className="field-label">Sort results</span>
        <select value={filters.sort} onChange={e => update('sort', e.target.value as SortMode)}>
          <option value="score">Strongest seller signal</option>
          <option value="acresAsc">Smallest first</option>
          <option value="acresDesc">Largest first</option>
          <option value="landValue">Assessor land value</option>
          <option value="recentSale">Most recent sale</option>
        </select>
      </label>
      <div className="unavailable-filters">
        <span>Not in this dataset</span>
        <p>Flood zone, wetlands, canal access, and parcel-boundary polygons are not available in the Cleveland preview.</p>
      </div>
      {JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS) && <button className="text-button" onClick={onReset}>Clear all filters</button>}
    </aside>
  );
}
