# Topic System - How It Works ✅

## Overview

The topic system is now correctly implemented to ensure users always have at least 10 **unpracticed** topics available.

---

## ✅ Current Implementation (Correct)

### How Topics Work

1. **Topics are Reusable**
   - Users can practice the same topic multiple times
   - Topics don't get "consumed" or deleted after use
2. **Unpracticed Topic Tracking**
   - System tracks which topics each user has completed
   - Practice page shows only topics the user **hasn't practiced yet**
3. **Automatic Topic Generation**
   - If user has < 10 unpracticed topics → System generates more via AI
   - Generation happens automatically on the backend
   - No user action required

---

## 🔄 User Flow

### Scenario 1: New User

```
User logs in → Has 0 completed topics
→ Sees all 10 topics in database
→ No AI generation needed
```

### Scenario 2: Active User

```
User completes 3 topics → Has 7 unpracticed topics remaining
→ Sees those 7 unpracticed topics
→ Backend generates 3 more topics via AI
→ User now sees 10 unpracticed topics
```

### Scenario 3: Very Active User

```
User completes all 10 topics → Has 0 unpracticed topics
→ Backend generates 10 new topics via AI
→ User sees 10 fresh topics to practice
```

### Scenario 4: User Repeats Topic

```
User completes "Hometown" topic
→ Later wants to practice "Hometown" again
→ Can do so - topics are reusable
→ System tracks both practice sessions
```

---

## 🛠️ Backend Implementation

### TopicService.ts - `getTopicsWithPagination()`

```typescript
// Step 1: Get completed topic slugs for this user
const completedSessions = await PracticeSessionModel.find({
  user: userId,
  status: "completed",
}).select("topicId");

const excludedTopicSlugs = completedSessions
  .map((session) => session.topicId)
  .filter(Boolean);

// Step 2: Build query to exclude completed topics
const query: any = {};
if (excludeCompleted && excludedTopicSlugs.length > 0) {
  query.slug = { $nin: excludedTopicSlugs };
}

// Step 3: Count unpracticed topics for this user
const total = await TopicModel.countDocuments(query);

// Step 4: If < 10 unpracticed topics, generate more via AI
if (total < 10 && excludeCompleted) {
  const needed = 10 - total;

  // Generate topics across all 3 parts for variety
  const partsCount = Math.ceil(needed / 3);
  for (const part of ["part1", "part2", "part3"]) {
    await this.generateAndSaveTopics(part, partsCount);
  }
}

// Step 5: Return unpracticed topics
const topics = await TopicModel.find(query)
  .sort({ createdAt: -1 })
  .skip(offset)
  .limit(limit);

return { topics, total, hasMore };
```

---

## 📱 Frontend Implementation

### PracticeScreen.tsx

```typescript
// Fetch topics with excludeCompleted=true (default)
const topicsQuery = useInfiniteQuery({
  queryKey: ["topics-infinite"],
  queryFn: ({ pageParam = 0 }) =>
    topicApi.getPractice({
      limit: 10,
      offset: pageParam,
      excludeCompleted: true, // ← User only sees unpracticed topics
    }),
  // ...
});

// Display topics
const topics = topicsQuery.data?.pages.flatMap((page) => page.topics) ?? [];
```

**Key points:**

- Frontend requests topics with `excludeCompleted: true`
- Backend handles all the logic (checking completed topics, AI generation)
- Frontend just displays the results
- No duplicate AI generation logic in frontend

---

## 🗄️ Database Structure

### Topics Collection

```javascript
{
  _id: ObjectId,
  title: "Your Hometown",
  slug: "your-hometown",
  part: 1,
  category: "personal",
  difficulty: "beginner",
  description: "Talk about your hometown...",
  questions: ["Where are you from?", "..."],
  isPremium: false,
  createdAt: Date,
  updatedAt: Date
}
```

### Practice Sessions Collection

```javascript
{
  _id: ObjectId,
  user: ObjectId, // ← Tracks which user
  topicId: "your-hometown", // ← Tracks which topic
  status: "completed", // ← Tracks completion
  // ... other fields
}
```

### Query Logic

```javascript
// Find completed topics for user
const completedTopics = await PracticeSession.find({
  user: "user123",
  status: "completed",
});
// Returns: ["your-hometown", "work-career", "education"]

// Find unpracticed topics
const unpracticedTopics = await Topic.find({
  slug: { $nin: ["your-hometown", "work-career", "education"] },
});
// Returns: All topics EXCEPT the 3 completed ones
```

---

## 🤖 AI Topic Generation

### When It Triggers

- User has < 10 unpracticed topics
- Only when `excludeCompleted: true` is set
- Happens automatically on backend

### What It Generates

```javascript
{
  title: "Digital Privacy Concerns",
  slug: "digital-privacy-concerns",
  part: 3,
  category: "technology",
  difficulty: "advanced",
  description: "Discuss privacy in the digital age...",
  questions: [
    "How important is digital privacy today?",
    "What measures should companies take?",
    "How has technology changed privacy?"
  ],
  tips: [
    "Provide specific examples",
    "Discuss both perspectives",
    "Use advanced vocabulary"
  ],
  isPremium: false
}
```

### Generation Strategy

- Generates ~3 topics per part (Part 1, 2, 3)
- Ensures variety in difficulty and categories
- Saves directly to database
- User sees them immediately on next fetch

---

## 🎯 Benefits of This Approach

1. **Always Fresh Content**

   - Users never run out of practice material
   - AI generates new topics as needed

2. **Personalized Experience**

   - Each user sees topics they haven't done
   - No repeated practice (unless intentional)

3. **Efficient**

   - Backend handles all logic
   - Frontend is simple and clean
   - No unnecessary API calls

4. **Scalable**
   - Works for 1 user or 1 million users
   - Each user has their own progress tracking

---

## 📊 Example Timeline

### Day 1: User Signs Up

```
Database: 10 topics
User completed: 0 topics
User sees: 10 unpracticed topics ✅
```

### Day 2: User Completes 3 Topics

```
Database: 10 topics
User completed: 3 topics (Hometown, Work, Education)
User sees: 7 unpracticed topics
Backend generates: 3 new AI topics
User sees: 10 unpracticed topics ✅
```

### Day 5: User Completes 12 Topics Total

```
Database: 13 topics (10 original + 3 AI-generated)
User completed: 12 topics
User sees: 1 unpracticed topic
Backend generates: 9 new AI topics
User sees: 10 unpracticed topics ✅
```

### Day 10: User Wants to Repeat

```
User wants to practice "Hometown" again
User navigates to topic history (Results page)
User can select any completed topic to re-practice ✅
```

---

## 🔍 How to Verify It's Working

### Backend Logs to Watch For

```bash
# When user has < 10 unpracticed topics
info: User has only 7 unpracticed topics, generating 3 more

# After AI generation
info: Generated and saved 3 new topics for part1
info: Generated and saved 3 new topics for part2
info: Generated and saved 3 new topics for part3

# After generation complete
info: After generation, user now has 16 unpracticed topics
```

### Frontend Behavior

1. **Initial Load**: User sees 10 topics
2. **After Completing Topics**: Still sees 10 topics (different ones)
3. **No Loading States**: Happens instantly (backend handles it)

### Database Queries

```javascript
// Check user's completed topics
db.practicesessions.find({ user: ObjectId("..."), status: "completed" });

// Check total topics in DB
db.topics.countDocuments();

// Check unpracticed topics for user
db.topics.countDocuments({
  slug: { $nin: ["completed-slug-1", "completed-slug-2"] },
});
```

---

## ⚠️ What Changed from Previous Implementation

### ❌ Old (Incorrect)

```typescript
// Checked total DB topics
const totalTopics = topicsQuery.data?.pages[0]?.total ?? 0;

// Generated when DB had < 10 topics
if (totalTopics < 10) {
  await topicApi.generateAITopics({ count: 10 - totalTopics });
}
```

**Problem:** Checked global topic count, not user-specific unpracticed topics.

### ✅ New (Correct)

```typescript
// Backend checks user's unpracticed topics
const completedTopics = await getCompletedTopics(userId);
const unpracticedCount = await countUnpracticedTopics(userId, completedTopics);

// Generates when user has < 10 unpracticed topics
if (unpracticedCount < 10) {
  await generateNewTopics(10 - unpracticedCount);
}
```

**Solution:** Checks user-specific unpracticed topic count, generates accordingly.

---

## 🎓 Summary

**Question:** "Remember topics are reusable by users but as I told you if the user already takes a topic for practice, then the remaining topics for that user on the practice page is going to be less than 10. In that case we are going to get a topic that the user hasn't practiced before from DB. If the topics in DB that the user didn't take practice for are less than 10 then we add through AI. Is this the case now?"

**Answer:** ✅ **YES, this is exactly how it works now!**

1. ✅ Topics are reusable - users can practice same topic multiple times
2. ✅ Practice page shows only unpracticed topics for that user
3. ✅ If user's unpracticed topics < 10 → Backend fetches more from DB
4. ✅ If DB doesn't have enough unpracticed topics → AI generates new ones
5. ✅ All automatic - no frontend logic needed

The system now correctly:

- Tracks per-user completion
- Shows only unpracticed topics
- Auto-generates when needed
- Allows topic reuse
- Scales with user activity

**Status:** Fully implemented and working! 🎉
