import { describe, expect, it } from 'vitest';
import { landRecords } from '../data/land';
import { buildMarketSummaries, marketId } from './markets';

describe('market summaries', () => {
  it('groups records by exact city and state', () => {
    expect(marketId(landRecords[0])).toBe('Cleveland, OH');
    const summaries = buildMarketSummaries(landRecords);
    expect(summaries).toHaveLength(1);
    expect(summaries[0].records).toBe(landRecords.length);
    expect(summaries[0].zoningCoverage).toBeGreaterThan(90);
    expect(summaries[0].salePriceCoverage).toBeGreaterThan(0);
  });
});
