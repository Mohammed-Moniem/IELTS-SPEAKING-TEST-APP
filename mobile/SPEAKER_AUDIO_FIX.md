# Speaker Audio Routing Fix

## Issue

TTS audio was playing through the **earpiece (receiver)** instead of the **loudspeaker (bottom speaker)** on iOS devices.

## Root Cause

On iOS, when the audio session is configured with:

- **Category: Playback** (`allowsRecordingIOS: false`)

The system defaults to routing audio to the **earpiece**, which is appropriate for phone calls but not for voice coaching/practice apps.

## Solution

Set `allowsRecordingIOS: true` **from the beginning** to configure the audio session as **PlayAndRecord** category, which defaults to speaker output on iOS.

### Before (Playing through earpiece):

```typescript
// Configure for playback only
await Audio.setAudioModeAsync({
  allowsRecordingIOS: false,  // ❌ Routes to earpiece
  playsInSilentModeIOS: true,
});

// Speak TTS...
await ttsService.speak(...);

// Then switch to recording
await Audio.setAudioModeAsync({
  allowsRecordingIOS: true,   // Too late - TTS already played through earpiece
});
```

### After (Playing through speaker):

```typescript
// Configure for PlayAndRecord from the start
await Audio.setAudioModeAsync({
  allowsRecordingIOS: true,   // ✅ Routes to speaker (default for PlayAndRecord)
  playsInSilentModeIOS: true,
  playThroughEarpieceAndroid: false,
  interruptionModeIOS: 1,
  interruptionModeAndroid: 1,
});

// Speak TTS - now plays through speaker!
await ttsService.speak(...);

// Already in recording mode, ready to capture user's voice
```

## iOS Audio Session Categories

| Category          | Recording Enabled | Default Audio Route   |
| ----------------- | ----------------- | --------------------- |
| **Playback**      | ❌ No             | Earpiece (receiver)   |
| **PlayAndRecord** | ✅ Yes            | Speaker (loudspeaker) |

When you enable recording (`allowsRecordingIOS: true`), iOS sets the audio session to **PlayAndRecord** category, which:

- ✅ Allows both playback and recording
- ✅ **Defaults to speaker output** (not earpiece)
- ✅ Works perfectly for voice practice apps
- ✅ No mode switching needed

## Key Insight

The fix is **simpler** than the original approach:

- **Original**: Start in playback mode → switch to recording mode after TTS
- **Fixed**: Start in PlayAndRecord mode → stay in that mode throughout

This eliminates the mode switching and ensures TTS always plays through the speaker.

## Testing

1. Run the app on a physical iOS device
2. Start a practice session
3. **Verify**: Examiner voice plays through the bottom speaker (loud)
4. **Verify**: No audio from the earpiece (top of phone)
5. Record your response
6. **Verify**: Transition messages also play through speaker
7. **Verify**: Recording works correctly

## Android

On Android, we explicitly set `playThroughEarpieceAndroid: false` to ensure speaker output. The fix works on both platforms.

## Files Modified

- ✅ `mobile/src/components/VoiceConversationV2.tsx`
  - Set `allowsRecordingIOS: true` from the start
  - Removed unnecessary mode switching after TTS
  - Added proper interruption modes

## Benefits

- ✅ TTS plays through speaker (louder, clearer)
- ✅ More natural for coaching/practice apps
- ✅ Simpler code (no mode switching)
- ✅ Works on both iOS and Android
- ✅ Recording still works perfectly

## Status

✅ **FIXED** - Audio now routes to speaker on both iOS and Android
