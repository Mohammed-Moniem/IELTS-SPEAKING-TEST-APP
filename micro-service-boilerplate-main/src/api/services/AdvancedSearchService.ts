import { CSError } from '@errors/CSError';
import { CODES, HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import {
  IAdvancedSearchOptions,
  IAdvancedSearchQuery,
  IAdvancedSearchResult,
  IAggregationOptions,
  ICacheKeyComponents,
  IDateRangeQuery,
  IPaginationMeta,
  IQueryBuilderContext
} from '@interfaces/IAdvancedSearch';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { constructLogMessage, isEmptyOrNull } from '@lib/env/helpers';
import { Logger } from '@lib/logger';
import { FilterQuery, Model, PopulateOptions } from '@lib/db/mongooseCompat';
import { Service } from 'typedi';

/**
 * Advanced Search Service
 *
 * Provides comprehensive search, filtering, pagination, and aggregation capabilities
 * for Mongoose models with caching, geospatial queries, and performance optimization.
 */
@Service()
export class AdvancedSearchService {
  private log = new Logger(__filename);

  /**
   * Execute advanced search with comprehensive filtering and pagination
   */
  public async search<T = any>(
    model: Model<any>,
    queryParams: IAdvancedSearchQuery,
    headers: IRequestHeaders,
    populate?: string | PopulateOptions | Array<PopulateOptions>,
    options: IAdvancedSearchOptions = {}
  ): Promise<IAdvancedSearchResult<T>> {
    const logMessage = constructLogMessage(__filename, 'search', headers);
    this.log.info(`${logMessage} :: Starting advanced search`);

    const startTime = Date.now();
    let cached = false;

    try {
      // Validate and sanitize query
      const sanitizedQuery = this.validateAndSanitizeQuery(queryParams, options, headers);

      // Check cache first if enabled
      if (this.isCacheEnabled(sanitizedQuery, options)) {
        const cacheKey = this.generateCacheKey(model, sanitizedQuery, populate, options);
        const cachedResult = await this.getCachedResult(cacheKey, options, headers);

        if (cachedResult) {
          this.log.info(`${logMessage} :: Cache hit for key: ${cacheKey}`);
          cached = true;
          return this.enhanceResultWithMeta(cachedResult, Date.now() - startTime, cached);
        }
      }

      // Build query context
      const context: IQueryBuilderContext = {
        model,
        rawQuery: sanitizedQuery,
        filter: {},
        options,
        populate
      };

      // Build comprehensive filter
      await this.buildCompleteFilter(context, headers);

      // Execute search with performance tracking
      const result = await this.executeSearch(context, headers);

      // Cache result if enabled
      if (this.isCacheEnabled(sanitizedQuery, options) && result.success) {
        const cacheKey = this.generateCacheKey(model, sanitizedQuery, populate, options);
        await this.cacheResult(cacheKey, result, options, headers);
      }

      // Add performance metadata
      const enhancedResult = this.enhanceResultWithMeta(result, Date.now() - startTime, cached);

      this.log.info(`${logMessage} :: Search completed successfully`, {
        model: model.collection.name,
        resultsCount: result.count,
        executionTime: Date.now() - startTime,
        cached
      });

      return enhancedResult;
    } catch (error: any) {
      this.log.error(`${logMessage} :: Search failed`, {
        error: error?.message || 'Unknown error',
        stack: error?.stack,
        model: model.collection.name,
        queryParams
      });

      if (error instanceof CSError) {
        throw error;
      }

      throw new CSError(
        HTTP_STATUS_CODES.BAD_REQUEST,
        CODES.InvalidQuery,
        `Search operation failed: ${error?.message || 'Unknown error'}`
      );
    }
  }

  /**
   * Execute aggregation-based search for complex queries
   */
  public async aggregateSearch<T = any>(
    model: Model<any>,
    queryParams: IAdvancedSearchQuery,
    aggregationOptions: IAggregationOptions,
    headers: IRequestHeaders,
    options: IAdvancedSearchOptions = {}
  ): Promise<IAdvancedSearchResult<T>> {
    const logMessage = constructLogMessage(__filename, 'aggregateSearch', headers);
    this.log.info(`${logMessage} :: Starting aggregation search`);

    try {
      const sanitizedQuery = this.validateAndSanitizeQuery(queryParams, options, headers);
      const pipeline = await this.buildAggregationPipeline(model, sanitizedQuery, aggregationOptions, options, headers);

      const startTime = Date.now();
      const results = await model.aggregate(pipeline);

      // Handle aggregation results pagination
      const paginatedResults = this.paginateAggregationResults(results, sanitizedQuery);

      this.log.info(`${logMessage} :: Aggregation search completed`, {
        model: model.collection.name,
        pipelineStages: pipeline.length,
        resultsCount: paginatedResults.data.length,
        executionTime: Date.now() - startTime
      });

      return paginatedResults;
    } catch (error: any) {
      this.log.error(`${logMessage} :: Aggregation search failed`, {
        error: error?.message || 'Unknown error',
        model: model.collection.name,
        aggregationOptions
      });

      throw new CSError(
        HTTP_STATUS_CODES.BAD_REQUEST,
        CODES.InvalidQuery,
        `Aggregation search failed: ${error?.message || 'Unknown error'}`
      );
    }
  }

  /**
   * Validate and sanitize query parameters
   */
  private validateAndSanitizeQuery(
    queryParams: IAdvancedSearchQuery,
    options: IAdvancedSearchOptions,
    headers: IRequestHeaders
  ): IAdvancedSearchQuery {
    const logMessage = constructLogMessage(__filename, 'validateAndSanitizeQuery', headers);

    // Remove undefined and null values
    const sanitized = Object.fromEntries(Object.entries(queryParams).filter(([_, value]) => !isEmptyOrNull(value)));

    // Validate allowed fields
    if (options.allowedFields) {
      const invalidFields = Object.keys(sanitized)
        .filter(
          field =>
            ![
              'select',
              'sort',
              'page',
              'limit',
              'and',
              'exact',
              'near',
              'within',
              'cache',
              'includeDeleted',
              'search',
              'dateFrom',
              'dateTo',
              'dateField',
              'aggregateBy',
              'groupBy'
            ].includes(field)
        )
        .filter(field => !options.allowedFields!.includes(field));

      if (invalidFields.length > 0) {
        this.log.warn(`${logMessage} :: Invalid fields detected: ${invalidFields.join(', ')}`);
        throw new CSError(
          HTTP_STATUS_CODES.BAD_REQUEST,
          CODES.InvalidField,
          `Invalid search fields: ${invalidFields.join(', ')}`
        );
      }
    }

    // Validate and sanitize pagination
    sanitized.page = Math.max(1, parseInt(sanitized.page?.toString() || '1', 10));
    sanitized.limit = Math.min(options.maxLimit || 100, Math.max(1, parseInt(sanitized.limit?.toString() || '25', 10)));

    // Sanitize boolean values
    sanitized.and = this.parseBoolean(sanitized.and);
    sanitized.exact = this.parseBoolean(sanitized.exact);
    sanitized.cache = this.parseBoolean(sanitized.cache);
    sanitized.includeDeleted = this.parseBoolean(sanitized.includeDeleted);

    // Validate select fields
    if (sanitized.select && options.excludedFields) {
      const selectFields = sanitized.select.split(',');
      const filteredFields = selectFields.filter(field => !options.excludedFields!.includes(field.trim()));
      sanitized.select = filteredFields.join(',');
    }

    this.log.debug(`${logMessage} :: Query sanitized successfully`, { sanitized });
    return sanitized;
  }

  /**
   * Build complete filter including all query types
   */
  private async buildCompleteFilter(context: IQueryBuilderContext, headers: IRequestHeaders): Promise<void> {
    const logMessage = constructLogMessage(__filename, 'buildCompleteFilter', headers);

    // Start with base filter
    let filter: FilterQuery<any> = {};

    // Extract special query parameters
    const { and, exact, near, within, includeDeleted, search, dateFrom, dateTo, dateField, ...queryFields } =
      context.rawQuery;

    // Build field-based filters
    if (Object.keys(queryFields).length > 0) {
      const fieldFilters = this.buildFieldFilters(queryFields, exact, context.options, headers);

      if (Object.keys(fieldFilters).length > 1 && and) {
        filter.$and = Object.entries(fieldFilters).map(([key, value]) => ({ [key]: value }));
      } else if (Object.keys(fieldFilters).length > 1 && !and) {
        filter.$or = Object.entries(fieldFilters).map(([key, value]) => ({ [key]: value }));
      } else {
        filter = { ...filter, ...fieldFilters };
      }
    }

    // Add full-text search
    if (search && context.options.enableFullTextSearch) {
      const textFilter = this.buildFullTextSearchFilter(search, context.options);
      filter = { ...filter, ...textFilter };
    }

    // Add date range filters
    if ((dateFrom || dateTo) && dateField) {
      const dateFilter = this.buildDateRangeFilter(
        {
          field: dateField,
          from: dateFrom ? new Date(dateFrom) : undefined,
          to: dateTo ? new Date(dateTo) : undefined
        },
        headers
      );
      filter = { ...filter, ...dateFilter };
    }

    // Add geospatial filters
    if (near && context.options.enableGeospatial) {
      const geoFilter = this.buildGeoNearFilter(near, headers);
      filter = { ...filter, ...geoFilter };
    }

    if (within && context.options.enableGeospatial) {
      const geoFilter = this.buildGeoWithinFilter(within, headers);
      filter = { ...filter, ...geoFilter };
    }

    // Add soft delete handling
    if (!includeDeleted) {
      const softDeleteFilter = this.buildSoftDeleteFilter(context.options);
      filter = { ...filter, ...softDeleteFilter };
    }

    context.filter = filter;
    this.log.debug(`${logMessage} :: Filter built successfully`, { filter });
  }

  /**
   * Build field-based filters with operators
   */
  private buildFieldFilters(
    queryFields: Record<string, any>,
    exact: any,
    options: IAdvancedSearchOptions,
    headers: IRequestHeaders
  ): FilterQuery<any> {
    const logMessage = constructLogMessage(__filename, 'buildFieldFilters', headers);
    const filter: FilterQuery<any> = {};

    Object.entries(queryFields).forEach(([field, value]) => {
      if (isEmptyOrNull(value)) return;

      const stringValue = value.toString();

      // Handle MongoDB operators
      if (stringValue.match(/\b(gt|gte|lt|lte|in|nin|eq|ne|regex|exists|type|size)\b/g)) {
        filter[field] = this.parseOperatorQuery(stringValue, options);
      }
      // Handle array values (comma-separated)
      else if (stringValue.includes(',') && !stringValue.includes(' ')) {
        const arrayValues = stringValue.split(',').map(v => this.convertToProperType(v.trim(), field, options));
        filter[field] = { $in: arrayValues };
      }
      // Handle exact vs regex search
      else if (this.parseBoolean(exact)) {
        filter[field] = this.convertToProperType(stringValue, field, options);
      }
      // Case-insensitive regex search for strings
      else if (typeof value === 'string') {
        filter[field] = {
          $regex: stringValue,
          $options: 'i'
        };
      }
      // Direct value assignment for non-strings
      else {
        filter[field] = this.convertToProperType(value, field, options);
      }
    });

    this.log.debug(`${logMessage} :: Field filters built`, { filter });
    return filter;
  }

  /**
   * Parse operator-based queries (gt:100, in:val1,val2, etc.)
   */
  private parseOperatorQuery(value: string, options: IAdvancedSearchOptions): any {
    const operators: any = {};

    // Match all operators in the value
    const operatorMatches = value.matchAll(/\b(gt|gte|lt|lte|in|nin|eq|ne|regex|exists|type|size):([^,\s]+)/g);

    for (const match of operatorMatches) {
      const [, operator, operatorValue] = match;
      let parsedValue: any = operatorValue;

      // Handle array operators
      if (['in', 'nin'].includes(operator)) {
        parsedValue = operatorValue.split(',').map(v => this.convertToProperType(v.trim(), '', options));
      }
      // Handle boolean operators
      else if (['exists'].includes(operator)) {
        parsedValue = this.parseBoolean(operatorValue);
      }
      // Handle numeric operators
      else if (['gt', 'gte', 'lt', 'lte', 'size'].includes(operator)) {
        parsedValue = this.parseNumber(operatorValue);
      }
      // Handle regex operators
      else if (operator === 'regex') {
        parsedValue = new RegExp(operatorValue, 'i');
      } else {
        parsedValue = this.convertToProperType(operatorValue, '', options);
      }

      operators[`$${operator}`] = parsedValue;
    }

    return operators;
  }

  /**
   * Build full-text search filter
   */
  private buildFullTextSearchFilter(searchTerm: string, _options: IAdvancedSearchOptions): FilterQuery<any> {
    if (!searchTerm.trim()) return {};

    // Use MongoDB text search if available
    return {
      $text: {
        $search: searchTerm,
        $caseSensitive: false,
        $diacriticSensitive: false
      }
    };
  }

  /**
   * Build date range filter
   */
  private buildDateRangeFilter(dateRange: IDateRangeQuery, headers: IRequestHeaders): FilterQuery<any> {
    const logMessage = constructLogMessage(__filename, 'buildDateRangeFilter', headers);
    const filter: any = {};

    if (dateRange.from || dateRange.to) {
      const dateFilter: any = {};

      if (dateRange.from) {
        dateFilter.$gte = dateRange.from;
      }

      if (dateRange.to) {
        dateFilter.$lte = dateRange.to;
      }

      filter[dateRange.field] = dateFilter;
      this.log.debug(`${logMessage} :: Date range filter built`, { field: dateRange.field, filter: dateFilter });
    }

    return filter;
  }

  /**
   * Build geospatial near filter
   */
  private buildGeoNearFilter(near: string, headers: IRequestHeaders): FilterQuery<any> {
    const logMessage = constructLogMessage(__filename, 'buildGeoNearFilter', headers);

    try {
      const [lng, lat, maxDistance, minDistance] = near.split(',').map(Number);

      if (isNaN(lng) || isNaN(lat)) {
        throw new CSError(
          HTTP_STATUS_CODES.BAD_REQUEST,
          CODES.InvalidGeospatialQuery,
          'Invalid coordinates format for near query'
        );
      }

      const geoQuery: any = {
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [lng, lat]
            },
            $maxDistance: maxDistance || 10000
          }
        }
      };

      if (minDistance && !isNaN(minDistance)) {
        geoQuery.location.$near.$minDistance = minDistance;
      }

      this.log.debug(`${logMessage} :: Geo near filter built`, { coordinates: [lng, lat], maxDistance });
      return geoQuery;
    } catch (error) {
      this.log.warn(`${logMessage} :: Invalid geo near query: ${near}`);
      throw new CSError(
        HTTP_STATUS_CODES.BAD_REQUEST,
        CODES.InvalidGeospatialQuery,
        'Invalid geospatial near query format'
      );
    }
  }

  /**
   * Build geospatial within filter
   */
  private buildGeoWithinFilter(within: string, headers: IRequestHeaders): FilterQuery<any> {
    const logMessage = constructLogMessage(__filename, 'buildGeoWithinFilter', headers);

    try {
      const coordinates = JSON.parse(within);

      if (!Array.isArray(coordinates)) {
        throw new Error('Coordinates must be an array');
      }

      const geoQuery = {
        location: {
          $geoWithin: {
            $geometry: {
              type: 'Polygon',
              coordinates: [coordinates]
            }
          }
        }
      };

      this.log.debug(`${logMessage} :: Geo within filter built`);
      return geoQuery;
    } catch (error) {
      this.log.warn(`${logMessage} :: Invalid geo within query: ${within}`);
      throw new CSError(
        HTTP_STATUS_CODES.BAD_REQUEST,
        CODES.InvalidGeospatialQuery,
        'Invalid geospatial within query format'
      );
    }
  }

  /**
   * Build soft delete filter
   */
  private buildSoftDeleteFilter(options: IAdvancedSearchOptions): FilterQuery<any> {
    const softDeleteConfig = options.softDelete || { field: 'isDeleted', deletedValue: true };

    return {
      [softDeleteConfig.field!]: { $ne: softDeleteConfig.deletedValue }
    };
  }

  /**
   * Execute the search with the built filter
   */
  private async executeSearch<T>(
    context: IQueryBuilderContext,
    headers: IRequestHeaders
  ): Promise<IAdvancedSearchResult<T>> {
    const logMessage = constructLogMessage(__filename, 'executeSearch', headers);

    const { model, rawQuery, filter, populate } = context;
    const page = Number(rawQuery.page) || 1;
    const limit = Number(rawQuery.limit) || 25;
    const skip = (page - 1) * limit;

    // Build base query
    let query = model.find(filter);

    // Apply field selection
    if (rawQuery.select) {
      const fields = rawQuery.select.split(',').join(' ');
      query = query.select(fields);
    }

    // Apply sorting
    if (rawQuery.sort) {
      const sortBy = rawQuery.sort.split(',').join(' ');
      query = query.sort(sortBy);
    } else {
      query = query.sort(context.options.defaultSort || '-createdAt');
    }

    // Apply pagination
    query = query.skip(skip).limit(limit);

    // Apply population
    if (populate) {
      if (Array.isArray(populate)) {
        populate.forEach(field => {
          query = query.populate(field);
        });
      } else if (typeof populate === 'string') {
        query = query.populate(populate);
      } else {
        query = query.populate(populate);
      }
    }

    // Execute query and count in parallel
    const [results, totalCount] = await Promise.all([query.exec(), model.countDocuments(filter)]);

    // Build pagination metadata
    const pagination = this.buildPaginationMeta(page, limit, totalCount);

    this.log.debug(`${logMessage} :: Query executed successfully`, {
      model: model.collection.name,
      resultsCount: results.length,
      totalCount,
      page,
      limit
    });

    return {
      success: true,
      count: results.length,
      pagination,
      data: results
    };
  }

  /**
   * Build pagination metadata
   */
  private buildPaginationMeta(currentPage: number, limit: number, totalCount: number): IPaginationMeta {
    const lastPage = Math.ceil(totalCount / limit);

    return {
      current: currentPage,
      lastPage,
      size: limit,
      total: totalCount,
      prev: currentPage > 1 ? currentPage - 1 : undefined,
      next: currentPage < lastPage ? currentPage + 1 : undefined,
      hasNext: currentPage < lastPage,
      hasPrev: currentPage > 1
    };
  }

  /**
   * Utility methods
   */
  private parseBoolean(value: any): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
    }
    return false;
  }

  private parseNumber(value: any): number {
    const num = Number(value);
    return isNaN(num) ? 0 : num;
  }

  private convertToProperType(value: any, field: string, options: IAdvancedSearchOptions): any {
    // Handle boolean fields
    if (options.booleanFields?.includes(field)) {
      return this.parseBoolean(value);
    }

    // Handle numeric fields
    if (options.numericFields?.includes(field)) {
      return this.parseNumber(value);
    }

    // Try to parse as number if it looks numeric
    if (typeof value === 'string' && !isNaN(Number(value)) && value.trim() !== '') {
      return Number(value);
    }

    return value;
  }

  /**
   * Cache-related methods
   */
  private isCacheEnabled(query: IAdvancedSearchQuery, options: IAdvancedSearchOptions): boolean {
    return !!(query.cache && options.cache?.client);
  }

  private generateCacheKey(
    model: Model<any>,
    query: IAdvancedSearchQuery,
    populate?: any,
    options: IAdvancedSearchOptions = {}
  ): string {
    const components: ICacheKeyComponents = {
      model: model.collection.name,
      filter: JSON.stringify(query),
      sort: query.sort || '',
      select: query.select || '',
      populate: JSON.stringify(populate || ''),
      page: Number(query.page) || 1,
      limit: Number(query.limit) || 25
    };

    const prefix = options.cache?.keyPrefix || 'search';
    const hash = Buffer.from(JSON.stringify(components)).toString('base64');
    return `${prefix}:${model.collection.name}:${hash}`;
  }

  private async getCachedResult(
    cacheKey: string,
    options: IAdvancedSearchOptions,
    headers: IRequestHeaders
  ): Promise<IAdvancedSearchResult | null> {
    const logMessage = constructLogMessage(__filename, 'getCachedResult', headers);

    try {
      const cached = await options.cache!.client.get(cacheKey);
      if (cached) {
        this.log.debug(`${logMessage} :: Cache hit for key: ${cacheKey}`);
        return JSON.parse(cached);
      }
    } catch (error: any) {
      this.log.warn(`${logMessage} :: Cache retrieval failed`, {
        error: error?.message || 'Unknown error',
        cacheKey
      });
    }

    return null;
  }

  private async cacheResult(
    cacheKey: string,
    result: IAdvancedSearchResult,
    options: IAdvancedSearchOptions,
    headers: IRequestHeaders
  ): Promise<void> {
    const logMessage = constructLogMessage(__filename, 'cacheResult', headers);

    try {
      const ttl = options.cache?.ttl || 300;
      await options.cache!.client.setex(cacheKey, ttl, JSON.stringify(result));
      this.log.debug(`${logMessage} :: Result cached with TTL: ${ttl}`, { cacheKey });
    } catch (error: any) {
      this.log.warn(`${logMessage} :: Cache storage failed`, {
        error: error?.message || 'Unknown error',
        cacheKey
      });
    }
  }

  private enhanceResultWithMeta(
    result: IAdvancedSearchResult,
    executionTime: number,
    cached: boolean
  ): IAdvancedSearchResult {
    return {
      ...result,
      meta: {
        ...result.meta,
        executionTime,
        cached
      }
    };
  }

  /**
   * Aggregation-related methods
   */
  private async buildAggregationPipeline(
    model: Model<any>,
    query: IAdvancedSearchQuery,
    aggregationOptions: IAggregationOptions,
    options: IAdvancedSearchOptions,
    headers: IRequestHeaders
  ): Promise<any[]> {
    const logMessage = constructLogMessage(__filename, 'buildAggregationPipeline', headers);
    const pipeline: any[] = [];

    // Add match stage if there are filters
    const context: IQueryBuilderContext = {
      model,
      rawQuery: query,
      filter: {},
      options
    };

    await this.buildCompleteFilter(context, headers);

    if (Object.keys(context.filter).length > 0) {
      pipeline.push({ $match: context.filter });
    }

    // Add grouping stage
    const groupStage = this.buildGroupStage(aggregationOptions);
    if (groupStage) {
      pipeline.push(groupStage);
    }

    // Add having stage if specified
    if (aggregationOptions.having) {
      pipeline.push({ $match: aggregationOptions.having });
    }

    // Add sorting
    if (query.sort) {
      const sort = this.parseSortString(query.sort);
      pipeline.push({ $sort: sort });
    }

    // Add pagination for aggregation
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 25;
    const skip = (page - 1) * limit;

    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: limit });

    this.log.debug(`${logMessage} :: Aggregation pipeline built`, {
      stagesCount: pipeline.length,
      pipeline
    });

    return pipeline;
  }

  private buildGroupStage(aggregationOptions: IAggregationOptions): any | null {
    if (!aggregationOptions.groupBy) return null;

    const groupFields = Array.isArray(aggregationOptions.groupBy)
      ? aggregationOptions.groupBy
      : [aggregationOptions.groupBy];

    const _id: any = {};
    groupFields.forEach(field => {
      _id[field] = `$${field}`;
    });

    const group: any = { _id };

    // Add metrics
    if (aggregationOptions.metrics) {
      const { metrics } = aggregationOptions;

      if (metrics.count) {
        group.count = { $sum: 1 };
      }

      metrics.sum?.forEach(field => {
        group[`${field}_sum`] = { $sum: `$${field}` };
      });

      metrics.avg?.forEach(field => {
        group[`${field}_avg`] = { $avg: `$${field}` };
      });

      metrics.min?.forEach(field => {
        group[`${field}_min`] = { $min: `$${field}` };
      });

      metrics.max?.forEach(field => {
        group[`${field}_max`] = { $max: `$${field}` };
      });
    }

    return { $group: group };
  }

  private parseSortString(sortString: string): any {
    const sort: any = {};
    const fields = sortString.split(',');

    fields.forEach(field => {
      const trimmed = field.trim();
      if (trimmed.startsWith('-')) {
        sort[trimmed.substring(1)] = -1;
      } else {
        sort[trimmed] = 1;
      }
    });

    return sort;
  }

  private paginateAggregationResults(results: any[], query: IAdvancedSearchQuery): IAdvancedSearchResult {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 25;
    const total = results.length;

    const pagination = this.buildPaginationMeta(page, limit, total);

    return {
      success: true,
      count: results.length,
      pagination,
      data: results,
      meta: {
        query: {},
        executionTime: 0,
        cached: false,
        aggregationData: {
          totalResults: total
        }
      }
    };
  }
}
