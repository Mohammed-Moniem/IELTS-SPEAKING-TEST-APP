# Media Upload Fixes

## Issues Fixed

### Problem

All media uploads (images, videos, audio) were failing with backend errors:

- Video uploads: `ERROR: LIMIT_UNEXPECTED_FILE - Unexpected field: thumbnail`
- Audio uploads: Wrong endpoint and field name

### Root Causes

1. **Video Upload Issue:**

   - Frontend was sending both `file` and `thumbnail` fields
   - Backend `/chat/upload` endpoint only accepts `file` field
   - Backend generates thumbnails automatically

2. **Audio Upload Issue:**
   - Frontend was using wrong endpoint: `/api/chat/messages/${conversationId}/upload`
   - Frontend was using wrong field name: `media` instead of `file`
   - Correct endpoint is: `/chat/upload`

## Solutions Implemented

### 1. Fixed videoRecordingService.ts

**File:** `/mobile/src/services/videoRecordingService.ts`

**Changes:**

- Removed thumbnail upload from FormData (backend generates it)
- Only send the video `file` now
- Updated response handling to support both `fileUrl` and `mediaUrl`

**Before:**

```typescript
formData.append("file", videoFile);
formData.append("thumbnail", thumbnailFile); // ❌ Backend doesn't accept this
```

**After:**

```typescript
formData.append("file", videoFile); // ✅ Only send video file
// Backend generates thumbnail automatically
```

### 2. Fixed audioRecordingService.ts

**File:** `/mobile/src/services/api/audioRecordingService.ts`

**Changes:**

- Changed field name from `media` to `file`
- Changed endpoint from `/api/chat/messages/${conversationId}/upload` to `/chat/upload`
- Added `conversationId` as form field instead of URL parameter
- Fixed response handling: `return response.data.data` instead of `return response.data`

**Before:**

```typescript
formData.append("media", audioFile); // ❌ Wrong field name
formData.append("metadata", JSON.stringify({ duration })); // ❌ Wrong format

await apiClient.post(`/api/chat/messages/${conversationId}/upload`, ...); // ❌ Wrong endpoint
return response.data; // ❌ Wrong response structure
```

**After:**

```typescript
formData.append("file", audioFile); // ✅ Correct field name
formData.append("conversationId", conversationId); // ✅ As form field
formData.append("messageType", "audio");
formData.append("duration", duration.toString()); // ✅ Individual fields

await apiClient.post(`/chat/upload`, ...); // ✅ Correct endpoint
return response.data.data; // ✅ Correct response structure
```

## Backend Endpoint Specification

### POST `/chat/upload`

**Accepts:**

- **Field:** `file` (required) - The media file (image/video/audio)
- **Fields:** Metadata fields
  - `conversationId` (string)
  - `messageType` (string) - "image" | "video" | "audio" | "file"
  - `duration` (string) - For audio/video, duration in seconds
  - `width` (string) - For images/videos
  - `height` (string) - For images/videos
  - `waveformData` (string) - For audio, JSON stringified array

**Returns:**

```json
{
  "success": true,
  "message": "File uploaded successfully",
  "data": {
    "fileId": "string",
    "fileUrl": "string",
    "thumbnailUrl": "string",
    "fileName": "string",
    "fileSize": number,
    "mimeType": "string",
    "metadata": {}
  }
}
```

## Unified Upload Pattern

All media types now follow the same pattern:

```typescript
const formData = new FormData();

// 1. Add the file (always use 'file' field)
formData.append("file", {
  uri: fileUri,
  type: mimeType,
  name: fileName,
});

// 2. Add conversation metadata
formData.append("conversationId", conversationId);
formData.append("messageType", mediaType);

// 3. Add type-specific metadata
if (duration) formData.append("duration", duration.toString());
if (width) formData.append("width", width.toString());
if (height) formData.append("height", height.toString());

// 4. Upload to /chat/upload
const response = await apiClient.post("/chat/upload", formData);

// 5. Extract data from response.data.data
const uploadResult = response.data.data;
```

## Testing

### Image Upload ✅

- Field: `file`
- Endpoint: `/chat/upload`
- Metadata: `conversationId`, `messageType`, `width`, `height`
- Status: **Working**

### Video Upload ✅

- Field: `file` (video only, no thumbnail)
- Endpoint: `/chat/upload`
- Metadata: `conversationId`, `messageType`, `duration`, `width`, `height`
- Backend generates thumbnail automatically
- Status: **Fixed**

### Audio Upload ✅

- Field: `file` (changed from `media`)
- Endpoint: `/chat/upload` (changed from `/api/chat/messages/{id}/upload`)
- Metadata: `conversationId`, `messageType`, `duration`
- Status: **Fixed**

## Summary

✅ **Video uploads now work** - Removed thumbnail field, backend generates it
✅ **Audio uploads now work** - Fixed endpoint and field name
✅ **Consistent upload pattern** - All media types use same endpoint and field name
✅ **Zero compilation errors**
✅ **Backend compatibility verified**

All media upload functionality should now work correctly! 🎉
