# Social Features Authentication Fix

## Problem

The social features were failing with "jwt malformed" errors and navigation errors:

1. **Authentication errors**: All social API endpoints (`/friends`, `/profile/me`, `/achievements/me`, etc.) were returning 401 "Invalid or expired token" errors
2. **Navigation errors**: `FindFriends` and `FriendRequests` screens were not registered in the navigator

## Root Cause Analysis

### Issue 1: Incorrect Auth Token Storage

The social service files were using `AsyncStorage.getItem("authToken")` to retrieve authentication tokens, but the app actually stores auth tokens in **SecureStore** under the key `"ielts-speaking-auth"` with a different structure:

```typescript
// ❌ What social services were doing:
const token = await AsyncStorage.getItem("authToken");

// ✅ What the app actually uses:
const stored = await SecureStore.getItemAsync("ielts-speaking-auth");
const { accessToken, refreshToken } = JSON.parse(stored);
```

This meant the social services couldn't find any auth tokens, resulting in malformed JWT errors when trying to send `undefined` or `null` as the Bearer token.

### Issue 2: Commented Out Navigation Screens

The `FindFriendsScreen` and `FriendRequestsScreen` components existed but were commented out in the `SocialNavigator.tsx`, causing navigation errors when trying to navigate to these screens.

## Solution

### Fix 1: Use apiClient for All Social Services

Refactored all social service files to use the centralized `apiClient` instead of creating their own axios instances:

**Files Modified:**

- `mobile/src/services/api/friendService.ts`
- `mobile/src/services/api/profileService.ts`
- `mobile/src/services/api/achievementService.ts`
- `mobile/src/services/api/leaderboardService.ts`
- `mobile/src/services/api/referralService.ts`
- `mobile/src/services/api/groupService.ts`
- `mobile/src/services/api/chatService.ts`
- `mobile/src/services/api/couponService.ts`

**Changes Made:**

```typescript
// ❌ OLD CODE:
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { API_BASE_URL } from "../../config";

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

class FriendService {
  async getFriends(): Promise<Friend[]> {
    const headers = await getAuthHeaders();
    const response = await axios.get(`${API_BASE_URL}/friends`, {
      headers,
    });
    return response.data.data;
  }
}

// ✅ NEW CODE:
import { apiClient } from "../../api/client";

class FriendService {
  async getFriends(): Promise<Friend[]> {
    const response = await apiClient.get(`/friends`);
    return response.data.data;
  }
}
```

**Why This Works:**

- The `apiClient` is already configured with auth handlers via `attachAuthHandlers()` in `AuthContext.tsx`
- It automatically attaches the Bearer token from SecureStore to all requests
- It handles token refresh automatically
- No need for manual header management

### Fix 2: Enable Navigation Screens

Uncommented the screen imports and routes in `SocialNavigator.tsx`:

```typescript
// ✅ Uncommented imports:
import { FriendRequestsScreen } from '../screens/Social/FriendRequestsScreen';
import { FindFriendsScreen } from '../screens/Social/FindFriendsScreen';

// ✅ Added routes:
<Stack.Screen
  name="FriendRequests"
  component={FriendRequestsScreen}
  options={{
    title: 'Friend Requests',
  }}
/>

<Stack.Screen
  name="FindFriends"
  component={FindFriendsScreen}
  options={{
    title: 'Find Friends',
  }}
/>
```

## Testing Instructions

### 1. Reload the App

The Metro bundler will automatically reload with the changes. If not, press `r` in the terminal.

### 2. Test Authentication Flow

1. Open the Social tab in the app
2. Verify no "jwt malformed" errors appear in the logs
3. Check that friend requests, friends list, profile, achievements load without 401 errors

### 3. Test Navigation

1. Click "Find Friends" button → should navigate to Find Friends screen
2. Click "Requests" button → should navigate to Friend Requests screen
3. Verify no "navigator not found" errors appear

### 4. Test API Calls

Watch the terminal logs for successful API calls:

```
✅ API Response: {"status": 200, "url": "/friends"}
✅ API Response: {"status": 200, "url": "/profile/me"}
✅ API Response: {"status": 200, "url": "/achievements/me"}
```

## Expected Behavior

### Before the Fix

```
❌ error: jwt malformed
❌ 401 Unauthorized on /friends
❌ 401 Unauthorized on /profile/me
❌ 401 Unauthorized on /achievements/me
❌ ERROR: The action 'NAVIGATE' with payload {"name":"FindFriends"} was not handled
❌ ERROR: The action 'NAVIGATE' with payload {"name":"FriendRequests"} was not handled
```

### After the Fix

```
✅ 200 OK on /friends
✅ 200 OK on /profile/me
✅ 200 OK on /achievements/me
✅ Navigation to FindFriends works
✅ Navigation to FriendRequests works
```

## Implementation Details

### apiClient Configuration

The `apiClient` in `mobile/src/api/client.ts` is configured with:

- Base URL from environment
- Automatic Bearer token attachment via interceptor
- Token refresh on 401 responses
- Proper error handling and logging

### AuthContext Integration

The `AuthContext` in `mobile/src/auth/AuthContext.tsx`:

- Stores tokens in SecureStore under `"ielts-speaking-auth"`
- Attaches auth handlers to apiClient on mount
- Provides `getAccessToken()` that returns current token
- Handles token refresh automatically

## Next Steps

1. ✅ Fixed auth integration for all social services
2. ✅ Enabled FindFriends and FriendRequests navigation
3. ⏳ Test social features end-to-end
4. ⏳ Fix any UI/UX issues discovered during testing

## Notes

- All social services now use the same authentication mechanism as the rest of the app
- No more duplicate auth code in each service
- Tokens are properly stored in SecureStore (encrypted)
- Navigation is now complete for the friends flow
