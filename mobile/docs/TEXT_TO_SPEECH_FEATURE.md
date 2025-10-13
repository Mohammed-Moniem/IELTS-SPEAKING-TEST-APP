# Text-to-Speech (TTS) Feature - IELTS Speaking Test

## Overview

The app now includes a realistic Text-to-Speech feature that simulates a real IELTS examiner speaking to the user. This creates an authentic test experience.

## Features Implemented

### 1. **Examiner Voice**

- Natural-sounding voice using Expo Speech API
- British/American English accent
- Slightly slower rate (0.85x) for clarity

### 2. **Part-Specific Introductions**

#### Part 1: Introduction & Interview

> "Good morning. Good afternoon. I'm your examiner for today's IELTS Speaking test. In this part, I'd like to ask you some general questions about yourself and a range of familiar topics. Let's begin."

#### Part 2: Individual Long Turn

> "Now, I'm going to give you a topic and I'd like you to talk about it for one to two minutes. Before you talk, you'll have one minute to think about what you're going to say. You can make some notes if you wish. Here is your topic."

#### Part 3: Two-way Discussion

> "We've been talking about your topic, and I'd like to discuss some more general questions related to this. Let's consider some broader issues."

### 3. **Automatic Flow**

1. User selects a part (1, 2, or 3)
2. Screen opens with voice orb
3. **Examiner speaks introduction** (TTS)
4. Short pause (1 second)
5. **Examiner asks the question** (TTS)
6. User can now tap mic to record their answer

### 4. **Visual Indicators**

- **"Examiner Speaking..."** state message
- **Voice orb** pulses when examiner is speaking
- **"Please listen to the examiner..."** indicator with speaker icon
- **Microphone disabled** while examiner is speaking
- **Timer starts** only when user starts recording

### 5. **User Experience**

- Feels like a real IELTS test
- Professional examiner tone
- Clear instructions
- Natural pacing
- No rush to respond

## Technical Implementation

### Files Modified:

1. **`textToSpeechService.ts`** (NEW)

   - TTS service with expo-speech
   - Part-specific introductions
   - Natural voice configuration
   - Automatic question reading

2. **`VoiceConversationV2.tsx`** (UPDATED)
   - Added TTS integration
   - State management for "ai-speaking"
   - Visual indicators
   - Automatic flow on mount

### API Used:

- `expo-speech` - Native text-to-speech

### Key Functions:

```typescript
// Speak introduction and question
await ttsService.speakIntroductionAndQuestion(part, question, onComplete);

// Stop speech
await ttsService.stop();

// Check if speaking
ttsService.getIsSpeaking();
```

## User Flow

### Before (Without TTS):

1. User opens test
2. Sees question on screen
3. Taps mic immediately
4. Records answer

### After (With TTS):

1. User opens test
2. **Hears examiner introduction** 🔊
3. **Hears the question** 🔊
4. Sees "Please listen..." indicator
5. Mic becomes available
6. User taps mic when ready
7. Records answer

## Testing

### Test Cases:

1. ✅ Part 1 introduction sounds natural
2. ✅ Part 2 introduction includes prep time mention
3. ✅ Part 3 introduction mentions discussion
4. ✅ Question is spoken clearly after introduction
5. ✅ Mic is disabled during speech
6. ✅ Voice orb pulses during speech
7. ✅ User can start recording after speech ends

### Edge Cases Handled:

- TTS fails → Falls back to idle state
- User closes screen → TTS stops automatically
- Multiple quick opens → Previous TTS stops first

## Configuration

### Voice Settings (in textToSpeechService.ts):

```typescript
rate: 0.85,  // Slightly slower for clarity
pitch: 1.0,  // Natural pitch
language: "en-US"  // American English (can be changed to "en-GB")
```

### Customization:

- Modify `getPartIntroduction()` to change examiner scripts
- Adjust `rate` for faster/slower speech
- Change `language` for different accents

## Future Enhancements

### Possible Improvements:

1. **Voice Selection**: Let users choose examiner voice (male/female)
2. **Accent Selection**: British vs American English
3. **Follow-up Questions**: TTS for Part 2/3 follow-ups
4. **Feedback Audio**: Spoken band score at end
5. **Pronunciation Tips**: Audio examples of corrections
6. **Multi-language**: Support for other test takers

## Known Limitations

- Requires device with TTS support
- Voice quality depends on device
- May have slight latency on older devices
- Network not required (works offline)

## Accessibility

- Helps visual impairments
- Provides audio feedback
- Creates realistic test environment
- Reduces reading pressure

---

**Implementation Date**: October 12, 2025  
**Version**: 1.0.0  
**Dependencies**: expo-speech
