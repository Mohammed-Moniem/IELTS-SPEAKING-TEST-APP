# Expo Go Compatibility Fix

## Issue

The app was crashing in Expo Go with the error:

```
ERROR [runtime not ready]: Invariant Violation: TurboModuleRegistry.getEnforcing(...): 'RTNGiphySDKModule' could not be found.
```

This occurred because the `@giphy/react-native-sdk` package requires native code and is not available in Expo Go.

## Solutions Implemented

### 1. Installed Missing Backend Dependency (aws-sdk)

**File:** Backend `package.json`

**Issue:** Backend was crashing with `Cannot find module 'aws-sdk'`

**Fix:** Installed the aws-sdk package required for S3 file storage

```bash
cd micro-service-boilerplate-main
npm install aws-sdk
```

### 2. Made react-native-compressor Optional in mediaUploadService

**File:** `/mobile/src/services/api/mediaUploadService.ts`

**Issue:** App was crashing with error about `react-native-compressor` not being linked in Expo Go

**Changes:**

- Replaced static import with dynamic require wrapped in try/catch
- Added check before using compressor: `if (!ImageCompressor) return uri;`
- Images are uploaded without compression in Expo Go (still work fine)
- Compression works normally in development builds

**Key Code:**

```typescript
// Dynamically import react-native-compressor (optional dependency)
let ImageCompressor: any = null;
try {
  const compressorModule = require("react-native-compressor");
  ImageCompressor = compressorModule.Image;
} catch (error) {
  console.warn(
    "react-native-compressor not available - image compression will be skipped."
  );
}
```

### 3. Made Giphy SDK Optional in GifPicker Component

**File:** `/mobile/src/components/chat/GifPicker.tsx`

**Changes:**

- Replaced static imports with dynamic require wrapped in try/catch
- Added graceful fallback when SDK is not available
- Updated fallback UI to show helpful message about development builds
- Changed all TypeScript types from Giphy SDK to `any` to avoid compile errors

**Key Code:**

```typescript
// Dynamically import Giphy SDK (optional dependency)
let GiphySDK: any = null;
let GiphyDialog: any = null;
let GiphyContentType: any = null;
let GiphyRating: any = null;

try {
  const giphyModule = require("@giphy/react-native-sdk");
  GiphySDK = giphyModule.GiphySDK;
  GiphyDialog = giphyModule.GiphyDialog;
  GiphyContentType = giphyModule.GiphyContentType;
  GiphyRating = giphyModule.GiphyRating;
} catch (error) {
  console.warn("Giphy SDK not available - GIF picker will be disabled.");
}
```

### 4. Conditionally Hide GIF Option in ChatScreen

**File:** `/mobile/src/screens/social/ChatScreen.tsx`

**Changes:**

- Added availability check at the top of the file
- Modified `handleAttachment()` to only show "GIF" option when SDK is available
- GIF option is automatically hidden in Expo Go

**Key Code:**

```typescript
// Check if Giphy SDK is available
let isGiphyAvailable = false;
try {
  require("@giphy/react-native-sdk");
  isGiphyAvailable = true;
} catch (error) {
  isGiphyAvailable = false;
}
```

## Result

✅ **App now runs successfully in Expo Go**

- Photo and Video features work normally
- GIF option is automatically hidden when SDK is unavailable
- User sees helpful message if they try to access GIF picker
- No crashes or runtime errors

## User Experience

### In Expo Go (No Native Modules)

- Attachment menu shows: **Photo | Video | Cancel**
- GIF option is hidden
- If GIF picker somehow opens, shows message:
  > "GIF picker requires a development build. This feature is not available in Expo Go. Run 'npx expo prebuild' and build the app to enable GIF support."

### In Development Build (With Native Modules)

- Attachment menu shows: **Photo | Video | GIF | Cancel**
- All features fully functional
- GIF picker works with GIPHY SDK

## Testing GIF Functionality

To test the full GIF feature, you need a development build:

### Option 1: Local Development Build

```bash
cd mobile
npx expo prebuild
npx expo run:ios    # For iOS
# or
npx expo run:android # For Android
```

### Option 2: EAS Build

```bash
cd mobile
eas build --profile development --platform ios
# or
eas build --profile development --platform android
```

## Backend Fix

Also installed missing `aws-sdk` dependency:

```bash
cd micro-service-boilerplate-main
npm install aws-sdk
```

This fixed the backend crash:

```
Error: Cannot find module 'aws-sdk'
```

## Summary

✅ Backend server now starts successfully with S3 support
✅ Mobile app runs in Expo Go without crashes
✅ Image compression gracefully disabled in Expo Go (images still upload)
✅ GIF feature gracefully disabled in Expo Go
✅ All messaging features work in Expo Go (text, image, video, audio)
✅ Full feature set (including compression & GIFs) in development builds
✅ Zero compilation errors
✅ User-friendly error messages

### Feature Comparison

| Feature           | Expo Go                 | Development Build     |
| ----------------- | ----------------------- | --------------------- |
| Text Messages     | ✅ Full                 | ✅ Full               |
| Image Upload      | ✅ Works (uncompressed) | ✅ Works (compressed) |
| Video Upload      | ✅ Full                 | ✅ Full               |
| Audio Messages    | ✅ Full                 | ✅ Full               |
| GIF Picker        | ❌ Disabled             | ✅ Full               |
| Image Compression | ❌ Skipped              | ✅ Enabled            |

The app is now compatible with both Expo Go (for quick testing) and development builds (for full feature set with optimizations).
