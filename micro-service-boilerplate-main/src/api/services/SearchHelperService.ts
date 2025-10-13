import { IAdvancedSearchOptions, IAdvancedSearchQuery, IQueryValidation } from '@interfaces/IAdvancedSearch';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { constructLogMessage } from '@lib/env/helpers';
import { Logger } from '@lib/logger';
import { Service } from 'typedi';

/**
 * Search Helper Service
 *
 * Provides utility functions for search operations including validation,
 * sanitization, performance optimization, and query analysis.
 */
@Service()
export class SearchHelperService {
  private log = new Logger(__filename);

  /**
   * Validate search query parameters comprehensively
   */
  public validateSearchQuery(
    query: IAdvancedSearchQuery,
    options: IAdvancedSearchOptions,
    headers: IRequestHeaders
  ): IQueryValidation {
    const logMessage = constructLogMessage(__filename, 'validateSearchQuery', headers);
    this.log.debug(`${logMessage} :: Validating search query`);

    const errors: string[] = [];
    const warnings: string[] = [];
    const sanitizedQuery = { ...query };

    // Validate pagination parameters
    const pageValidation = this.validatePagination(sanitizedQuery, options);
    errors.push(...pageValidation.errors);
    warnings.push(...pageValidation.warnings);

    // Validate field restrictions
    const fieldValidation = this.validateFields(sanitizedQuery, options);
    errors.push(...fieldValidation.errors);
    warnings.push(...fieldValidation.warnings);

    // Validate geospatial parameters
    if (sanitizedQuery.near || sanitizedQuery.within) {
      const geoValidation = this.validateGeospatialParams(sanitizedQuery, options);
      errors.push(...geoValidation.errors);
      warnings.push(...geoValidation.warnings);
    }

    // Validate date parameters
    if (sanitizedQuery.dateFrom || sanitizedQuery.dateTo) {
      const dateValidation = this.validateDateParams(sanitizedQuery);
      errors.push(...dateValidation.errors);
      warnings.push(...dateValidation.warnings);
    }

    // Validate sort parameters
    if (sanitizedQuery.sort) {
      const sortValidation = this.validateSortParams(sanitizedQuery.sort, options);
      errors.push(...sortValidation.errors);
      warnings.push(...sortValidation.warnings);
    }

    // Validate select parameters
    if (sanitizedQuery.select) {
      const selectValidation = this.validateSelectParams(sanitizedQuery.select, options);
      errors.push(...selectValidation.errors);
      warnings.push(...selectValidation.warnings);
    }

    const isValid = errors.length === 0;

    this.log.debug(`${logMessage} :: Query validation completed`, {
      isValid,
      errorsCount: errors.length,
      warningsCount: warnings.length
    });

    return {
      isValid,
      errors,
      warnings,
      sanitizedQuery
    };
  }

  /**
   * Optimize query for better performance
   */
  public optimizeQuery(
    query: IAdvancedSearchQuery,
    options: IAdvancedSearchOptions,
    headers: IRequestHeaders
  ): IAdvancedSearchQuery {
    const logMessage = constructLogMessage(__filename, 'optimizeQuery', headers);
    this.log.debug(`${logMessage} :: Optimizing search query`);

    const optimized = { ...query };

    // Optimize pagination
    if (optimized.limit && Number(optimized.limit) > (options.maxLimit || 100)) {
      optimized.limit = (options.maxLimit || 100).toString();
      this.log.warn(`${logMessage} :: Limit reduced to maximum allowed: ${optimized.limit}`);
    }

    // Optimize select fields (remove duplicates, invalid fields)
    if (optimized.select) {
      const selectFields = optimized.select.split(',');
      const uniqueFields = [...new Set(selectFields.map(f => f.trim()))];

      if (options.excludedFields) {
        const filteredFields = uniqueFields.filter(field => !options.excludedFields!.includes(field));
        optimized.select = filteredFields.join(',');
      } else {
        optimized.select = uniqueFields.join(',');
      }
    }

    // Optimize sort fields
    if (optimized.sort) {
      const sortFields = optimized.sort.split(',');
      const uniqueSorts = [...new Set(sortFields.map(f => f.trim()))];
      optimized.sort = uniqueSorts.join(',');
    }

    // Add performance hints
    if (!optimized.sort && !optimized.search) {
      optimized.sort = options.defaultSort || '-createdAt';
    }

    this.log.debug(`${logMessage} :: Query optimization completed`);
    return optimized;
  }

  /**
   * Generate performance recommendations
   */
  public generatePerformanceRecommendations(
    query: IAdvancedSearchQuery,
    options: IAdvancedSearchOptions,
    headers: IRequestHeaders
  ): string[] {
    const logMessage = constructLogMessage(__filename, 'generatePerformanceRecommendations', headers);
    const recommendations: string[] = [];

    // Check for potential performance issues
    if (!query.limit || Number(query.limit) > 50) {
      recommendations.push('Consider using smaller limit values (≤50) for better performance');
    }

    if (query.search && !options.enableFullTextSearch) {
      recommendations.push('Full-text search is not enabled. Consider enabling it for better search performance');
    }

    if (Object.keys(query).length > 10) {
      recommendations.push('Consider reducing the number of filter parameters for better performance');
    }

    if (query.sort && query.sort.split(',').length > 3) {
      recommendations.push('Consider limiting sort fields to 3 or fewer for better performance');
    }

    if (query.select && query.select.split(',').length > 20) {
      recommendations.push('Consider selecting fewer fields for better performance');
    }

    if ((query.near || query.within) && !options.enableGeospatial) {
      recommendations.push('Geospatial queries require proper indexing. Ensure 2dsphere indexes are created');
    }

    this.log.debug(`${logMessage} :: Generated ${recommendations.length} performance recommendations`);
    return recommendations;
  }

  /**
   * Sanitize dangerous query parameters
   */
  public sanitizeQuery(query: IAdvancedSearchQuery, headers: IRequestHeaders): IAdvancedSearchQuery {
    const logMessage = constructLogMessage(__filename, 'sanitizeQuery', headers);
    this.log.debug(`${logMessage} :: Sanitizing query parameters`);

    const sanitized = { ...query };

    // Remove potentially dangerous patterns
    Object.keys(sanitized).forEach(key => {
      if (typeof sanitized[key] === 'string') {
        // Remove MongoDB injection patterns
        sanitized[key] = sanitized[key]
          .replace(/\$where/gi, '')
          .replace(/\$expr/gi, '')
          .replace(/\$jsonSchema/gi, '')
          .replace(/eval\s*\(/gi, '')
          .replace(/function\s*\(/gi, '');

        // Remove script tags and javascript
        sanitized[key] = sanitized[key]
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+\s*=/gi, '');
      }
    });

    // Validate and convert types
    if (sanitized.page) {
      sanitized.page = Math.max(1, parseInt(sanitized.page.toString(), 10)) || 1;
    }

    if (sanitized.limit) {
      sanitized.limit = Math.max(1, Math.min(1000, parseInt(sanitized.limit.toString(), 10))) || 25;
    }

    this.log.debug(`${logMessage} :: Query sanitization completed`);
    return sanitized;
  }

  /**
   * Build cache key with performance considerations
   */
  public buildOptimizedCacheKey(
    modelName: string,
    query: IAdvancedSearchQuery,
    populate?: any,
    options: IAdvancedSearchOptions = {}
  ): string {
    // Create a normalized version of the query for consistent caching
    const normalizedQuery = this.normalizeQueryForCaching(query);

    const keyComponents = {
      model: modelName,
      query: normalizedQuery,
      populate: populate ? JSON.stringify(populate) : '',
      timestamp: Math.floor(Date.now() / (options.cache?.ttl || 300)) // Group by TTL periods
    };

    const keyString = JSON.stringify(keyComponents);
    const hash = Buffer.from(keyString).toString('base64url').substring(0, 50);

    const prefix = options.cache?.keyPrefix || 'search';
    return `${prefix}:${modelName}:${hash}`;
  }

  /**
   * Estimate query complexity
   */
  public estimateQueryComplexity(query: IAdvancedSearchQuery, _options: IAdvancedSearchOptions): number {
    let complexity = 0;

    // Base complexity
    complexity += 1;

    // Filter complexity
    const filterCount = Object.keys(query).filter(
      key => !['select', 'sort', 'page', 'limit', 'cache'].includes(key)
    ).length;
    complexity += filterCount * 0.5;

    // Regex searches are more expensive
    Object.values(query).forEach(value => {
      if (typeof value === 'string' && value.includes('regex:')) {
        complexity += 2;
      }
    });

    // Geospatial queries
    if (query.near || query.within) {
      complexity += 3;
    }

    // Full-text search
    if (query.search) {
      complexity += 2;
    }

    // Sort complexity
    if (query.sort) {
      const sortFields = query.sort.split(',').length;
      complexity += sortFields * 0.3;
    }

    // Population complexity
    complexity += 0.5; // Assume some population

    return Math.round(complexity * 10) / 10;
  }

  /**
   * Private validation methods
   */
  private validatePagination(
    query: IAdvancedSearchQuery,
    options: IAdvancedSearchOptions
  ): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (query.page && (isNaN(Number(query.page)) || Number(query.page) < 1)) {
      errors.push('Page must be a positive integer');
    }

    if (query.limit && (isNaN(Number(query.limit)) || Number(query.limit) < 1)) {
      errors.push('Limit must be a positive integer');
    }

    if (query.limit && Number(query.limit) > (options.maxLimit || 100)) {
      warnings.push(`Limit exceeds maximum allowed (${options.maxLimit || 100})`);
    }

    return { errors, warnings };
  }

  private validateFields(
    query: IAdvancedSearchQuery,
    options: IAdvancedSearchOptions
  ): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (options.allowedFields) {
      const queryFields = Object.keys(query).filter(
        key => !['select', 'sort', 'page', 'limit', 'and', 'exact', 'cache', 'includeDeleted'].includes(key)
      );

      const invalidFields = queryFields.filter(field => !options.allowedFields!.includes(field));

      if (invalidFields.length > 0) {
        errors.push(`Invalid fields: ${invalidFields.join(', ')}`);
      }
    }

    return { errors, warnings };
  }

  private validateGeospatialParams(
    query: IAdvancedSearchQuery,
    options: IAdvancedSearchOptions
  ): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!options.enableGeospatial) {
      warnings.push('Geospatial queries are not enabled');
    }

    if (query.near) {
      const parts = query.near.split(',');
      if (parts.length < 2 || parts.length > 4) {
        errors.push('Near parameter must be in format: longitude,latitude[,maxDistance[,minDistance]]');
      } else {
        const [lng, lat] = parts.map(Number);
        if (isNaN(lng) || isNaN(lat)) {
          errors.push('Invalid coordinates in near parameter');
        }
        if (Math.abs(lng) > 180 || Math.abs(lat) > 90) {
          errors.push('Coordinates out of valid range');
        }
      }
    }

    if (query.within) {
      try {
        const coordinates = JSON.parse(query.within);
        if (!Array.isArray(coordinates)) {
          errors.push('Within parameter must be a valid JSON array');
        }
      } catch {
        errors.push('Within parameter must be valid JSON');
      }
    }

    return { errors, warnings };
  }

  private validateDateParams(query: IAdvancedSearchQuery): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (query.dateFrom && isNaN(Date.parse(query.dateFrom))) {
      errors.push('Invalid dateFrom format');
    }

    if (query.dateTo && isNaN(Date.parse(query.dateTo))) {
      errors.push('Invalid dateTo format');
    }

    if (query.dateFrom && query.dateTo) {
      const from = new Date(query.dateFrom);
      const to = new Date(query.dateTo);
      if (from > to) {
        errors.push('dateFrom must be earlier than dateTo');
      }
    }

    if ((query.dateFrom || query.dateTo) && !query.dateField) {
      warnings.push('Date range specified but no dateField provided');
    }

    return { errors, warnings };
  }

  private validateSortParams(sort: string, options: IAdvancedSearchOptions): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    const sortFields = sort.split(',');

    if (sortFields.length > 5) {
      warnings.push('Too many sort fields may impact performance');
    }

    sortFields.forEach(field => {
      const trimmed = field.trim();
      const fieldName = trimmed.startsWith('-') ? trimmed.substring(1) : trimmed;

      if (options.allowedFields && !options.allowedFields.includes(fieldName)) {
        errors.push(`Invalid sort field: ${fieldName}`);
      }
    });

    return { errors, warnings };
  }

  private validateSelectParams(
    select: string,
    options: IAdvancedSearchOptions
  ): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    const selectFields = select.split(',').map(f => f.trim());

    if (selectFields.length > 30) {
      warnings.push('Selecting too many fields may impact performance');
    }

    if (options.excludedFields) {
      const excludedSelected = selectFields.filter(field => options.excludedFields!.includes(field));

      if (excludedSelected.length > 0) {
        errors.push(`Cannot select excluded fields: ${excludedSelected.join(', ')}`);
      }
    }

    return { errors, warnings };
  }

  private normalizeQueryForCaching(query: IAdvancedSearchQuery): any {
    const normalized = { ...query };

    // Sort object keys for consistent caching
    const sortedKeys = Object.keys(normalized).sort();
    const sortedQuery: any = {};

    sortedKeys.forEach(key => {
      sortedQuery[key] = normalized[key];
    });

    return sortedQuery;
  }
}
