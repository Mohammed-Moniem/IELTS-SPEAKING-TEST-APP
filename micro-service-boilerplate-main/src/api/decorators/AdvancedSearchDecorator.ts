import { IAdvancedSearchOptions, IAdvancedSearchQuery } from '@interfaces/IAdvancedSearch';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { StandardResponse } from '@responses/StandardResponse';
import { AdvancedSearchService } from '@services/AdvancedSearchService';
import { Response } from 'express';
import { Model } from 'mongoose';
import { Container } from 'typedi';

/**
 * Decorator factory for simplified advanced search endpoints
 *
 * This provides a lightweight wrapper around AdvancedSearchService
 * for common use cases while maintaining service architecture benefits
 */
export function AdvancedSearchEndpoint(options: {
  model: () => Model<any>;
  defaultOptions?: IAdvancedSearchOptions;
  allowedFilters?: string[];
  maxLimit?: number;
}) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (
      query: IAdvancedSearchQuery,
      res: Response,
      headers: IRequestHeaders,
      ...args: any[]
    ) {
      try {
        // Get service from DI container
        const searchService = Container.get(AdvancedSearchService);

        // Apply restrictions
        const restrictedQuery = applyQueryRestrictions(query, options);

        // Execute search
        const result = await searchService.search(
          options.model(),
          restrictedQuery,
          headers,
          undefined,
          options.defaultOptions
        );

        // Call original method if it exists (for custom post-processing)
        if (originalMethod) {
          return await originalMethod.call(this, result, res, headers, ...args);
        }

        // Default response
        return StandardResponse.success(res, result, 'Search completed successfully', 200, headers);
      } catch (error) {
        return StandardResponse.error(res, error as Error, headers);
      }
    };

    return descriptor;
  };
}

/**
 * Apply query restrictions based on decorator options
 */
function applyQueryRestrictions(
  query: IAdvancedSearchQuery,
  options: {
    allowedFilters?: string[];
    maxLimit?: number;
  }
): IAdvancedSearchQuery {
  const restricted = { ...query };

  // Restrict filters to allowed list
  if (options.allowedFilters && restricted.filters) {
    const allowedSet = new Set(options.allowedFilters);
    restricted.filters = Object.keys(restricted.filters)
      .filter(key => allowedSet.has(key))
      .reduce((obj: any, key) => {
        obj[key] = restricted.filters![key];
        return obj;
      }, {});
  }

  // Apply max limit
  if (options.maxLimit && restricted.pagination?.limit) {
    restricted.pagination.limit = Math.min(restricted.pagination.limit, options.maxLimit);
  }

  return restricted;
}
