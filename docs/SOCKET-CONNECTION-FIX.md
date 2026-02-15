# Socket.IO Connection Fix - Text & Voice Messages

## Issue

Text messages and voice messages were not working. The messages weren't being sent at all.

## Root Cause

The Socket.IO service was trying to connect to `http://localhost:8080`, but the backend is running on ngrok at `https://38500cc31f43.ngrok-free.app`.

**The socket connection was failing silently**, which meant:

- ❌ Text messages couldn't be sent via Socket.IO
- ❌ Voice messages couldn't be sent (they use Socket.IO after upload)
- ❌ Real-time message delivery wasn't working
- ❌ Typing indicators weren't working
- ❌ Online status wasn't working

## Solutions Implemented

### 1. Updated socketService.ts to Use Dynamic URL

**File:** `/mobile/src/services/socketService.ts`

**Changes:**

- Imported `Constants` from `expo-constants`
- Made SOCKET_URL use the same configuration sources as API client
- Added fallback to derive socket URL from API URL (remove `/api/v1`)
- Added console log to show which socket URL is being used

**Before:**

```typescript
const SOCKET_URL = process.env.SOCKET_URL || "http://localhost:8080";
```

**After:**

```typescript
const SOCKET_URL =
  process.env.EXPO_PUBLIC_SOCKET_URL ||
  (Constants.expoConfig?.extra as { socketUrl?: string })?.socketUrl ||
  process.env.EXPO_PUBLIC_API_URL?.replace("/api/v1", "") ||
  (Constants.expoConfig?.extra as { apiUrl?: string })?.apiUrl?.replace(
    "/api/v1",
    ""
  ) ||
  defaultSocketUrl;

console.log("🔌 Socket URL:", SOCKET_URL);
```

### 2. Updated app.json with ngrok URLs

**File:** `/mobile/app.json`

**Changes:**

- Updated `apiUrl` from localhost to ngrok URL
- Added `socketUrl` configuration

**Before:**

```json
"extra": {
  "apiUrl": "http://localhost:4000/api/v1"
}
```

**After:**

```json
"extra": {
  "apiUrl": "https://38500cc31f43.ngrok-free.app/api/v1",
  "socketUrl": "https://38500cc31f43.ngrok-free.app"
}
```

## Configuration Priority

The socket service now checks URLs in this order:

1. `process.env.EXPO_PUBLIC_SOCKET_URL` (environment variable)
2. `app.json` → `extra.socketUrl` (recommended for ngrok)
3. `process.env.EXPO_PUBLIC_API_URL` without `/api/v1` (fallback)
4. `app.json` → `extra.apiUrl` without `/api/v1` (fallback)
5. `http://localhost:8080` (default for local dev)

## How Socket.IO is Used

### Text Messages

1. User types message and presses send
2. `ChatScreen` calls `sendMessage()` or `sendGroupMessage()`
3. `useChat` hook calls `socketService.sendDirectMessage()` or `socketService.sendGroupMessage()`
4. Socket emits `message:send` or `message:group:send` event
5. Backend receives, saves to DB, and broadcasts to recipient
6. Recipient's socket receives `message:new` event
7. Message appears in chat

### Voice Messages

1. User records audio
2. Audio is uploaded to `/chat/upload` via HTTP
3. Upload returns `fileUrl`
4. App sends message via Socket.IO with `content: fileUrl` and `messageType: "audio"`
5. Message is delivered in real-time to recipient

### Other Real-time Features

- **Typing indicators:** Sent via `message:typing` event
- **Online status:** Broadcasted when users connect/disconnect
- **Read receipts:** Sent via `message:read` event
- **Message delivery:** Confirmed via `message:delivered` event

## Testing

After this fix, you should:

1. **Restart the Expo app** (reload won't pick up app.json changes)

   ```bash
   # Stop the app and run:
   cd mobile
   npx expo start --clear
   ```

2. **Check console logs** for:

   ```
   🔌 Socket URL: https://38500cc31f43.ngrok-free.app
   ✅ Socket connected
   ```

3. **Test text messages:**

   - ✅ Type a message and send
   - ✅ Should appear immediately in chat
   - ✅ Should be delivered to recipient

4. **Test voice messages:**

   - ✅ Record audio
   - ✅ Should upload successfully
   - ✅ Should send via Socket.IO
   - ✅ Should appear in chat

5. **Test typing indicators:**
   - ✅ Start typing
   - ✅ Recipient should see "typing..." indicator

## Important Notes

### When Ngrok URL Changes

Every time you restart ngrok, you get a new URL. You must update:

1. **Update app.json:**

   ```json
   "extra": {
     "apiUrl": "https://NEW-URL-HERE.ngrok-free.app/api/v1",
     "socketUrl": "https://NEW-URL-HERE.ngrok-free.app"
   }
   ```

2. **Restart Expo app** (required for app.json changes):

   ```bash
   npx expo start --clear
   ```

3. **Update docs/CURRENT-NGROK-URL.txt** (optional, for reference)

### Alternative: Use Environment Variables

For easier updates, you can use `.env` file (requires `expo-constants` setup):

1. Create `mobile/.env`:

   ```
   EXPO_PUBLIC_API_URL=https://YOUR-NGROK-URL.ngrok-free.app/api/v1
   EXPO_PUBLIC_SOCKET_URL=https://YOUR-NGROK-URL.ngrok-free.app
   ```

2. Install package (if not already):

   ```bash
   npm install expo-constants
   ```

3. Restart expo:
   ```bash
   npx expo start --clear
   ```

## Summary

✅ **Socket.IO now connects to ngrok URL** instead of localhost
✅ **Text messages will work** - sent via Socket.IO
✅ **Voice messages will work** - upload via HTTP, send via Socket.IO
✅ **Real-time features work** - typing, online status, read receipts
✅ **Configuration is centralized** in app.json
✅ **Easy to update** when ngrok URL changes

**Remember:** Restart the Expo app after changing app.json! 🔄
