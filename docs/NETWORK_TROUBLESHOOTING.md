# 🔧 Network Connectivity Troubleshooting

## Changes Made

### 1. Updated Mobile App Configuration

- **File**: `mobile/app.json`
- **Change**: Updated IP address from `192.168.0.197` to `192.168.0.149`
- **Your Mac's Current IP**: `192.168.0.149`

### 2. Added API Key Header

- **File**: `mobile/src/api/client.ts`
- **Change**: Added `x-api-key: local-dev-api-key` header
- **Why**: Backend requires this API key (from `.env`)

### 3. Enhanced Logging

- **File**: `mobile/src/api/client.ts`
- **Changes**:
  - Added request logging (method, URL, headers)
  - Added response logging (status, data)
  - Added detailed error logging
  - Increased timeout from 15s to 30s

### 4. Added Network Test Utility

- **File**: `mobile/src/api/networkTest.ts`
- **Features**:
  - Automatic connection test on app startup
  - Tests basic connectivity, health endpoint, and topics
  - Helpful error messages with troubleshooting steps

### 5. Auto-Test on App Launch

- **File**: `mobile/App.tsx`
- **Change**: Automatically tests backend connection when app starts (dev mode only)

## How to Test

### Step 1: Restart Mobile App

```bash
# Kill the current Metro bundler (Ctrl+C)
# Then restart:
cd /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP/mobile
npm start
```

Press **`r`** to reload the app or shake device to reload.

### Step 2: Watch the Logs

You should now see in the Metro bundler terminal:

```
🌐 API Base URL: http://192.168.0.149:4000/api/v1

📱 Mobile App Network Info:
API URL: http://192.168.0.149:4000/api/v1
API Key: local-dev-api-key
Timeout: 30 seconds

🔍 Testing Backend Connection...
📍 Target URL: http://192.168.0.149:4000/api/v1

1️⃣ Testing basic connectivity...
✅ Basic connectivity OK

2️⃣ Testing health endpoint...
✅ Health check OK

3️⃣ Testing topics endpoint...
📤 API Request: GET /topics
✅ API Response: { status: 200, data: {...} }
✅ Topics endpoint OK

✅ Backend connection test complete!
```

### Step 3: Check Backend Logs

In your backend terminal, you should now see incoming requests:

```
info: [GET] /api/v1/topics
info: Response: 200
```

## If Still Not Working

### Check 1: Backend Running?

```bash
# In backend terminal, you should see:
info: [app] Aloha, your app is ready on http://0.0.0.0:4000/api/v1
```

### Check 2: Same WiFi Network?

- Mac and iPhone/Android must be on the **same WiFi network**
- Check: System Settings → Network → WiFi on Mac
- Check: Settings → WiFi on mobile device

### Check 3: Firewall?

```bash
# Check Mac firewall:
# System Settings → Network → Firewall
# Should be OFF or allow Node.js
```

### Check 4: Correct IP Address?

```bash
# Get your Mac's current IP:
ipconfig getifaddr en0

# Update mobile/app.json if IP changed:
{
  "extra": {
    "apiUrl": "http://YOUR_MAC_IP:4000/api/v1"
  }
}
```

### Check 5: Port 4000 Accessible?

```bash
# Test from another terminal:
curl -H "x-api-key: local-dev-api-key" http://192.168.0.149:4000/api/v1/topics

# Should return JSON response
```

## Common Issues

### "Network Error"

**Cause**: Can't reach backend
**Solutions**:

1. Verify backend is running
2. Check IP address is correct
3. Ensure same WiFi network
4. Disable firewall temporarily

### "Request failed with status code 403"

**Cause**: Missing or wrong API key
**Solution**: Already fixed! Header now includes `x-api-key: local-dev-api-key`

### "Request failed with status code 401"

**Cause**: Invalid or missing auth token
**Solution**: Normal for unauthenticated endpoints. Login should work now.

### "Timeout"

**Cause**: Request takes too long
**Solution**: Already increased to 30s. Check backend performance.

## Testing Checklist

After restarting mobile app:

- [ ] See network info logs in Metro bundler
- [ ] See "Testing Backend Connection" message
- [ ] See ✅ checkmarks for connectivity tests
- [ ] Backend logs show incoming requests
- [ ] Can login/register from mobile app
- [ ] Can fetch topics list
- [ ] Audio upload works

## Quick Test Commands

```bash
# Terminal 1 - Backend
cd "micro-service-boilerplate-main 2"
npm start serve

# Terminal 2 - Mobile
cd mobile
npm start
# Press 'r' to reload

# Terminal 3 - Test backend directly
curl -H "x-api-key: local-dev-api-key" http://192.168.0.149:4000/api/v1/topics
```

## Need More Help?

If logs still show "Network Error":

1. **Screenshot the Metro bundler console** - shows detailed error
2. **Screenshot backend terminal** - shows if requests arrive
3. **Check both devices on same WiFi** - most common issue
4. **Try from Mac browser** - Visit `http://192.168.0.149:4000/api/v1/topics`
   - If this works, it's a mobile-specific issue
   - If this fails, it's a backend issue

---

**Current Configuration:**

- Backend IP: `192.168.0.149`
- Backend Port: `4000`
- API Key: `local-dev-api-key`
- Mobile App URL: `http://192.168.0.149:4000/api/v1`
