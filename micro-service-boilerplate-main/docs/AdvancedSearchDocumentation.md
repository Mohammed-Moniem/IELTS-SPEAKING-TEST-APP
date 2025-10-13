# Advanced Search System Documentation

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Architecture](#architecture)
4. [Service-Based Approach](#service-based-approach)
5. [Decorator Approach](#decorator-approach)
6. [Query Parameters](#query-parameters)
7. [Response Format](#response-format)
8. [Security Features](#security-features)
9. [Caching](#caching)
10. [Performance Optimization](#performance-optimization)
11. [Examples](#examples)
12. [Best Practices](#best-practices)
13. [Troubleshooting](#troubleshooting)

---

## Overview

The Advanced Search System provides comprehensive search, filtering, pagination, and aggregation capabilities for your Express microservice. It supports:

- **Complex Filtering**: MongoDB operators, date ranges, numeric ranges
- **Full-Text Search**: MongoDB text search with relevance scoring
- **Geospatial Queries**: Location-based searches with distance filtering
- **Aggregation**: Group by fields, statistical operations
- **Caching**: Redis-based result caching with TTL
- **Security**: Field restrictions, query sanitization
- **Performance**: Query optimization, indexing recommendations

### Key Components

- **AdvancedSearchService**: Core search service with full functionality
- **SearchHelperService**: Validation, optimization, and security utilities
- **AdvancedSearchEndpoint Decorator**: Simplified decorator for common use cases
- **IAdvancedSearch Interfaces**: TypeScript definitions for type safety

---

## Quick Start

### 1. Basic Service Usage

```typescript
import { Container } from 'typedi';
import { AdvancedSearchService } from '@services/AdvancedSearchService';

@JsonController('/v1/products')
export class ProductController {
  constructor(private searchService: AdvancedSearchService) {}

  @Get('/search')
  public async searchProducts(
    @QueryParams() query: IAdvancedSearchQuery,
    @Res() res: Response,
    @HeaderParam('Unique-Reference-Code') urc: string
  ): Promise<void> {
    const headers: IRequestHeaders = { urc };

    try {
      const result = await this.searchService.search(
        Product, // Your Mongoose model
        query,
        headers
      );

      return StandardResponse.success(res, result, 'Search completed', 200, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }
}
```

### 2. Basic Decorator Usage

```typescript
@Get('/search')
@AdvancedSearchEndpoint({
  model: () => Product,
  allowedFilters: ['category', 'price', 'brand'],
  maxLimit: 100
})
public async searchProducts(
  @QueryParams() query: IAdvancedSearchQuery,
  @Res() res: Response,
  @HeaderParam('Unique-Reference-Code') urc: string
): Promise<void> {
  // No code needed - decorator handles everything!
}
```

---

## Architecture

### Service Layer Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Controller Layer                        │
│  ┌─────────────────────┐  ┌─────────────────────────────────┐ │
│  │ Manual Service Call │  │ @AdvancedSearchEndpoint         │ │
│  │                     │  │ Decorator                       │ │
│  └─────────────────────┘  └─────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Service Layer                          │
│  ┌─────────────────────┐  ┌─────────────────────────────────┐ │
│  │ AdvancedSearchService│ │ SearchHelperService             │ │
│  │ - search()          │  │ - validateSearchQuery()         │ │
│  │ - aggregateSearch() │  │ - sanitizeQuery()               │ │
│  │ - buildQuery()      │  │ - optimizeQuery()               │ │
│  └─────────────────────┘  └─────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Database Layer                           │
│              MongoDB with Mongoose ODM                      │
└─────────────────────────────────────────────────────────────┘
```

### Dependency Injection Flow

```typescript
// 1. Service Registration (automatic with @Service())
@Service()
export class AdvancedSearchService { ... }

// 2. Service Injection in Controllers
export class ProductController {
  constructor(private searchService: AdvancedSearchService) {}
}

// 3. Service Access in Decorators
const searchService = Container.get(AdvancedSearchService);
```

---

## Service-Based Approach

### Basic Service Usage

```typescript
@Service()
export class ProductSearchService {
  constructor(
    private advancedSearch: AdvancedSearchService,
    private searchHelper: SearchHelperService
  ) {}

  public async searchProducts(
    query: IAdvancedSearchQuery,
    headers: IRequestHeaders
  ): Promise<IAdvancedSearchResult<any>> {
    const logMessage = constructLogMessage(__filename, 'searchProducts', headers);
    this.log.info(logMessage);

    try {
      // Validate query
      await this.searchHelper.validateSearchQuery(query, {
        allowedFields: ['name', 'category', 'price'],
        requiredFields: [],
        maxLimit: 100
      });

      // Execute search
      const result = await this.advancedSearch.search(
        Product,
        query,
        headers,
        [{ path: 'category', select: 'name slug' }], // populate
        {
          allowedFields: ['name', 'description', 'price', 'category'],
          cache: {
            client: redisClient,
            ttl: 300,
            keyPrefix: 'product-search'
          }
        }
      );

      this.log.info(`${logMessage} :: Search completed with ${result.pagination.total} results`);
      return result;
    } catch (error) {
      this.log.error(`${logMessage} :: Search failed: ${error.message}`);
      throw error;
    }
  }
}
```

### Advanced Service Features

```typescript
// Complex search with multiple operations
public async complexSearch(
  criteria: IComplexSearchCriteria,
  headers: IRequestHeaders
): Promise<any> {
  const logMessage = constructLogMessage(__filename, 'complexSearch', headers);
  this.log.info(logMessage);

  try {
    // Build complex query
    const baseQuery: IAdvancedSearchQuery = {
      filters: {
        category: criteria.category,
        price: { $gte: criteria.minPrice, $lte: criteria.maxPrice }
      },
      sort: criteria.sortBy || '-createdAt',
      pagination: { page: criteria.page, limit: criteria.limit }
    };

    // Execute multiple searches in parallel
    const [
      mainResults,
      relatedResults,
      aggregationResults
    ] = await Promise.all([
      // Main search
      this.advancedSearch.search(Product, baseQuery, headers),

      // Related products search
      this.advancedSearch.search(
        Product,
        { ...baseQuery, filters: { category: criteria.category } },
        headers,
        undefined,
        { maxLimit: 5 }
      ),

      // Aggregation for analytics
      this.advancedSearch.aggregateSearch(
        Product,
        [
          { $match: baseQuery.filters },
          { $group: { _id: '$category', count: { $sum: 1 }, avgPrice: { $avg: '$price' } } }
        ],
        headers
      )
    ]);

    return {
      products: mainResults,
      related: relatedResults,
      analytics: aggregationResults,
      metadata: {
        searchId: this.generateSearchId(),
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    this.log.error(`${logMessage} :: Complex search failed: ${error.message}`);
    throw new CSError(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR, CODES.SearchFailed);
  }
}
```

---

## Decorator Approach

### Basic Decorator Configuration

```typescript
@AdvancedSearchEndpoint({
  model: () => YourModel,
  allowedFilters: ['field1', 'field2'],
  maxLimit: 100,
  defaultOptions: {
    allowedFields: ['field1', 'field2', 'field3'],
    cache: { client: redisClient, ttl: 300 },
    enableGeospatial: true
  }
})
```

### Decorator Configuration Options

| Option           | Type                     | Description                          | Example                 |
| ---------------- | ------------------------ | ------------------------------------ | ----------------------- |
| `model`          | `() => Model<any>`       | **Required**. Mongoose model factory | `() => Product`         |
| `allowedFilters` | `string[]`               | Whitelist of filterable fields       | `['category', 'price']` |
| `maxLimit`       | `number`                 | Maximum results per page             | `100`                   |
| `defaultOptions` | `IAdvancedSearchOptions` | Default search options               | See below               |

### Advanced Decorator Usage

```typescript
// Zero-code search endpoint
@Get('/basic-search')
@AdvancedSearchEndpoint({
  model: () => Product,
  allowedFilters: ['category', 'price', 'brand'],
  maxLimit: 50
})
public async basicSearch(
  @QueryParams() query: IAdvancedSearchQuery,
  @Res() res: Response,
  @HeaderParam('Unique-Reference-Code') urc: string
): Promise<void> {
  // Decorator handles everything automatically
}

// Search with post-processing
@Get('/enhanced-search')
@AdvancedSearchEndpoint({
  model: () => Product,
  allowedFilters: ['category', 'price'],
  defaultOptions: {
    enableFullTextSearch: true,
    cache: { client: redisClient, ttl: 600 }
  }
})
public async enhancedSearch(
  result: any, // Search result from decorator
  @Res() res: Response,
  @HeaderParam('Unique-Reference-Code') urc: string
): Promise<void> {
  const headers: IRequestHeaders = { urc };

  // Add custom post-processing
  if (result.data) {
    result.data = result.data.map(item => ({
      ...item,
      formattedPrice: this.formatCurrency(item.price),
      availability: this.checkAvailability(item)
    }));
  }

  return StandardResponse.success(res, result, 'Enhanced search completed', 200, headers);
}
```

---

## Query Parameters

### Basic Query Structure

```typescript
interface IAdvancedSearchQuery {
  // Field selection
  select?: string; // 'name,price,category'

  // Sorting
  sort?: string; // 'price' or '-price' or 'price,name'

  // Pagination
  page?: string | number; // 1, 2, 3...
  limit?: string | number; // 10, 20, 50...

  // Search behavior
  and?: string | boolean; // true/false for AND vs OR logic
  exact?: string | boolean; // true/false for exact matches

  // Geospatial
  near?: string; // '40.7128,-74.0060'
  within?: string; // '5000' (meters)

  // Caching
  cache?: string | boolean; // true/false to enable/disable cache

  // Full-text search
  search?: string; // 'smartphone camera'

  // Date filtering
  dateFrom?: string; // '2024-01-01'
  dateTo?: string; // '2024-12-31'
  dateField?: string; // 'createdAt'

  // Aggregation
  aggregateBy?: string; // 'category'
  groupBy?: string; // 'brand'

  // Dynamic filters
  [key: string]: any; // category=electronics, price[gte]=100
}
```

### Filter Operators

| Operator              | MongoDB   | URL Example                      | Description           |
| --------------------- | --------- | -------------------------------- | --------------------- |
| Equal                 | `$eq`     | `price=100`                      | Exact match           |
| Greater Than          | `$gt`     | `price[gt]=100`                  | Greater than          |
| Greater Than or Equal | `$gte`    | `price[gte]=100`                 | Greater than or equal |
| Less Than             | `$lt`     | `price[lt]=500`                  | Less than             |
| Less Than or Equal    | `$lte`    | `price[lte]=500`                 | Less than or equal    |
| Not Equal             | `$ne`     | `status[ne]=deleted`             | Not equal             |
| In Array              | `$in`     | `category[in]=electronics,books` | Value in array        |
| Not In Array          | `$nin`    | `status[nin]=deleted,archived`   | Value not in array    |
| Exists                | `$exists` | `image[exists]=true`             | Field exists          |
| Regex                 | `$regex`  | `name[regex]=^Product`           | Regular expression    |
| Text Search           | `$text`   | `search=smartphone`              | Full-text search      |

### Query Examples

#### Basic Filtering

```http
GET /v1/products/search?category=electronics&price[gte]=100&price[lte]=500
```

#### Sorting and Pagination

```http
GET /v1/products/search?sort=-price,rating&page=2&limit=20
```

#### Full-Text Search

```http
GET /v1/products/search?search=smartphone camera&category=electronics
```

#### Geospatial Search

```http
GET /v1/stores/search?near=40.7128,-74.0060&within=5000
```

#### Date Range Filtering

```http
GET /v1/orders/search?dateFrom=2024-01-01&dateTo=2024-12-31&dateField=createdAt
```

#### Complex Filtering

```http
GET /v1/products/search?category[in]=electronics,computers&price[gte]=100&rating[gte]=4&inStock=true
```

#### Array and Existence Checks

```http
GET /v1/products/search?tags[in]=featured,bestseller&image[exists]=true&discount[ne]=0
```

---

## Response Format

### Standard Response Structure

```json
{
  "data": [
    {
      "id": "product123",
      "name": "Smartphone",
      "category": "electronics",
      "price": 299.99,
      "rating": 4.5,
      "inStock": true
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 156,
    "pages": 8,
    "hasNext": true,
    "hasPrev": false
  },
  "filters": {
    "applied": {
      "category": "electronics",
      "price": { "$gte": 100, "$lte": 500 }
    },
    "available": ["category", "price", "brand", "rating"]
  },
  "sorting": {
    "applied": "-price",
    "available": ["price", "rating", "createdAt", "name"]
  },
  "performance": {
    "executionTime": 45,
    "cacheHit": false,
    "indexesUsed": ["category_1", "price_1"]
  },
  "metadata": {
    "searchId": "search_1695123456789",
    "timestamp": "2024-09-20T10:30:45.123Z",
    "query": "electronics smartphones"
  },
  "message": "Search completed successfully",
  "status": "success"
}
```

### Aggregation Response

```json
{
  "data": [
    {
      "_id": "electronics",
      "count": 45,
      "avgPrice": 324.5,
      "maxPrice": 999.99,
      "minPrice": 49.99
    }
  ],
  "aggregation": {
    "pipeline": [
      { "$match": { "category": "electronics" } },
      { "$group": { "_id": "$category", "count": { "$sum": 1 } } }
    ],
    "stages": 2
  },
  "performance": {
    "executionTime": 23,
    "documentsExamined": 1250,
    "documentsReturned": 3
  }
}
```

### Error Response

```json
{
  "errors": {
    "code": "INVALID_QUERY",
    "message": "Invalid filter field 'invalidField'",
    "details": {
      "field": "invalidField",
      "allowedFields": ["category", "price", "brand"],
      "suggestion": "Use one of the allowed fields"
    },
    "timestamp": "2024-09-20T10:30:45.123Z",
    "requestId": "req_1695123456789"
  },
  "status": "error"
}
```

---

## Security Features

### Field Restrictions

```typescript
// Whitelist approach - only allow specific fields
const options: IAdvancedSearchOptions = {
  allowedFields: ['name', 'category', 'price', 'rating'],
  excludedFields: ['internalNotes', 'cost', 'supplierInfo']
};

// Blacklist approach - exclude sensitive fields
const options: IAdvancedSearchOptions = {
  excludedFields: ['password', 'ssn', 'creditCard', 'privateNotes']
};
```

### Query Sanitization

```typescript
// Automatic sanitization prevents injection attacks
const sanitizedQuery = this.searchHelper.sanitizeQuery(userQuery, {
  maxDepth: 5, // Prevent deeply nested objects
  maxKeys: 50, // Limit number of query keys
  allowedOperators: ['$eq', '$gt', '$gte', '$lt', '$lte', '$in', '$nin'],
  blacklistedOperators: ['$where', '$eval', '$regex']
});
```

### Rate Limiting Integration

```typescript
// Built-in protection via your Express rate limiting
// Automatically applied to all search endpoints
app.use(
  rateLimit({
    windowMs: env.app.rateWindowMs,
    max: env.app.rateMax,
    message: 'Too many search requests'
  })
);
```

### Data Access Control

```typescript
// Role-based field filtering
public async secureSearch(
  query: IAdvancedSearchQuery,
  userRole: string,
  headers: IRequestHeaders
): Promise<any> {
  const options: IAdvancedSearchOptions = {
    allowedFields: this.getFieldsForRole(userRole),
    maxLimit: this.getLimitForRole(userRole)
  };

  return this.advancedSearch.search(Model, query, headers, undefined, options);
}

private getFieldsForRole(role: string): string[] {
  const roleFields = {
    admin: ['*'], // All fields
    manager: ['name', 'category', 'price', 'status', 'createdAt'],
    user: ['name', 'category', 'price', 'rating'],
    guest: ['name', 'category'] // Minimal fields
  };

  return roleFields[role] || roleFields.guest;
}
```

---

## Caching

### Redis Cache Configuration

```typescript
// Basic cache configuration
const cacheOptions = {
  client: redisClient,
  ttl: 300, // 5 minutes
  keyPrefix: 'search'
};

// Advanced cache configuration
const advancedCacheOptions = {
  client: redisClient,
  ttl: 600,
  keyPrefix: 'advanced-search',
  compression: true,
  serialization: 'json',
  tags: ['products', 'search'], // For cache invalidation
  conditions: {
    minResultCount: 10, // Only cache if results >= 10
    maxQueryComplexity: 5 // Don't cache very complex queries
  }
};
```

### Cache Key Generation

```typescript
// Automatic cache key generation based on:
// - Model name
// - Query parameters
// - User permissions
// - Sort/pagination settings

const cacheKey = generateCacheKey({
  model: 'Product',
  query: sanitizedQuery,
  userRole: 'user',
  options: searchOptions
});
// Result: "search:Product:user:category=electronics:price_gte=100:sort=-price:page=1"
```

### Cache Invalidation

```typescript
// Manual cache invalidation
await this.searchService.invalidateCache({
  model: 'Product',
  tags: ['products'],
  pattern: 'search:Product:*'
});

// Automatic invalidation on data changes
@Post('/products')
public async createProduct(@Body() productData: any): Promise<any> {
  const product = await this.productService.create(productData);

  // Invalidate related search caches
  await this.searchService.invalidateCache({
    model: 'Product',
    tags: ['products', 'categories']
  });

  return product;
}
```

---

## Performance Optimization

### Database Indexing

```typescript
// Recommended indexes for optimal search performance
const recommendedIndexes = [
  // Single field indexes
  { category: 1 },
  { price: 1 },
  { rating: -1 },
  { createdAt: -1 },

  // Compound indexes for common queries
  { category: 1, price: 1 },
  { category: 1, rating: -1 },
  { inStock: 1, category: 1, price: 1 },

  // Text index for full-text search
  {
    name: 'text',
    description: 'text',
    category: 'text'
  },

  // Geospatial index for location-based searches
  { location: '2dsphere' }
];
```

### Query Optimization

```typescript
// Automatic query optimization
const optimizedQuery = this.searchHelper.optimizeQuery(userQuery, {
  // Use indexes efficiently
  preferIndexes: true,

  // Limit field selection
  selectOnlyNeeded: true,

  // Optimize sort operations
  optimizeSort: true,

  // Use aggregation for complex operations
  useAggregationWhenBeneficial: true,

  // Early filtering
  applyFiltersFirst: true
});
```

### Performance Monitoring

```typescript
// Built-in performance tracking
const result = await this.advancedSearch.search(Model, query, headers, undefined, {
  performanceTracking: true,
  slowQueryThreshold: 1000, // Log queries taking > 1 second
  explainQueries: env.isDevelopment
});

// Performance data in response
result.performance = {
  executionTime: 45, // ms
  documentsExamined: 1250, // MongoDB stats
  documentsReturned: 20, // Result count
  indexesUsed: ['category_1'], // Indexes utilized
  cacheHit: false, // Cache status
  optimizationSuggestions: [
    // Performance tips
    'Consider adding compound index on {category: 1, price: 1}',
    'Query could benefit from field selection to reduce data transfer'
  ]
};
```

---

## Examples

### E-commerce Product Search

```typescript
@JsonController('/v1/products')
export class ProductSearchController {
  constructor(
    private advancedSearch: AdvancedSearchService,
    private productService: ProductService
  ) {}

  // Basic product search
  @Get('/search')
  @AdvancedSearchEndpoint({
    model: () => Product,
    allowedFilters: ['category', 'price', 'brand', 'rating', 'inStock'],
    maxLimit: 100,
    defaultOptions: {
      allowedFields: ['name', 'description', 'price', 'category', 'brand', 'rating', 'images'],
      cache: { client: redisClient, ttl: 300, keyPrefix: 'product-search' },
      enableFullTextSearch: true
    }
  })
  public async searchProducts(
    @QueryParams() query: IAdvancedSearchQuery,
    @Res() res: Response,
    @HeaderParam('Unique-Reference-Code') urc: string
  ): Promise<void> {
    // Automatic search with caching and full-text support
  }

  // Advanced product search with business logic
  @Get('/advanced-search')
  public async advancedProductSearch(
    @QueryParams() query: IAdvancedSearchQuery,
    @Res() res: Response,
    @HeaderParam('Unique-Reference-Code') urc: string
  ): Promise<void> {
    const headers: IRequestHeaders = { urc };

    try {
      // Build business-specific query
      const businessQuery = {
        ...query,
        filters: {
          ...query.filters,
          // Business rules
          isPublished: true,
          deletedAt: { $exists: false },
          // User-specific filters
          ...(query.filters || {})
        }
      };

      // Execute search with custom options
      const result = await this.advancedSearch.search(
        Product,
        businessQuery,
        headers,
        [
          { path: 'category', select: 'name slug' },
          { path: 'brand', select: 'name logo' }
        ],
        {
          allowedFields: ['name', 'description', 'price', 'category', 'brand', 'rating'],
          cache: { client: redisClient, ttl: 600, keyPrefix: 'advanced-product-search' },
          enableFullTextSearch: true,
          enableGeospatial: false,
          performanceTracking: true
        }
      );

      // Add business logic to results
      if (result.data) {
        result.data = await Promise.all(
          result.data.map(async (product: any) => ({
            ...product,
            // Add computed fields
            formattedPrice: this.formatCurrency(product.price),
            discountPercentage: this.calculateDiscount(product),
            availability: await this.checkAvailability(product),
            // Add recommendations
            similarProducts: await this.getSimilarProducts(product.id, 3),
            // Add user-specific data
            isWishlisted: await this.isInUserWishlist(product.id, headers),
            estimatedDelivery: this.calculateDeliveryDate(product)
          }))
        );
      }

      // Add search analytics
      result.analytics = {
        totalCategories: this.getUniqueValues(result.data, 'category').length,
        priceRange: this.calculatePriceRange(result.data),
        brandDistribution: this.getBrandDistribution(result.data),
        averageRating: this.calculateAverageRating(result.data)
      };

      return StandardResponse.success(res, result, 'Advanced search completed', 200, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  // Location-based store search
  @Get('/nearby-stores')
  @AdvancedSearchEndpoint({
    model: () => Store,
    allowedFilters: ['type', 'rating', 'services'],
    maxLimit: 25,
    defaultOptions: {
      enableGeospatial: true,
      allowedFields: ['name', 'address', 'location', 'rating', 'hours', 'services']
    }
  })
  public async nearbyStores(
    result: any,
    @Res() res: Response,
    @HeaderParam('Unique-Reference-Code') urc: string
  ): Promise<void> {
    const headers: IRequestHeaders = { urc };

    // Add distance and availability info
    if (result.data) {
      result.data = result.data.map((store: any) => ({
        ...store,
        distanceInMiles: this.calculateDistance(store.location),
        estimatedTravelTime: this.estimateTravelTime(store.location),
        isCurrentlyOpen: this.checkStoreHours(store.hours),
        availableServices: this.getAvailableServices(store.services)
      }));
    }

    return StandardResponse.success(res, result, 'Nearby stores found', 200, headers);
  }

  // Analytics and aggregation search
  @Get('/analytics')
  public async productAnalytics(
    @QueryParams() query: IAdvancedSearchQuery,
    @Res() res: Response,
    @HeaderParam('Unique-Reference-Code') urc: string
  ): Promise<void> {
    const headers: IRequestHeaders = { urc };

    try {
      // Aggregation pipeline for analytics
      const pipeline = [
        // Match stage
        { $match: this.buildMatchStage(query) },

        // Group by category
        {
          $group: {
            _id: '$category',
            totalProducts: { $sum: 1 },
            averagePrice: { $avg: '$price' },
            maxPrice: { $max: '$price' },
            minPrice: { $min: '$price' },
            totalRevenue: { $sum: { $multiply: ['$price', '$soldCount'] } },
            averageRating: { $avg: '$rating' }
          }
        },

        // Sort by total products
        { $sort: { totalProducts: -1 } },

        // Add additional calculations
        {
          $addFields: {
            revenuePercentage: {
              $multiply: [{ $divide: ['$totalRevenue', { $sum: '$totalRevenue' }] }, 100]
            }
          }
        }
      ];

      const result = await this.advancedSearch.aggregateSearch(Product, pipeline, headers, {
        cache: { client: redisClient, ttl: 1800, keyPrefix: 'product-analytics' }
      });

      return StandardResponse.success(res, result, 'Analytics completed', 200, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  // Helper methods
  private formatCurrency(price: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price);
  }

  private calculateDiscount(product: any): number {
    if (product.originalPrice && product.price) {
      return Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);
    }
    return 0;
  }

  private async checkAvailability(product: any): Promise<string> {
    // Check inventory, shipping, etc.
    if (product.inStock && product.quantity > 0) {
      return 'in-stock';
    } else if (product.quantity === 0) {
      return 'out-of-stock';
    } else {
      return 'discontinued';
    }
  }

  private async getSimilarProducts(productId: string, limit: number): Promise<any[]> {
    // Use recommendation engine or simple category-based similarity
    return this.productService.findSimilar(productId, limit);
  }

  private calculatePriceRange(products: any[]): { min: number; max: number } {
    if (!products.length) return { min: 0, max: 0 };

    const prices = products.map(p => p.price).filter(p => p != null);
    return {
      min: Math.min(...prices),
      max: Math.max(...prices)
    };
  }
}
```

### User Management Search

```typescript
@JsonController('/v1/admin/users')
export class UserSearchController {
  constructor(private advancedSearch: AdvancedSearchService) {}

  // Secure user search for admin panel
  @Get('/search')
  @AdvancedSearchEndpoint({
    model: () => User,
    allowedFilters: ['role', 'department', 'isActive', 'lastLoginDate'],
    maxLimit: 50,
    defaultOptions: {
      allowedFields: [
        'id',
        'firstName',
        'lastName',
        'email',
        'role',
        'department',
        'isActive',
        'lastLoginDate',
        'createdAt'
      ],
      excludedFields: ['password', 'ssn', 'creditCard', 'privateNotes'],
      defaultSort: 'lastName'
    }
  })
  public async searchUsers(
    @QueryParams() query: IAdvancedSearchQuery,
    @Res() res: Response,
    @HeaderParam('Unique-Reference-Code') urc: string
  ): Promise<void> {
    // Automatic secure user search
  }

  // Advanced user analytics
  @Get('/analytics')
  public async userAnalytics(
    @QueryParams() query: IAdvancedSearchQuery,
    @Res() res: Response,
    @HeaderParam('Unique-Reference-Code') urc: string
  ): Promise<void> {
    const headers: IRequestHeaders = { urc };

    const pipeline = [
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$department',
          userCount: { $sum: 1 },
          roles: { $addToSet: '$role' },
          avgLastLogin: { $avg: { $dateToNumber: '$lastLoginDate' } }
        }
      },
      { $sort: { userCount: -1 } }
    ];

    const result = await this.advancedSearch.aggregateSearch(User, pipeline, headers);
    return StandardResponse.success(res, result, 'User analytics completed', 200, headers);
  }
}
```

---

## Best Practices

### 1. Security First

```typescript
// Always define allowed filters
@AdvancedSearchEndpoint({
  model: () => Model,
  allowedFilters: ['safeField1', 'safeField2'], // Whitelist approach
  defaultOptions: {
    excludedFields: ['password', 'sensitive'] // Blacklist sensitive data
  }
})

// Role-based access control
const getAllowedFields = (userRole: string): string[] => {
  const rolePermissions = {
    admin: ['*'],
    manager: ['name', 'email', 'department', 'role'],
    user: ['name', 'email']
  };
  return rolePermissions[userRole] || [];
};
```

### 2. Performance Optimization

```typescript
// Use appropriate caching
const cacheOptions = {
  client: redisClient,
  ttl: isFrequentlyChangingData ? 60 : 300, // Shorter TTL for dynamic data
  keyPrefix: 'search',
  conditions: {
    minResultCount: 5, // Only cache meaningful results
    maxQueryComplexity: 10 // Don't cache overly complex queries
  }
};

// Limit result sizes
const options = {
  maxLimit: userRole === 'admin' ? 1000 : 100, // Role-based limits
  defaultLimit: 20
};

// Use field selection
const query = {
  select: 'name,price,category', // Only fetch needed fields
  ...userQuery
};
```

### 3. Error Handling

```typescript
public async robustSearch(
  query: IAdvancedSearchQuery,
  headers: IRequestHeaders
): Promise<any> {
  try {
    // Validate input
    await this.validateQuery(query);

    // Execute search
    const result = await this.advancedSearch.search(Model, query, headers);

    return result;
  } catch (error) {
    if (error instanceof CSError) {
      // Known application errors
      throw error;
    } else if (error.name === 'ValidationError') {
      // MongoDB validation errors
      throw new CSError(HTTP_STATUS_CODES.BAD_REQUEST, CODES.InvalidQuery, error.message);
    } else if (error.name === 'MongoTimeoutError') {
      // Database timeout
      throw new CSError(HTTP_STATUS_CODES.REQUEST_TIMEOUT, CODES.DatabaseTimeout);
    } else {
      // Unexpected errors
      this.log.error(`Unexpected search error: ${error.message}`);
      throw new CSError(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR, CODES.SearchFailed);
    }
  }
}
```

### 4. Logging and Monitoring

```typescript
public async monitoredSearch(
  query: IAdvancedSearchQuery,
  headers: IRequestHeaders
): Promise<any> {
  const logMessage = constructLogMessage(__filename, 'monitoredSearch', headers);
  const startTime = Date.now();

  this.log.info(`${logMessage} :: Starting search with query: ${JSON.stringify(query)}`);

  try {
    const result = await this.advancedSearch.search(Model, query, headers, undefined, {
      performanceTracking: true
    });

    const duration = Date.now() - startTime;
    this.log.info(`${logMessage} :: Search completed in ${duration}ms, ${result.pagination.total} results`);

    // Log slow queries
    if (duration > 1000) {
      this.log.warn(`${logMessage} :: Slow query detected: ${duration}ms`);
    }

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    this.log.error(`${logMessage} :: Search failed after ${duration}ms: ${error.message}`);
    throw error;
  }
}
```

### 5. Testing

```typescript
describe('AdvancedSearchService', () => {
  let searchService: AdvancedSearchService;
  let mockModel: any;

  beforeEach(() => {
    searchService = Container.get(AdvancedSearchService);
    mockModel = {
      find: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      exec: jest.fn(),
      countDocuments: jest.fn()
    };
  });

  it('should perform basic search', async () => {
    const mockData = [{ id: '1', name: 'Test Product' }];
    mockModel.exec.mockResolvedValue(mockData);
    mockModel.countDocuments.mockResolvedValue(1);

    const result = await searchService.search(mockModel, { filters: { category: 'test' } }, { urc: 'test' });

    expect(result.data).toEqual(mockData);
    expect(result.pagination.total).toBe(1);
  });

  it('should handle security restrictions', async () => {
    await expect(
      searchService.search(mockModel, { filters: { unauthorizedField: 'value' } }, { urc: 'test' }, undefined, {
        allowedFields: ['name', 'price']
      })
    ).rejects.toThrow(CSError);
  });

  it('should respect rate limits', async () => {
    const query = { pagination: { limit: 1000000 } }; // Excessive limit

    await expect(
      searchService.search(mockModel, query, { urc: 'test' }, undefined, { maxLimit: 100 })
    ).rejects.toThrow();
  });
});
```

---

## Troubleshooting

### Common Issues and Solutions

#### 1. Performance Issues

**Problem**: Slow search queries

```typescript
// Solution: Add proper indexing
{
  // Single field indexes
  category: 1,
  price: 1,

  // Compound indexes for common query patterns
  { category: 1, price: 1 },
  { category: 1, rating: -1 }
}

// Solution: Use field selection
const query = {
  select: 'name,price,category', // Only needed fields
  ...userQuery
};

// Solution: Implement pagination
const options = {
  maxLimit: 50, // Reasonable page sizes
  defaultLimit: 20
};
```

**Problem**: Memory issues with large result sets

```typescript
// Solution: Use streaming for large datasets
public async streamSearch(query: IAdvancedSearchQuery): Promise<ReadableStream> {
  return this.advancedSearch.searchStream(Model, query, {
    batchSize: 100,
    maxMemoryUsage: '100MB'
  });
}
```

#### 2. Security Issues

**Problem**: Unauthorized field access

```typescript
// Solution: Always define field restrictions
const options: IAdvancedSearchOptions = {
  allowedFields: ['public', 'fields', 'only'],
  excludedFields: ['password', 'sensitive', 'internal']
};
```

**Problem**: Query injection attacks

```typescript
// Solution: Use query sanitization
const sanitizedQuery = this.searchHelper.sanitizeQuery(userQuery, {
  allowedOperators: ['$eq', '$gt', '$gte', '$lt', '$lte', '$in'],
  blacklistedOperators: ['$where', '$eval', '$regex'],
  maxDepth: 5
});
```

#### 3. Cache Issues

**Problem**: Stale cache data

```typescript
// Solution: Implement cache invalidation
@Post('/products')
public async createProduct(@Body() data: any): Promise<any> {
  const product = await this.productService.create(data);

  // Invalidate related caches
  await this.searchService.invalidateCache({
    model: 'Product',
    tags: ['products', 'categories']
  });

  return product;
}
```

**Problem**: Cache key collisions

```typescript
// Solution: Use detailed cache keys
const cacheKey = `search:${modelName}:${userRole}:${JSON.stringify(sanitizedQuery)}`;
```

#### 4. Validation Errors

**Problem**: Invalid query parameters

```typescript
// Solution: Implement comprehensive validation
await this.searchHelper.validateSearchQuery(query, {
  allowedFields: ['name', 'category', 'price'],
  requiredFields: [],
  maxLimit: 100,
  fieldTypes: {
    price: 'number',
    category: 'string',
    createdAt: 'date'
  }
});
```

### Debug Mode

```typescript
// Enable debug mode for detailed logging
const result = await this.advancedSearch.search(Model, query, headers, undefined, {
  debug: true,
  explainQueries: true,
  performanceTracking: true
});

// Debug output includes:
// - Query execution plan
// - Index usage
// - Performance metrics
// - Cache hit/miss
// - Optimization suggestions
```

### Error Codes Reference

| Code                       | Description             | Solution                            |
| -------------------------- | ----------------------- | ----------------------------------- |
| `INVALID_QUERY`            | Query validation failed | Check allowed fields and operators  |
| `INVALID_FIELD`            | Field not permitted     | Use only allowed fields             |
| `INVALID_GEOSPATIAL_QUERY` | Geospatial query error  | Check coordinate format and indexes |
| `CACHE_ERROR`              | Cache operation failed  | Check Redis connection              |
| `SEARCH_FAILED`            | General search error    | Check database connection and query |
| `RATE_LIMIT_EXCEEDED`      | Too many requests       | Implement backoff strategy          |

---

## Conclusion

The Advanced Search System provides enterprise-grade search capabilities with security, performance, and flexibility built-in. Choose the appropriate approach based on your needs:

- **Use the Service directly** for complex business logic and full control
- **Use the Decorator** for simple, consistent search endpoints with minimal code
- **Combine both approaches** for different scenarios within the same application

The system integrates seamlessly with your Express microservice architecture, maintaining consistency with your established patterns while providing powerful search capabilities.

For additional support or feature requests, refer to the service implementation files and test cases for detailed examples and usage patterns.
