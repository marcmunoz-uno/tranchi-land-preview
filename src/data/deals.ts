import rawDeals from '../../data/tranchi-deals.json';
import type { DealDataset } from '../dealTypes';

export const dealDataset = rawDeals as DealDataset;
export const tranchiDeals = dealDataset.records;
