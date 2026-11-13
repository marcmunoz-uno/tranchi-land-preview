import { ArrowUpRight, MapPin } from 'lucide-react';
import type { LandRecord } from '../types';
import { acresLabel, addressLabel, dateLabel, landSellerSignal, money } from '../lib/analysis';
import { ValidationBadge } from './ValidationBadge';

export function ParcelList({ records, selectedId, onSelect, onReset }: {
  records: LandRecord[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onReset: () => void;
}) {
  if (!records.length) return (
    <div className="empty-state">
      <MapPin size={28} />
      <h3>No parcels match these filters</h3>
      <p>Try widening the acreage range or clearing the seller-angle filter.</p>
      <button className="secondary-button" onClick={onReset}>Reset filters</button>
    </div>
  );
  return (
    <div className="parcel-list">
      {records.map(record => {
        const signal = landSellerSignal(record);
        return (
          <button key={record.id} className={`parcel-card${selectedId === record.id ? ' selected' : ''}`} onClick={() => onSelect(record.id)}>
            <span className="parcel-card-top">
              <span className="parcel-address">{addressLabel(record)}</span>
              <ArrowUpRight size={16} />
            </span>
            <span className="parcel-facts"><strong>{acresLabel(record.lot.acres)}</strong><span>{record.lot.zoning ?? 'Zoning unknown'}</span><span>{record.lot.topography ?? 'Terrain unknown'}</span></span>
            <span className="parcel-reason">{signal.reasons[0]}</span>
            <ValidationBadge validation={record.validation} compact />
            <span className="parcel-card-bottom">
              <span><small>Assessor land value</small><strong>{money(record.assessment.landMarketValue)}</strong></span>
              <span className="signal-chip" title={signal.reasons.join(' · ')}>{signal.score} seller signal</span>
            </span>
            <span className="parcel-sale">Last sale: {dateLabel(record.sale.date)}{record.sale.price ? ` · ${money(record.sale.price)}` : ''}</span>
          </button>
        );
      })}
    </div>
  );
}
