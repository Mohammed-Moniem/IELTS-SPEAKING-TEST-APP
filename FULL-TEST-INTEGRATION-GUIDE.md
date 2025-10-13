# Quick Integration Guide - Full Test Screen

## 🎯 Goal

Integrate the new FullTestScreen into the existing VoiceTestScreen to enable authentic full IELTS speaking tests.

## 📝 Changes Required

### 1. Import the FullTestScreen Component

Add this import at the top of `VoiceTestScreen.tsx`:

```typescript
import { FullTestScreen } from "../FullTest/FullTestScreen";
```

### 2. Add Full Test State

In the VoiceTestScreen component, update the mode type:

```typescript
// Change this:
const [mode, setMode] = useState<"practice" | "simulation">("practice");

// To this:
const [mode, setMode] = useState<"practice" | "simulation" | "full-test">(
  "practice"
);
```

### 3. Add Full Test Button

In the main screen (where "Start Practice" and "Start Simulation" buttons are), add:

```typescript
<Button
  title="Start Full Test"
  variant="primary"
  onPress={startFullTest}
  loading={isLoadingTopic}
/>
```

### 4. Implement startFullTest Function

Add this function near `startPractice` and `startSimulation`:

```typescript
const startFullTest = async () => {
  try {
    // Check usage limit
    const limitCheck = await checkUsageLimit(DEMO_USER_ID, "simulation"); // Use simulation limit

    if (!limitCheck.allowed) {
      setLimitInfo(limitCheck);
      setShowLimitModal(true);
      return;
    }

    setMode("full-test");
    setShowVoiceUI(true);
  } catch (error: any) {
    console.error("Failed to check limit:", error);
    Alert.alert("Error", "Failed to start full test. Please try again.", [
      { text: "OK" },
    ]);
  }
};
```

### 5. Handle Full Test Results

Add this function to process full test completion:

```typescript
const handleFullTestComplete = async (results: any) => {
  console.log("Full test completed:", results);

  // TODO: Send to backend for evaluation
  // For now, show a success message
  Alert.alert(
    "Test Complete!",
    "Your full IELTS speaking test has been completed. Results will be available shortly.",
    [
      {
        text: "OK",
        onPress: () => {
          setShowVoiceUI(false);
          setMode("practice");
        },
      },
    ]
  );

  // Future: Call backend API
  // const evaluation = await evaluateFullTest(results);
  // setEvaluationData(evaluation);
  // setShowEvaluation(true);
};
```

### 6. Update Render Logic

In the render section where VoiceConversation is shown, update it to:

```typescript
{
  showVoiceUI && mode === "full-test" ? (
    <FullTestScreen
      onComplete={handleFullTestComplete}
      onExit={handleSessionEnd}
    />
  ) : showVoiceUI && mode === "practice" ? (
    <VoiceConversation
      mode={mode}
      topic={currentTopic?.topic}
      question={currentTopic?.question}
      part={selectedPart}
      onEnd={handleSessionEnd}
      onEvaluationComplete={handleEvaluationComplete}
    />
  ) : showVoiceUI && mode === "simulation" ? (
    <SimulationMode
      onEnd={handleSessionEnd}
      onSimulationComplete={handleSimulationComplete}
    />
  ) : null;
}
```

## 🎨 UI Recommendation

Add a visual distinction for the Full Test button:

```typescript
<View style={styles.testModeSection}>
  <Text style={styles.sectionTitle}>Practice Mode</Text>
  <Button title="Quick Practice" variant="secondary" onPress={startPractice} />

  <Text style={[styles.sectionTitle, { marginTop: spacing.xl }]}>
    Full Test Mode
  </Text>
  <Button
    title="Start Full IELTS Test"
    variant="primary"
    onPress={startFullTest}
    icon="trophy"
  />
  <Text style={styles.fullTestInfo}>
    ⏱️ ~11-14 minutes • All 3 parts • Complete evaluation
  </Text>
</View>
```

## ⚠️ Important Notes

### Backend Integration Required

The FullTestScreen returns a results object with all recordings. You'll need to:

1. Create new backend endpoint: `POST /api/v1/test/full-test/evaluate`
2. Accept all recordings (Part 1: 4 files, Part 2: 1 file, Part 3: 3 files)
3. Return comprehensive evaluation with part-by-part scores

### Expected Results Format

```typescript
{
  part1: {
    recordings: [uri1, uri2, uri3, uri4],
    questions: [GeneratedTopic, ...],
    duration: 300
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
  totalDuration: 720,
  completedAt: "2025-10-13T12:18:00Z"
}
```

## 🧪 Testing Checklist

Before deploying, test:

- [ ] Full test loads all questions correctly
- [ ] Audio plays through loudspeakers
- [ ] Recording starts automatically (no button press)
- [ ] Timing is accurate for each part
- [ ] Part 2 has 60-second prep time
- [ ] Back button shows exit warning
- [ ] Test completes successfully
- [ ] Results are passed to handler
- [ ] Usage limits are checked
- [ ] No crashes or errors

## 🚀 Quick Start (Minimal Integration)

If you want to test immediately without full integration:

```typescript
// In VoiceTestScreen.tsx, add temporary test button:

<Button
  title="🧪 Test Full IELTS (Debug)"
  onPress={() => {
    setMode("full-test");
    setShowVoiceUI(true);
  }}
/>;

// Then in render:
{
  showVoiceUI && mode === "full-test" && (
    <FullTestScreen
      onComplete={(results) => {
        console.log("Test results:", results);
        Alert.alert("Complete!", JSON.stringify(results, null, 2));
        setShowVoiceUI(false);
      }}
      onExit={() => setShowVoiceUI(false)}
    />
  );
}
```

This will let you test the full test experience immediately!

## 📚 Related Files

- **New File**: `/mobile/src/screens/FullTest/FullTestScreen.tsx` (✅ Created)
- **Modify**: `/mobile/src/screens/VoiceTest/VoiceTestScreen.tsx`
- **Reference**: `/mobile/src/services/textToSpeechService.ts` (already has speaker config)
- **Reference**: `/mobile/src/components/VoiceConversationV2.tsx` (practice mode)

---

**Status: ✅ Component Ready**  
**Next Step: Add to VoiceTestScreen + Test**
