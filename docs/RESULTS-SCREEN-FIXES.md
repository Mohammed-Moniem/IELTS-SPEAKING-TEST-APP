# Results Screen Fixes - Implementation Summary

## Changes Made

### 1. Fixed Modal Close Functionality ✅

**Problem**: The X button and Android back button didn't close the evaluation results modal properly.

**Solution**:

- Added proper `onRequestClose` handler to the Modal component in `ResultsScreen.tsx`
- Both handlers now correctly call `setShowLocalModal(false)` and `setSelectedLocalResult(null)`

**File**: `mobile/src/screens/Results/ResultsScreen.tsx`

- Modal properly implements `onRequestClose` prop
- Close button (`onClose`) properly clears state

---

### 2. Conditional "Try Again" Button ✅

**Problem**: "Try Again" button appeared for all test types, including full tests where it shouldn't.

**Solution**:

- Added `showTryAgain` prop to `EvaluationResultsScreen` component
- Made `onTryAgain` optional
- Conditionally render the button based on these props
- When button is hidden, "Done" button takes full width

**File**: `mobile/src/screens/EvaluationResults/EvaluationResultsScreen.tsx`

- New prop: `showTryAgain?: boolean` (default: `true`)
- Updated `onTryAgain?: () => void` to be optional
- Added conditional rendering in JSX
- Added `doneButtonFull` style for full-width Done button

**Usage**:

```tsx
// For local (Voice Practice) results - show Try Again
<EvaluationResultsScreen
  {...props}
  showTryAgain={true}
  onTryAgain={() => { /* retry logic */ }}
  testType="local"
/>

// For full test results - hide Try Again
<EvaluationResultsScreen
  {...props}
  showTryAgain={false}
  testType="simulation"
/>
```

---

### 3. Implemented "Try Again" Navigation ✅

**Problem**: Clicking "Try Again" didn't properly restart the test with the same question.

**Solution**:

- Updated navigation types to support retry parameters
- Implemented retry logic in `VoiceTestScreen`
- Passes question data via navigation params

**Files Modified**:

#### `mobile/src/navigation/AppNavigator.tsx`

```typescript
export type AppTabParamList = {
  // ... other routes
  VoiceTest:
    | {
        retryData?: {
          part: 1 | 2 | 3;
          topic: string;
          question: string;
        };
      }
    | undefined;
  // ...
};
```

#### `mobile/src/screens/VoiceTest/VoiceTestScreen.tsx`

- Added route params handling with `useRoute` hook
- Implemented `useEffect` to detect retry params
- Reconstructs `GeneratedTopic` object from retry data
- Automatically starts voice UI with the same question

#### `mobile/src/screens/Results/ResultsScreen.tsx`

- Updated `onTryAgain` handler to navigate with retry data:

```typescript
onTryAgain={() => {
  setShowLocalModal(false);
  setSelectedLocalResult(null);

  navigation.navigate("VoiceTest", {
    retryData: {
      part: selectedLocalResult.part,
      topic: selectedLocalResult.topic,
      question: selectedLocalResult.question,
    },
  });
}}
```

---

### 4. Test Type Support

**Enhanced**: Added support for `"local"` test type to handle Voice Practice results separately from practice sessions.

**File**: `mobile/src/screens/EvaluationResults/EvaluationResultsScreen.tsx`

- Updated `testType` prop: `"practice" | "simulation" | "local"`
- Maps `"local"` to `"practice"` when saving to analytics

---

## How It Works

### Voice Practice (Local Results)

1. User completes a Voice Practice session
2. Result is saved locally via `resultsStorage`
3. In Results screen → "Voice Practice" tab, user taps a result card
4. Modal opens with full evaluation details
5. User sees "Try Again" button and "Done" button
6. **Try Again**: Closes modal, navigates to VoiceTest with retry data
   - Same part, topic, and question
   - User can attempt again for a new score
7. **Done** or **X button**: Closes modal, returns to Results screen

### Practice Sessions

1. User completes a Practice Session (managed via Practice tab)
2. Result is fetched from backend via API
3. In Results screen → "Practice Sessions" tab, user taps a result
4. Navigates to `PracticeResultDetailScreen` (different flow)
5. That screen has its own "Retry" button logic

### Full Tests (Simulations)

1. User completes a Full Test
2. Result is fetched from backend via API
3. In Results screen → "Full Tests" tab, user taps a result
4. Modal opens (or navigates to detail screen)
5. **No "Try Again" button** - full tests shouldn't be retried
6. Only "Done" button shown (takes full width)

---

## Incomplete Sessions Handling

### Current Behavior:

- Practice sessions marked as "In Progress" are shown in Results screen
- Currently they're disabled (not clickable)
- They navigate to detail screen when completed

### Recommended Future Enhancement:

For in-progress sessions:

1. Allow clicking on them
2. Navigate to resume the session (not retry from scratch)
3. On completion, mark as completed and remove from "In Progress" filter
4. Update the result in the list

**Implementation would require**:

- Session resume logic in Practice/Simulation screens
- State management to track partial progress
- API endpoint to update session status

---

## Testing Checklist

- [x] Modal closes with X button
- [x] Modal closes with Android back button
- [x] "Try Again" appears for Voice Practice results
- [x] "Try Again" navigates to VoiceTest with correct question
- [x] "Done" button closes modal and returns to Results
- [x] Full test results don't show "Try Again" button
- [ ] In-progress sessions can be resumed (future enhancement)
- [ ] Completed sessions updated in real-time after retry

---

## Files Modified

1. `mobile/src/screens/EvaluationResults/EvaluationResultsScreen.tsx`

   - Added `showTryAgain` prop
   - Made `onTryAgain` optional
   - Conditional button rendering
   - Added `doneButtonFull` style

2. `mobile/src/screens/Results/ResultsScreen.tsx`

   - Fixed modal `onRequestClose`
   - Implemented retry navigation
   - Added retry data params

3. `mobile/src/screens/VoiceTest/VoiceTestScreen.tsx`

   - Added route params handling
   - Implemented retry logic with `useEffect`
   - Reconstructs topic from retry data

4. `mobile/src/navigation/AppNavigator.tsx`
   - Updated `AppTabParamList` type
   - Added `retryData` params to VoiceTest route

---

## Notes

- The retry creates a **new** result, not updating the old one
- User can retry the same question multiple times
- Each retry will create a separate result entry
- Original result remains unchanged in history
- This allows users to track their improvement over time
