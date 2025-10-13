# Advanced Search - Quick Reference

## Overview

Two main approaches for implementing search in your microservice:

1. **Service Approach** (recommended) - Full control and flexibility
2. **Decorator Approach** - Simplified for common use cases

---

## Service Approach

### Basic Usage

```typescript
@JsonController('/v1/products')
export class ProductController {
  constructor(private searchService: AdvancedSearchService) {}

  @Get('/search')
  public async search(
    @QueryParams() query: IAdvancedSearchQuery,
    @Res() res: Response,
    @HeaderParam('Unique-Reference-Code') urc: string
  ): Promise<void> {
    const headers: IRequestHeaders = { urc };

    const result = await this.searchService.search(
      Product, // Mongoose model
      query, // Query parameters
      headers, // Headers for logging
      undefined, // Populate options (optional)
      {
        // Search options (optional)
        allowedFields: ['name', 'price', 'category'],
        cache: { client: redisClient, ttl: 300 }
      }
    );

    return StandardResponse.success(res, result, 'Search completed', 200, headers);
  }
}
```

### Advanced Service Usage

```typescript
// Complex search with business logic
const result = await this.searchService.search(
  Product,
  {
    filters: { category: 'electronics', price: { $gte: 100 } },
    sort: '-rating',
    pagination: { page: 1, limit: 20 },
    search: 'smartphone' // Full-text search
  },
  headers,
  [{ path: 'category', select: 'name slug' }], // Population
  {
    allowedFields: ['name', 'price', 'category', 'rating'],
    excludedFields: ['internalNotes'],
    cache: { client: redisClient, ttl: 600, keyPrefix: 'product-search' },
    enableGeospatial: true,
    enableFullTextSearch: true,
    performanceTracking: true
  }
);
```

---

## Decorator Approach

### Basic Decorator

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

### Decorator with Post-Processing

```typescript
@Get('/enhanced-search')
@AdvancedSearchEndpoint({
  model: () => Product,
  allowedFilters: ['category', 'price'],
  defaultOptions: {
    enableFullTextSearch: true,
    cache: { client: redisClient, ttl: 300 }
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
      customField: this.addBusinessLogic(item)
    }));
  }

  return StandardResponse.success(res, result, 'Enhanced search completed', 200, headers);
}
```

---

## Query Parameters

### URL Examples

```bash
# Basic filtering
GET /api/products/search?category=electronics&price[gte]=100

# Sorting and pagination
GET /api/products/search?sort=-price&page=2&limit=20

# Full-text search
GET /api/products/search?search=smartphone camera

# Geospatial search
GET /api/stores/search?near=40.7128,-74.0060&within=5000

# Complex filtering
GET /api/products/search?category[in]=electronics,books&price[gte]=50&rating[gte]=4
```

### Query Object Structure

```typescript
interface IAdvancedSearchQuery {
  // Field selection
  select?: string; // 'name,price,category'

  // Sorting
  sort?: string; // 'price' or '-price'

  // Pagination
  page?: number; // 1, 2, 3...
  limit?: number; // 10, 20, 50...

  // Full-text search
  search?: string; // 'smartphone camera'

  // Geospatial
  near?: string; // '40.7128,-74.0060'
  within?: string; // '5000' (meters)

  // Date filtering
  dateFrom?: string; // '2024-01-01'
  dateTo?: string; // '2024-12-31'
  dateField?: string; // 'createdAt'

  // Dynamic filters
  [key: string]: any; // category=electronics, price[gte]=100
}
```

---

## Operators

| Operator      | URL Example                    | MongoDB   | Description           |
| ------------- | ------------------------------ | --------- | --------------------- |
| Equal         | `price=100`                    | `$eq`     | Exact match           |
| Greater Than  | `price[gt]=100`                | `$gt`     | Greater than          |
| Greater/Equal | `price[gte]=100`               | `$gte`    | Greater than or equal |
| Less Than     | `price[lt]=500`                | `$lt`     | Less than             |
| Less/Equal    | `price[lte]=500`               | `$lte`    | Less than or equal    |
| Not Equal     | `status[ne]=deleted`           | `$ne`     | Not equal             |
| In Array      | `category[in]=a,b,c`           | `$in`     | Value in array        |
| Not In Array  | `status[nin]=deleted,archived` | `$nin`    | Value not in array    |
| Exists        | `image[exists]=true`           | `$exists` | Field exists          |
| Regex         | `name[regex]=^Product`         | `$regex`  | Pattern match         |

---

## Response Format

```json
{
  "data": [
    // Array of search results
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
    "applied": { "category": "electronics" },
    "available": ["category", "price", "brand"]
  },
  "performance": {
    "executionTime": 45,
    "cacheHit": false,
    "indexesUsed": ["category_1"]
  },
  "message": "Search completed successfully",
  "status": "success"
}
```

---

## Configuration Options

### Service Options (IAdvancedSearchOptions)

```typescript
{
  allowedFields?: string[];           // ['name', 'price', 'category']
  excludedFields?: string[];          // ['password', 'internal']
  maxLimit?: number;                  // 100
  defaultSort?: string;               // 'createdAt'
  cache?: {
    client: any;                      // Redis client
    ttl?: number;                     // 300 (seconds)
    keyPrefix?: string;               // 'search'
  };
  enableGeospatial?: boolean;         // true
  enableFullTextSearch?: boolean;     // true
  enableAggregation?: boolean;        // true
  performanceTracking?: boolean;      // true
  debug?: boolean;                    // false
}
```

### Decorator Options

```typescript
{
  model: () => Model<any>;            // Required: () => YourModel
  allowedFilters?: string[];          // ['category', 'price']
  maxLimit?: number;                  // 100
  defaultOptions?: IAdvancedSearchOptions; // Service options
}
```

---

## Security Best Practices

### Field Restrictions

```typescript
// Whitelist approach - recommended
allowedFields: ['name', 'price', 'category', 'rating'];

// Blacklist approach - for sensitive data
excludedFields: ['password', 'ssn', 'internalNotes'];

// Role-based restrictions
const getFieldsForRole = (role: string) => {
  const permissions = {
    admin: ['*'],
    manager: ['name', 'email', 'department'],
    user: ['name', 'email']
  };
  return permissions[role] || permissions.user;
};
```

### Query Sanitization

```typescript
// Automatic sanitization (built-in)
- Removes dangerous operators
- Limits query complexity
- Validates field types
- Prevents injection attacks
```

---

## Performance Tips

### Database Indexing

```javascript
// Recommended indexes
db.products.createIndex({ category: 1 });
db.products.createIndex({ price: 1 });
db.products.createIndex({ category: 1, price: 1 });
db.products.createIndex({ name: 'text', description: 'text' });
db.stores.createIndex({ location: '2dsphere' });
```

### Caching Strategy

```typescript
// Cache configuration
cache: {
  client: redisClient,
  ttl: 300,                          // 5 minutes
  keyPrefix: 'search',
  conditions: {
    minResultCount: 5,               // Only cache meaningful results
    maxQueryComplexity: 10           // Skip caching complex queries
  }
}
```

### Query Optimization

```typescript
// Use field selection
select: 'name,price,category'; // Only fetch needed fields

// Reasonable pagination
limit: 20; // Don't fetch too many at once
maxLimit: 100; // Set upper bounds

// Efficient sorting
sort: 'createdAt'; // Use indexed fields for sorting
```

---

## When to Use Which Approach

### Use Service Directly When:

- ✅ Complex business logic required
- ✅ Multiple model searches
- ✅ Custom aggregations
- ✅ Need full control

### Use Decorator When:

- ✅ Simple CRUD operations
- ✅ Standard filter/sort/paginate
- ✅ Want minimal code
- ✅ Security restrictions are straightforward

---

## Common Patterns

### E-commerce Search

```typescript
// Product search with business logic
const businessQuery = {
  ...query,
  filters: {
    ...query.filters,
    isPublished: true,
    deletedAt: { $exists: false }
  }
};
```

### User Management

```typescript
// Secure user search
@AdvancedSearchEndpoint({
  model: () => User,
  allowedFilters: ['role', 'department', 'isActive'],
  maxLimit: 25,
  defaultOptions: {
    excludedFields: ['password', 'ssn']
  }
})
```

### Analytics Dashboard

```typescript
// Aggregation for analytics
const pipeline = [
  { $match: { category: 'electronics' } },
  { $group: { _id: '$brand', count: { $sum: 1 }, avgPrice: { $avg: '$price' } } },
  { $sort: { count: -1 } }
];

const result = await this.searchService.aggregateSearch(Product, pipeline, headers);
```

---

## Error Handling

### Common Errors

- `INVALID_QUERY` - Check allowed fields and operators
- `INVALID_FIELD` - Use only permitted fields
- `SEARCH_FAILED` - Check database connection
- `RATE_LIMIT_EXCEEDED` - Implement backoff strategy

### Debug Mode

```typescript
// Enable detailed logging
const result = await this.searchService.search(Model, query, headers, undefined, {
  debug: true,
  performanceTracking: true
});
```

---

## Integration Checklist

- [ ] Service registered with `@Service()` decorator
- [ ] Controllers inject service via constructor
- [ ] Headers passed for logging (`IRequestHeaders`)
- [ ] Responses use `StandardResponse` format
- [ ] Error handling with `CSError`
- [ ] Field restrictions defined for security
- [ ] Caching configured with Redis
- [ ] Database indexes created
- [ ] Rate limiting applied
- [ ] Tests written for search functionality

This quick reference covers the essential patterns for implementing advanced search in your Express microservice architecture.
