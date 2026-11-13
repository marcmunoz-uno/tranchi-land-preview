export type LandRecord = {
  id: string;
  apn: string | null;
  address: {
    street: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    county: string | null;
    countyFips: string | null;
    lat: number;
    lng: number;
    geoStatus: string | null;
  };
  propertyTypeDetail: string | null;
  landUseCode: string | null;
  lot: {
    acres: number | null;
    squareFeet: number | null;
    frontageFeet: number | null;
    depthFeet: number | null;
    zoning: string | null;
    topography: string | null;
  };
  assessment: {
    landMarketValue: number | null;
    totalMarketValue: number | null;
    assessedLandValue: number | null;
  };
  sale: {
    price: number | null;
    date: string | null;
    transactionType: string | null;
    transactionTypeCode: string | null;
    priceCodeDescription: string | null;
  };
  flags: string[];
  ownerOccupied: boolean | null;
  cachedAt: string;
};

export type LandDataset = {
  dataset: string;
  source: string;
  market: string;
  generatedAt: string;
  recordCount: number;
  records: LandRecord[];
};

export type MotivationFilter = 'all' | 'absentee' | 'failed' | 'pressure' | 'entity' | 'equity';
export type SortMode = 'score' | 'acresAsc' | 'acresDesc' | 'landValue' | 'recentSale';
export type FilterState = {
  search: string;
  minAcres: string;
  maxAcres: string;
  zoning: string;
  topography: string;
  motivation: MotivationFilter;
  armsLengthOnly: boolean;
  sort: SortMode;
};

export type CompSettings = {
  radiusMiles: number;
  maxAgeMonths: number;
  acreageTolerance: number;
};

export type LandComp = {
  record: LandRecord;
  distanceMiles: number;
  ageMonths: number;
  pricePerAcre: number;
};
