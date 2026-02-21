# 🔍 Debugging the Authentic Test Issues

## Issues You Reported

1. ✅ **Test takes a lot of time to start** - FIXED with loading indicators
2. ❌ **Examiner doesn't actually ask questions** - Questions appear but no voice
3. ❌ **Part 1 ends immediately** - Test stops after Part 1
4. ❌ **Cannot proceed further** - Test stuck after Part 1

## What I Added

### Better Loading Feedback

- Loading screen now shows specific messages:
  - "Requesting microphone permission..."
  - "Loading test questions..."
  - "Loading Part 2 cue card..."
  - "Loading Part 3 discussion questions..."
  - "Starting test..."

### Better Error Handling

- Added detailed console logs for debugging
- Added error alerts if TTS fails
- Added retry/skip options
- Added timeout handling

### Console Logs to Watch

When you start the test, you should see these logs in Metro bundler:

```
🎯 Initializing full IELTS test...
✅ Questions loaded successfully
🎬 Starting introduction...
✅ Audio mode configured
🗣️ About to speak welcome message...
🔊 Speaking: Good morning. Good afternoon. I'm your examiner...
```

**If TTS is working**, you'll see:

```
✅ Welcome message completed
📝 Part 1 Question 1/4
🗣️ Asking: Could you tell me what hobbies you enjoy?...
✅ Question spoken, starting recording countdown...
🎤 Starting recording (max 60s)...
```

**If TTS fails**, you'll see:

```
❌ TTS Error: [error details]
```

## Possible Root Causes

### Issue: Examiner Not Speaking

**Cause 1: Backend/ElevenLabs API Timeout**

- TTS service calls backend → backend calls ElevenLabs API
- If slow/timeout → No audio plays
- **Check**: Look for `❌ Speech synthesis error` in console

**Cause 2: Audio Configuration Issue**

- Audio mode not configured properly
- **Check**: Look for `✅ Audio mode configured` in console

**Cause 3: Network Issues**

- Ngrok tunnel might be slow or disconnected
- **Check**: Test backend is accessible: https://ce4be704c8b6.ngrok-free.app/api/v1

### Issue: Part 1 Ends Immediately

**Likely Cause**: If TTS never calls `onDone` callback

- Question text shows on screen (state updates)
- But TTS never actually plays
- So `onDone` never fires
- Recording never starts
- After showing all 4 questions rapidly, Part 1 "completes"

## How to Debug

### Step 1: Check Console Logs

Open Metro bundler terminal and look for:

1. **TTS Logs**:

   ```
   🔊 Speaking: [text]
   ✅ Speech completed
   ```

2. **Error Logs**:

   ```
   ❌ TTS Error: [details]
   ❌ Speech synthesis error: [details]
   ```

3. **Recording Logs**:
   ```
   🎤 Starting recording (max 60s)...
   ⏹️ Stopping recording...
   ✅ Recording saved: file:///...
   ```

### Step 2: Test Backend Manually

Check if TTS endpoint is working:

```bash
# Terminal
curl -X POST https://ce4be704c8b6.ngrok-free.app/api/v1/speech/synthesize \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello, this is a test","speed":1.0}'
```

**Expected**: Should return JSON with `audioBase64` field
**If fails**: Backend or ElevenLabs API issue

### Step 3: Check Ngrok

```bash
# Check if ngrok is running
curl https://ce4be704c8b6.ngrok-free.app/api/v1/health
```

**Expected**: Should return health check response
**If fails**: Restart ngrok with `./start-dev-multi-terminal.sh`

## Quick Fixes to Try

### Fix 1: Use Fallback TTS (Expo Speech)

If backend TTS is failing, we can use Expo's built-in TTS temporarily:

Edit `/mobile/src/services/textToSpeechService.ts` and add fallback:

```typescript
// In getAudioDataUri method, add this at the catch block:
catch (error) {
  console.warn("Backend TTS failed, using fallback...");
  // Use expo-speech as fallback
  return this.useFallbackTTS(text);
}
```

### Fix 2: Increase Timeout

If backend is just slow, increase timeout in API client:

Edit `/mobile/src/api/client.ts`:

```typescript
timeout: 30000, // Increase from default to 30 seconds
```

### Fix 3: Test Without TTS

Temporarily disable TTS to test recording flow:

In `AuthenticFullTest.tsx`, comment out TTS and call `onDone` immediately:

```typescript
// await ttsService.speak(question.question, {
//   onDone: async () => {
console.log("⚠️ TTS DISABLED FOR TESTING");
setTimeout(async () => {
  // Start recording logic...
}, 1000);
// });
```

## What to Report Back

Please share:

1. **Console logs** - Copy the full Metro bundler output when starting test
2. **Which logs appear** - Do you see TTS logs? Error logs?
3. **Backend test result** - Does the curl command work?
4. **How long it takes** - How many seconds between "Starting test" and when questions appear?

## Next Steps Based on Findings

### If Backend TTS is timing out:

→ Add fallback to Expo Speech
→ Or increase timeout
→ Or optimize backend ElevenLabs calls

### If Audio not playing:

→ Check audio permissions
→ Check audio mode configuration
→ Test with simpler audio file

### If Recording not starting:

→ Test recording separately
→ Check if `onDone` callback is firing

---

**Let me know what you see in the console logs and I'll fix it immediately!** 🚀
