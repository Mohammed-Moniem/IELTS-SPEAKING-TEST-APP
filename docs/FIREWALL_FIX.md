# 🔥 FIREWALL BLOCKING ISSUE - SOLUTION

## Problem Identified

Your backend is running but **macOS Firewall is blocking incoming network connections** on port 4000.

**Evidence:**

- ✅ Backend running: `lsof -i :4000` shows Node.js listening
- ✅ Works on localhost: `curl http://localhost:4000` succeeds
- ❌ Blocked on network: `curl http://192.168.0.149:4000` fails with "No route to host"

## Solutions (Choose One)

### **Solution 1: Disable Firewall (Quickest)**

**Steps:**

1. Open **System Settings** (or System Preferences)
2. Click **Network**
3. Click **Firewall** in the sidebar
4. Turn Firewall **OFF**
5. Restart backend: `cd "micro-service-boilerplate-main 2" && npm start serve`
6. Test: Mobile app should now connect!

**Pros:** Quick, works immediately
**Cons:** Less secure (only do on trusted networks)

---

### **Solution 2: Allow Node.js Through Firewall (Recommended)**

**Option A - Use Script (Easiest):**

```bash
cd /Users/mohammedosman/Downloads/IELTS-SPEAKING-TEST-APP
sudo bash fix-firewall.sh
```

It will prompt for your Mac password, then automatically configure firewall.

**Option B - Manual Configuration:**

1. Open **System Settings** → **Network** → **Firewall** → **Options**
2. Click the **+** button
3. Navigate to Node.js binary:
   - Run: `which node` to find location (e.g., `/opt/homebrew/bin/node`)
   - Add that file
4. Ensure it's set to **Allow incoming connections**
5. Click **OK**

---

### **Solution 3: Use ngrok (For Testing)**

If firewall continues to block, use ngrok to tunnel:

```bash
# Install ngrok (if not installed)
brew install ngrok

# Start ngrok tunnel
ngrok http 4000

# Copy the HTTPS URL (e.g., https://abc123.ngrok.io)
# Update mobile/app.json:
{
  "extra": {
    "apiUrl": "https://abc123.ngrok.io/api/v1"
  }
}
```

**Pros:** Works with any firewall, gives you HTTPS
**Cons:** Requires ngrok account, adds latency

---

## Verification Steps

After applying a solution:

### 1. Test from Mac Terminal

```bash
curl -H "x-api-key: local-dev-api-key" http://192.168.0.149:4000/api/v1/topics
```

**Expected:** JSON response (even if 401 error, that means connection works!)
**Bad:** "No route to host" or "Connection refused"

### 2. Test from Mobile App

```bash
cd mobile
npm start
# Press 'r' to reload
```

**Expected in logs:**

```
✅ Basic connectivity OK
✅ Health check OK
✅ Backend connection test complete!
```

### 3. Test Login/Register

- Open mobile app
- Try to register new account
- Should succeed and see welcome screen

---

## Why This Happened

macOS Firewall blocks incoming connections by default. When you run:

- `http://localhost:4000` → Works (local only, no firewall check)
- `http://192.168.0.149:4000` → Blocked (network connection, firewall checks)

Your **mobile device is trying to connect over network**, so firewall blocks it.

---

## Quick Decision Tree

**Want fastest solution?**
→ **Solution 1**: Turn off firewall (5 seconds)

**Want to keep firewall on?**
→ **Solution 2**: Allow Node.js (2 minutes)

**Can't modify firewall?**
→ **Solution 3**: Use ngrok tunnel

---

## After Fixing

Once firewall is configured:

1. ✅ Backend stays accessible on network
2. ✅ Mobile app connects successfully
3. ✅ Can test on real devices
4. ✅ Other developers on same WiFi can connect

---

## Testing Checklist

- [ ] Backend running: `npm start serve` in backend folder
- [ ] Firewall configured (one of 3 solutions above)
- [ ] Test from terminal: `curl http://192.168.0.149:4000/api/v1/topics`
- [ ] See JSON response (not "No route to host")
- [ ] Restart mobile app
- [ ] See ✅ in mobile logs
- [ ] Backend logs show incoming requests
- [ ] Can login/register from mobile

---

## Need Help?

**Still seeing "No route to host"?**
→ Firewall still blocking. Try Solution 1 (turn off firewall completely)

**Seeing "Connection refused"?**
→ Backend not running. Start it: `npm start serve`

**Seeing "Network request failed"?**
→ Wrong IP or backend crashed. Check backend terminal for errors

**Seeing 401 Unauthorized?**
→ Connection works! That's an authentication error (expected for protected endpoints)

---

## Commands Summary

```bash
# Check if backend is running
lsof -i :4000

# Test backend from terminal (should return JSON)
curl -H "x-api-key: local-dev-api-key" http://192.168.0.149:4000/api/v1/topics

# Fix firewall (choose one)
sudo bash fix-firewall.sh                    # Automated script
# OR: System Settings → Network → Firewall → OFF

# Restart backend
cd "micro-service-boilerplate-main 2"
npm start serve

# Restart mobile
cd mobile
npm start
# Press 'r'
```

---

**TL;DR:**

1. Run `sudo bash fix-firewall.sh` OR turn off firewall in System Settings
2. Restart backend
3. Reload mobile app
4. Should now connect! 🎉
