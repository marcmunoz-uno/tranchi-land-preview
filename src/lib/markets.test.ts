import { describe, expect, it } from 'vitest';
import { landRecords } from '../data/land';
import { buildMarketSummaries, marketId } from './markets';

describe('market summaries', () => {
  it('groups records by exact city and state', () => {
    expect(marketId(landRecords[0])).toBe('Cleveland, OH');
    const summaries = buildMarketSummaries(landRecords);
    expect(summaries).toHaveLength(3);
    expect(summaries.reduce((sum, market) => sum + market.records, 0)).toBe(landRecords.length);
    const cleveland = summaries.find(market => market.id === 'Cleveland, OH');
    expect(cleveland?.records).toBe(361);
    expect(cleveland?.zoningCoverage).toBeGreaterThan(90);
    expect(cleveland?.salePriceCoverage).toBeGreaterThan(0);
    expect(summaries.find(market => market.id === 'Bastrop, TX')?.records).toBe(135);
    expect(summaries.find(market => market.id === 'Lehigh Acres, FL')?.records).toBe(60);
  });
});
