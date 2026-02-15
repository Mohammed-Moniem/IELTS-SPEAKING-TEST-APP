# 🔄 Restart Guide - Socket Authentication Fix

## Problem

The backend code has been updated but the running server hasn't picked up the changes yet. You need to restart the backend to apply the socket authentication fixes.

## Solution

### Option 1: Full Restart (Recommended)

Stop everything and restart cleanly:

```bash
# Stop the current process (Ctrl+C in the terminal)
# Then restart:
./start-backend-and-mobile.sh
```

### Option 2: Backend Only Restart

If you only want to restart the backend:

```bash
# In the backend directory:
cd micro-service-boilerplate-main
npm run dev
```

## What to Look For After Restart

### Backend Logs (Should See):

```
info: Socket auth attempt - Token present: true, Length: 268
info: Socket JWT decoded successfully: {
  "sub": "68ea5227471c2c2257af0fa5",
  "email": "pro@test.com",
  ...
}
info: Socket authenticated for user: 68ea5227471c2c2257af0fa5
info: User connected: 68ea5227471c2c2257af0fa5 (Socket: abc123...)
```

### Mobile Logs (Should See):

```
🔑 Socket token retrieved: { hasToken: true, tokenLength: 268, ... }
✅ Socket connected: abc123
```

## If Still Failing

### Check Backend Logs for JWT Errors

If you see errors like:

- `jwt malformed` → Token format issue
- `jwt expired` → Token needs refresh
- `invalid signature` → Secret key mismatch
- `invalid issuer` → App name mismatch

### Verify Environment Variables

Make sure these are set in `micro-service-boilerplate-main/.env`:

```env
APP_NAME=ielts-speaking-practice-api
JWT_ACCESS_SECRET=change-me-access-secret
```

### Check Token Refresh

If the token expired, the mobile app should automatically refresh it. Look for:

```
LOG 📤 API Request: .../auth/refresh
LOG ✅ API Response: { accessToken: "...", refreshToken: "..." }
```

## Common Issues

### 1. Backend Not Picking Up Changes

**Symptom**: Don't see new log messages
**Solution**: Fully stop and restart backend (Ctrl+C, then npm run dev)

### 2. Mobile App Cached

**Symptom**: Old behavior persists
**Solution**: Press `r` in Expo CLI to reload, or close and reopen app

### 3. Token Mismatch

**Symptom**: "Invalid token" even after restart
**Solution**: Check that APP_NAME matches in both sign and verify operations

## Next Steps After Successful Connection

1. ✅ Verify backend logs show "User connected"
2. ✅ Verify mobile logs show "Socket connected"
3. ✅ Send a test message
4. ✅ Verify message appears instantly
5. ✅ Check typing indicators work
6. ✅ Check online status updates
