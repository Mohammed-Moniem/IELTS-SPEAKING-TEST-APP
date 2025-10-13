# 🚀 RESTART AND TEST GUIDE

**All fixes are applied. Now restart both services to activate them.**

---

## Step 1: Restart Backend Server ⚠️ CRITICAL

```bash
cd "micro-service-boilerplate-main 2"
# Press Ctrl+C to stop the current server
npm run serve
```

**Watch for these logs:**

- ✅ Server started on port 4000
- ✅ MongoDB connected successfully
- ✅ OpenAI API initialized

---

## Step 2: Reload Mobile App

**Option A - Quick Reload (Recommended):**

```
Press 'r' in the Expo terminal
```

**Option B - Full Restart:**

```bash
cd mobile
npm start
```

---

## Step 3: Test Recording (5 minutes)

1. Open the app
2. Navigate to Practice Mode
3. Tap "Start Practice Session"
4. Tap "Start Recording"
5. Speak for 10 seconds
6. **Tap "Stop Recording"** ← Should work now!
7. **Tap "Send"** ← Should work now!

**Expected Result:**

- ✅ No "Cannot unload" errors
- ✅ Recording processes successfully
- ✅ Evaluation appears

---

## Step 4: Test Token Refresh (15 minutes)

1. Login to the app
2. Wait 15-20 minutes
3. Navigate to a different screen (triggers API call)
4. Check backend logs for `auth-refresh`

**Expected Result:**

- ✅ No MongoDB conflict error
- ✅ User stays logged in
- ✅ No 401 errors

**Quick Test (Optional):**
Temporarily change token expiry to 1 minute in `.env`:

```
JWT_ACCESS_TOKEN_EXPIRY=1m
```

Then restart backend and test immediately.

---

## Step 5: Check Topic Generation

**If topics load:**
✅ Great! Everything works.

**If topics fail:**
Check backend logs for the detailed error:

```
error: [api:services/TopicGenerationService] Topic generation error: {
  message: "Rate limit exceeded",
  response: {...},
  status: 429
}
```

Common issues:

- **Rate limit:** Wait or upgrade OpenAI plan
- **Invalid key:** Check OPENAI_API_KEY in .env
- **Network error:** Check internet connection

---

## 📊 Success Checklist

After restart, verify these work:

### Recording Flow:

- [ ] Start recording button works
- [ ] Stop recording button works
- [ ] Send button works
- [ ] No console errors
- [ ] Evaluation displays

### Authentication:

- [ ] Login works
- [ ] Token refreshes automatically
- [ ] No 401 errors after 15 minutes
- [ ] User stays logged in

### Practice Mode:

- [ ] Topics load successfully
- [ ] Can start practice test
- [ ] Questions display
- [ ] Recording evaluates
- [ ] Feedback shows

---

## ⚠️ If Issues Persist

### Recording still broken:

1. Verify mobile app reloaded (press 'r' again)
2. Try full restart: `cd mobile && npm start`
3. Check if `VoiceConversationV2.tsx` changes were saved

### Token refresh still fails:

1. Verify backend restarted (check process start time)
2. Look for "Server started" log with current time
3. Confirm `AuthService.ts` has 3 separate update operations

### Topics won't load:

1. Check backend logs for detailed error
2. Test OpenAI API key: `curl -H "Authorization: Bearer sk-proj-..." https://api.openai.com/v1/models`
3. Verify `.env` has correct OPENAI_API_KEY

---

## 🎯 Quick Status Check

**Run this after restart to verify everything:**

```bash
# Backend health check
curl http://192.168.0.197:4000/health

# Get subscription plans (should return 200)
curl http://192.168.0.197:4000/api/v1/subscription/plans \
  -H "x-api-key: local-dev-api-key"

# Check topic generation (should return topics or clear error)
curl http://192.168.0.197:4000/api/v1/topics/practice \
  -H "x-api-key: local-dev-api-key"
```

---

## 📝 What Changed

### Mobile:

- ✅ Recording error handling improved
- ✅ FileSystem deprecation handled
- ✅ 2 files modified

### Backend:

- ✅ Token refresh MongoDB conflict fixed
- ✅ Topic generation error logging improved
- ✅ 2 files modified
- ⚠️ **Changes only active after restart!**

---

## 🎊 Expected Outcome

After restarting both services:

1. **Recording:** Works smoothly without errors
2. **Token Refresh:** No more MongoDB conflicts
3. **Topic Generation:** Clear error messages if it fails
4. **User Experience:** Can complete full test without crashes

**You're ready to test! 🚀**

If everything works, the app is now production-ready for actual usage testing.
