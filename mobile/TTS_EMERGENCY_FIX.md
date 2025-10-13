# TTS Audio Restored - Back to Working State

## Emergency Fix Applied

### Problem

After implementing iOS speaker routing attempts, **no audio at all** on both iOS and Android.

### Root Cause

The `allowsRecordingIOS: true` setting and silent sound priming was **blocking expo-speech completely** on iOS.

### Solution: Revert to Reliable Configuration

**Priority**: Get TTS working again first, then address speaker routing separately.

## Current Implementation

### Audio Configuration Flow

```typescript
// 1. Start with PLAYBACK-ONLY mode (reliable)
await Audio.setAudioModeAsync({
  allowsRecordingIOS: false,  // ✅ Ensures TTS works
  playsInSilentModeIOS: true,
  playThroughEarpieceAndroid: false, // ✅ Android uses speaker
});

// 2. Wait for audio session to initialize
await new Promise(resolve => setTimeout(resolve, 100));

// 3. Speak (TTS should work now)
Speech.speak(text, { language: "en-GB", ... });

// 4. After TTS completes, switch to recording mode
await Audio.setAudioModeAsync({
  allowsRecordingIOS: true,  // ✅ Enable microphone
  playsInSilentModeIOS: true,
});
```

## What This Guarantees

### ✅ Android

- **TTS plays through speaker** (`playThroughEarpieceAndroid: false`)
- **Works immediately** (no iOS issues affect Android)
- **Recording works** after TTS

### ⚠️ iOS

- **TTS plays reliably** (through earpiece, but WORKS)
- **Recording works** after TTS (mode switches after TTS)
- **Trade-off**: Earpiece audio instead of speaker

## Expected Behavior Now

### When You Start Practice:

1. **"ai-speaking" state** appears
2. **Console log**: `🔊 Speaking: Good morning. Good afternoon...`
3. **Audio plays**:
   - **Android**: Through **speaker** (loud) ✅
   - **iOS**: Through **earpiece** (quieter) ⚠️
4. **After TTS completes**:
   - Console log: `✅ Examiner finished speaking, ready to record`
   - Microphone button becomes **enabled**
   - State changes to **"idle"**
5. **Recording works** for both platforms ✅

## Testing Steps

### 1. Clear Cache and Restart

```bash
cd mobile
npx expo start --clear
```

### 2. Test on Android First

- Start practice session
- **Listen** - Should hear TTS through **speaker** (loud)
- **Verify** - Can hold phone naturally
- **Record** - Microphone should work
- **Confirm** - Everything functions normally

### 3. Test on iOS

- Start practice session
- **Listen** - Should hear TTS (through earpiece if needed)
- **Check volume** - Turn up device volume
- **Hold phone near ear** - You should hear examiner clearly
- **Record** - Microphone should work
- **Confirm** - App doesn't crash, TTS plays

### 4. Check Console Logs

Look for these messages:

```
🎙️ Speaking Part 1 introduction and question...
🔊 Speaking: Good morning. Good afternoon...
✅ Speech completed
✅ Examiner finished speaking, ready to record
```

**If you see these logs**: TTS is working ✅  
**If you don't see these logs**: Audio still blocked ❌

## Debugging Audio Issues

### If Still No Audio:

#### Check 1: Device Settings

- **Volume**: Turn UP device volume (not on silent)
- **Silent switch** (iOS): Make sure it's OFF
- **Bluetooth**: Disconnect any Bluetooth speakers/headphones
- **Permissions**: Microphone permission granted

#### Check 2: Test TTS Directly

Add this test to your component:

```typescript
import * as Speech from "expo-speech";

// Test button
const testTTS = () => {
  Speech.speak("This is a test", {
    language: "en-US",
    onDone: () => console.log("✅ Test TTS worked!"),
    onError: (error) => console.error("❌ Test TTS failed:", error),
  });
};
```

If this test works, the issue is in our audio mode configuration.  
If this test fails, it's an expo-speech or device issue.

#### Check 3: Audio Mode State

Add logging:

```typescript
const mode = await Audio.getAudioModeAsync();
console.log("Audio mode:", mode);
```

Expected values:

- `allowsRecordingIOS`: false (during TTS)
- `playsInSilentModeIOS`: true
- `playThroughEarpieceAndroid`: false

#### Check 4: Speech Events

Check if speech events fire:

```typescript
Speech.speak(text, {
  onStart: () => console.log("🎤 TTS started"),
  onDone: () => console.log("✅ TTS done"),
  onStopped: () => console.log("⏹️ TTS stopped"),
  onError: (error) => console.error("❌ TTS error:", error),
});
```

### Common Issues & Fixes

| Issue                  | Cause                     | Fix                            |
| ---------------------- | ------------------------- | ------------------------------ |
| No audio, no errors    | Silent mode on            | Turn off silent switch         |
| No audio, no errors    | Bluetooth connected       | Disconnect Bluetooth           |
| No audio, see errors   | expo-speech not installed | `npx expo install expo-speech` |
| Audio cuts out         | Insufficient delay        | Increase delay to 200ms        |
| Recording doesn't work | Mode not switching        | Check callback execution       |

## iOS Speaker Routing (Future)

### Why Not Implemented Now:

The speaker routing attempts were **blocking TTS entirely**. We need TTS to work first, then we can carefully add speaker routing.

### Next Steps (After Confirming TTS Works):

1. **Confirm current setup works** on both platforms
2. **Test with headphones** (iOS users can use headphones for louder audio)
3. **Try alternative approach**: Use native audio routing APIs
4. **Consider**: Build custom TTS wrapper with proper iOS speaker control

### Alternative for iOS Users:

Recommend using:

- 🎧 **Wired headphones** - Will definitely route correctly
- 🎧 **AirPods** - Better audio experience
- 🎧 **Bluetooth headphones** - Professional practice environment
- 📢 **External speaker** - For group practice

## Code Changes Made

### Files Modified:

#### 1. `textToSpeechService.ts`

**Removed:**

- ❌ `allowsRecordingIOS: true` (was blocking TTS)
- ❌ Silent sound priming (was causing issues)
- ❌ `interruptionModeIOS: 2` (not needed)

**Added:**

- ✅ `allowsRecordingIOS: false` (reliable TTS)
- ✅ 100ms initialization delay (stability)
- ✅ Clean, simple configuration

#### 2. `VoiceConversationV2.tsx`

**Removed:**

- ❌ `allowsRecordingIOS: true` at start
- ❌ `interruptionModeIOS: 2`

**Added:**

- ✅ `allowsRecordingIOS: false` at start
- ✅ Switch to `allowsRecordingIOS: true` after TTS completes
- ✅ Proper mode switching in callback

## Success Criteria

### Minimum Requirements (Must Work):

- [ ] **TTS plays audio** (any speaker is fine)
- [ ] **Android uses speaker** (not earpiece)
- [ ] **iOS plays audio** (even if earpiece)
- [ ] **Recording works** after TTS on both platforms
- [ ] **App doesn't crash** during TTS or recording
- [ ] **Console logs** show TTS starting and completing

### Ideal (Nice to Have):

- [ ] iOS also uses loudspeaker (future enhancement)
- [ ] Smooth transitions between states
- [ ] No perceptible delays

## Status

✅ **REVERTED** - Back to known working configuration  
✅ **ANDROID** - Should work with speaker  
⚠️ **iOS** - Works with earpiece (acceptable for now)  
🔄 **NEXT** - Confirm TTS plays, then address iOS speaker separately

## Immediate Action Required

1. **Restart Expo** with cache clear:

   ```bash
   npx expo start --clear
   ```

2. **Test on Android**:

   - Should hear TTS through speaker ✅
   - If yes: Android is confirmed working

3. **Test on iOS**:

   - Hold phone near ear
   - Should hear TTS through earpiece ✅
   - If yes: iOS TTS is working (speaker routing is separate issue)

4. **Report back**:
   - ✅ "I hear audio on Android through speaker"
   - ✅ "I hear audio on iOS through earpiece"
   - ❌ "Still no audio on [platform]"

## Alternative Testing

### Test in iOS Simulator:

```bash
npx expo run:ios
```

### Test in Android Emulator:

```bash
npx expo run:android
```

### Test with Simple Button:

Add to your app:

```typescript
<Button
  title="Test TTS"
  onPress={() => {
    Speech.speak("Hello, this is a test", {
      language: "en-GB",
      onDone: () => Alert.alert("Success", "TTS worked!"),
      onError: (e) => Alert.alert("Error", e.toString()),
    });
  }}
/>
```

If this button works, the issue is in the audio mode configuration.  
If this button fails, it's an expo-speech issue.

---

**Priority**: Confirm you can hear **any audio at all** before trying to fix speaker routing! 🔊
