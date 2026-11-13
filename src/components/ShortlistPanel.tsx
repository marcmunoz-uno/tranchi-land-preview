import { useEffect } from 'react';
import { ArrowLeftRight, Bookmark, Check, MapPin, Trash2, X } from 'lucide-react';
import type { LandRecord } from '../types';
import { acresLabel, addressLabel, landSellerSignal, money } from '../lib/analysis';
import { MAX_COMPARE } from '../lib/shortlist';

export function ShortlistPanel({ records, compareIds, onClose, onSelect, onRemove, onClear, onToggleCompare, onCompare }: {
  records: LandRecord[];
  compareIds: string[];
  onClose: () => void;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onToggleCompare: (id: string) => void;
  onCompare: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return <>
    <button className="drawer-backdrop shortlist-backdrop" onClick={onClose} aria-label="Close shortlist overlay" />
    <aside className="shortlist-panel" role="dialog" aria-modal="true" aria-labelledby="shortlist-title">
      <div className="shortlist-header">
        <div><span className="eyebrow">Saved on this device</span><h2 id="shortlist-title">Your shortlist <span>{records.length}</span></h2></div>
        <button autoFocus className="icon-button" onClick={onClose} aria-label="Close shortlist"><X size={20} /></button>
      </div>
      <div className="shortlist-intro">
        <p>Choose {MAX_COMPARE === 5 ? '2–5' : `2–${MAX_COMPARE}`} parcels for a side-by-side comparison. Your shortlist persists on this device and is included when you share a search.</p>
        <div className="shortlist-tools">
          <span>{compareIds.length} selected to compare</span>
          {records.length > 0 && <button className="text-button" onClick={onClear}>Clear shortlist</button>}
        </div>
      </div>
      <div className="shortlist-scroll">
        {!records.length ? <div className="shortlist-empty">
          <Bookmark size={30} />
          <h3>No shortlisted parcels yet</h3>
          <p>Select a parcel on the map or in the list, then choose “Add to shortlist” in the parcel action bar.</p>
          <button className="secondary-button" onClick={onClose}>Browse all parcels</button>
        </div> : <div className="shortlist-cards">{records.map(record => {
          const signal = landSellerSignal(record);
          const compared = compareIds.includes(record.id);
          const compareDisabled = !compared && compareIds.length >= MAX_COMPARE;
          return <article className={`shortlist-card${compared ? ' compare-selected' : ''}`} key={record.id}>
            <label className="compare-check" title={compareDisabled ? `You can compare up to ${MAX_COMPARE} parcels` : 'Include in comparison'}>
              <input type="checkbox" checked={compared} disabled={compareDisabled} onChange={() => onToggleCompare(record.id)} aria-label={`Compare ${addressLabel(record)}`} />
              <span aria-hidden="true">{compared && <Check size={13} />}</span>
            </label>
            <div className="shortlist-card-content">
              <button className="shortlist-address" onClick={() => onSelect(record.id)}>{addressLabel(record)}</button>
              <div className="shortlist-card-facts"><span>{acresLabel(record.lot.acres)}</span><span>{record.lot.zoning ?? 'Zoning unknown'}</span><span>{signal.score} seller signal</span></div>
              <strong>{money(record.assessment.landMarketValue)}</strong>
              <small>Assessor land value</small>
            </div>
            <button className="icon-button shortlist-remove" onClick={() => onRemove(record.id)} aria-label={`Remove ${addressLabel(record)} from shortlist`} title="Remove from shortlist"><Trash2 size={16} /></button>
          </article>;
        })}</div>}
      </div>
      <div className="shortlist-footer">
        <button className="primary-button" onClick={onCompare} disabled={compareIds.length < 2}><ArrowLeftRight size={17} /> Compare selected{compareIds.length ? ` (${compareIds.length})` : ''}</button>
        {compareIds.length < 2 && <span><MapPin size={12} /> Select at least two parcels</span>}
      </div>
    </aside>
  </>;
}
