import { useMemo, useState } from 'react';
import { BarChart3, Check, Info, Share2, X } from 'lucide-react';
import type { CompSettings, LandRecord } from '../types';
import { acresLabel, addressLabel, analyzeLand, dateLabel, DEFAULT_COMP_SETTINGS, findLandComps, landSellerSignal, money, number } from '../lib/analysis';
import { dataset } from '../data/land';

function Fact({ label, value, title }: { label: string; value: string; title?: string }) {
  return <div className="fact" title={title}><span>{label}</span><strong>{value}</strong></div>;
}

export function ParcelDetail({ record, onClose, onShare, shared }: {
  record: LandRecord;
  onClose: () => void;
  onShare: () => void;
  shared: boolean;
}) {
  const [tab, setTab] = useState<'overview' | 'analysis'>('overview');
  const [settings, setSettings] = useState<CompSettings>(DEFAULT_COMP_SETTINGS);
  const [assignmentFee, setAssignmentFee] = useState('10000');
  const [closingCosts, setClosingCosts] = useState('1500');
  const signal = landSellerSignal(record);
  const comps = useMemo(() => findLandComps(record, dataset.records, settings, new Date(dataset.generatedAt)), [record, settings]);
  const analysis = useMemo(() => analyzeLand(record, comps), [record, comps]);
  const maxOffer = analysis.estimatedValue === null ? null : analysis.estimatedValue - (Number(assignmentFee) || 0) - (Number(closingCosts) || 0);
  return (
    <aside className="detail-panel" aria-label={`Parcel details for ${addressLabel(record)}`}>
      <div className="detail-header">
        <div>
          <span className="eyebrow">{record.propertyTypeDetail ?? 'Land parcel'}</span>
          <h2>{record.address.street ?? record.apn ?? 'Land parcel'}</h2>
          <p>{record.address.city}, {record.address.state} {record.address.zip ?? ''}</p>
        </div>
        <div className="detail-header-actions">
          <button className="icon-button" onClick={onShare} title="Copy parcel link" aria-label="Copy parcel link">{shared ? <Check size={18} /> : <Share2 size={18} />}</button>
          <button className="icon-button detail-close" onClick={onClose} title="Close parcel details" aria-label="Close parcel details"><X size={19} /></button>
        </div>
      </div>
      <div className="detail-metrics">
        <div><span>Lot size</span><strong>{acresLabel(record.lot.acres)}</strong></div>
        <div><span>Assessor land value</span><strong>{money(record.assessment.landMarketValue)}</strong></div>
        <div><span>Seller signal</span><strong>{signal.score}</strong></div>
      </div>
      <div className="detail-tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'overview'} className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')}>Overview</button>
        <button role="tab" aria-selected={tab === 'analysis'} className={tab === 'analysis' ? 'active' : ''} onClick={() => setTab('analysis')}><BarChart3 size={15} /> Comps & offer</button>
      </div>
      <div className="detail-scroll">
        {tab === 'overview' ? <>
          <section className="detail-section">
            <h3>Parcel facts</h3>
            <div className="facts-grid">
              <Fact label="APN" value={record.apn ?? 'Unknown'} />
              <Fact label="Zoning" value={record.lot.zoning ?? 'Unknown'} />
              <Fact label="Topography" value={record.lot.topography ?? 'Unknown'} />
              <Fact label="Frontage" value={record.lot.frontageFeet == null ? 'Unknown' : `${number(record.lot.frontageFeet, 0)} ft`} />
              <Fact label="Depth" value={record.lot.depthFeet == null ? 'Unknown' : `${number(record.lot.depthFeet, 0)} ft`} />
              <Fact label="Land use" value={record.landUseCode ?? 'Unknown'} />
              <Fact label="County" value={record.address.county ?? 'Unknown'} />
              <Fact label="Point type" value={record.address.geoStatus ?? 'Unknown'} title="Provider location point. No parcel boundary is shown." />
            </div>
          </section>
          <section className="detail-section">
            <h3>Why it might be worth a conversation</h3>
            <div className="reason-list">{signal.reasons.map(reason => <span key={reason}>{reason}</span>)}</div>
            <p className="section-note">Public-record signals help prioritize outreach. They do not prove the owner wants to sell.</p>
          </section>
          <section className="detail-section">
            <h3>Recorded sale</h3>
            <div className="sale-highlight"><strong>{money(record.sale.price)}</strong><span>{dateLabel(record.sale.date)}</span></div>
            <p className="section-note">{record.sale.transactionType ?? 'Transaction type unavailable'}{record.sale.priceCodeDescription ? ` · ${record.sale.priceCodeDescription}` : ''}</p>
          </section>
          <section className="detail-section">
            <h3>Assessor values</h3>
            <div className="facts-grid">
              <Fact label="Land market value" value={money(record.assessment.landMarketValue)} />
              <Fact label="Total market value" value={money(record.assessment.totalMarketValue)} />
              <Fact label="Assessed land value" value={money(record.assessment.assessedLandValue)} />
            </div>
            <p className="section-note">Assessor values are separate reference points, not a market comp or a buyer offer.</p>
          </section>
        </> : <>
          <section className="detail-section comp-settings">
            <div className="section-heading"><h3>Comp search</h3><span>{comps.length} usable sales</span></div>
            <div className="field-row three">
              <label><span>Radius</span><select value={settings.radiusMiles} onChange={e => setSettings({ ...settings, radiusMiles: Number(e.target.value) })}><option value="1">1 mile</option><option value="5">5 miles</option><option value="25">25 miles</option></select></label>
              <label><span>Sale age</span><select value={settings.maxAgeMonths} onChange={e => setSettings({ ...settings, maxAgeMonths: Number(e.target.value) })}><option value="24">24 months</option><option value="60">60 months</option><option value="120">120 months</option></select></label>
              <label><span>Acreage range</span><select value={settings.acreageTolerance} onChange={e => setSettings({ ...settings, acreageTolerance: Number(e.target.value) })}><option value="2">Within 2×</option><option value="4">Within 4×</option><option value="10">Within 10×</option></select></label>
            </div>
            <p className="section-note">Nearest 12 qualifying arms-length land sales. Expanding a filter is explicit and visible.</p>
          </section>
          {analysis.available ? <>
            <section className="valuation-block">
              <span>Comp-supported value</span>
              <strong>{money(analysis.estimatedValue)}</strong>
              <p>Median {money(analysis.pricePerAcre)}/acre × {number(record.lot.acres)} subject acres</p>
            </section>
            <section className="detail-section">
              <h3>Your max-offer model</h3>
              <div className="field-row">
                <label><span>Desired assignment fee</span><input type="number" min="0" step="500" value={assignmentFee} onChange={e => setAssignmentFee(e.target.value)} /></label>
                <label><span>Estimated closing costs</span><input type="number" min="0" step="100" value={closingCosts} onChange={e => setClosingCosts(e.target.value)} /></label>
              </div>
              <div className={`max-offer${(maxOffer ?? 0) < 0 ? ' negative' : ''}`}>
                <span>Maximum seller offer</span>
                <strong>{money(maxOffer)}</strong>
                <p>{money(analysis.estimatedValue)} value − {money(Number(assignmentFee) || 0)} fee − {money(Number(closingCosts) || 0)} costs</p>
              </div>
              <p className="section-note"><Info size={13} /> Planning math, not a buyer offer or appraisal. Verify access, title, utilities, zoning, and buyer demand before contracting.</p>
            </section>
            <section className="detail-section">
              <h3>Selected recorded sales</h3>
              <div className="comp-list">{comps.map(comp => <div className="comp-row" key={comp.record.id}>
                <div><strong>{comp.record.address.street ?? comp.record.apn}</strong><span>{comp.distanceMiles.toFixed(1)} mi · {dateLabel(comp.record.sale.date)} · {acresLabel(comp.record.lot.acres)}</span></div>
                <div><strong>{money(comp.record.sale.price)}</strong><span>{money(comp.pricePerAcre)}/acre</span></div>
              </div>)}</div>
            </section>
          </> : <div className="insufficient-state">
            <BarChart3 size={24} />
            <h3>Not enough usable land comps</h3>
            <p>Only {comps.length} recorded sale{comps.length === 1 ? '' : 's'} match these settings. Three are required before Tranchi shows an estimate.</p>
            <p>Try a wider radius, older sale history, or broader acreage range. The assessor value remains available in Overview.</p>
          </div>}
        </>}
      </div>
      <div className="preview-note">Interactive preview · no owner contact details or outbound actions</div>
    </aside>
  );
}
