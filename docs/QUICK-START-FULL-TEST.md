# 🚀 QUICK START - Test Your Full IELTS Speaking Test

## ⚡ 5-Minute Test Setup

### Step 1: Add Import (10 seconds)

Open `/mobile/src/screens/VoiceTest/VoiceTestScreen.tsx` and add this import at the top:

```typescript
import { FullTestScreen } from "../FullTest/FullTestScreen";
```

### Step 2: Update Mode Type (5 seconds)

Find this line:

```typescript
const [mode, setMode] = useState<"practice" | "simulation">("practice");
```

Change to:

```typescript
const [mode, setMode] = useState<"practice" | "simulation" | "full-test">(
  "practice"
);
```

### Step 3: Add Test Button (30 seconds)

In the render section, find where the buttons are (near "Start Practice") and add:

```typescript
<Button
  title="🧪 Test Full IELTS"
  onPress={() => {
    setMode("full-test");
    setShowVoiceUI(true);
  }}
  style={{ marginTop: spacing.md }}
/>
```

### Step 4: Add Render Logic (1 minute)

Find where `showVoiceUI` renders the VoiceConversation component. Update it to:

```typescript
{showVoiceUI && mode === "full-test" ? (
  <FullTestScreen
    onComplete={(results) => {
      console.log("✅ Full test complete!", results);
      Alert.alert(
        "Test Complete!",
        `You completed all 3 parts!\n\nPart 1: ${results.part1.recordings.length} responses\nPart 2: 1 response\nPart 3: ${results.part3.recordings.length} responses`,
        [{ text: "OK", onPress: () => setShowVoiceUI(false) }]
      );
    }}
    onExit={() => {
      console.log("❌ User exited test");
      setShowVoiceUI(false);
    }}
  />
) : showVoiceUI && mode === "practice" ? (
  // ... existing VoiceConversation component
) : showVoiceUI && mode === "simulation" ? (
  // ... existing SimulationMode component
) : null}
```

### Step 5: Test It! (2-3 minutes)

1. **Save all files**
2. **Reload the app** (shake device → Reload, or `r` in Metro)
3. **Tap "🧪 Test Full IELTS"**
4. **Turn volume UP** (to hear through loudspeakers)
5. **Listen and speak**:
   - Examiner introduces self → You respond
   - Examiner asks 4 questions → You answer each
   - Part 2 cue card → 1 min prep → 2 min speaking
   - Part 3 discussion → 3 questions

## ✅ What to Verify

### Audio Through Speakers

- [ ] You hear examiner voice through **phone speakers** (not earpiece)
- [ ] Audio is clear and loud enough

### No Button Tapping

- [ ] NO "Start Recording" button appears
- [ ] Recording starts automatically after examiner speaks
- [ ] You see "Speak now" prompt (fades after 2 sec)

### Automatic Flow

- [ ] After you speak, next question comes automatically
- [ ] No need to tap anything during test
- [ ] Natural conversation flow

### Timing

- [ ] Part 2 shows "1 minute to prepare" (60 sec countdown)
- [ ] Recording auto-stops when time's up
- [ ] Red dot + timer shows when recording

### Exit Protection

- [ ] Press back button → Shows warning
- [ ] Warning says test won't be evaluated
- [ ] Can cancel or confirm exit

### Complete Flow

- [ ] Part 1: 4 questions complete
- [ ] Part 2: Prep + speaking complete
- [ ] Part 3: 3 questions complete
- [ ] Final alert shows "Test Complete!"

## 🐛 Troubleshooting

### "Can't hear examiner"

- ✅ **Turn up volume** (use side buttons)
- ✅ Check if phone is on silent mode
- ✅ Check that you're not using Bluetooth headphones

### "Recording doesn't start"

- ✅ Grant microphone permission when prompted
- ✅ Wait 1-2 seconds after examiner finishes
- ✅ Look for "Speak now" prompt at top

### "App crashes"

- ✅ Check Metro bundler for errors
- ✅ Clear cache: `npx expo start -c`
- ✅ Check console logs

### "Questions don't load"

- ✅ Make sure backend is running
- ✅ Check ngrok URL is correct
- ✅ Check internet connection

## 📱 Testing Tips

1. **Use Real Phone**: Test on actual device, not simulator (for audio)
2. **Quiet Room**: Test in quiet space to hear clearly
3. **Full Volume**: Turn volume up to test loudspeaker
4. **Be Patient**: Wait for prompts, don't rush
5. **Complete Flow**: Go through all 3 parts to test fully

## 🎬 Expected Experience

```
1. Tap "Test Full IELTS"
   ↓
2. Screen shows "Welcome"
   Examiner: "Good morning, I'm your examiner..."
   ↓
3. Prompt appears: "Speak now"
   (You see red dot + timer when recording starts)
   ↓
4. You speak
   ↓
5. Recording auto-stops
   ↓
6. Examiner asks next question
   ↓
7. Repeat for Part 1 (4 questions)
   ↓
8. Part 2: Cue card + prep time
   ↓
9. Part 2: 2-minute speaking
   ↓
10. Part 3: Discussion questions (3)
    ↓
11. "Test Complete!" alert
```

## 🎯 Success =

- ✅ You complete all 3 parts without crashes
- ✅ You never tap a "record" button
- ✅ You hear examiner through phone speakers
- ✅ Flow feels natural and intuitive
- ✅ Timing auto-stops correctly
- ✅ Exit warning appears on back button

## 📊 After Testing

Check the console log (`console.log`) for the results object:

```javascript
{
  part1: {
    recordings: [uri, uri, uri, uri],  // 4 files
    questions: [...],
    duration: 300
  },
  part2: {
    recording: uri,  // 1 file
    topic: {...},
    duration: 180
  },
  part3: {
    recordings: [uri, uri, uri],  // 3 files
    questions: [...],
    duration: 240
  },
  totalDuration: 720,  // ~12 minutes
  completedAt: "2025-10-13T..."
}
```

This object will be sent to your backend for evaluation!

## 🚀 Ready?

1. Make the 4 code changes above
2. Reload the app
3. Tap "Test Full IELTS"
4. Experience the authentic test!

---

**Time to Complete**: ~5 minutes  
**Time to Test**: ~12-14 minutes (full test duration)  
**Expected Result**: Smooth, button-free, authentic IELTS experience! 🎉
