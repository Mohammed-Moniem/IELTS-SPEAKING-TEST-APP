import { FilterQuery, Model, PopulateOptions } from '@lib/db/mongooseCompat';

/**
 * Advanced search options configuration
 */
export interface IAdvancedSearchOptions {
  allowedFields?: string[];
  excludedFields?: string[];
  debug?: boolean;
  cache?: {
    client: any;
    ttl?: number;
    keyPrefix?: string;
  };
  defaultSort?: string;
  maxLimit?: number;
  enableGeospatial?: boolean;
  enableFullTextSearch?: boolean;
  enableAggregation?: boolean;
  customFilters?: Record<string, (value: any) => any>;
  softDelete?: {
    field?: string;
    deletedValue?: any;
  };
  dateRangeFields?: string[];
  numericFields?: string[];
  booleanFields?: string[];
}

/**
 * Query parameters from request
 */
export interface IAdvancedSearchQuery {
  select?: string;
  sort?: string;
  page?: string | number;
  limit?: string | number;
  and?: string | boolean;
  exact?: string | boolean;
  near?: string;
  within?: string;
  cache?: string | boolean;
  includeDeleted?: string | boolean;
  search?: string; // Full-text search
  dateFrom?: string;
  dateTo?: string;
  dateField?: string;
  aggregateBy?: string;
  groupBy?: string;
  [key: string]: any;
}

/**
 * Pagination metadata
 */
export interface IPaginationMeta {
  current: number;
  lastPage: number;
  size: number;
  total: number;
  prev?: number;
  next?: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * Advanced search result structure
 */
export interface IAdvancedSearchResult<T = any> {
  success: boolean;
  count: number;
  pagination: IPaginationMeta;
  data: T[];
  meta?: {
    query: FilterQuery<any>;
    executionTime: number;
    cached: boolean;
    totalDocuments?: number;
    aggregationData?: any;
  };
}

/**
 * Query builder context
 */
export interface IQueryBuilderContext {
  model: Model<any>;
  rawQuery: IAdvancedSearchQuery;
  filter: FilterQuery<any>;
  options: IAdvancedSearchOptions;
  populate?: string | PopulateOptions | Array<PopulateOptions>;
  aggregationPipeline?: any[];
}

/**
 * Geospatial query types
 */
export interface IGeoNearQuery {
  longitude: number;
  latitude: number;
  maxDistance: number;
  minDistance?: number;
  spherical?: boolean;
}

export interface IGeoWithinQuery {
  coordinates: number[][][];
  type?: 'Polygon' | 'MultiPolygon';
}

/**
 * Date range query
 */
export interface IDateRangeQuery {
  field: string;
  from?: Date;
  to?: Date;
  format?: string;
}

/**
 * Full-text search configuration
 */
export interface IFullTextSearchConfig {
  fields: string[];
  weights?: Record<string, number>;
  language?: string;
  caseSensitive?: boolean;
  diacriticSensitive?: boolean;
}

/**
 * Aggregation options
 */
export interface IAggregationOptions {
  groupBy: string | string[];
  metrics?: {
    count?: boolean;
    sum?: string[];
    avg?: string[];
    min?: string[];
    max?: string[];
  };
  having?: FilterQuery<any>;
  limit?: number;
}

/**
 * Cache key components
 */
export interface ICacheKeyComponents {
  model: string;
  filter: string;
  sort: string;
  select: string;
  populate: string;
  page: number;
  limit: number;
  aggregation?: string;
}

/**
 * Query validation result
 */
export interface IQueryValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  sanitizedQuery: IAdvancedSearchQuery;
}

/**
 * Performance metrics
 */
export interface IPerformanceMetrics {
  queryTime: number;
  cacheHit: boolean;
  documentsScanned: number;
  documentsReturned: number;
  indexesUsed: string[];
  optimizations: string[];
}
