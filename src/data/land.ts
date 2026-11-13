import rawDataset from '../../data/cleveland-land.json';
import type { LandDataset } from '../types';

export const dataset = rawDataset as LandDataset;
export const landRecords = dataset.records;
