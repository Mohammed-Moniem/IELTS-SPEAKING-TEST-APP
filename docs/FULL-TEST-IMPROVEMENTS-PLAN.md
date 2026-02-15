# Full Test Improvements - Implementation Plan

**Date:** October 16, 2025  
**Status:** In Progress

## Overview

This document outlines the plan to enhance the full IELTS speaking test with proper evaluation, question tracking, and improved user experience.

## Requirements Summary

1. ✅ **Questions from DB** - Already implemented with 60K questions
2. ⏳ **Welcome sequence** - Add full name + ID document questions
3. ⏳ **Exit handling** - Stop all processes (TTS, recording, API calls)
4. ⏳ **Full test evaluation** - Evaluate entire test and show results
5. ⏳ **Question uniqueness** - Prevent same questions for same user
6. ⏳ **Test transcript storage** - Save complete test transcript to DB
7. ⏳ **Evaluation persistence** - Save evaluation results to DB

## Priority & Implementation Order

### Phase 1: Database Models & Backend Foundation (Priority: HIGH)
**Estimated Time:** 2-3 hours

#### 1.1 Create UserQuestionHistory Model
- Track which questions each user has seen
- Prevent repetition for 30 days
- Store: userId, questionId, usedAt, testId

#### 1.2 Create TestSession Model
- Store complete test sessions
- Fields: userId, testType, startedAt, completedAt, duration, transcript, questions, recordings, evaluation

#### 1.3 Create TestEvaluation Model
- Store detailed evaluation results
- Link to TestSession
- Include all IELTS criteria scores

#### 1.4 Update IELTSQuestionService
- Add user-based question filtering
- Track question usage per user
- Implement random selection excluding user history

### Phase 2: Backend API Endpoints (Priority: HIGH)
**Estimated Time:** 2 hours

#### 2.1 Full Test Evaluation Endpoint
- `POST /speech/evaluate-full-test`
- Accept complete test data (all parts)
- Return comprehensive evaluation
- Save to database

#### 2.2 Test Session Management
- `POST /test-sessions` - Create test session
- `PATCH /test-sessions/:id` - Update session
- `GET /test-sessions/:id` - Get session details

#### 2.3 Enhanced Question Selection
- Update `/speech/random-topic` to use userId
- Filter out recently used questions
- Return truly random questions

### Phase 3: Mobile App - Welcome & Exit (Priority: HIGH)
**Estimated Time:** 1-2 hours

#### 3.1 Enhanced Welcome Sequence
- Ask for full name with waiting indicator
- Ask for ID document with waiting indicator
- Smooth transitions between questions
- Start Part 1 after welcome

#### 3.2 Improved Exit Handling
- Stop TTS immediately
- Stop all recordings
- Cancel pending API requests
- Clear all timers
- Proper cleanup

### Phase 4: Full Test Evaluation Flow (Priority: HIGH)
**Estimated Time:** 3 hours

#### 4.1 Collect Test Data
- Gather all recordings
- Prepare transcript
- Include all questions and answers

#### 4.2 Call Evaluation API
- Send complete test data
- Receive evaluation results
- Parse response

#### 4.3 Speak Evaluation Summary
- Examiner speaks closing message
- Speak evaluation summary
- Navigate to results screen

#### 4.4 Show Evaluation Screen
- Reuse existing evaluation UI
- Display all criteria scores
- Show suggestions and corrections

### Phase 5: Testing & Refinement (Priority: MEDIUM)
**Estimated Time:** 2 hours

#### 5.1 End-to-End Testing
- Test complete flow
- Verify question randomization
- Check evaluation accuracy

#### 5.2 Edge Cases
- Handle offline scenarios
- Network errors
- Interrupted tests

## Detailed Implementation Steps

### Step 1: UserQuestionHistory Model

```typescript
// micro-service-boilerplate-main/src/api/models/UserQuestionHistoryModel.ts
interface IUserQuestionHistory {
  userId: string;
  questionId: Types.ObjectId;
  usedAt: Date;
  testId?: Types.ObjectId;
  testType: 'practice' | 'full-test';
}
```

### Step 2: TestSession Model

```typescript
// micro-service-boilerplate-main/src/api/models/TestSessionModel.ts
interface ITestSession {
  userId: string;
  testType: 'practice' | 'full-test';
  part: 1 | 2 | 3 | 'full';
  startedAt: Date;
  completedAt?: Date;
  duration: number; // seconds
  questions: Array<{
    questionId: Types.ObjectId;
    question: string;
    category: string;
  }>;
  transcript: string;
  recordings: Array<{
    partNumber: number;
    questionIndex: number;
    recordingUrl?: string;
    duration: number;
  }>;
  evaluationId?: Types.ObjectId;
  status: 'in-progress' | 'completed' | 'abandoned';
}
```

### Step 3: TestEvaluation Model

```typescript
// micro-service-boilerplate-main/src/api/models/TestEvaluationModel.ts
interface ITestEvaluation {
  testSessionId: Types.ObjectId;
  userId: string;
  overallBand: number;
  criteria: {
    fluencyCoherence: { band: number; feedback: string; strengths: string[]; improvements: string[] };
    lexicalResource: { band: number; feedback: string; strengths: string[]; improvements: string[] };
    grammaticalRange: { band: number; feedback: string; strengths: string[]; improvements: string[] };
    pronunciation: { band: number; feedback: string; strengths: string[]; improvements: string[] };
  };
  spokenSummary: string;
  corrections: Array<{ original: string; corrected: string; explanation: string }>;
  suggestions: Array<{ category: string; suggestion: string }>;
  evaluatedAt: Date;
  evaluatedBy: 'ai' | 'human';
}
```

### Step 4: Enhanced Question Selection

```typescript
// Update IELTSQuestionService.ts
async getRandomQuestionForUser(
  userId: string,
  category: IELTSQuestionCategory,
  difficulty: IELTSQuestionDifficulty
): Promise<IELTSQuestionDocument | null> {
  // Get user's recent questions (last 30 days)
  const recentQuestions = await UserQuestionHistoryModel.find({
    userId,
    usedAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
  }).distinct('questionId');

  // Find available questions
  const query = {
    category,
    difficulty,
    active: true,
    _id: { $nin: recentQuestions }
  };

  // Use aggregation with $sample for random selection
  const questions = await IELTSQuestionModel.aggregate([
    { $match: query },
    { $sample: { size: 1 } }
  ]);

  if (questions.length > 0) {
    // Track usage
    await UserQuestionHistoryModel.create({
      userId,
      questionId: questions[0]._id,
      usedAt: new Date(),
      testType: 'full-test'
    });

    return questions[0];
  }

  return null;
}
```

### Step 5: Full Test Evaluation Endpoint

```typescript
// SpeechController.ts
@Post('/evaluate-full-test')
public async evaluateFullTest(@Body() body: {
  userId: string;
  testSessionId: string;
  part1: { questions: any[]; recordings: any[]; transcripts: string[] };
  part2: { topic: any; recording: any; transcript: string };
  part3: { questions: any[]; recordings: any[]; transcripts: string[] };
  duration: number;
}): Promise<any> {
  // 1. Evaluate complete test using AI
  // 2. Calculate overall band score
  // 3. Save evaluation to DB
  // 4. Update test session
  // 5. Return evaluation results
}
```

### Step 6: Mobile Welcome Sequence

```typescript
// AuthenticFullTestV2.tsx
const startWelcome = async () => {
  setPhase("welcome");
  setIsExaminerSpeaking(true);

  // Question 1: Full name
  await speakAndWait("Good morning. My name is Dr. Smith and I will be your examiner today. Can you tell me your full name please?");
  setIsExaminerSpeaking(false);
  
  // Show waiting indicator
  await waitForUserResponse(3000);

  // Question 2: ID document
  setIsExaminerSpeaking(true);
  await speakAndWait("Thank you. And could you please show me your identification?");
  setIsExaminerSpeaking(false);
  
  await waitForUserResponse(3000);

  // Transition to Part 1
  setIsExaminerSpeaking(true);
  await speakAndWait("Thank you. Now let's begin with Part 1.");
  setIsExaminerSpeaking(false);

  setTimeout(() => startPart1(), 2000);
};
```

### Step 7: Enhanced Exit Handling

```typescript
const handleExit = () => {
  Alert.alert("Exit Test?", "Your progress will not be saved.", [
    { text: "Cancel", style: "cancel" },
    { 
      text: "Exit", 
      onPress: async () => {
        // Stop TTS
        await ttsService.stop();
        
        // Stop recording
        if (recording.current) {
          await recording.current.stopAndUnloadAsync();
          recording.current = null;
        }
        
        // Clear timers
        cleanup();
        
        // Exit
        onExit();
      },
      style: "destructive" 
    }
  ]);
};
```

## Implementation Timeline

- **Day 1 (4 hours)**: Database models + Backend endpoints
- **Day 2 (3 hours)**: Question selection + Welcome sequence
- **Day 3 (4 hours)**: Full test evaluation flow
- **Day 4 (2 hours)**: Testing + Refinements

**Total Estimated Time:** 13 hours

## Success Criteria

- ✅ Questions come from 60K question database
- ✅ No question repetition for same user (30 days)
- ✅ Welcome sequence includes name + ID questions
- ✅ Exit immediately stops all processes
- ✅ Full test provides comprehensive evaluation
- ✅ Evaluation results saved to database
- ✅ Complete test transcript stored
- ✅ User can see detailed results screen

## Next Steps

1. Start with Phase 1: Create database models
2. Implement backend endpoints
3. Update mobile app
4. Test end-to-end
5. Deploy and monitor

---

**Status Updates:**
- [x] Plan created
- [ ] Phase 1 in progress
- [ ] Phase 2 pending
- [ ] Phase 3 pending
- [ ] Phase 4 pending
- [ ] Phase 5 pending
