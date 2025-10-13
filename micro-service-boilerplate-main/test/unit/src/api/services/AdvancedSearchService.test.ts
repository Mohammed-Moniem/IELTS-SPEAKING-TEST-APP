import { IAdvancedSearchOptions, IAdvancedSearchQuery, IAggregationOptions } from '@interfaces/IAdvancedSearch';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { AdvancedSearchService } from '@services/AdvancedSearchService';
import { SearchHelperService } from '@services/SearchHelperService';
import { HttpError } from 'routing-controllers';
import { Container } from 'typedi';

// Mock Mongoose model
const mockModel = {
  collection: { name: 'testmodels' },
  find: jest.fn(),
  countDocuments: jest.fn(),
  aggregate: jest.fn()
} as any;

// Mock query chain
const mockQuery = {
  select: jest.fn().mockReturnThis(),
  sort: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  populate: jest.fn().mockReturnThis(),
  exec: jest.fn()
};

// Mock Redis client
const mockRedisClient = {
  get: jest.fn(),
  setex: jest.fn()
};

describe('AdvancedSearchService', () => {
  let advancedSearchService: AdvancedSearchService;
  let headers: IRequestHeaders;

  beforeEach(() => {
    Container.reset();
    advancedSearchService = Container.get(AdvancedSearchService);
    headers = { urc: 'test-urc' };

    // Reset all mocks
    jest.clearAllMocks();

    // Ensure query chain always returns itself
    mockQuery.select.mockReturnThis();
    mockQuery.sort.mockReturnThis();
    mockQuery.skip.mockReturnThis();
    mockQuery.limit.mockReturnThis();
    mockQuery.populate.mockReturnThis();
    mockQuery.exec.mockResolvedValue([{ id: '1', name: 'Test' }]);

    // Setup model mocks to always return the query chain
    mockModel.find.mockReturnValue(mockQuery);
    mockModel.countDocuments.mockResolvedValue(100);
    mockModel.aggregate.mockResolvedValue([{ _id: 'group1', count: 10, data: [{ id: '1', name: 'Test' }] }]);
  });

  describe('search', () => {
    it('should perform basic search with default pagination', async () => {
      const query: IAdvancedSearchQuery = {
        name: 'test'
      };

      const result = await advancedSearchService.search(mockModel, query, headers);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.pagination.current).toBe(1);
      expect(result.pagination.size).toBe(25);
      expect(mockModel.find).toHaveBeenCalled();
      expect(mockQuery.sort).toHaveBeenCalledWith('-createdAt');
    });

    it('should handle pagination correctly', async () => {
      const query: IAdvancedSearchQuery = {
        page: '2',
        limit: '10',
        name: 'test'
      };

      await advancedSearchService.search(mockModel, query, headers);

      expect(mockQuery.skip).toHaveBeenCalledWith(10);
      expect(mockQuery.limit).toHaveBeenCalledWith(10);
    });

    it('should handle field selection', async () => {
      const query: IAdvancedSearchQuery = {
        select: 'name,email,age'
      };

      await advancedSearchService.search(mockModel, query, headers);

      expect(mockQuery.select).toHaveBeenCalledWith('name email age');
    });

    it('should handle custom sorting', async () => {
      const query: IAdvancedSearchQuery = {
        sort: 'name,-createdAt,age'
      };

      await advancedSearchService.search(mockModel, query, headers);

      expect(mockQuery.sort).toHaveBeenCalledWith('name -createdAt age');
    });

    it('should handle exact search', async () => {
      const query: IAdvancedSearchQuery = {
        name: 'test',
        exact: 'true'
      };

      const result = await advancedSearchService.search(mockModel, query, headers);

      expect(result.success).toBe(true);
      expect(mockModel.find).toHaveBeenCalledWith({
        name: 'test',
        isDeleted: { $ne: true }
      });
    });

    it('should handle regex search by default', async () => {
      const query: IAdvancedSearchQuery = {
        name: 'test'
      };

      await advancedSearchService.search(mockModel, query, headers);

      expect(mockModel.find).toHaveBeenCalledWith({
        name: { $regex: 'test', $options: 'i' },
        isDeleted: { $ne: true }
      });
    });

    it('should handle array filters with comma-separated values', async () => {
      const query: IAdvancedSearchQuery = {
        tags: 'javascript,nodejs,express'
      };

      await advancedSearchService.search(mockModel, query, headers);

      expect(mockModel.find).toHaveBeenCalledWith({
        tags: { $in: ['javascript', 'nodejs', 'express'] },
        isDeleted: { $ne: true }
      });
    });

    it('should handle MongoDB operators', async () => {
      const query: IAdvancedSearchQuery = {
        age: 'gt:18',
        salary: 'gte:50000',
        score: 'lt:100'
      };

      await advancedSearchService.search(mockModel, query, headers);

      expect(mockModel.find).toHaveBeenCalledWith({
        $or: [{ age: { $gt: 18 } }, { salary: { $gte: 50000 } }, { score: { $lt: 100 } }],
        isDeleted: { $ne: true }
      });
    });

    it('should handle AND logic', async () => {
      const query: IAdvancedSearchQuery = {
        name: 'test',
        email: 'test@example.com',
        and: 'true'
      };

      await advancedSearchService.search(mockModel, query, headers);

      expect(mockModel.find).toHaveBeenCalledWith({
        $and: [{ name: { $regex: 'test', $options: 'i' } }, { email: { $regex: 'test@example.com', $options: 'i' } }],
        isDeleted: { $ne: true }
      });
    });

    it('should handle population', async () => {
      const query: IAdvancedSearchQuery = {
        name: 'test'
      };
      const populate = 'author';

      await advancedSearchService.search(mockModel, query, headers, populate);

      expect(mockQuery.populate).toHaveBeenCalledWith('author');
    });

    it('should handle complex population', async () => {
      const query: IAdvancedSearchQuery = {
        name: 'test'
      };
      const populate = [
        { path: 'author', select: 'name email' },
        { path: 'category', select: 'name' }
      ];

      await advancedSearchService.search(mockModel, query, headers, populate);

      expect(mockQuery.populate).toHaveBeenCalledTimes(2);
    });

    it('should validate allowed fields', async () => {
      const query: IAdvancedSearchQuery = {
        name: 'test',
        secretField: 'value'
      };
      const options: IAdvancedSearchOptions = {
        allowedFields: ['name', 'email']
      };

      await expect(advancedSearchService.search(mockModel, query, headers, undefined, options)).rejects.toThrow(
        HttpError
      );
    });

    it('should handle geospatial near queries', async () => {
      const query: IAdvancedSearchQuery = {
        near: '-73.97,40.77,5000'
      };
      const options: IAdvancedSearchOptions = {
        enableGeospatial: true
      };

      await advancedSearchService.search(mockModel, query, headers, undefined, options);

      expect(mockModel.find).toHaveBeenCalledWith({
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [-73.97, 40.77]
            },
            $maxDistance: 5000
          }
        },
        isDeleted: { $ne: true }
      });
    });

    it('should handle geospatial within queries', async () => {
      const coordinates = [
        [
          [-73.9, 40.7],
          [-73.8, 40.7],
          [-73.8, 40.8],
          [-73.9, 40.8],
          [-73.9, 40.7]
        ]
      ];
      const query: IAdvancedSearchQuery = {
        within: JSON.stringify(coordinates)
      };
      const options: IAdvancedSearchOptions = {
        enableGeospatial: true
      };

      await advancedSearchService.search(mockModel, query, headers, undefined, options);

      expect(mockModel.find).toHaveBeenCalledWith({
        location: {
          $geoWithin: {
            $geometry: {
              type: 'Polygon',
              coordinates: [coordinates]
            }
          }
        },
        isDeleted: { $ne: true }
      });
    });

    it('should handle full-text search', async () => {
      const query: IAdvancedSearchQuery = {
        search: 'javascript programming'
      };
      const options: IAdvancedSearchOptions = {
        enableFullTextSearch: true
      };

      await advancedSearchService.search(mockModel, query, headers, undefined, options);

      expect(mockModel.find).toHaveBeenCalledWith({
        $text: {
          $search: 'javascript programming',
          $caseSensitive: false,
          $diacriticSensitive: false
        },
        isDeleted: { $ne: true }
      });
    });

    it('should handle date range filters', async () => {
      const query: IAdvancedSearchQuery = {
        dateFrom: '2024-01-01',
        dateTo: '2024-12-31',
        dateField: 'createdAt'
      };

      await advancedSearchService.search(mockModel, query, headers);

      expect(mockModel.find).toHaveBeenCalledWith({
        createdAt: {
          $gte: new Date('2024-01-01'),
          $lte: new Date('2024-12-31')
        },
        isDeleted: { $ne: true }
      });
    });

    it('should handle caching', async () => {
      const query: IAdvancedSearchQuery = {
        name: 'test',
        cache: 'true'
      };
      const options: IAdvancedSearchOptions = {
        cache: {
          client: mockRedisClient,
          ttl: 300
        }
      };

      // Mock cache miss first, then hit
      mockRedisClient.get.mockResolvedValueOnce(null);

      const result1 = await advancedSearchService.search(mockModel, query, headers, undefined, options);

      expect(mockRedisClient.get).toHaveBeenCalled();
      expect(mockRedisClient.setex).toHaveBeenCalled();

      // Mock cache hit
      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify(result1));

      const result2 = await advancedSearchService.search(mockModel, query, headers, undefined, options);

      // Check that core data is the same, but meta might be different due to caching
      expect(result2.success).toBe(result1.success);
      expect(result2.count).toBe(result1.count);
      expect(result2.data).toEqual(result1.data);
      expect(result2.pagination).toEqual(result1.pagination);
    });

    it('should handle soft delete inclusion', async () => {
      const query: IAdvancedSearchQuery = {
        name: 'test',
        includeDeleted: 'true'
      };

      await advancedSearchService.search(mockModel, query, headers);

      expect(mockModel.find).toHaveBeenCalledWith({
        name: { $regex: 'test', $options: 'i' }
      });
    });

    it('should limit results to maxLimit', async () => {
      const query: IAdvancedSearchQuery = {
        limit: '1000'
      };
      const options: IAdvancedSearchOptions = {
        maxLimit: 100
      };

      await advancedSearchService.search(mockModel, query, headers, undefined, options);

      expect(mockQuery.limit).toHaveBeenCalledWith(100);
    });

    it('should handle errors gracefully', async () => {
      mockQuery.exec.mockRejectedValue(new Error('Database error'));

      const query: IAdvancedSearchQuery = {
        name: 'test'
      };

      await expect(advancedSearchService.search(mockModel, query, headers)).rejects.toThrow(HttpError);
    });
  });

  describe('aggregateSearch', () => {
    it('should perform aggregation search', async () => {
      const query: IAdvancedSearchQuery = {
        name: 'test'
      };
      const aggregationOptions = {
        groupBy: 'category',
        metrics: {
          count: true,
          sum: ['price'],
          avg: ['rating']
        }
      };

      mockModel.aggregate.mockResolvedValue([
        { _id: { category: 'electronics' }, count: 5, price_sum: 1000, rating_avg: 4.5 }
      ]);

      const result = await advancedSearchService.aggregateSearch(mockModel, query, aggregationOptions, headers);

      expect(result.success).toBe(true);
      expect(mockModel.aggregate).toHaveBeenCalled();
    });

    it('should handle aggregation errors', async () => {
      mockModel.aggregate.mockRejectedValue(new Error('Aggregation error'));

      const query: IAdvancedSearchQuery = {
        name: 'test'
      };
      const aggregationOptions = {
        groupBy: 'category'
      };

      await expect(
        advancedSearchService.aggregateSearch(mockModel, query, aggregationOptions, headers)
      ).rejects.toThrow(HttpError);
    });
  });

  describe('private methods via public interface', () => {
    it('should build correct pagination metadata', async () => {
      mockModel.countDocuments.mockResolvedValue(250);

      const query: IAdvancedSearchQuery = {
        page: '3',
        limit: '20'
      };

      const result = await advancedSearchService.search(mockModel, query, headers);

      expect(result.pagination).toEqual({
        current: 3,
        lastPage: 13,
        size: 20,
        total: 250,
        prev: 2,
        next: 4,
        hasNext: true,
        hasPrev: true
      });
    });

    it('should handle first page pagination', async () => {
      mockModel.countDocuments.mockResolvedValue(50);

      const query: IAdvancedSearchQuery = {
        page: '1',
        limit: '25'
      };

      const result = await advancedSearchService.search(mockModel, query, headers);

      expect(result.pagination).toEqual({
        current: 1,
        lastPage: 2,
        size: 25,
        total: 50,
        next: 2,
        hasNext: true,
        hasPrev: false
      });
    });

    it('should handle last page pagination', async () => {
      mockModel.countDocuments.mockResolvedValue(75);

      const query: IAdvancedSearchQuery = {
        page: '3',
        limit: '25'
      };

      const result = await advancedSearchService.search(mockModel, query, headers);

      expect(result.pagination).toEqual({
        current: 3,
        lastPage: 3,
        size: 25,
        total: 75,
        prev: 2,
        hasNext: false,
        hasPrev: true
      });
    });
  });

  describe('utility methods', () => {
    const utilityHeaders: IRequestHeaders = { urc: 'utility-test' };

    it('should sanitize select fields against exclusions', () => {
      const query: IAdvancedSearchQuery = {
        select: 'name,email,password'
      };

      const result = (advancedSearchService as any).validateAndSanitizeQuery(query, {
        excludedFields: ['password']
      }, utilityHeaders);

      expect(result.select).toBe('name,email');
    });

    it('should build field filters across operator branches', () => {
      const options: IAdvancedSearchOptions = {
        numericFields: ['age'],
        booleanFields: ['isActive']
      };

      const filter = (advancedSearchService as any).buildFieldFilters(
        {
          age: 'gt:30',
          tags: 'alpha,beta',
          isActive: 'true',
          title: 'Example',
          createdAt: 1700000000000
        },
        true,
        options,
        utilityHeaders
      );

      expect(filter.age.$gt).toBe(30);
      expect(filter.tags.$in).toEqual(['alpha', 'beta']);
      expect(filter.isActive).toBe(true);
      expect(filter.title).toBe('Example');
      expect(filter.createdAt).toBe(1700000000000);
    });

    it('should parse operator queries with regex and numeric operators', () => {
      const operators = (advancedSearchService as any).parseOperatorQuery('regex:sample,exists:true,lt:5', {}, utilityHeaders);

      expect(operators.$regex).toBeInstanceOf(RegExp);
      expect(operators.$exists).toBe(true);
      expect(operators.$lt).toBe(5);
    });

    it('should build full text search filter and handle empty terms', () => {
      const populated = (advancedSearchService as any).buildFullTextSearchFilter('hello world', {});
      const empty = (advancedSearchService as any).buildFullTextSearchFilter('   ', {});

      expect(populated.$text.$search).toBe('hello world');
      expect(empty).toEqual({});
    });

    it('should build date range filters when boundaries provided', () => {
      const filter = (advancedSearchService as any).buildDateRangeFilter(
        { field: 'createdAt', from: new Date('2024-01-01'), to: new Date('2024-02-01') },
        utilityHeaders
      );

      expect(filter.createdAt.$gte).toBeInstanceOf(Date);
      expect(filter.createdAt.$lte).toBeInstanceOf(Date);

      const empty = (advancedSearchService as any).buildDateRangeFilter({ field: 'createdAt' }, utilityHeaders);
      expect(empty).toEqual({});
    });

    it('should build and validate geo near filters', () => {
      const nearFilter = (advancedSearchService as any).buildGeoNearFilter('-73.97,40.77,5000,100', utilityHeaders);
      expect(nearFilter.location.$near.$geometry.coordinates).toEqual([-73.97, 40.77]);

      expect(() =>
        (advancedSearchService as any).buildGeoNearFilter('invalid-coordinates', utilityHeaders)
      ).toThrow('Invalid geospatial near query format');
    });

    it('should build and validate geo within filters', () => {
      const geoWithin = (advancedSearchService as any).buildGeoWithinFilter(
        JSON.stringify([
          [40.73, -73.93],
          [40.74, -73.94],
          [40.72, -73.95],
          [40.73, -73.93]
        ]),
        utilityHeaders
      );

      expect(geoWithin.location.$geoWithin.$geometry.coordinates[0].length).toBe(4);

      expect(() =>
        (advancedSearchService as any).buildGeoWithinFilter('not-json', utilityHeaders)
      ).toThrow('Invalid geospatial within query format');
    });

    it('should convert values to proper types', () => {
      const options: IAdvancedSearchOptions = {
        booleanFields: ['isActive'],
        numericFields: ['age']
      };

      expect((advancedSearchService as any).convertToProperType('true', 'isActive', options)).toBe(true);
      expect((advancedSearchService as any).convertToProperType('42', 'age', options)).toBe(42);
      expect((advancedSearchService as any).convertToProperType('123', 'other', options)).toBe(123);
      expect((advancedSearchService as any).convertToProperType('value', 'other', options)).toBe('value');
    });

    it('should parse booleans and numbers safely', () => {
      expect((advancedSearchService as any).parseBoolean(true)).toBe(true);
      expect((advancedSearchService as any).parseBoolean('YES')).toBe(true);
      expect((advancedSearchService as any).parseBoolean('no')).toBe(false);

      expect((advancedSearchService as any).parseNumber('15')).toBe(15);
      expect((advancedSearchService as any).parseNumber('not-a-number')).toBe(0);
    });

    it('should handle cache key generation and retrieval flows', async () => {
      const mockClient = {
        get: jest.fn().mockResolvedValueOnce(JSON.stringify({ success: true, data: [] })),
        setex: jest.fn().mockResolvedValue(undefined)
      };

      const cacheKey = (advancedSearchService as any).generateCacheKey(
        mockModel,
        { page: '2', limit: '10', sort: 'name' },
        { path: 'user' },
        { cache: { client: mockClient, keyPrefix: 'custom' } }
      );

      expect(cacheKey.startsWith('custom:testmodels:')).toBe(true);

      const cached = await (advancedSearchService as any).getCachedResult(cacheKey, { cache: { client: mockClient } }, utilityHeaders);
      expect(cached).toEqual({ success: true, data: [] });

      await (advancedSearchService as any).cacheResult(cacheKey, { success: true, data: [] }, { cache: { client: mockClient, ttl: 60 } }, utilityHeaders);
      expect(mockClient.setex).toHaveBeenCalledWith(cacheKey, 60, expect.any(String));
    });

    it('should gracefully handle cache retrieval failures', async () => {
      const mockClient = {
        get: jest.fn().mockRejectedValue(new Error('cache down'))
      };

      const result = await (advancedSearchService as any).getCachedResult('key', { cache: { client: mockClient } }, utilityHeaders);
      expect(result).toBeNull();
    });

    it('should build aggregation pipeline with grouping and sorting', async () => {
      const aggregationOptions: IAggregationOptions = {
        groupBy: ['status'],
        having: { status: 'active' },
        metrics: {
          count: true,
          sum: ['amount'],
          avg: ['score'],
          min: ['age'],
          max: ['age']
        }
      };

      const pipeline = await (advancedSearchService as any).buildAggregationPipeline(
        mockModel,
        { page: '1', limit: '5', sort: 'status,-amount' },
        aggregationOptions,
        {},
        utilityHeaders
      );

      expect(pipeline.some(stage => stage.$group)).toBe(true);
      expect(pipeline.some(stage => stage.$match)).toBe(true);
      expect(pipeline.some(stage => stage.$sort)).toBe(true);
    });

    it('should parse sort strings and paginate aggregation results', () => {
      const sort = (advancedSearchService as any).parseSortString('name,-createdAt');
      expect(sort).toEqual({ name: 1, createdAt: -1 });

      const result = (advancedSearchService as any).paginateAggregationResults(
        [{ id: 1 }, { id: 2 }, { id: 3 }],
        { page: '1', limit: '2' }
      );

      expect(result.pagination.total).toBe(3);
      expect(result.meta.aggregationData.totalResults).toBe(3);
    });
  });
});

describe('SearchHelperService', () => {
  let searchHelperService: SearchHelperService;
  let headers: IRequestHeaders;

  beforeEach(() => {
    Container.reset();
    searchHelperService = Container.get(SearchHelperService);
    headers = { urc: 'test-urc' };
  });

  describe('validateSearchQuery', () => {
    it('should validate valid query', () => {
      const query: IAdvancedSearchQuery = {
        name: 'test',
        page: '1',
        limit: '25'
      };
      const options: IAdvancedSearchOptions = {
        allowedFields: ['name', 'email']
      };

      const result = searchHelperService.validateSearchQuery(query, options, headers);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid pagination', () => {
      const query: IAdvancedSearchQuery = {
        page: 'invalid',
        limit: '-5'
      };

      const result = searchHelperService.validateSearchQuery(query, {}, headers);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Page must be a positive integer');
      expect(result.errors).toContain('Limit must be a positive integer');
    });

    it('should detect invalid fields', () => {
      const query: IAdvancedSearchQuery = {
        name: 'test',
        secretField: 'value'
      };
      const options: IAdvancedSearchOptions = {
        allowedFields: ['name', 'email']
      };

      const result = searchHelperService.validateSearchQuery(query, options, headers);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid fields: secretField');
    });

    it('should detect invalid geospatial parameters', () => {
      const query: IAdvancedSearchQuery = {
        near: 'invalid-coordinates'
      };

      const result = searchHelperService.validateSearchQuery(query, {}, headers);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Near parameter must be in format: longitude,latitude[,maxDistance[,minDistance]]'
      );
    });

    it('should detect invalid date parameters', () => {
      const query: IAdvancedSearchQuery = {
        dateFrom: 'invalid-date',
        dateTo: '2024-01-01'
      };

      const result = searchHelperService.validateSearchQuery(query, {}, headers);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid dateFrom format');
    });

    it('should detect date range issues', () => {
      const query: IAdvancedSearchQuery = {
        dateFrom: '2024-12-31',
        dateTo: '2024-01-01'
      };

      const result = searchHelperService.validateSearchQuery(query, {}, headers);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('dateFrom must be earlier than dateTo');
    });

    it('should detect invalid sort fields and warn about too many sorts', () => {
      const query: IAdvancedSearchQuery = {
        sort: 'name,-email,createdAt,-updatedAt,status,role'
      };
      const options: IAdvancedSearchOptions = {
        allowedFields: ['name', 'createdAt', 'status']
      };

      const result = searchHelperService.validateSearchQuery(query, options, headers);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid sort field: email');
      expect(result.errors).toContain('Invalid sort field: updatedAt');
      expect(result.errors).toContain('Invalid sort field: role');
      expect(result.warnings).toContain('Too many sort fields may impact performance');
    });

    it('should detect excluded select fields and recommend limits', () => {
      const query: IAdvancedSearchQuery = {
        select: Array.from({ length: 35 }, (_, index) => `field${index}`).join(',') + ',secretField'
      };
      const options: IAdvancedSearchOptions = {
        excludedFields: ['secretField']
      };

      const result = searchHelperService.validateSearchQuery(query, options, headers);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Cannot select excluded fields: secretField');
      expect(result.warnings).toContain('Selecting too many fields may impact performance');
    });

    it('should detect geospatial coordinate issues', () => {
      const query: IAdvancedSearchQuery = {
        near: '190,95'
      };

      const result = searchHelperService.validateSearchQuery(query, {}, headers);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Coordinates out of valid range');
    });
  });

  describe('optimizeQuery', () => {
    it('should optimize limit to maxLimit', () => {
      const query: IAdvancedSearchQuery = {
        limit: '1000'
      };
      const options: IAdvancedSearchOptions = {
        maxLimit: 100
      };

      const optimized = searchHelperService.optimizeQuery(query, options, headers);

      expect(optimized.limit).toBe('100');
    });

    it('should remove duplicate select fields', () => {
      const query: IAdvancedSearchQuery = {
        select: 'name,email,name,age'
      };

      const optimized = searchHelperService.optimizeQuery(query, {}, headers);

      expect(optimized.select).toBe('name,email,age');
    });

    it('should filter excluded fields from select', () => {
      const query: IAdvancedSearchQuery = {
        select: 'name,email,password,secret'
      };
      const options: IAdvancedSearchOptions = {
        excludedFields: ['password', 'secret']
      };

      const optimized = searchHelperService.optimizeQuery(query, options, headers);

      expect(optimized.select).toBe('name,email');
    });

    it('should add default sort if missing', () => {
      const query: IAdvancedSearchQuery = {
        name: 'test'
      };
      const options: IAdvancedSearchOptions = {
        defaultSort: '-updatedAt'
      };

      const optimized = searchHelperService.optimizeQuery(query, options, headers);

      expect(optimized.sort).toBe('-updatedAt');
    });
  });

  describe('generatePerformanceRecommendations', () => {
    it('should recommend smaller limit', () => {
      const query: IAdvancedSearchQuery = {
        limit: '100'
      };

      const recommendations = searchHelperService.generatePerformanceRecommendations(query, {}, headers);

      expect(recommendations).toContain('Consider using smaller limit values (≤50) for better performance');
    });

    it('should recommend enabling full-text search', () => {
      const query: IAdvancedSearchQuery = {
        search: 'test query'
      };

      const recommendations = searchHelperService.generatePerformanceRecommendations(query, {}, headers);

      expect(recommendations).toContain(
        'Full-text search is not enabled. Consider enabling it for better search performance'
      );
    });

    it('should recommend reducing filter parameters', () => {
      const query: IAdvancedSearchQuery = {
        field1: 'value1',
        field2: 'value2',
        field3: 'value3',
        field4: 'value4',
        field5: 'value5',
        field6: 'value6',
        field7: 'value7',
        field8: 'value8',
        field9: 'value9',
        field10: 'value10',
        field11: 'value11'
      };

      const recommendations = searchHelperService.generatePerformanceRecommendations(query, {}, headers);

      expect(recommendations).toContain('Consider reducing the number of filter parameters for better performance');
    });

    it('should provide recommendations for complex query patterns', () => {
      const manyFields = Array.from({ length: 25 }, (_, index) => `field${index}`);
      const query: IAdvancedSearchQuery = {
        limit: '75',
        search: 'term',
        sort: 'name,email,createdAt,updatedAt',
        select: manyFields.join(','),
        near: '-73.97,40.77,5000'
      };
      const options: IAdvancedSearchOptions = {
        enableFullTextSearch: false,
        enableGeospatial: false
      };

      const recommendations = searchHelperService.generatePerformanceRecommendations(query, options, headers);

      expect(recommendations).toContain('Consider using smaller limit values (≤50) for better performance');
      expect(recommendations).toContain(
        'Full-text search is not enabled. Consider enabling it for better search performance'
      );
      expect(recommendations).toContain('Consider limiting sort fields to 3 or fewer for better performance');
      expect(recommendations).toContain('Consider selecting fewer fields for better performance');
      expect(recommendations).toContain('Geospatial queries require proper indexing. Ensure 2dsphere indexes are created');
    });
  });

  describe('sanitizeQuery', () => {
    it('should remove dangerous MongoDB patterns', () => {
      const query: IAdvancedSearchQuery = {
        name: 'test$where',
        code: 'function(test)',
        script: '<script>alert("xss")</script>'
      };

      const sanitized = searchHelperService.sanitizeQuery(query, headers);

      expect(sanitized.name).toBe('test');
      expect(sanitized.code).toBe('test)');
      expect(sanitized.script).toBe('');
    });

    it('should sanitize pagination values', () => {
      const query: IAdvancedSearchQuery = {
        page: 'invalid',
        limit: '2000'
      };

      const sanitized = searchHelperService.sanitizeQuery(query, headers);

      expect(sanitized.page).toBe(1);
      expect(sanitized.limit).toBe(1000);
    });
  });

  describe('buildOptimizedCacheKey', () => {
    it('should generate consistent cache keys', () => {
      const query: IAdvancedSearchQuery = {
        name: 'test',
        page: '1',
        limit: '25'
      };

      const key1 = searchHelperService.buildOptimizedCacheKey('testmodel', query);
      const key2 = searchHelperService.buildOptimizedCacheKey('testmodel', query);

      expect(key1).toBe(key2);
    });

    it('should generate different keys for different queries', () => {
      const query1: IAdvancedSearchQuery = { name: 'test1', page: '1' };
      const query2: IAdvancedSearchQuery = { email: 'test2', page: '2' };
      const options: IAdvancedSearchOptions = { cache: { client: mockRedisClient, ttl: 300 } };

      const key1 = searchHelperService.buildOptimizedCacheKey('testmodel', query1, undefined, options);
      const key2 = searchHelperService.buildOptimizedCacheKey('testmodel', query2, undefined, options);

      expect(key1).not.toBe(key2);
    });

    it('should respect populate data and cache prefix', () => {
      const query: IAdvancedSearchQuery = { status: 'active', page: '2' };
      const options: IAdvancedSearchOptions = {
        cache: { client: mockRedisClient, ttl: 600, keyPrefix: 'custom' }
      };
      const populate = [{ path: 'user', select: 'name' }];

      const key = searchHelperService.buildOptimizedCacheKey('accounts', query, populate, options);

      expect(key.startsWith('custom:accounts:')).toBe(true);
    });
  });

  describe('estimateQueryComplexity', () => {
    it('should calculate basic complexity', () => {
      const query: IAdvancedSearchQuery = {
        name: 'test'
      };

      const complexity = searchHelperService.estimateQueryComplexity(query, {});

      expect(complexity).toBeGreaterThan(0);
    });

    it('should increase complexity for geospatial queries', () => {
      const query1: IAdvancedSearchQuery = { name: 'test' };
      const query2: IAdvancedSearchQuery = { name: 'test', near: '-73.97,40.77,5000' };

      const complexity1 = searchHelperService.estimateQueryComplexity(query1, {});
      const complexity2 = searchHelperService.estimateQueryComplexity(query2, {});

      expect(complexity2).toBeGreaterThan(complexity1);
    });

    it('should increase complexity for full-text search', () => {
      const query1: IAdvancedSearchQuery = { name: 'test' };
      const query2: IAdvancedSearchQuery = { search: 'full text search' };

      const complexity1 = searchHelperService.estimateQueryComplexity(query1, {});
      const complexity2 = searchHelperService.estimateQueryComplexity(query2, {});

      expect(complexity2).toBeGreaterThan(complexity1);
    });

    it('should increase complexity for regex searches', () => {
      const query1: IAdvancedSearchQuery = { name: 'test' };
      const query2: IAdvancedSearchQuery = { name: 'regex:test.*' };

      const complexity1 = searchHelperService.estimateQueryComplexity(query1, {});
      const complexity2 = searchHelperService.estimateQueryComplexity(query2, {});

      expect(complexity2).toBeGreaterThan(complexity1);
    });

    it('should increase complexity for sort fields', () => {
      const query1: IAdvancedSearchQuery = { name: 'test' };
      const query2: IAdvancedSearchQuery = { name: 'test', sort: 'name,createdAt,updatedAt' };

      const complexity1 = searchHelperService.estimateQueryComplexity(query1, {});
      const complexity2 = searchHelperService.estimateQueryComplexity(query2, {});

      expect(complexity2).toBeGreaterThan(complexity1);
    });
  });

});
