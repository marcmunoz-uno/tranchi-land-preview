import { Database } from 'lucide-react';
import type { LandRecord } from '../types';
import { buildMarketSummaries } from '../lib/markets';

export function MarketCoverage({ records, value, onChange }: {
  records: LandRecord[];
  value: string;
  onChange: (market: string) => void;
}) {
  const summaries = buildMarketSummaries(records);
  const selected = summaries.find(market => market.id === value);
  return (
    <div className="market-coverage">
      <label className="field-group"><span className="field-label">Market</span>
        <select value={value} onChange={event => onChange(event.target.value)} aria-label="Filter by market">
          <option value="all">All {summaries.length} markets</option>
          {summaries.map(market => <option key={market.id} value={market.id}>{market.id} · {market.records}</option>)}
        </select>
      </label>
      {selected && <div className="market-coverage-note" title="Field coverage in this cached market">
        <span><Database size={13} /> {selected.records} cached parcels</span>
        <small>{selected.zoningCoverage}% zoning · {selected.topographyCoverage}% terrain · {selected.salePriceCoverage}% sale price</small>
        {selected.latestCachedAt && <small>Latest record seen {selected.latestCachedAt.slice(0, 10)}</small>}
      </div>}
    </div>
  );
}
