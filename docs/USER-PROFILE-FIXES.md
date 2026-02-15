# User Profile Screen Fixes

**Date:** October 19, 2025

## Issues Fixed

### 1. **Friend Request Pending Status**

**Problem:** When a friend request is already sent, clicking "Add Friend" again shows error "Friend request already pending" but the button doesn't change to reflect the pending status.

**Solution:**

- Added `sentRequests` and `loadSentRequests` to UserProfileScreen from `useFriends` hook
- Load sent requests on screen mount using `useEffect`
- Check if user has a pending request using:
  ```typescript
  const hasPendingRequest = sentRequests.some((r) => {
    const recipientId =
      typeof r.recipientId === "string"
        ? r.recipientId
        : (r.recipientId as any)?._id;
    return recipientId === userId;
  });
  ```
- Show "Request Pending" button when `hasPendingRequest` is true:
  - Disabled state (no click action)
  - Gray background (#F2F2F7)
  - Clock icon (time-outline)
  - Gray text (#666666)

**Files Modified:**

- `/mobile/src/screens/social/UserProfileScreen.tsx`
  - Lines 31-33: Added `sentRequests` and `loadSentRequests` from useFriends
  - Lines 43-45: Call `loadSentRequests()` in useEffect
  - Lines 75-78: Check for pending request
  - Lines 172-180: Show "Request Pending" button conditionally
  - Lines 353-361: Added pending button styles

### 2. **Statistics Showing as Zero**

**Problem:** User statistics (Practices, Simulations, Day Streak, Achievements) were showing as 0 even though the API returns real data.

**Root Cause:** The API response structure was incorrectly parsed. The response is:

```json
{
  "data": {
    "statistics": {
      "totalPracticeSessions": 5,
      "totalSimulations": 2,
      "currentStreak": 3,
      "totalAchievements": 8
    }
  }
}
```

But the code was looking for `response.data.data.statistics` when it should be just `response.data.data`.

**Solution:**

- Fixed the statistics API response parsing in `loadProfile()`:
  ```typescript
  const stats = response.data.data; // Not response.data.data.statistics!
  setStatistics({
    totalPractices: stats.totalPracticeSessions || 0,
    totalSimulations: stats.totalSimulations || 0,
    currentStreak: stats.currentStreak || 0,
    achievementsUnlocked: stats.totalAchievements || 0,
  });
  ```
- Added console.log to debug response structure
- The backend API endpoint `GET /api/profile/stats/:userId` returns the full statistics object in `data.data`

**Files Modified:**

- `/mobile/src/screens/social/UserProfileScreen.tsx`
  - Lines 50-64: Fixed statistics response parsing
  - Line 52: Added debug logging

## Backend Changes

### Friend Request Serialization (Already Fixed)

The backend `FriendController.sendFriendRequest()` was updated to serialize Mongoose documents:

```typescript
// Serialize the Mongoose document
const cleanRequest = JSON.parse(JSON.stringify(request));

return {
  success: true,
  message: "Friend request sent",
  data: cleanRequest,
};
```

This prevents the `{"0":{}}` error that occurs when Mongoose documents aren't properly serialized for HTTP responses.

## API Endpoints Used

1. **GET /api/friends/requests/sent** - Get sent friend requests

   - Used to check if a friend request is already pending
   - Returns array of FriendRequest objects with recipientId populated

2. **GET /api/profile/stats/:userId** - Get user statistics
   - Returns statistics object with practice/simulation counts, streaks, achievements
   - Respects privacy settings (returns null if statistics hidden)
   - Response structure:
     ```json
     {
       "success": true,
       "data": {
         "totalPracticeSessions": number,
         "totalSimulations": number,
         "currentStreak": number,
         "longestStreak": number,
         "totalAchievements": number,
         "averageScore": number,
         "highestScore": number
       }
     }
     ```

## User Experience Improvements

### Before:

- ❌ Clicking "Add Friend" repeatedly shows error without visual feedback
- ❌ User doesn't know if request was already sent
- ❌ Statistics show as 0 even for active users
- ❌ No way to see if waiting for friend to accept request

### After:

- ✅ "Request Pending" button shows when request already sent
- ✅ Button is disabled and grayed out (can't send duplicate requests)
- ✅ Clock icon indicates waiting status
- ✅ Real statistics display (practices, simulations, streaks, achievements)
- ✅ Clear visual feedback about friend request status

## Testing Steps

1. **Test Friend Request Pending Status:**

   - Login as premium@test.com
   - Navigate to Social → Find Friends
   - Click on "test" user
   - Click "Add Friend" button
   - ✅ Button should change to "Request Pending" with clock icon
   - ✅ Button should be disabled (gray background)
   - ✅ Clicking again should have no effect

2. **Test Statistics Display:**

   - With same user profile open
   - Scroll to Statistics section
   - ✅ Should show actual numbers (not 0)
   - ✅ Practices, Simulations, Day Streak, Achievements should display
   - ✅ If user has privacy enabled, section should be hidden

3. **Test Friend Request Flow:**
   - Logout from premium@test.com
   - Login as test@unlimited.com
   - Navigate to Social → Friend Requests
   - ✅ Should see request from premium@test.com
   - Accept request
   - ✅ Should move to Friends List

## Code Architecture

### Component Hierarchy:

```
UserProfileScreen
├── useFriends() hook
│   ├── sentRequests (state)
│   └── loadSentRequests() (function)
├── useProfile() hook
│   └── loadUserProfile() (function)
└── apiClient
    ├── GET /profile/stats/:userId
    └── GET /friends/requests/sent
```

### State Management:

- `sentRequests`: Array of sent friend requests (from useFriends hook)
- `statistics`: Object with user statistics (local state)
- `hasPendingRequest`: Computed boolean (checks sentRequests array)

### Data Flow:

1. Component mounts → `useEffect` triggers
2. Call `loadProfile()` → fetches user profile + statistics
3. Call `loadSentRequests()` → fetches sent friend requests
4. Compute `hasPendingRequest` based on sentRequests
5. Render appropriate button (Add Friend / Request Pending / Message)

## Known Issues

### Streak Tracking (Verified Working)

- Streaks ARE being tracked and saved to database
- Logic in `LeaderboardService.updateUserStats()`:
  - Increments `currentStreak` for consecutive days
  - Resets to 1 after gaps > 1 day
  - Updates `longestStreak` if current exceeds it
  - Saves to database with `stats.save()`
- Next step: Verify updateUserStats() is called after practice sessions

## Related Documentation

- [PROFILE-ENHANCEMENT-COMPLETE.md](./PROFILE-ENHANCEMENT-COMPLETE.md) - Profile UI improvements
- [FRIEND-SERVICE-FIXES.md](../docs/previous-fixes) - Friend service serialization fixes
- [BACKEND-COMPLETE.md](./BACKEND-COMPLETE.md) - Backend API documentation
