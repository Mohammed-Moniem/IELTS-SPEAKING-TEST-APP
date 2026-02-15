# Questions Database Implementation Plan

## Overview

Replace AI-generated questions with a pre-populated database of authentic IELTS questions to:

- **Save AI costs** (currently wasting budget on repetitive generation)
- **Improve performance** (instant DB queries vs slow AI generation)
- **Better variety** (5000+ questions vs cache of 10-20)
- **Authentic IELTS experience** (real exam questions)

## Current Issues

1. ✅ **FIXED**: Same questions every test (cache persists) - Added `topicCache.clear()` at test start
2. ✅ **FIXED**: Part 3 transition says "related to this topic" but questions aren't related - Changed wording
3. ⚠️ **TO FIX**: Wasting AI budget generating questions every time
4. ⚠️ **TO FIX**: Limited question variety (only 10-20 cached questions)

## Database Schema

### Collection: `ielts_questions`

```typescript
interface IIELTSQuestion {
  _id: ObjectId;

  // Question details
  category: "part1" | "part2" | "part3";
  difficulty: "easy" | "medium" | "hard";
  question: string;

  // Part 1 specific
  followUpQuestions?: string[]; // 2-3 follow-up questions

  // Part 2 specific (cue card)
  cueCard?: {
    mainTopic: string;
    bulletPoints: string[]; // 4 bullet points typically
    preparationTime: number; // 60 seconds
    timeToSpeak: number; // 120 seconds
  };

  // Part 3 specific
  relatedTopics?: string[]; // Topics this question relates to

  // Metadata
  keywords: string[]; // For search and filtering
  topic: string; // General topic (e.g., "Work", "Hometown", "Technology")
  source?: string; // Source of the question (e.g., "Cambridge IELTS 15")

  // Usage tracking
  timesUsed: number; // How many times this question has been served
  lastUsedAt?: Date;

  // Quality control
  verified: boolean; // Has been verified as authentic IELTS
  active: boolean; // Can be used in tests

  createdAt: Date;
  updatedAt: Date;
}
```

### Indexes

```typescript
// Query performance
{ category: 1, difficulty: 1, active: 1 } // Primary query pattern
{ topic: 1, active: 1 } // Filter by topic
{ keywords: 1 } // Search functionality
{ timesUsed: 1, lastUsedAt: 1 } // Fair distribution

// Text search
{ question: 'text', keywords: 'text' } // Full-text search
```

## API Endpoints

### 1. Get Random Questions for Full Test

```
GET /api/v1/questions/full-test?difficulty=medium
```

Returns:

```json
{
  "part1": [
    { "question": "...", "followUpQuestions": [...], ... },
    { "question": "...", "followUpQuestions": [...], ... },
    { "question": "...", "followUpQuestions": [...], ... },
    { "question": "...", "followUpQuestions": [...], ... }
  ],
  "part2": {
    "question": "...",
    "cueCard": { ... }
  },
  "part3": [
    { "question": "...", ... },
    { "question": "...", ... },
    { "question": "...", ... }
  ]
}
```

**Logic**:

- Select 4 Part 1 questions from different topics
- Select 1 Part 2 cue card
- Select 3 Part 3 questions
- Prioritize less-used questions (timesUsed ASC)
- Avoid recently used questions for this user
- Update timesUsed and lastUsedAt

### 2. Get Single Random Question

```
GET /api/v1/questions/random?category=part1&difficulty=medium
```

### 3. Get Questions by Topic

```
GET /api/v1/questions/by-topic/:topic?category=part1
```

### 4. Search Questions (Admin)

```
GET /api/v1/questions/search?q=hometown&category=part1
```

## Seeding Strategy

### Phase 1: Initial Seed (100 questions per category)

Total: 300 questions (100 Part 1 + 100 Part 2 + 100 Part 3)

**Part 1 Topics** (10 questions each):

- Work/Studies
- Hometown
- Accommodation
- Family
- Friends
- Hobbies
- Music
- Food
- Transportation
- Technology

**Part 2 Topics** (10 cue cards each):

- People (Describe a person you admire)
- Places (Describe a place you like to visit)
- Objects (Describe a useful object you own)
- Events (Describe a memorable event)
- Experiences (Describe an interesting experience)
- Activities (Describe an activity you enjoy)
- Memories (Describe a childhood memory)
- Future Plans (Describe something you want to do)
- Media (Describe a book/movie/song)
- Skills (Describe a skill you learned)

**Part 3 Topics** (10 questions each):

- Society & Community
- Education & Learning
- Technology & Innovation
- Environment & Nature
- Culture & Traditions
- Work & Career
- Health & Lifestyle
- Communication & Media
- Economy & Business
- Future & Change

### Phase 2: Expand to 1000 questions

- 400 Part 1 (40 per topic)
- 300 Part 2 (30 per topic)
- 300 Part 3 (30 per topic)

### Phase 3: Reach 5000 questions

- 2000 Part 1
- 1500 Part 2
- 1500 Part 3

## Implementation Steps

### Backend Changes

1. **Create Model** (`IELTSQuestionModel.ts`)

```typescript
import { model, Schema } from "mongoose";
import { IIELTSQuestion } from "../interfaces/IIELTSQuestion";

const IELTSQuestionSchema = new Schema<IIELTSQuestion>(
  {
    category: {
      type: String,
      enum: ["part1", "part2", "part3"],
      required: true,
    },
    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
      required: true,
    },
    question: { type: String, required: true },
    followUpQuestions: [{ type: String }],
    cueCard: {
      mainTopic: String,
      bulletPoints: [String],
      preparationTime: { type: Number, default: 60 },
      timeToSpeak: { type: Number, default: 120 },
    },
    relatedTopics: [{ type: String }],
    keywords: [{ type: String }],
    topic: { type: String, required: true, index: true },
    source: String,
    timesUsed: { type: Number, default: 0 },
    lastUsedAt: Date,
    verified: { type: Boolean, default: false },
    active: { type: Boolean, default: true, index: true },
  },
  {
    timestamps: true,
  }
);

// Indexes
IELTSQuestionSchema.index({ category: 1, difficulty: 1, active: 1 });
IELTSQuestionSchema.index({ timesUsed: 1, lastUsedAt: 1 });
IELTSQuestionSchema.index({ question: "text", keywords: "text" });

export const IELTSQuestionModel = model<IIELTSQuestion>(
  "IELTSQuestion",
  IELTSQuestionSchema
);
```

2. **Create Service** (`IELTSQuestionService.ts`)

```typescript
export class IELTSQuestionService {
  async getRandomQuestion(category, difficulty, excludeIds = []) {
    // Smart selection:
    // 1. Filter: category, difficulty, active=true, not in excludeIds
    // 2. Sort: timesUsed ASC, lastUsedAt ASC (prioritize less-used)
    // 3. Random from top 20
    // 4. Update timesUsed and lastUsedAt
  }

  async getFullTestQuestions(difficulty, userId) {
    // Get user's recently used questions (last 7 days)
    // Select questions avoiding recent ones
    // Return complete test set
  }

  async seedDatabase(questionsData) {
    // Bulk insert questions
    // Validate format
    // Set verified=true for authenticated sources
  }
}
```

3. **Create Controller** (`IELTSQuestionController.ts`)

```typescript
@Controller("/api/v1/questions")
export class IELTSQuestionController {
  @Get("/full-test")
  async getFullTestQuestions(@QueryParam("difficulty") difficulty) {
    // Returns complete test: 4xPart1, 1xPart2, 3xPart3
  }

  @Get("/random")
  async getRandomQuestion(
    @QueryParam("category") category,
    @QueryParam("difficulty") difficulty
  ) {
    // Returns single question
  }
}
```

4. **Create Seed Script** (`seed-ielts-questions.ts`)

```typescript
// Load questions from JSON files
// Insert into database
// Set verified=true
// Create indexes
```

### Frontend Changes

1. **Update `topicApi.ts`**

```typescript
// Replace /topics/get-random with /questions/random
// Replace /topics/generate with /questions/full-test
// Remove caching (database is fast enough)
// Simplify interface to match new API
```

2. **Update `AuthenticFullTestV2.tsx`**

```typescript
// Replace: getCachedRandomTopic() calls
// With: Single API call to /questions/full-test
// Simpler, faster, one request instead of 8
```

## Question Sources

### Authentic IELTS Sources

1. **Cambridge IELTS Books** (14-19)
2. **Official IELTS Practice Materials**
3. **British Council IELTS Prep**
4. **IDP IELTS Resources**

### Question Format Examples

**Part 1**:

```json
{
  "category": "part1",
  "difficulty": "medium",
  "question": "Do you work or are you a student?",
  "followUpQuestions": ["What do you study/do?", "Do you enjoy it?"],
  "keywords": ["work", "study", "occupation"],
  "topic": "Work & Studies",
  "verified": true
}
```

**Part 2**:

```json
{
  "category": "part2",
  "difficulty": "medium",
  "question": "Describe a memorable journey you have taken",
  "cueCard": {
    "mainTopic": "Describe a memorable journey you have taken",
    "bulletPoints": [
      "Where you went",
      "Who you went with",
      "What you did during the journey",
      "Why it was memorable"
    ],
    "preparationTime": 60,
    "timeToSpeak": 120
  },
  "keywords": ["travel", "journey", "experience", "memorable"],
  "topic": "Travel & Places",
  "verified": true
}
```

**Part 3**:

```json
{
  "category": "part3",
  "difficulty": "hard",
  "question": "How do you think urbanization affects community relationships?",
  "relatedTopics": ["society", "community", "urban development"],
  "keywords": ["urbanization", "community", "social", "relationships"],
  "topic": "Society & Community",
  "verified": true
}
```

## Migration Plan

### Step 1: Create Database Schema (Day 1)

- Create model, service, controller
- Set up indexes
- Test basic CRUD operations

### Step 2: Seed Initial 300 Questions (Day 1-2)

- Create JSON files with 100 questions per category
- Run seed script
- Verify in database

### Step 3: Update API Endpoints (Day 2)

- Create new `/questions/*` endpoints
- Keep old `/topics/*` endpoints for backward compatibility
- Add feature flag to switch between old/new system

### Step 4: Update Frontend (Day 2)

- Update `topicApi.ts` to use new endpoints
- Simplify `AuthenticFullTestV2.tsx` to use single API call
- Test thoroughly

### Step 5: Expand to 1000+ Questions (Week 2)

- Add more questions incrementally
- Monitor usage statistics
- Ensure fair distribution

### Step 6: Deprecate Old System (Week 3)

- Remove AI generation endpoints
- Remove topic caching
- Clean up old code

## Benefits Summary

### Cost Savings

- **Current**: ~$0.002 per question × 8 questions per test × 1000 tests/month = **$16/month**
- **With Database**: $0 (just DB storage ~$5/month)
- **Savings**: ~$11/month or ~$132/year

### Performance Improvements

- **Current**: 8 API calls × 2-3 seconds each = 16-24 seconds load time
- **With Database**: 1 API call × 0.1 seconds = **0.1 seconds load time**
- **Improvement**: **160-240x faster**

### User Experience

- **Fresh questions** every test (5000+ pool vs 20 cache)
- **Instant loading** (no waiting for AI)
- **Authentic IELTS** (real exam questions)
- **Reliable** (no AI failures or rate limits)

## Next Steps

1. ✅ **DONE**: Fix immediate issues (cache clearing, Part 3 transition)
2. **TODO**: Create initial 100 questions JSON file for Part 1
3. **TODO**: Create database model and seed script
4. **TODO**: Create new API endpoints
5. **TODO**: Update frontend to use new endpoints
6. **TODO**: Test thoroughly
7. **TODO**: Deploy and monitor

## Notes

- Keep AI generation as backup/fallback for rare cases
- Add admin panel to manage questions (add/edit/deactivate)
- Track question usage statistics for quality control
- Allow users to report problematic questions
- Periodically refresh with new authentic IELTS questions

---

**Status**: Ready to implement
**Priority**: HIGH (cost savings + better UX)
**Estimated Time**: 2-3 days for full implementation
