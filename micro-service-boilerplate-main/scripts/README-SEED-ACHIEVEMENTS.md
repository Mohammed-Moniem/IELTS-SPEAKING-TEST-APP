# Achievement Seed Script

## Overview

This script populates the database with **45+ predefined achievements** across 9 categories, including the new achievement types added in Phase 4.

## Achievement Categories

### 1. 🎯 PRACTICE (5 achievements)

Progressive achievements for completing practice sessions:

- **First Steps** (Bronze, 10pts) - Complete 1 practice
- **Getting Started** (Bronze, 50pts) - Complete 10 practices
- **Dedicated Learner** (Silver, 150pts) - Complete 50 practices
- **Century Club** (Gold, 300pts) - Complete 100 practices
- **IELTS Master** (Diamond, 1000pts) - Complete 500 practices

### 2. 🌟 IMPROVEMENT (6 achievements)

Score-based achievements:

- **Breaking Through** (Bronze, 25pts) - Score 5.0+
- **Competent Speaker** (Silver, 50pts) - Score 6.0+
- **Good User** (Gold, 100pts) - Score 7.0+
- **Very Good User** (Platinum, 200pts) - Score 8.0+
- **Expert User** (Diamond, 500pts) - Score 9.0
- **Progress Maker** (Silver, 75pts) - Improve by 1 band
- **Transformation** (Gold, 200pts) - Improve by 2 bands

### 3. 🔥 STREAK (5 achievements)

Daily practice streaks:

- **Three in a Row** (Bronze, 30pts) - 3-day streak
- **Weekly Warrior** (Silver, 70pts) - 7-day streak
- **Monthly Master** (Gold, 300pts) - 30-day streak
- **Unstoppable** (Platinum, 1000pts) - 100-day streak
- **Year of Dedication** (Diamond, 5000pts, Premium) - 365-day streak

### 4. 🤝 SOCIAL (5 achievements)

Social interaction achievements:

- **Making Friends** (Bronze, 20pts) - Add 1 friend
- **Social Circle** (Silver, 50pts) - Add 5 friends
- **Social Butterfly** (Gold, 150pts) - Add 25 friends
- **Team Player** (Bronze, 30pts) - Join 1 group
- **Influencer** (Silver, 100pts) - Refer 3 friends

### 5. ⚡ SPEED (3 achievements) **[NEW]**

Fast completion achievements:

- **Quick Thinker** (Silver, 40pts) - Complete Part 1 in <5 minutes
- **Fluent Speaker** (Silver, 50pts) - Complete Part 2 efficiently
- **Speed Demon** (Gold, 100pts) - Complete 10 sessions under target time

### 6. 📅 CONSISTENCY (5 achievements) **[NEW]**

Time-based practice patterns:

- **Early Bird** (Silver, 60pts) - Practice before 9 AM, 10 times
- **Night Owl** (Silver, 60pts) - Practice after 10 PM, 10 times
- **Weekend Warrior** (Silver, 50pts) - 10 weekend practices
- **Balanced Learner** (Gold, 150pts) - Practice all 3 parts 10+ times each
- **Daily Dedication** (Gold, 200pts) - Practice daily for 30 days

### 7. 🎯 MASTERY (4 achievements) **[NEW]**

Topic expertise achievements:

- **Family Expert** (Gold, 100pts) - Score 8.0+ on Family topic 3 times
- **Work & Career Expert** (Gold, 100pts) - Score 8.0+ on Work topic 3 times
- **Education Expert** (Gold, 100pts) - Score 8.0+ on Education topic 3 times
- **All-Rounder** (Platinum, 250pts) - Score 7.0+ on 10 different topics

### 8. ✅ MILESTONE (5 achievements)

Key milestones:

- **Profile Perfect** (Bronze, 25pts) - Complete profile
- **Test Taker** (Silver, 100pts) - Complete 1 full simulation
- **Exam Ready** (Gold, 500pts) - Complete 10 simulations
- **Rising Star** (Platinum, 300pts) - Reach top 10 on leaderboard
- **Champion** (Diamond, 1000pts, Premium) - Reach top 3 on leaderboard

### 9. 🎊 SEASONAL (3 achievements) **[NEW]**

Time-limited seasonal goals:

- **New Year Resolution** (Silver, 100pts) - Practice 10 times in January
- **Summer Scholar** (Gold, 150pts) - Practice 20 times in summer (June-August)
- **Holiday Hustle** (Silver, 100pts) - Practice 10 times in December

## Achievement Tiers

Achievements are classified into 5 tiers based on difficulty:

| Tier         | Symbol | Description               | Typical Points |
| ------------ | ------ | ------------------------- | -------------- |
| **Bronze**   | 🥉     | Entry-level achievements  | 10-30          |
| **Silver**   | 🥈     | Intermediate achievements | 40-100         |
| **Gold**     | 🥇     | Advanced achievements     | 100-300        |
| **Platinum** | 💠     | Expert achievements       | 300-1000       |
| **Diamond**  | 💎     | Legendary achievements    | 1000+          |

## Total Points Available

- **Total Achievements**: 45
- **Total Points**: ~11,000 points
- **Premium Achievements**: 2 (Year of Dedication, Champion)

## Usage

### Run the Seed Script

```bash
cd micro-service-boilerplate-main
npm run seed:achievements
```

### What It Does

1. ✅ Connects to MongoDB using your `.env` configuration
2. 🗑️ Clears existing achievements (optional - can be commented out)
3. 📝 Inserts 45 new achievements into the database
4. 📊 Displays summary statistics:
   - Achievements by category
   - Tier distribution
   - Total points available

### Output Example

```
🔌 Connecting to MongoDB...
✅ Connected to MongoDB
🗑️  Clearing existing achievements...
✅ Cleared existing achievements
📝 Inserting 45 achievements...
✅ Successfully inserted 45 achievements

📊 Achievement Summary by Category:
┌─────────────┬───────┬──────────────┬──────────────┐
│   Category  │ Count │ Total Points │ Premium Count│
├─────────────┼───────┼──────────────┼──────────────┤
│ CONSISTENCY │   5   │     520      │      0       │
│ IMPROVEMENT │   6   │     750      │      0       │
│ MASTERY     │   4   │     550      │      0       │
│ MILESTONE   │   5   │    1850      │      1       │
│ PRACTICE    │   5   │    1510      │      0       │
│ SEASONAL    │   3   │     350      │      0       │
│ SOCIAL      │   5   │     250      │      0       │
│ SPEED       │   3   │     190      │      0       │
│ STREAK      │   5   │    6400      │      1       │
└─────────────┴───────┴──────────────┴──────────────┘

🎯 Total Active Achievements: 45
💰 Total Available Points: 11370

✨ Achievement seeding completed successfully!
```

## Important Notes

### ⚠️ Production Safety

The script includes this line:

```typescript
await Achievement.deleteMany({});
```

**Comment this out in production** to avoid accidentally deleting custom achievements!

### 🔄 Re-running the Script

- Safe to run multiple times during development
- Will replace all achievements with fresh data
- Won't affect user progress (UserAchievement records)

### 🎯 Auto-Tracking Integration

Once seeded, achievements will **automatically unlock** as users:

- ✅ Complete practice sessions
- ✅ Achieve high scores
- ✅ Build practice streaks
- ✅ Add friends
- ✅ Join groups
- ✅ Complete simulations
- ✅ Practice at different times of day
- ✅ Master specific topics

No additional code needed - the `AchievementTracker` service handles everything!

## Customization

### Adding New Achievements

Edit `scripts/seedAchievements.ts` and add to the `achievements` array:

```typescript
{
  key: 'my_achievement',
  name: 'Achievement Name',
  description: 'What the user needs to do',
  category: AchievementCategory.PRACTICE,
  tier: AchievementTier.GOLD,
  icon: '🏆',
  points: 100,
  requirement: {
    type: 'practice_count',
    value: 50
  },
  isPremium: false,
  order: 99
}
```

### Requirement Types

Supported requirement types in the system:

| Type                | Description             | Example                                                                                |
| ------------------- | ----------------------- | -------------------------------------------------------------------------------------- |
| `practice_count`    | Total practice sessions | `{ type: 'practice_count', value: 100 }`                                               |
| `streak_days`       | Consecutive days        | `{ type: 'streak_days', value: 7 }`                                                    |
| `score_threshold`   | Minimum score           | `{ type: 'score_threshold', value: 7.0 }`                                              |
| `score_improvement` | Band improvement        | `{ type: 'score_improvement', value: 1.0 }`                                            |
| `friend_count`      | Number of friends       | `{ type: 'friend_count', value: 10 }`                                                  |
| `group_count`       | Groups joined           | `{ type: 'group_count', value: 3 }`                                                    |
| `simulation_count`  | Full tests              | `{ type: 'simulation_count', value: 5 }`                                               |
| `speed_completion`  | Fast completion         | `{ type: 'speed_completion', value: 300, metadata: { partNumber: 1 } }`                |
| `time_based`        | Practice timing         | `{ type: 'time_based', value: 10, metadata: { timeRange: 'morning' } }`                |
| `topic_mastery`     | Topic expertise         | `{ type: 'topic_mastery', value: 3, metadata: { topicKey: 'family', minScore: 8.0 } }` |
| `seasonal_practice` | Seasonal goals          | `{ type: 'seasonal_practice', value: 10, metadata: { month: 1 } }`                     |

## Next Steps

After seeding achievements:

1. ✅ **Test the Backend**
   - Start the backend server
   - Complete a practice session
   - Check if achievements unlock correctly
   - Monitor logs for 🏆 emoji markers

2. ✅ **Verify Database**

   ```bash
   # Connect to MongoDB and check
   db.achievements.countDocuments()
   # Should return 45
   ```

3. ✅ **Test Achievement Unlocking**
   - Complete your first practice → Should unlock "First Steps"
   - Practice 3 days in a row → Should unlock "Three in a Row"
   - Score 7.0+ → Should unlock "Good User"

4. ✅ **Check Socket Events**
   - Open browser console
   - Look for `achievement:unlocked` events
   - Verify modal appears when achievement unlocks

## Troubleshooting

### Connection Issues

If the script can't connect to MongoDB:

```bash
# Check your .env file
cat micro-service-boilerplate-main/.env | grep MONGODB

# Test connection
npm run db:check
```

### TypeScript Errors

```bash
# Rebuild TypeScript
npm run build

# Or use ts-node directly
npx ts-node scripts/seedAchievements.ts
```

### Achievements Not Unlocking

1. Check `AchievementTracker` is integrated in `PracticeService`
2. Verify socket.io connection is active
3. Check backend logs for errors
4. Ensure `isActive: true` on achievements

## Related Files

- **Model**: `src/api/models/AchievementModel.ts`
- **Service**: `src/api/services/AchievementService.ts`
- **Tracker**: `src/api/services/AchievementTracker.ts`
- **Controller**: `src/api/controllers/AchievementController.ts`
- **Seed Script**: `scripts/seedAchievements.ts`

---

**Created**: Phase 4 of Achievements Implementation  
**Last Updated**: October 2025
