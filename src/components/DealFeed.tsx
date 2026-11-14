import { useMemo, useState } from 'react';
import { BadgeDollarSign, ExternalLink, Gavel, Home, ImageOff, Landmark, MapPin, RotateCcw, Search, Users, X } from 'lucide-react';
import { dateLabel, money, number } from '../lib/analysis';
import { tranchiDeals, dealDataset } from '../data/deals';
import type { DealCategoryGroup, TranchiDeal } from '../dealTypes';

const CATEGORY_LABELS: Partial<Record<DealCategoryGroup, string>> & { all: string } = {
  all: 'All deal types',
  land_bank: 'Land bank',
  tax_lien: 'Tax / distress',
  motivated_seller: 'Off-market leads',
};

type SortMode = 'cashFlow' | 'recent' | 'priceAsc' | 'priceDesc';

function CategoryIcon({ category }: { category: DealCategoryGroup }) {
  if (category === 'on_market') return <Home size={14} />;
  if (category === 'land_bank') return <Landmark size={14} />;
  if (category === 'tax_lien') return <Gavel size={14} />;
  return <Users size={14} />;
}

function DealImage({ deal, large = false }: { deal: TranchiDeal; large?: boolean }) {
  const [failed, setFailed] = useState(false);
  return <div className={`deal-image${large ? ' large' : ''}`}>
    {deal.images[0] && !failed
      ? <img src={deal.images[0]} alt={`Property at ${deal.address.street}`} loading={large ? 'eager' : 'lazy'} onError={() => setFailed(true)} />
      : <div className="deal-image-fallback"><ImageOff size={large ? 38 : 24} /><span>No photo in the cached feed</span></div>}
    <span className={`deal-category-badge category-${deal.categoryGroup}`}><CategoryIcon category={deal.categoryGroup} />{deal.categoryLabel}</span>
  </div>;
}

function primaryMetric(deal: TranchiDeal) {
  if (deal.categoryGroup === 'on_market') return `${money(deal.cashFlow)}/mo modeled cash flow${deal.dscrRatio != null ? ` · ${deal.dscrRatio}x DSCR` : ''}`;
  if (deal.categoryGroup === 'land_bank') return `County market value ${money(deal.marketValue)}`;
  if (deal.categoryGroup === 'tax_lien') return `Opening bid ${money(deal.openingBid ?? deal.price)} · assessor ${money(deal.marketValue)}`;
  return `No asking price · assessor ${money(deal.marketValue)}`;
}

function DealDetail({ deal, onClose }: { deal: TranchiDeal; onClose: () => void }) {
  const facts = [
    ['Property type', deal.propertyType ?? 'Unknown'],
    ['Bed / bath', deal.bedrooms != null || deal.bathrooms != null ? `${deal.bedrooms ?? '—'} bd · ${deal.bathrooms ?? '—'} ba` : 'Unknown'],
    ['Living area', deal.squareFeet ? `${number(deal.squareFeet, 0)} sq ft` : 'Unknown'],
    ['Market value', money(deal.marketValue)],
    ['Opening bid', money(deal.openingBid)],
    ['Tax balance', money(deal.taxBalance)],
    ['Last sale', deal.lastSaleDate ? `${money(deal.lastSalePrice)} · ${dateLabel(deal.lastSaleDate)}` : 'Unknown'],
    ['Lead status', deal.leadStatus ?? 'Unknown'],
    ['QC status', deal.qcStatus ?? 'Unknown'],
    ['Absentee indicator', deal.absenteeOwner ? 'Yes' : 'No'],
  ];
  return <aside className="deal-detail" aria-label={`Real deal details for ${deal.address.street}`}>
    <div className="deal-detail-header">
      <div><span className="eyebrow">{deal.categoryLabel} · Tranchi #{deal.id}</span><h2>{deal.address.street}</h2><p>{deal.address.city}, {deal.address.state} {deal.address.zip ?? ''}</p></div>
      <button className="icon-button" onClick={onClose} aria-label="Close real deal details"><X size={19} /></button>
    </div>
    <DealImage deal={deal} large />
    <div className="deal-detail-price"><span>{deal.priceLabel}</span><strong>{money(deal.price)}</strong><small>{deal.priceSource ? `Source: ${deal.priceSource}${deal.priceConfidence != null ? ` · ${Math.round(deal.priceConfidence * 100)}% confidence` : ''}` : 'Price provenance not supplied'}</small></div>
    <p className="deal-primary-metric">{primaryMetric(deal)}</p>
    <div className="deal-fact-grid">{facts.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
    <div className="deal-detail-links">
      <a className="primary-button" href={deal.tranchiUrl} target="_blank" rel="noreferrer">Open in Tranchi <ExternalLink size={14} /></a>
      {deal.sourceUrl && <a className="secondary-button" href={deal.sourceUrl} target="_blank" rel="noreferrer">View public source <ExternalLink size={14} /></a>}
    </div>
    <p className="section-note">Ingested {dateLabel(deal.createdAt)}{deal.sourceCreatedAt ? ` · source record ${dateLabel(deal.sourceCreatedAt)}` : ''}. Production statuses and listing data can be stale. Modeled rent, DSCR, and cash flow are not guaranteed returns. Verify current availability, title, and terms before acting.</p>
  </aside>;
}

export function DealFeed() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<DealCategoryGroup | 'all'>('all');
  const [market, setMarket] = useState('all');
  const [sort, setSort] = useState<SortMode>('cashFlow');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const markets = useMemo(() => Array.from(new Set(tranchiDeals.map(deal => `${deal.address.city}, ${deal.address.state}`))).sort(), []);
  const records = useMemo(() => {
    const query = search.trim().toLowerCase();
    return tranchiDeals.filter(deal => {
      if (category !== 'all' && deal.categoryGroup !== category) return false;
      if (market !== 'all' && `${deal.address.city}, ${deal.address.state}` !== market) return false;
      if (query && !`${deal.address.street} ${deal.address.city} ${deal.address.state} ${deal.address.zip ?? ''} ${deal.id}`.toLowerCase().includes(query)) return false;
      return true;
    }).sort((a, b) => {
      if (sort === 'cashFlow') return (b.cashFlow ?? -Infinity) - (a.cashFlow ?? -Infinity) || b.createdAt.localeCompare(a.createdAt);
      if (sort === 'priceAsc') return (a.price ?? Infinity) - (b.price ?? Infinity);
      if (sort === 'priceDesc') return (b.price ?? -1) - (a.price ?? -1);
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [search, category, market, sort]);
  const selected = tranchiDeals.find(deal => deal.id === selectedId) ?? null;
  const reset = () => { setSearch(''); setCategory('all'); setMarket('all'); setSort('cashFlow'); };

  return <div className={`deal-feed${selected ? ' has-deal-detail' : ''}`}>
    <div className="deal-feed-main">
      <div className="deal-feed-heading">
        <div><span className="eyebrow">Production feed · not synthetic deals</span><h1>Real Tranchi deals.</h1><p>{records.length} of {dealDataset.recordCount} share-safe production records · {dealDataset.activeDealCount.toLocaleString()} active in the source system</p></div>
        <div className="deal-source-stamp"><BadgeDollarSign size={16} /><span>Actual Tranchi IDs, prices, photos, and source links</span></div>
      </div>
      <div className="deal-provenance-notice">Price provenance stays attached: opening bid or tax-assessed reference. Off-market assessed value is not an asking price. Listing status and source-model cash flow require verification.</div>
      <div className="deal-filters">
        <label className="deal-search"><Search size={15} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Address or Tranchi ID" aria-label="Search real deals" /></label>
        <select value={category} onChange={event => setCategory(event.target.value as DealCategoryGroup | 'all')} aria-label="Deal type">{Object.entries(CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <select value={market} onChange={event => setMarket(event.target.value)} aria-label="Deal market"><option value="all">All preview markets</option>{markets.map(value => <option key={value} value={value}>{value}</option>)}</select>
        <select value={sort} onChange={event => setSort(event.target.value as SortMode)} aria-label="Sort real deals"><option value="cashFlow">Best modeled cash flow</option><option value="recent">Newest ingested</option><option value="priceAsc">Price: low to high</option><option value="priceDesc">Price: high to low</option></select>
      </div>
      {records.length ? <div className="deal-grid">{records.map(deal => <article className={`deal-card category-card-${deal.categoryGroup}`} key={deal.id}>
        <button className="deal-card-main" onClick={() => setSelectedId(deal.id)} aria-label={`Inspect real deal ${deal.address.street}`}>
          <DealImage deal={deal} />
          <div className="deal-card-body">
            <div className="deal-card-address"><strong>{deal.address.street}</strong><span><MapPin size={12} />{deal.address.city}, {deal.address.state}</span></div>
            <div className="deal-card-price"><span>{deal.priceLabel}</span><strong>{money(deal.price)}</strong></div>
            <p className="deal-card-metric">{primaryMetric(deal)}</p>
            <div className="deal-card-meta"><span>{deal.propertyType ?? 'Property'}</span><span>Ingested {dateLabel(deal.createdAt)}</span></div>
          </div>
        </button>
        <div className="deal-card-footer"><span>Tranchi #{deal.id}</span><a href={deal.tranchiUrl} target="_blank" rel="noreferrer">Open deal <ExternalLink size={12} /></a></div>
      </article>)}</div> : <div className="empty-state deal-empty"><Search size={26} /><h3>No real deals match these filters</h3><p>Reset to see all {dealDataset.recordCount} production records.</p><button className="secondary-button" onClick={reset}><RotateCcw size={14} /> Reset deal filters</button></div>}
    </div>
    {selected && <DealDetail deal={selected} onClose={() => setSelectedId(null)} />}
  </div>;
}
