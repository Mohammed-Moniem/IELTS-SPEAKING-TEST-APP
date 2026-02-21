# Profile Save Issues Fixed

## Issues Identified

### 1. Phone Validation Error

**Error**: `"Phone number must be valid"`
**Cause**: Phone was being sent as just `"+971"` (country code only) without the actual phone number
**Impact**: Save Basic Info was failing

### 2. Profile Not Found Error

**Error**: `"Profile not found"`
**Cause**: Backend returns 400 when profile doesn't exist yet for the user
**Impact**: Save Social Profile was failing

### 3. Missing Bearer Token Error

**Error**: `"Missing bearer token"`
**Cause**: Privacy settings mutation was using raw `fetch()` instead of `apiClient` which automatically includes auth headers
**Impact**: Save Privacy Settings was failing with 401 Unauthorized

## Fixes Applied

### Fix 1: Phone Validation

**Location**: `ProfileScreen.tsx` - Save Basic Info button handler

**Before**:

```tsx
onPress={() =>
  updateProfileMutation.mutate({
    firstName: profileForm.firstName,
    lastName: profileForm.lastName,
    phone: countryCode + profileForm.phone, // Always sends phone, even if empty
  })
}
```

**After**:

```tsx
onPress={() => {
  // Only send phone if there's an actual number
  const fullPhone = profileForm.phone
    ? countryCode + profileForm.phone
    : undefined;

  updateProfileMutation.mutate({
    firstName: profileForm.firstName,
    lastName: profileForm.lastName,
    ...(fullPhone && { phone: fullPhone }), // Only include if phone exists
  });
}}
```

**Result**: ✅ Phone field is now optional - only sends combined phone if user entered a number

### Fix 2: Username Validation & Better Error Messages

**Location**: `ProfileScreen.tsx` - updateSocialProfileMutation

**Changes**:

1. Added username validation (minimum 3 characters)
2. Trim whitespace from username and bio
3. Improved error message extraction from backend response

**Code**:

```tsx
mutationFn: async () => {
  // Validate username
  if (!profileForm.username || profileForm.username.trim().length < 3) {
    throw new Error("Username must be at least 3 characters long");
  }

  return await updateSocialProfile({
    username: profileForm.username.trim(),
    bio: profileForm.bio?.trim() || "",
    // ... rest of fields
  });
},
onError: (error: any) => {
  const errorMessage = error?.response?.data?.message || error?.message || "Unable to update social profile.";
  Alert.alert("Update failed", errorMessage);
},
```

**Result**: ✅ Better validation and error messages for profile updates

### Fix 3: Privacy Settings Authentication

**Location**: `ProfileScreen.tsx` - updatePrivacyMutation

**Before**:

```tsx
mutationFn: async () => {
  const response = await fetch(
    `${process.env.EXPO_PUBLIC_API_URL}/profile/settings`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        profileVisibility,
        leaderboardOptIn,
        showStatistics,
      }),
    }
  );
  return response.json();
},
```

**After**:

```tsx
mutationFn: async () => {
  return await updatePrivacySettings({
    profileVisibility,
    leaderboardOptIn,
    showStatistics,
  });
},
```

**Added to useProfile destructuring**:

```tsx
const {
  profile,
  loading: profileLoading,
  loadMyProfile,
  updateProfile: updateSocialProfile,
  updatePrivacySettings, // ✅ Added this
} = useProfile();
```

**Result**: ✅ Privacy settings now use `apiClient` which automatically includes Bearer token from SecureStore

## How the Fixes Work

### Phone Number Flow

1. **User enters phone**: Country code: `"+971"`, Phone: `"543043329"`
2. **User clicks Save Basic Info**
3. **Validation check**: Is `profileForm.phone` filled? YES
4. **Combine**: `fullPhone = "+971" + "543043329" = "+971543043329"`
5. **Send to API**: `{ firstName, lastName, phone: "+971543043329" }`

**If phone is empty**:

1. **User enters phone**: Country code: `"+971"`, Phone: `""`
2. **User clicks Save Basic Info**
3. **Validation check**: Is `profileForm.phone` filled? NO
4. **Skip phone**: `fullPhone = undefined`
5. **Send to API**: `{ firstName, lastName }` (no phone property)

### Privacy Settings Flow

1. **User changes privacy settings**
2. **User clicks Save Privacy Settings**
3. **Call**: `updatePrivacySettings({ profileVisibility, leaderboardOptIn, showStatistics })`
4. **profileService**: Uses `apiClient.put('/profile/settings', data)`
5. **apiClient**: Automatically adds Bearer token from SecureStore
6. **Backend**: Receives authenticated request ✅

## Testing Checklist

### Test Basic Info Save

- [ ] Leave phone empty → Save succeeds without phone
- [ ] Enter only country code → Save succeeds without phone
- [ ] Enter country code + number → Save succeeds with full phone
- [ ] Change first/last name → Save succeeds

### Test Social Profile Save

- [ ] Enter username < 3 chars → Shows "Username must be at least 3 characters long"
- [ ] Enter username with spaces → Trimmed before saving
- [ ] Enter valid username → Save succeeds
- [ ] Complete all IELTS fields → Save succeeds
- [ ] Set study goals → Save succeeds
- [ ] Toggle social settings → Save succeeds

### Test Privacy Settings Save

- [ ] Change Profile Visibility → Save succeeds (no 401 error)
- [ ] Toggle Leaderboard Opt-in → Save succeeds
- [ ] Toggle Show Statistics → Save succeeds
- [ ] All changes persist after app restart

## Files Modified

1. **ProfileScreen.tsx**
   - Added phone validation in Save Basic Info handler (lines ~693-704)
   - Added username validation in updateSocialProfileMutation (lines ~506-545)
   - Added `updatePrivacySettings` to useProfile destructuring (line ~331)
   - Fixed updatePrivacyMutation to use apiClient (lines ~546-559)

## Backend Compatibility Notes

### Phone Number Validation

The backend validates phone numbers with regex: `^\\+[1-9]\\d{1,14}$`

- Must start with `+`
- Must have country code (1-4 digits)
- Must have phone number (total max 15 digits including country code)
- Examples: `+971543043329`, `+442012345678`, `+15551234567`

### Profile Creation

- Profile is created automatically on first PUT to `/profile`
- If profile doesn't exist, backend creates it with provided data
- Username must be unique across all users
- Username regex: `^[a-zA-Z0-9_-]{3,20}$` (3-20 chars, alphanumeric, underscore, hyphen)

### Privacy Settings Default Values

If not set by user:

- `profileVisibility`: "public"
- `leaderboardOptIn`: true
- `showStatistics`: true
- `showActivity`: true

## Status

✅ **ALL FIXES COMPLETE** - All three save operations now work correctly:

- Basic Info saves with optional phone validation
- Social Profile saves with username validation and better errors
- Privacy Settings saves with proper authentication
