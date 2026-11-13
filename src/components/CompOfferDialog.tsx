import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Check, FileDown, Info, LoaderCircle, X } from 'lucide-react';
import type { CompSettings, LandRecord } from '../types';
import { acresLabel, addressLabel, analyzeLand, dateLabel, DEFAULT_COMP_SETTINGS, findLandComps, money, number } from '../lib/analysis';
import { dataset } from '../data/land';

export function CompOfferDialog({ record, onClose, onDownloaded }: {
  record: LandRecord;
  onClose: () => void;
  onDownloaded: (filename: string) => void;
}) {
  const [settings, setSettings] = useState<CompSettings>(DEFAULT_COMP_SETTINGS);
  const [assignmentFee, setAssignmentFee] = useState('10000');
  const [closingCosts, setClosingCosts] = useState('1500');
  const allComps = useMemo(() => findLandComps(record, dataset.records, settings, new Date(dataset.generatedAt)), [record, settings]);
  const [selectedCompIds, setSelectedCompIds] = useState<string[]>(() => allComps.map(comp => comp.record.id));
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSelectedCompIds(allComps.map(comp => comp.record.id));
  }, [allComps]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape' && !generating) onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [generating, onClose]);

  const selectedComps = allComps.filter(comp => selectedCompIds.includes(comp.record.id));
  const analysis = analyzeLand(record, selectedComps);
  const feeNumber = Math.max(0, Number(assignmentFee) || 0);
  const costsNumber = Math.max(0, Number(closingCosts) || 0);
  const maxOffer = analysis.estimatedValue === null ? null : analysis.estimatedValue - feeNumber - costsNumber;

  const toggleComp = (id: string) => {
    setSelectedCompIds(ids => ids.includes(id) ? ids.filter(compId => compId !== id) : [...ids, id]);
  };
  const download = async () => {
    setGenerating(true); setError(null);
    try {
      const { downloadCompOfferPdf } = await import('../lib/compOfferPdf');
      const filename = downloadCompOfferPdf({
        subject: record,
        comps: selectedComps,
        settings,
        assignmentFee: feeNumber,
        closingCosts: costsNumber,
        datasetGeneratedAt: dataset.generatedAt,
      });
      onDownloaded(filename);
    } catch {
      setError('The PDF could not be generated in this browser. Your parcel analysis is still available here.');
    } finally {
      setGenerating(false);
    }
  };

  return <>
    <button className="drawer-backdrop offer-backdrop" onClick={() => { if (!generating) onClose(); }} aria-label="Close comp and offer worksheet overlay" />
    <section className="offer-dialog" role="dialog" aria-modal="true" aria-labelledby="offer-title">
      <header className="offer-header">
        <div><span className="eyebrow">Client-side worksheet</span><h2 id="offer-title">Comp / offer PDF</h2><p>{addressLabel(record)}</p></div>
        <button autoFocus className="icon-button" onClick={onClose} disabled={generating} aria-label="Close comp and offer worksheet"><X size={21} /></button>
      </header>
      <div className="offer-scroll">
        <section className="offer-subject-summary">
          <div><span>Lot size</span><strong>{acresLabel(record.lot.acres)}</strong></div>
          <div><span>Assessor land value</span><strong>{money(record.assessment.landMarketValue)}</strong></div>
          <div><span>Last recorded sale</span><strong>{money(record.sale.price)}</strong></div>
        </section>
        <section className="offer-section comp-settings">
          <div className="section-heading"><h3>1. Find recorded land sales</h3><span>{allComps.length} qualifying</span></div>
          <div className="field-row three">
            <label><span>Radius</span><select value={settings.radiusMiles} onChange={event => setSettings({ ...settings, radiusMiles: Number(event.target.value) })}><option value="1">1 mile</option><option value="5">5 miles</option><option value="25">25 miles</option></select></label>
            <label><span>Sale age</span><select value={settings.maxAgeMonths} onChange={event => setSettings({ ...settings, maxAgeMonths: Number(event.target.value) })}><option value="24">24 months</option><option value="60">60 months</option><option value="120">120 months</option></select></label>
            <label><span>Acreage range</span><select value={settings.acreageTolerance} onChange={event => setSettings({ ...settings, acreageTolerance: Number(event.target.value) })}><option value="2">Within 2×</option><option value="4">Within 4×</option><option value="10">Within 10×</option></select></label>
          </div>
          <p className="section-note">Qualifying sales are arms-length transactions from the cached dataset. Selections below are the evidence used in the PDF.</p>
        </section>
        <section className="offer-section">
          <div className="section-heading"><h3>2. Select comp evidence</h3>{allComps.length > 0 && <button className="text-button" onClick={() => setSelectedCompIds(selectedCompIds.length === allComps.length ? [] : allComps.map(comp => comp.record.id))}>{selectedCompIds.length === allComps.length ? 'Clear all' : 'Select all'}</button>}</div>
          {!allComps.length ? <div className="offer-insufficient"><AlertCircle size={20} /><strong>No qualifying recorded sales</strong><p>Broaden the radius, age, or acreage settings. The PDF will explicitly state that no estimate is available.</p></div> : <div className="offer-comp-list">{allComps.map((comp, index) => <label className={`offer-comp${selectedCompIds.includes(comp.record.id) ? ' selected' : ''}`} key={comp.record.id}>
            <input type="checkbox" checked={selectedCompIds.includes(comp.record.id)} onChange={() => toggleComp(comp.record.id)} aria-label={`Use comp ${comp.record.address.street ?? comp.record.apn ?? index + 1}`} />
            <span className="offer-comp-check" aria-hidden="true">{selectedCompIds.includes(comp.record.id) && <Check size={13} />}</span>
            <span className="offer-comp-address"><strong>{comp.record.address.street ?? comp.record.apn ?? 'Land parcel'}</strong><small>{comp.distanceMiles.toFixed(1)} mi · {dateLabel(comp.record.sale.date)} · {acresLabel(comp.record.lot.acres)}</small></span>
            <span className="offer-comp-price"><strong>{money(comp.record.sale.price)}</strong><small>{money(comp.pricePerAcre)}/acre</small></span>
          </label>)}</div>}
          <p className="section-note">{selectedComps.length} selected · at least 3 required for an estimate</p>
        </section>
        <section className="offer-section">
          <h3>3. Offer assumptions</h3>
          <div className="field-row">
            <label><span>Desired assignment fee</span><input type="number" min="0" step="500" value={assignmentFee} onChange={event => setAssignmentFee(event.target.value)} /></label>
            <label><span>Estimated closing costs</span><input type="number" min="0" step="100" value={closingCosts} onChange={event => setClosingCosts(event.target.value)} /></label>
          </div>
          {analysis.available ? <div className="offer-valuation">
            <div><span>Comp-supported estimated value</span><strong>{money(analysis.estimatedValue)}</strong><small>Median {money(analysis.pricePerAcre)}/acre × {number(record.lot.acres)} acres</small></div>
            <div className={maxOffer !== null && maxOffer < 0 ? 'negative' : ''}><span>Maximum seller offer</span><strong>{money(maxOffer)}</strong><small>{money(analysis.estimatedValue)} − {money(feeNumber)} − {money(costsNumber)}</small></div>
          </div> : <div className="offer-insufficient"><AlertCircle size={20} /><strong>Not enough usable comps</strong><p>{selectedComps.length} selected; three are required. Estimated value and maximum offer will be marked unavailable in the PDF—not replaced with assessor value.</p></div>}
        </section>
        <div className="offer-assumptions"><Info size={15} /><p>The PDF includes parcel facts, selected evidence, offer math, and assumptions. It is not an appraisal or outbound offer. Verify title, access, zoning, utilities, environmental constraints, and buyer demand.</p></div>
        {error && <div className="offer-error" role="alert">{error}</div>}
      </div>
      <footer className="offer-footer"><span>Generated locally in your browser</span><button className="primary-button" onClick={download} disabled={generating}>{generating ? <LoaderCircle className="spin" size={17} /> : <FileDown size={17} />}{generating ? 'Generating…' : analysis.available ? 'Download comp / offer PDF' : 'Download PDF without estimate'}</button></footer>
    </section>
  </>;
}
