export type ParcelValidationStatus = 'verified_vacant' | 'probable_vacant' | 'improved' | 'unclear';

export type ParcelValidation = {
  status: ParcelValidationStatus;
  /** Confidence that the parcel is vacant, not confidence in the source provider. */
  score: number;
  reasons: string[];
  fieldCompleteness: number;
};

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
  building: {
    livingArea: number | null;
    buildingArea: number | null;
    yearBuilt: number | null;
    units: number | null;
    stories: number | null;
    bedrooms: number | null;
    bathrooms: number | null;
    totalRooms: number | null;
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
  validation: ParcelValidation;
};

export type LandDataset = {
  dataset: string;
  source: string;
  market: string;
  generatedAt: string;
  recordCount: number;
  markets: Array<{ id: string; records: number }>;
  records: LandRecord[];
};

export type MotivationFilter = 'all' | 'absentee' | 'failed' | 'pressure' | 'entity' | 'equity';
export type SortMode = 'score' | 'acresAsc' | 'acresDesc' | 'landValue' | 'recentSale';
export type VacancyFilter = 'likely' | 'include_unclear' | 'all';
export type FilterState = {
  search: string;
  market: string;
  vacancy: VacancyFilter;
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
