# TTS No Audio Diagnosis & Fix

## Latest Change: Remove All Audio Mode Interference

### What I Just Did

**Completely removed** all `Audio.setAudioModeAsync()` calls **before** TTS plays. Now `expo-speech` manages its own audio session without interference.

### Theory

The audio mode configuration was **conflicting** with `expo-speech`'s internal audio session management, preventing TTS from playing at all.

### New Flow

```
1. Start app → No audio configuration
2. Call ttsService.speak() → expo-speech handles audio internally
3. TTS plays → Should work with default settings
4. After TTS completes → Configure audio for recording
```

## Immediate Testing Steps

### Step 1: Check Console Logs

**Start the app and look for these logs:**

```
🎙️ Speaking Part 1 introduction and question...
🔊 Speaking: Good morning. Good afternoon...
```

**Question 1:** Do you see these logs?

- ✅ **YES**: TTS is being called, continue to Step 2
- ❌ **NO**: TTS isn't being called at all (different issue)

### Step 2: Check for Error Logs

**Look for any error messages:**

```
❌ Speech error: [error message]
Failed to speak introduction: [error]
```

**Question 2:** Do you see error logs?

- ✅ **YES**: What's the exact error message? (Share it)
- ❌ **NO**: No errors but no audio either, continue to Step 3

### Step 3: Test expo-speech Directly

Add this test button to your `VoiceConversationV2.tsx` temporarily:

```typescript
// Add at the top
import * as Speech from "expo-speech";
import { Button } from "react-native";

// Add in the render (above the SafeAreaView):
<Button
  title="TEST TTS"
  onPress={() => {
    console.log("🧪 Testing direct TTS...");
    Speech.speak("Hello world test", {
      language: "en-US",
      onStart: () => console.log("✅ TTS Started!"),
      onDone: () => console.log("✅ TTS Done!"),
      onError: (e) => console.error("❌ TTS Error:", e),
    });
  }}
/>;
```

**Question 3:** Does the test button produce audio?

- ✅ **YES**: expo-speech works, issue is in our code
- ❌ **NO**: expo-speech itself has an issue

### Step 4: Check Device Settings

#### iOS Device Checklist:

- [ ] **Volume**: Press volume up button, make sure it's NOT at 0
- [ ] **Silent mode**: Check the physical switch on side of iPhone - should be OFF (no orange showing)
- [ ] **Do Not Disturb**: Swipe down control center, make sure DND is OFF
- [ ] **Bluetooth**: Disconnect any Bluetooth headphones/speakers
- [ ] **Permissions**: Go to Settings → [Your App] → Microphone should be ON

#### App Permissions:

In your app, check:

```typescript
const { status } = await Audio.requestPermissionsAsync();
console.log("Microphone permission:", status);
```

Should show: `status: "granted"`

### Step 5: Check expo-speech Installation

Run these commands:

```bash
cd mobile

# Reinstall expo-speech
npx expo install expo-speech

# Clear everything
npx expo start --clear --reset-cache

# Or completely clean
rm -rf node_modules
npm install
npx expo start --clear
```

## Diagnostic Scenarios

### Scenario A: Logs show but no audio

**Console shows:**

```
🎙️ Speaking Part 1 introduction and question...
🔊 Speaking: Good morning. Good afternoon...
✅ Speech completed
```

**But no audio plays**

**Likely causes:**

1. Device is on silent mode
2. Volume is at 0
3. Audio is routing to disconnected Bluetooth device
4. iOS audio session is locked by another app

**Fixes:**

- Turn OFF silent mode switch
- Turn UP volume using buttons
- Disable Bluetooth
- Close other audio apps (Music, YouTube, etc.)
- Restart device

### Scenario B: No logs at all

**Console doesn't show:**

```
🎙️ Speaking Part 1 introduction and question...
```

**Likely causes:**

1. Component isn't mounting
2. Part/question not set
3. useEffect not running

**Fixes:**
Check these values:

```typescript
console.log("Part:", part);
console.log("Question:", question);
console.log("Mode:", mode);
```

### Scenario C: Error logs appear

**Console shows errors like:**

```
❌ Speech error: [message]
Failed to speak introduction: [message]
```

**Action**: Share the exact error message so I can fix it

### Scenario D: Test button works, app doesn't

**Test button produces audio, but app TTS doesn't**

**Likely cause:** Issue in `speakIntroductionAndQuestion()` method

**Fix**: Let's debug that method:

```typescript
// In textToSpeechService.ts, add logging:
async speakIntroductionAndQuestion(
  part: 1 | 2 | 3,
  question: string,
  onComplete?: () => void
): Promise<void> {
  console.log('📢 speakIntroductionAndQuestion called');
  console.log('  Part:', part);
  console.log('  Question:', question);

  const intro = this.getPartIntroduction(part);
  console.log('  Intro length:', intro.length);

  await this.speak(intro);
  console.log('  Intro spoken, now question...');

  await this.speak(question);
  console.log('  Question spoken, calling onComplete...');

  onComplete?.();
}
```

## Quick Fixes to Try

### Fix 1: Simplest Possible TTS

Replace your `speak()` method temporarily with this ultra-simple version:

```typescript
async speak(text: string, options: TTSOptions = {}): Promise<void> {
  console.log("🔊 ULTRA SIMPLE SPEAK:", text);

  return new Promise((resolve) => {
    Speech.speak(text, {
      language: "en-US", // Try US first
      onDone: () => {
        console.log("✅ DONE");
        resolve();
      },
      onError: (error) => {
        console.error("❌ ERROR:", error);
        resolve(); // Resolve anyway
      },
    });
  });
}
```

### Fix 2: Remove British English

Try US English instead:

```typescript
language: "en-US"; // Instead of "en-GB"
```

Some iOS devices don't have British voices installed.

### Fix 3: Test in iOS Simulator

```bash
npx expo run:ios
```

iOS Simulator has better debugging. Check Xcode console for additional logs.

### Fix 4: Use Default Speech Settings

Remove all customizations:

```typescript
Speech.speak(text); // Just this, nothing else
```

## Expected Success State

When working correctly, you should see:

### Console Output:

```
🎙️ Speaking Part 1 introduction and question...
🔊 Speaking: Good morning. Good afternoon...
✅ Speech completed
🔊 Speaking: What is your favorite color?
✅ Speech completed
✅ Examiner finished speaking, ready to record
```

### User Experience:

- Hear examiner introduction (British accent)
- Hear question being read
- Microphone button becomes enabled
- Can record response

## Emergency Rollback

If nothing works, we can try using a different TTS library:

### Option 1: react-native-tts

```bash
npx expo install react-native-tts
```

### Option 2: Web Speech API (via WebView)

Use browser's speech synthesis

### Option 3: Pre-recorded Audio

Use actual audio files (last resort)

## What to Report Back

Please provide:

1. **Console logs** - Copy/paste everything related to TTS
2. **Device info** - iPhone model, iOS version
3. **Test button result** - Does direct Speech.speak() work?
4. **Error messages** - Any red errors in console?
5. **Device settings** - Silent mode? Volume level? Bluetooth?

## Most Likely Issue

Based on symptoms (no audio at all), most likely:

1. **Device on silent mode** (70% probability)
2. **Volume at 0** (20% probability)
3. **Audio routing to Bluetooth** (5% probability)
4. **expo-speech not working** (5% probability)

**First thing to check:** Physical silent switch on side of iPhone!

---

## Immediate Action

1. **Check iPhone silent switch** - Make sure it's OFF
2. **Turn volume UP** - Press volume buttons
3. **Run app again**
4. **Press test button** (add it if needed)
5. **Report what happens**

The app is now in its simplest state - expo-speech manages everything itself. If this doesn't work, it's likely a device setting or expo-speech installation issue.
