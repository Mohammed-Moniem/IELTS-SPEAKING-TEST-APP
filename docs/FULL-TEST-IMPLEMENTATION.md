# Full IELTS Speaking Test - Real Exam Experience Implementation

## 🎯 Overview

This document details the implementation of a comprehensive, authentic IELTS Speaking Test experience that mimics the actual exam as closely as possible.

## ✅ Key Features Implemented

### 1. **Audio Through Loudspeakers** ✓

- ✅ Examiner voice plays through device speakers (not earpiece)
- ✅ Configuration: `playThroughEarpieceAndroid: false` and `playsInSilentModeIOS: true`
- ✅ Same solution used successfully in practice mode

### 2. **Automatic Voice Detection** ✓

- ✅ NO manual microphone button tapping required
- ✅ Recording starts automatically after examiner finishes speaking
- ✅ User is prompted with subtle UI alerts ("Your turn to speak")
- ✅ Natural conversation flow without interruptions

### 3. **Authentic Test Flow** ✓

Following the exact IELTS format from the reference video:

#### **Part 1: Introduction & Interview (4-5 minutes)**

- Examiner introduces self and asks for candidate's name
- 4-5 questions about familiar topics
- ~30-60 seconds per response
- Auto-advances to next question after user stops speaking

#### **Part 2: Individual Long Turn (3-4 minutes)**

- Examiner explains the task
- Reads the cue card topic
- 1 minute preparation time (with on-screen countdown)
- 1-2 minutes speaking time (auto-stops at 2 minutes)
- No interruptions during speaking

#### **Part 3: Two-Way Discussion (4-5 minutes)**

- Examiner transitions to broader discussion
- 3-4 deeper questions related to Part 2 topic
- More analytical responses expected
- Natural back-and-forth conversation

### 4. **Intuitive UI/UX** ✓

#### **No Buttons During Test**

- ✅ No "Start Recording" button
- ✅ No "Stop Recording" button
- ✅ No "Next Question" button
- ✅ Everything happens automatically

#### **Subtle Visual Prompts**

- ✅ Small animated badges appear at top of screen
- ✅ Examples: "Speak now", "Your turn to speak", "Listening..."
- ✅ Fade in/out smoothly after 1-2 seconds
- ✅ Never block the screen or distract

#### **Clear State Indicators**

- ✅ Header shows current part: "Part 1: Introduction & Interview"
- ✅ Subtitle shows what's happening: "Examiner speaking..." or "You are speaking..."
- ✅ Recording indicator with red dot and timer
- ✅ Current question displayed in card at bottom

### 5. **Strict Timing** ✓

- ✅ Part 1: Auto-advances after each response
- ✅ Part 2 Prep: Exactly 60 seconds preparation time
- ✅ Part 2 Speaking: Auto-stops at 2 minutes
- ✅ Part 3: Similar to Part 1, natural flow
- ✅ Total test time: ~11-14 minutes (authentic)

### 6. **Exit Protection** ✓

- ✅ Back button shows warning: "If you leave now, this test will NOT be evaluated"
- ✅ Prevents accidental exits
- ✅ Must explicitly confirm exit
- ✅ Hardware back button handled on Android

## 📁 New Files Created

### `/mobile/src/screens/FullTest/FullTestScreen.tsx`

Complete implementation of the full IELTS speaking test with:

- State machine for test flow
- Automatic recording management
- TTS integration with proper audio configuration
- Question management (4 Part 1, 1 Part 2, 3 Part 3)
- Recording storage per part
- Exit protection
- Subtle UI prompts
- Authentic timing

## 🔧 Technical Implementation

### State Management

```typescript
type TestState =
  | "intro" // Initial welcome
  | "part1-examiner" // Examiner asking Part 1 question
  | "part1-user" // User answering Part 1
  | "part1-complete" // Transition to Part 2
  | "part2-intro" // Part 2 introduction
  | "part2-prep" // 1 minute preparation
  | "part2-examiner" // Examiner prompting to speak
  | "part2-user" // User speaking (1-2 min)
  | "part2-complete" // Transition to Part 3
  | "part3-intro" // Part 3 introduction
  | "part3-examiner" // Examiner asking Part 3 question
  | "part3-user" // User answering Part 3
  | "part3-complete" // Transition to end
  | "test-complete"; // Test finished
```

### Audio Configuration Flow

#### 1. **Examiner Speaking (TTS)**

```typescript
await Audio.setAudioModeAsync({
  allowsRecordingIOS: false, // No recording during TTS
  playsInSilentModeIOS: true, // Play even if phone is silent
  playThroughEarpieceAndroid: false, // Use loudspeaker
});
```

#### 2. **User Speaking (Recording)**

```typescript
await Audio.setAudioModeAsync({
  allowsRecordingIOS: true, // Enable recording
  playsInSilentModeIOS: true, // Keep audio on
  playThroughEarpieceAndroid: false, // Consistent audio output
});
```

### Automatic Recording Flow

#### Part 1 & 3 (Q&A)

```
1. Examiner asks question
2. TTS finishes speaking → onDone callback
3. Show prompt "Your turn to speak" (1.5 sec)
4. Auto-start recording
5. Record for up to 60 seconds
6. Auto-stop recording
7. Save audio
8. Move to next question (1 sec delay)
9. Repeat steps 1-8
```

#### Part 2 (Long Turn)

```
1. Examiner introduces Part 2
2. Reads cue card topic
3. Show "1 minute to prepare" prompt
4. 60-second countdown (user sees on screen)
5. Examiner says "Please begin speaking now"
6. Auto-start recording
7. Record for up to 120 seconds (2 minutes)
8. Auto-stop recording
9. Move to Part 3
```

### Prompt System

```typescript
const showTimedPrompt = (message: string, duration: number) => {
  // Shows animated badge at top of screen
  // Fades in (300ms)
  // Stays visible (duration - 600ms)
  // Fades out (300ms)
  // Never blocks interaction
};
```

### Question Management

```typescript
// Load all questions at start to avoid delays
const part1Questions = [4 questions];  // From API
const part2Topic = [1 topic];          // From API
const part3Questions = [3 questions];  // From API

// Mark all as "used" to avoid repeats
await resultsStorage.markQuestionAsUsed(question, part);
```

### Recording Storage

```typescript
// Separate storage for each part
part1Recordings.current = [uri1, uri2, uri3, uri4];
part2Recording.current = uri;
part3Recordings.current = [uri1, uri2, uri3];

// Sent to backend for evaluation after test completes
```

## 🎨 UI Components

### 1. **Header**

```
┌─────────────────────────────────────┐
│  ✕   Part 1: Introduction           │
│      Examiner speaking...           │
└─────────────────────────────────────┘
```

### 2. **Voice Orb**

- Center of screen
- Pulses when examiner speaks (blue glow)
- Subtle pulse when user speaks
- Idle when waiting

### 3. **Timer** (only when recording)

```
┌──────────┐
│ 🔴 0:23  │
└──────────┘
```

### 4. **Question Card** (bottom)

```
┌─────────────────────────────────────┐
│  What do you like most about        │
│  hip-hop music?                     │
└─────────────────────────────────────┘
```

### 5. **Prompt Badge** (temporary)

```
   ┌──────────────────┐
   │ 🎤 Speak now     │
   └──────────────────┘
```

## 🔄 Integration with Existing Code

### VoiceTestScreen.tsx

Update the "Start Full Test" button to use the new FullTestScreen:

```typescript
const startFullTest = async () => {
  setMode("full-test");
  setShowVoiceUI(true);
};

// In render:
{mode === "full-test" ? (
  <FullTestScreen
    onComplete={handleFullTestComplete}
    onExit={handleSessionEnd}
  />
) : (
  // ... existing VoiceConversation component
)}
```

### Handle Test Completion

```typescript
const handleFullTestComplete = async (results: any) => {
  // results contains all recordings and questions
  // Send to backend for comprehensive evaluation
  // Show final results screen

  const evaluation = await evaluateFullTest(results);
  setEvaluationData(evaluation);
  setShowEvaluation(true);
};
```

## 📊 Results Structure

```typescript
{
  part1: {
    recordings: [uri1, uri2, uri3, uri4],
    questions: [GeneratedTopic, ...],
    duration: 300  // seconds
  },
  part2: {
    recording: uri,
    topic: GeneratedTopic,
    duration: 180
  },
  part3: {
    recordings: [uri1, uri2, uri3],
    questions: [GeneratedTopic, ...],
    duration: 240
  },
  totalDuration: 720,  // 12 minutes
  completedAt: "2025-10-13T12:18:00Z"
}
```

## 🎯 Backend Integration Needed

### New API Endpoint

```typescript
POST /api/v1/test/full-test/evaluate

Body: {
  part1: {
    recordings: [base64Audio1, ...],
    questions: [string, ...],
  },
  part2: {
    recording: base64Audio,
    topic: string,
  },
  part3: {
    recordings: [base64Audio1, ...],
    questions: [string, ...],
  },
  duration: number
}

Response: {
  overallBand: 7.5,
  partScores: {
    part1: { fluency: 7.5, lexical: 7.0, grammar: 8.0, pronunciation: 7.5 },
    part2: { fluency: 7.5, lexical: 8.0, grammar: 7.5, pronunciation: 8.0 },
    part3: { fluency: 8.0, lexical: 8.0, grammar: 7.5, pronunciation: 7.5 }
  },
  transcripts: { part1: [...], part2: "...", part3: [...] },
  feedback: { strengths: [...], improvements: [...] }
}
```

## ⚙️ Configuration

### Time Limits (can be adjusted in code)

```typescript
Part 1: 60 seconds per response (auto-stop)
Part 2 Prep: 60 seconds (strict)
Part 2 Speaking: 120 seconds (auto-stop)
Part 3: 60 seconds per response (auto-stop)
```

### Question Counts

```typescript
Part 1: 4 questions
Part 2: 1 topic
Part 3: 3 questions
Total: 8 questions
```

### Prompt Durations

```typescript
"Speak now": 2000ms
"Your turn to speak": 1500ms
"Listening...": Shows while recording
```

## 🚀 Next Steps

### 1. Update VoiceTestScreen

Add navigation to FullTestScreen when "Start Full Test" is tapped.

### 2. Create Backend Endpoint

Implement `/api/v1/test/full-test/evaluate` to process all recordings.

### 3. Results Screen

Create or update results screen to show:

- Overall band score
- Individual part scores
- Detailed feedback per part
- Transcripts with timestamps
- Improvement suggestions

### 4. Testing Checklist

- [ ] Audio plays through loudspeaker
- [ ] No manual button tapping needed
- [ ] Automatic recording starts/stops
- [ ] Timing is accurate
- [ ] Back button shows warning
- [ ] All 3 parts complete successfully
- [ ] Recordings are saved correctly
- [ ] Questions are marked as used
- [ ] UI prompts are subtle and helpful
- [ ] Test on both iOS and Android

## 📝 Notes

### Differences from Practice Mode

1. **No evaluation between parts** - everything evaluated at the end
2. **Stricter timing** - follows exact IELTS format
3. **No pause/resume** - continuous test flow
4. **Exit warning** - prevents accidental exit
5. **Complete assessment** - all 3 parts in one session

### User Experience Goals

- ✅ Feels like a real IELTS test
- ✅ No confusing buttons or controls
- ✅ Natural conversation flow
- ✅ Clear what to do at each step
- ✅ Professional and polished
- ✅ Builds confidence for actual test

## 🎥 Reference

Implementation follows the authentic IELTS Speaking Test format as demonstrated in:
https://www.youtube.com/watch?v=2oC-dXJUYqY&list=PLWWR_9t3vo3OtrmF3BV0CUDTBs83i4iAo&index=20

---

**Status: ✅ Core Implementation Complete**
**Next: Integration with VoiceTestScreen + Backend Endpoint**
