import type { LandRecord } from '../types';

export type MarketSummary = {
  id: string;
  city: string;
  state: string;
  records: number;
  zoningCoverage: number;
  topographyCoverage: number;
  salePriceCoverage: number;
  latestCachedAt: string | null;
};

export function marketId(record: Pick<LandRecord, 'address'>) {
  return `${record.address.city ?? 'Unknown'}, ${record.address.state ?? 'Unknown'}`;
}

export function buildMarketSummaries(records: LandRecord[]): MarketSummary[] {
  const groups = new Map<string, LandRecord[]>();
  for (const record of records) {
    const id = marketId(record);
    groups.set(id, [...(groups.get(id) ?? []), record]);
  }
  return Array.from(groups.entries()).map(([id, rows]) => {
    const pct = (count: number) => Math.round(count / rows.length * 100);
    return {
      id,
      city: rows[0].address.city ?? 'Unknown',
      state: rows[0].address.state ?? 'Unknown',
      records: rows.length,
      zoningCoverage: pct(rows.filter(r => r.lot.zoning).length),
      topographyCoverage: pct(rows.filter(r => r.lot.topography).length),
      salePriceCoverage: pct(rows.filter(r => r.sale.price).length),
      latestCachedAt: rows.map(r => r.cachedAt).sort().at(-1) ?? null,
    };
  }).sort((a, b) => a.id.localeCompare(b.id));
}
