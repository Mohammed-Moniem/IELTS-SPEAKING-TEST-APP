# StandardResponse Documentation

The `StandardResponse` class provides a consistent, standardized way to handle API responses throughout the application. It integrates seamlessly with the existing error handling system using `CSError` and follows the established logging patterns.

## Features

- ✅ **Consistent Response Format**: All responses follow the same structure
- ✅ **Integration with CSError**: Seamless error handling with existing system
- ✅ **Request Tracing**: Includes request ID (URC) for traceability
- ✅ **Comprehensive Logging**: Automatic logging with context
- ✅ **TypeScript Support**: Full type safety with interfaces
- ✅ **Multiple Response Types**: Success, error, validation, etc.

## Response Structures

### Success Response

```typescript
{
  status: number;           // HTTP status code
  success: true;            // Always true for success
  message?: string;         // Optional success message
  data?: T;                 // Optional response data
  timestamp: string;        // ISO timestamp
  requestId?: string;       // Request tracking ID (URC)
}
```

### Error Response

```typescript
{
  status: number;           // HTTP error status code
  success: false;           // Always false for errors
  error: {
    code: string;           // Error code from CODES enum
    message: string;        // Human-readable error message
    description?: string;   // Optional detailed description
    details?: any;          // Optional additional error details
  };
  timestamp: string;        // ISO timestamp
  requestId?: string;       // Request tracking ID (URC)
}
```

## Usage Examples

### In Services

```typescript
import { Service } from 'typedi';
import { CSError } from '@errors/CSError';
import { CODES, HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';

@Service()
export class UserService {
  public async getUser(id: string, headers: IRequestHeaders): Promise<any> {
    if (!id) {
      throw new CSError(HTTP_STATUS_CODES.BAD_REQUEST, CODES.MissingUserId, 'User ID is required');
    }

    // Your business logic here
    const user = await this.userRepository.findById(id);

    if (!user) {
      throw new CSError(HTTP_STATUS_CODES.NOT_FOUND, CODES.NotFound, 'User not found');
    }

    return user;
  }
}
```

### In Controllers

```typescript
import { Get, JsonController, Param, Req, Res } from 'routing-controllers';
import { Request, Response } from 'express';
import { StandardResponse } from '@responses/StandardResponse';
import { UserService } from '@services/UserService';

@JsonController('/v1/users')
export class UserController {
  constructor(private userService: UserService) {}

  @Get('/:id')
  public async getUser(@Param('id') id: string, @Req() req: Request, @Res() res: Response): Promise<void> {
    const headers = { urc: req.headers['unique-reference-code'] as string };

    try {
      const user = await this.userService.getUser(id, headers);

      StandardResponse.success(res, user, 'User retrieved successfully', 200, headers);
    } catch (error) {
      StandardResponse.error(res, error as Error, headers);
    }
  }
}
```

## Available Methods

### success(res, data?, message?, status?, headers?)

Send a successful response with optional data and message.

```typescript
// With data and message
StandardResponse.success(res, userData, 'User retrieved successfully');

// Data only
StandardResponse.success(res, userData);

// Message only
StandardResponse.success(res, undefined, 'Operation completed');

// Custom status code
StandardResponse.success(res, userData, 'User updated', 200, headers);
```

### created(res, data?, message?, headers?)

Send a 201 Created response for resource creation.

```typescript
StandardResponse.created(res, newUser, 'User created successfully', headers);
```

### error(res, error, headers?)

Send an error response. Automatically converts different error types to the standard format.

```typescript
// With CSError (recommended)
const csError = new CSError(400, CODES.InvalidBody, 'Invalid input');
StandardResponse.error(res, csError, headers);

// With standard Error
StandardResponse.error(res, new Error('Something went wrong'), headers);

// With string
StandardResponse.error(res, 'Error message', headers);
```

### validationError(res, errors, message?, headers?)

Send a validation error response with detailed error information.

```typescript
const validationErrors = [
  { field: 'email', message: 'Invalid email format' },
  { field: 'name', message: 'Name is required' }
];

StandardResponse.validationError(res, validationErrors, 'Validation failed', headers);
```

### notFound(res, resource?, headers?)

Send a 404 Not Found response.

```typescript
StandardResponse.notFound(res, 'User', headers);
// Response: "User not found"

StandardResponse.notFound(res, undefined, headers);
// Response: "Resource not found"
```

### unauthorized(res, message?, headers?)

Send a 401 Unauthorized response.

```typescript
StandardResponse.unauthorized(res, 'Authentication required', headers);
```

### forbidden(res, message?, headers?)

Send a 403 Forbidden response.

```typescript
StandardResponse.forbidden(res, 'Access denied', headers);
```

### internalError(res, error?, headers?)

Send a 500 Internal Server Error response.

```typescript
StandardResponse.internalError(res, new Error('Database connection failed'), headers);
```

## Response Examples

### Success Example

```json
{
  "status": 200,
  "success": true,
  "message": "User retrieved successfully",
  "data": {
    "id": "123",
    "name": "John Doe",
    "email": "john@example.com"
  },
  "timestamp": "2024-01-15T10:30:00.000Z",
  "requestId": "urc-123-456-789"
}
```

### Error Example

```json
{
  "status": 404,
  "success": false,
  "error": {
    "code": "NotFound",
    "message": "User not found",
    "description": "The requested user does not exist in the system"
  },
  "timestamp": "2024-01-15T10:30:00.000Z",
  "requestId": "urc-123-456-789"
}
```

### Validation Error Example

```json
{
  "status": 400,
  "success": false,
  "error": {
    "code": "InvalidBody",
    "message": "Validation failed",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      },
      {
        "field": "name",
        "message": "Name is required"
      }
    ]
  },
  "timestamp": "2024-01-15T10:30:00.000Z",
  "requestId": "urc-123-456-789"
}
```

## Best Practices

### Always Use in Controllers

Use `StandardResponse` in all controller methods to ensure consistency:

```typescript
@Get('/users')
public async getUsers(@Req() req: Request, @Res() res: Response): Promise<void> {
  const headers = { urc: req.headers['unique-reference-code'] as string };

  try {
    const users = await this.userService.getUsers(headers);
    StandardResponse.success(res, users, 'Users retrieved successfully', 200, headers);
  } catch (error) {
    StandardResponse.error(res, error as Error, headers);
  }
}
```

### Use CSError in Services

Create and throw `CSError` instances in services for consistent error handling:

```typescript
if (!userId) {
  throw new CSError(HTTP_STATUS_CODES.BAD_REQUEST, CODES.MissingUserId, 'User ID is required');
}
```

### Include Request Headers

Always pass request headers for proper logging and tracing:

```typescript
const headers: IRequestHeaders = {
  urc: req.headers['unique-reference-code'] as string
};
StandardResponse.success(res, data, message, 200, headers);
```

### Use Appropriate Response Methods

Choose the most specific method for your use case:

```typescript
// For creation
StandardResponse.created(res, newResource, 'Resource created', headers);

// For validation errors
StandardResponse.validationError(res, errors, 'Validation failed', headers);

// For not found
StandardResponse.notFound(res, 'Resource', headers);
```

### Consistent Error Handling Pattern

Follow this pattern in all controller methods:

```typescript
try {
  const result = await this.service.method(params, headers);
  StandardResponse.success(res, result, 'Success message', 200, headers);
} catch (error) {
  StandardResponse.error(res, error as Error, headers);
}
```

## Integration with Existing Systems

### Error Handling

`StandardResponse` works seamlessly with the existing `CSError` and `ErrorResponse` classes:

- Automatically converts `CSError` instances to standard format
- Preserves error codes, messages, and descriptions
- Maintains compatibility with existing error middleware

### Logging

All response methods include automatic logging:

- Success responses log with `info` level
- Error responses log with `error` level
- Validation errors log with `warn` level
- Includes request context and URC for traceability

### TypeScript Support

Full TypeScript support with interfaces:

```typescript
import { IStandardResponse, IStandardErrorResponse } from '@responses/StandardResponse';

// Use in type definitions
function processResponse(response: IStandardResponse<UserData>): void {
  // Type-safe access to response properties
}
```

## Migration from Old Response System

### Before (Old System)

```typescript
res.status(200).json({
  success: true,
  data: user,
  message: 'User retrieved'
});

// Error handling
res.status(400).json({
  success: false,
  error: 'Invalid input'
});
```

### After (StandardResponse)

```typescript
StandardResponse.success(res, user, 'User retrieved successfully', 200, headers);

// Error handling
StandardResponse.error(res, new CSError(400, CODES.InvalidBody, 'Invalid input'), headers);
```

## Testing

The `StandardResponse` class is fully tested with comprehensive unit tests. Run tests with:

```bash
npm test -- StandardResponse.test.ts
```

## File Locations

- **Implementation**: `src/api/responses/StandardResponse.ts`
- **Interfaces**: Included in the main file
- **Tests**: `test/unit/src/api/responses/StandardResponse.test.ts`
- **Examples**: `src/api/controllers/ExampleController.ts`
- **Path Alias**: `@responses/StandardResponse`
