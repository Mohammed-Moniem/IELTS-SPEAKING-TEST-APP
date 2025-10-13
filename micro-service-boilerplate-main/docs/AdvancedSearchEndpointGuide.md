# AdvancedSearchEndpoint Decorator - Usage Guide

## Overview

The `@AdvancedSearchEndpoint` decorator provides a simplified way to create search endpoints while maintaining your service architecture. It's a lightweight wrapper around `AdvancedSearchService` that reduces boilerplate code for common search scenarios.

## Basic Syntax

```typescript
@Get('/search')
@AdvancedSearchEndpoint({
  model: () => YourModel,
  allowedFilters: ['field1', 'field2'],
  maxLimit: 100,
  defaultOptions: {
    // AdvancedSearchService options
  }
})
public async searchMethod(
  @QueryParams() query: IAdvancedSearchQuery,
  @Res() res: Response,
  @HeaderParam('Unique-Reference-Code') urc: string
): Promise<void> {
  // Optional: custom post-processing
}
```

## Configuration Options

### Required Options

- `model: () => Model<any>` - Function returning your Mongoose model

### Optional Options

- `allowedFilters: string[]` - Whitelist of allowed filter fields
- `maxLimit: number` - Maximum results per page
- `defaultOptions: IAdvancedSearchOptions` - Options passed to AdvancedSearchService

## Usage Patterns

### 1. Automatic Search (Zero Code)

```typescript
@Get('/products/search')
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

**What the decorator does automatically:**

1. Gets `AdvancedSearchService` from DI container
2. Applies query restrictions (filters, limits)
3. Executes search with your model
4. Returns `StandardResponse.success` with results
5. Handles errors with `StandardResponse.error`

### 2. Search with Post-Processing

```typescript
@Get('/products/enhanced')
@AdvancedSearchEndpoint({
  model: () => Product,
  allowedFilters: ['category', 'price'],
  defaultOptions: {
    enableGeospatial: true,
    cache: { client: redisClient, ttl: 300 }
  }
})
public async enhancedSearch(
  result: any, // Search result from decorator
  @Res() res: Response,
  @HeaderParam('Unique-Reference-Code') urc: string
): Promise<void> {
  const headers: IRequestHeaders = { urc };

  // Modify results after search
  if (result.data) {
    result.data = result.data.map(item => ({
      ...item,
      customField: this.addCustomLogic(item)
    }));
  }

  return StandardResponse.success(res, result, 'Enhanced search completed', 200, headers);
}
```

## API Request Examples

### Basic Search

```
GET /v1/products/search?category=electronics&price[gte]=100&sort=-rating&page=1&limit=20
```

### Advanced Search with Operators

```
GET /v1/products/search?price[gte]=100&price[lte]=500&rating[gte]=4&inStock=true
```

### Geospatial Search

```
GET /v1/stores/search?near=40.7128,-74.0060&within=5000
```

### Full-Text Search

```
GET /v1/products/search?search=smartphone camera&category=electronics
```

## Response Format

All responses follow the `StandardResponse` format:

```json
{
  "data": [
    // Search results array
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 156,
    "pages": 8
  },
  "message": "Search completed successfully",
  "status": "success"
}
```

## Security Features

The decorator automatically enforces security restrictions:

1. **Filter Whitelist**: Only `allowedFilters` are processed
2. **Field Restrictions**: Respects `allowedFields` and `excludedFields`
3. **Limit Enforcement**: Prevents excessive data retrieval
4. **Input Sanitization**: Inherits from `AdvancedSearchService` sanitization

## When to Use vs. Direct Service

### Use Decorator When:

- ✅ Standard CRUD search operations
- ✅ Simple filter/sort/paginate scenarios
- ✅ You want minimal boilerplate
- ✅ Security restrictions are straightforward

### Use Service Directly When:

- ❌ Complex business logic before search
- ❌ Multiple model searches in one endpoint
- ❌ Complex aggregations or joins
- ❌ Custom error handling requirements

## Integration with Your Architecture

The decorator maintains full compatibility with your microservice patterns:

- **Dependency Injection**: Uses `Container.get(AdvancedSearchService)`
- **Logging**: Inherits logging from service layer
- **Error Handling**: Uses `StandardResponse.error`
- **Headers**: Supports `IRequestHeaders` pattern
- **Testing**: Can be mocked via DI container

## Best Practices

1. **Always specify `allowedFilters`** for security
2. **Set reasonable `maxLimit`** to prevent performance issues
3. **Use post-processing pattern** for custom business logic
4. **Cache frequently accessed searches** with `defaultOptions.cache`
5. **Keep method bodies simple** - complex logic should use service directly

## Migration from Manual Service Usage

```typescript
// Before (manual service)
@Get('/search')
public async search(@QueryParams() query: any, @Res() res: Response) {
  const searchService = Container.get(AdvancedSearchService);
  const result = await searchService.search(Model, query, headers);
  return StandardResponse.success(res, result);
}

// After (with decorator)
@Get('/search')
@AdvancedSearchEndpoint({
  model: () => Model,
  allowedFilters: ['field1', 'field2']
})
public async search(@QueryParams() query: any, @Res() res: Response) {
  // Code removed - decorator handles it!
}
```

The decorator is a **convenience wrapper** that maintains all the benefits of your service architecture while reducing repetitive code for common search scenarios.
