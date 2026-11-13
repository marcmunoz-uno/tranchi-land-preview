import { useEffect } from 'react';
import { ArrowLeftRight, FileDown, Info, X } from 'lucide-react';
import type { LandRecord } from '../types';
import { acresLabel, addressLabel, dateLabel, landSellerSignal, money, number } from '../lib/analysis';

function ComparisonRow({ label, values }: { label: string; values: React.ReactNode[] }) {
  return <tr><th scope="row">{label}</th>{values.map((value, index) => <td key={index}>{value}</td>)}</tr>;
}

export function CompareParcels({ records, onClose, onRemove, onOfferPdf }: {
  records: LandRecord[];
  onClose: () => void;
  onRemove: (id: string) => void;
  onOfferPdf: (record: LandRecord) => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const values = (read: (record: LandRecord) => React.ReactNode) => records.map(read);
  return <div className="compare-overlay" role="dialog" aria-modal="true" aria-labelledby="compare-title">
    <header className="compare-header">
      <div><span className="eyebrow">Shortlist workspace</span><h2 id="compare-title"><ArrowLeftRight size={22} /> Compare {records.length} parcels</h2><p>Cached public-record facts, side by side. Unknown values are not inferred.</p></div>
      <button autoFocus className="icon-button" onClick={onClose} aria-label="Close comparison"><X size={22} /></button>
    </header>
    <div className="compare-scroll">
      <table className="compare-table">
        <caption className="sr-only">Side-by-side comparison of shortlisted land parcels</caption>
        <thead><tr><th scope="col">Parcel fact</th>{records.map(record => <th scope="col" key={record.id}>
          <div className="compare-parcel-heading">
            <div><strong>{record.address.street ?? record.apn ?? 'Land parcel'}</strong><span>{record.address.city}, {record.address.state} {record.address.zip ?? ''}</span></div>
            <button className="icon-button" disabled={records.length <= 2} onClick={() => onRemove(record.id)} aria-label={`Remove ${addressLabel(record)} from comparison`} title={records.length <= 2 ? 'A comparison needs at least two parcels' : 'Remove from comparison'}><X size={16} /></button>
          </div>
          <button className="secondary-button compare-pdf-button" onClick={() => onOfferPdf(record)}><FileDown size={14} /> Comp / offer PDF</button>
        </th>)}</tr></thead>
        <tbody>
          <ComparisonRow label="APN" values={values(record => record.apn ?? 'Unknown')} />
          <ComparisonRow label="Acreage" values={values(record => <strong>{acresLabel(record.lot.acres)}</strong>)} />
          <ComparisonRow label="Square feet" values={values(record => record.lot.squareFeet == null ? 'Unknown' : `${number(record.lot.squareFeet, 0)} sq ft`)} />
          <ComparisonRow label="Zoning" values={values(record => record.lot.zoning ?? 'Unknown')} />
          <ComparisonRow label="Assessor land value" values={values(record => <strong className="compare-money">{money(record.assessment.landMarketValue)}</strong>)} />
          <ComparisonRow label="Assessed land value" values={values(record => money(record.assessment.assessedLandValue))} />
          <ComparisonRow label="Last sale price" values={values(record => money(record.sale.price))} />
          <ComparisonRow label="Last sale date" values={values(record => dateLabel(record.sale.date))} />
          <ComparisonRow label="Sale validation" values={values(record => <>{record.sale.transactionType ?? 'Transaction type unknown'}<small>{record.sale.priceCodeDescription ?? 'Price qualification unavailable'}</small></>)} />
          <ComparisonRow label="Seller signal" values={values(record => {
            const signal = landSellerSignal(record);
            return <><strong className="signal-chip">{signal.score} signal</strong><small>{signal.reasons.join(' · ')}</small></>;
          })} />
          <ComparisonRow label="Topography" values={values(record => record.lot.topography ?? 'Unknown')} />
          <ComparisonRow label="Frontage / depth" values={values(record => `${record.lot.frontageFeet == null ? 'Unknown' : `${number(record.lot.frontageFeet, 0)} ft`} / ${record.lot.depthFeet == null ? 'Unknown' : `${number(record.lot.depthFeet, 0)} ft`}`)} />
          <ComparisonRow label="Land use" values={values(record => record.landUseCode ?? 'Unknown')} />
          <ComparisonRow label="Location validation" values={values(record => <>{record.address.geoStatus ?? 'Unknown'}<small>Provider point, not a parcel boundary</small></>)} />
          <ComparisonRow label="County" values={values(record => record.address.county ?? 'Unknown')} />
          <ComparisonRow label="Record cached" values={values(record => dateLabel(record.cachedAt.slice(0, 10)))} />
          <ComparisonRow label="Flood / wetlands / utilities" values={values(() => <span className="compare-unavailable">Not in cached data — verify independently</span>)} />
        </tbody>
      </table>
    </div>
    <footer className="compare-footer"><Info size={15} /><span>Seller signals prioritize research; they do not prove an owner wants to sell. Verify records, title, access, zoning, and buyer demand before making an offer.</span></footer>
  </div>;
}
