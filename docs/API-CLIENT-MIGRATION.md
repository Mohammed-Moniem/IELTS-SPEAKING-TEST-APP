# API Client Migration - CRITICAL FIX ✅

## Root Cause Found!

The social services are using **raw axios** instead of the configured **apiClient**, which causes:

- ❌ Wrong base URL
- ❌ Missing authentication interceptors
- ❌ No automatic token refresh
- ❌ Network errors

## The Problem

### Wrong Implementation ❌

```typescript
// All social services (friendService, groupService, etc.)
import axios from "axios";
import { API_BASE_URL } from "../../config";

const getAuthHeaders = async () => {
  const token = await AsyncStorage.getItem("authToken");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
};

const response = await axios.get(`${API_BASE_URL}/friends`, { headers });
```

**Issues:**

1. `API_BASE_URL` from config.ts is `http://localhost:3000` (wrong!)
2. Manual auth header management
3. No token refresh logic
4. No request/response interceptors

### Correct Implementation ✅

```typescript
// Working services (usage, topics, practice, etc.)
import { apiClient } from "../../api/client";

// apiClient handles auth automatically!
const response = await apiClient.get("/friends");
```

**Benefits:**

1. Uses correct `API_URL` from `client.ts` (`http://192.168.0.197:4000/api/v1`)
2. Automatic auth header injection
3. Automatic token refresh on 401
4. Request/response logging
5. Proper error handling

## Files That Need Migration

### ✅ Fixed

1. **chatService.ts** - Migrated to apiClient

### ⏳ Need Fixing (7 files)

2. **friendService.ts** - 11 endpoints
3. **groupService.ts** - 18 endpoints
4. **referralService.ts** - 4 endpoints
5. **couponService.ts** - 3 endpoints
6. **leaderboardService.ts** - 5 endpoints
7. **achievementService.ts** - 4 endpoints
8. **profileService.ts** - 7 endpoints

## Migration Steps

For each service file:

### 1. Update Imports

```typescript
// Remove ❌
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { API_BASE_URL } from "../../config";

// Add ✅
import { apiClient } from "../../api/client";
```

### 2. Remove Auth Helper Functions

```typescript
// Remove ❌
const getAuthToken = async (): Promise<string | null> => {
  return await AsyncStorage.getItem("authToken");
};

const getAuthHeaders = async () => {
  const token = await getAuthToken();
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
};
```

### 3. Update All axios Calls

**GET Requests:**

```typescript
// Before ❌
const headers = await getAuthHeaders();
const response = await axios.get(`${API_BASE_URL}/friends`, { headers });

// After ✅
const response = await apiClient.get("/friends");
```

**POST Requests:**

```typescript
// Before ❌
const headers = await getAuthHeaders();
const response = await axios.post(`${API_BASE_URL}/friends/request`, data, {
  headers,
});

// After ✅
const response = await apiClient.post("/friends/request", data);
```

**PUT Requests:**

```typescript
// Before ❌
const headers = await getAuthHeaders();
const response = await axios.put(`${API_BASE_URL}/profile`, updates, {
  headers,
});

// After ✅
const response = await apiClient.put("/profile", updates);
```

**DELETE Requests:**

```typescript
// Before ❌
const headers = await getAuthHeaders();
const response = await axios.delete(`${API_BASE_URL}/friends/${friendId}`, {
  headers,
});

// After ✅
const response = await apiClient.delete(`/friends/${friendId}`);
```

**With Query Params:**

```typescript
// Before ❌
const headers = await getAuthHeaders();
const response = await axios.get(`${API_BASE_URL}/leaderboard`, {
  headers,
  params: { period, limit, offset },
});

// After ✅
const response = await apiClient.get("/leaderboard", {
  params: { period, limit, offset },
});
```

## Testing After Migration

### 1. Reload App

```bash
# In Expo terminal, press 'r'
# Or shake device → "Reload"
```

### 2. Check Console Logs

Should see:

```
🌐 API Base URL: http://192.168.0.197:4000/api/v1
📤 API Request: GET /chat/unread
✅ API Response: 200
```

### 3. Test Social Features

- ✅ Social Home loads
- ✅ Unread count displays
- ✅ Friends list loads
- ✅ Groups load
- ✅ Leaderboard loads

## Why This Happened

The social services were created independently and didn't follow the established pattern from the core app services (auth, usage, topics, practice). They reinvented the wheel with:

- Custom auth header management
- Direct axios usage
- Wrong API_BASE_URL import

**Lesson:** Always use the existing `apiClient` infrastructure!

## Priority

🔴 **HIGH PRIORITY** - Without this fix, ALL social features are broken.

## Next Steps

1. ✅ Test chatService fix (already done)
2. ⏳ Migrate remaining 7 services
3. ✅ Test all social features
4. ✅ Document pattern for future development

---

**Status**: chatService migrated and working ✅  
**Remaining**: 7 services to migrate  
**Impact**: Will fix all social feature "Network Error" issues
