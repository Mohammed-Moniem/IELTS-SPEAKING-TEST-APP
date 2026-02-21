# Rate Limiter Documentation

## Overview

The Rate Limiter implements a **sliding-window algorithm** to prevent API abuse by limiting the number of requests per endpoint within a time window. This protects both the client (from excessive battery/data usage) and the server (from overload).

## Architecture

### Sliding-Window Algorithm

The rate limiter tracks timestamps of requests in a sliding time window:

1. **Request arrives** → Check if endpoint has hit limit
2. **Clean old entries** → Remove timestamps outside the window
3. **Count remaining** → Compare against max requests
4. **Allow or delay** → If under limit, proceed; otherwise wait

**Example with 3 requests per 10 seconds:**

```
Time:  0s   2s   4s   6s   8s   10s  12s
       |    |    |    |    |    |    |
Req:   A    B    C         D    (A expires)
                                     E ✓ (allowed)
```

- At 8s: Request D is **delayed** (A, B, C still in window)
- At 10s: Request A expires (outside 10s window)
- At 12s: Request E is **allowed** (only B, C, D in window)

### Key Features

✅ **Per-endpoint tracking**: Each API endpoint has separate limits  
✅ **User-facing warnings**: Optional Alert dialogs when limits are hit  
✅ **Delay protection**: Throws error after 3 consecutive delays  
✅ **Warning spam prevention**: Only shows Alert once per 30 seconds  
✅ **Debug helpers**: Methods to check status and remaining requests

## Usage

### Basic Integration (Already Setup)

The rate limiter is integrated in `api/client.ts`:

```typescript
import { rateLimiter } from "../utils/RateLimiter";

// Request interceptor
api.interceptors.request.use(async (config) => {
  const method = config.method?.toUpperCase() || "GET";
  const endpoint = config.url || "";
  const key = `${method}:${endpoint}`;

  // Rate limit check - will delay if needed
  await rateLimiter.schedule(key);

  return config;
});
```

### Two Rate Limiters Available

#### 1. Default Rate Limiter (General API Calls)

```typescript
import { rateLimiter } from "../utils/RateLimiter";

// Configuration:
// - 10 requests per minute per endpoint
// - No user warnings (silent delays)
// - Used automatically for all API calls

await rateLimiter.schedule("GET:/api/leaderboard");
```

#### 2. Strict Rate Limiter (Sensitive Operations)

```typescript
import { strictRateLimiter } from "../utils/RateLimiter";

// Configuration:
// - 5 requests per minute per endpoint
// - Shows user warnings via Alert
// - Recommended for: auth, payments, password changes

await strictRateLimiter.schedule("POST:/api/auth/login");
```

### Helper Methods

#### Check Current Status

```typescript
import { rateLimiter } from "../utils/RateLimiter";

// Get status of all tracked endpoints
const status = rateLimiter.getStatus();
console.log(status);
// Output:
// {
//   "GET:/api/leaderboard": { count: 3, limit: 10, window: "60s" },
//   "POST:/api/practice/complete": { count: 8, limit: 10, window: "60s" }
// }
```

#### Check If Rate Limited

```typescript
const isLimited = rateLimiter.isRateLimited("GET:/api/achievements");
if (isLimited) {
  console.log("Endpoint is currently rate limited");
}
```

#### Get Remaining Requests

```typescript
const remaining = rateLimiter.getRemainingRequests("GET:/api/profile");
console.log(`${remaining} requests remaining`); // "7 requests remaining"
```

#### Reset Rate Limiter

```typescript
// Reset specific endpoint
rateLimiter.reset("GET:/api/leaderboard");

// Reset all endpoints
rateLimiter.reset();
```

## Configuration

### Creating Custom Rate Limiters

```typescript
import { RateLimiter } from "../utils/RateLimiter";

// Ultra-strict rate limiter (e.g., for OTP requests)
const otpLimiter = new RateLimiter({
  maxRequests: 3, // Only 3 requests
  perMilliseconds: 300_000, // Per 5 minutes
  showUserWarning: true, // Show alerts
});

// Lenient rate limiter (e.g., for public content)
const publicLimiter = new RateLimiter({
  maxRequests: 30, // 30 requests
  perMilliseconds: 60_000, // Per minute
  showUserWarning: false, // No alerts
});
```

### Options

| Option            | Type    | Description                  | Default  |
| ----------------- | ------- | ---------------------------- | -------- |
| `maxRequests`     | number  | Maximum requests allowed     | Required |
| `perMilliseconds` | number  | Time window in milliseconds  | Required |
| `showUserWarning` | boolean | Show Alert when rate limited | `false`  |

## User Experience

### When Rate Limit Is Hit

**With `showUserWarning: false` (default):**

- Request is delayed silently
- Logs warning in **DEV** mode
- Throws error after 3 consecutive delays
- User doesn't see any UI feedback

**With `showUserWarning: true` (strict):**

- Request is delayed silently
- Shows Alert dialog (max once per 30s)
- Logs warning in **DEV** mode
- Throws error after 3 consecutive delays

**Alert Example:**

```
Title: "Slow Down"
Message: "Too many requests. Please wait a moment before trying again."
Button: "OK"
```

### Error Handling

After 3 consecutive delays, the rate limiter throws an error:

```typescript
try {
  await rateLimiter.schedule(key);
} catch (error) {
  console.error(error.message); // "Rate limit exceeded. Please try again later."
  // Show user-friendly error UI
}
```

## Best Practices

### ✅ DO

- **Use default `rateLimiter` for most API calls** (already integrated)
- **Use `strictRateLimiter` for sensitive endpoints** (auth, payments)
- **Handle rate limit errors gracefully** with try-catch
- **Check `getRemainingRequests()` before batch operations**
- **Reset limiter after logout** to clear user-specific tracking

### ❌ DON'T

- Don't create many custom rate limiters (2-3 max)
- Don't set `maxRequests` too low (causes poor UX)
- Don't ignore rate limit errors (can cause app crashes)
- Don't use rate limiter for offline-first operations
- Don't rely solely on client-side limiting (add server-side too)

## Testing

### Manual Testing

```typescript
import { rateLimiter } from "../utils/RateLimiter";

// Test rapid requests
const testRateLimit = async () => {
  const promises = Array.from({ length: 15 }, (_, i) =>
    rateLimiter.schedule(`test-endpoint-${i}`)
  );

  try {
    await Promise.all(promises);
    console.log("All requests completed");
  } catch (error) {
    console.error("Rate limit exceeded:", error.message);
  }

  // Check status
  console.log(rateLimiter.getStatus());
};
```

### Expected Behavior

1. **First 10 requests**: Instant (within limit)
2. **Requests 11-13**: Delayed (waiting for window)
3. **Request 14+**: Throws error (max delays reached)

## Troubleshooting

### Issue: Requests hang indefinitely

**Solution**: Check if `maxDelays` protection is working. Update rate limiter.

### Issue: Too many Alert dialogs

**Solution**: Spam prevention should limit to 1 per 30s. Check `lastWarningTime` logic.

### Issue: Rate limiting not working

**Solution**: Verify `rateLimiter.schedule(key)` is called in API interceptor.

### Issue: Different endpoints interfering

**Solution**: Ensure unique keys per endpoint (`${method}:${endpoint}`).

## Performance Considerations

- **Memory usage**: Each endpoint stores ~10-30 timestamps (negligible)
- **CPU usage**: O(n) cleanup per request (n = timestamps, typically <10)
- **Network impact**: Reduces server load by preventing burst requests
- **Battery impact**: Prevents excessive API calls that drain battery

## Related Files

- `/mobile/src/utils/RateLimiter.ts` - Implementation
- `/mobile/src/api/client.ts` - Integration
- `/mobile/src/utils/logger.ts` - Logging utility

## Future Improvements

- [ ] Add exponential backoff for repeated violations
- [ ] Track rate limit violations per user for analytics
- [ ] Add server-side rate limit header parsing (e.g., `X-RateLimit-Remaining`)
- [ ] Create visual indicator component (e.g., "Requests: 7/10 remaining")
- [ ] Add rate limit presets (e.g., STRICT, NORMAL, LENIENT)

## Summary

The rate limiter provides **production-ready protection** against API abuse using a sliding-window algorithm. It's already integrated in the API client and requires no additional setup for basic usage. Use `strictRateLimiter` for sensitive operations that need user-facing warnings.

**Key Takeaway**: Rate limiting happens automatically for all API calls. No action needed unless implementing custom sensitive endpoints.
