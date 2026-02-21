import mongoose from 'mongoose';
import { Achievement, AchievementCategory, AchievementTier } from '../src/api/models/AchievementModel';

// Simple logger for seed script
const log = {
  info: (msg: string, data?: any) => console.log(`ℹ️  ${msg}`, data || ''),
  error: (msg: string, error: any) => console.error(`❌ ${msg}`, error),
  warn: (msg: string, data?: any) => console.warn(`⚠️  ${msg}`, data || '')
};

// MongoDB URI from environment or default
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ielts-speaking-test';

// Achievement definitions grouped by category
const achievements = [
  // ========== PRACTICE ACHIEVEMENTS ==========
  {
    key: 'first_practice',
    name: 'First Steps',
    description: 'Complete your first practice session',
    category: AchievementCategory.PRACTICE,
    tier: AchievementTier.BRONZE,
    icon: '👣',
    points: 10,
    requirement: { type: 'practice_count', value: 1 },
    isPremium: false,
    order: 1
  },
  {
    key: 'practice_10',
    name: 'Getting Started',
    description: 'Complete 10 practice sessions',
    category: AchievementCategory.PRACTICE,
    tier: AchievementTier.BRONZE,
    icon: '🎯',
    points: 50,
    requirement: { type: 'practice_count', value: 10 },
    isPremium: false,
    order: 2
  },
  {
    key: 'practice_50',
    name: 'Dedicated Learner',
    description: 'Complete 50 practice sessions',
    category: AchievementCategory.PRACTICE,
    tier: AchievementTier.SILVER,
    icon: '📚',
    points: 150,
    requirement: { type: 'practice_count', value: 50 },
    isPremium: false,
    order: 3
  },
  {
    key: 'practice_100',
    name: 'Century Club',
    description: 'Complete 100 practice sessions',
    category: AchievementCategory.PRACTICE,
    tier: AchievementTier.GOLD,
    icon: '💯',
    points: 300,
    requirement: { type: 'practice_count', value: 100 },
    isPremium: false,
    order: 4
  },
  {
    key: 'practice_500',
    name: 'IELTS Master',
    description: 'Complete 500 practice sessions',
    category: AchievementCategory.PRACTICE,
    tier: AchievementTier.DIAMOND,
    icon: '💎',
    points: 1000,
    requirement: { type: 'practice_count', value: 500 },
    isPremium: false,
    order: 5
  },

  // ========== IMPROVEMENT ACHIEVEMENTS ==========
  {
    key: 'score_5',
    name: 'Breaking Through',
    description: 'Achieve a score of 5.0 or higher',
    category: AchievementCategory.IMPROVEMENT,
    tier: AchievementTier.BRONZE,
    icon: '🌟',
    points: 25,
    requirement: { type: 'score_threshold', value: 5.0 },
    isPremium: false,
    order: 10
  },
  {
    key: 'score_6',
    name: 'Competent Speaker',
    description: 'Achieve a score of 6.0 or higher',
    category: AchievementCategory.IMPROVEMENT,
    tier: AchievementTier.SILVER,
    icon: '⭐',
    points: 50,
    requirement: { type: 'score_threshold', value: 6.0 },
    isPremium: false,
    order: 11
  },
  {
    key: 'score_7',
    name: 'Good User',
    description: 'Achieve a score of 7.0 or higher',
    category: AchievementCategory.IMPROVEMENT,
    tier: AchievementTier.GOLD,
    icon: '🌠',
    points: 100,
    requirement: { type: 'score_threshold', value: 7.0 },
    isPremium: false,
    order: 12
  },
  {
    key: 'score_8',
    name: 'Very Good User',
    description: 'Achieve a score of 8.0 or higher',
    category: AchievementCategory.IMPROVEMENT,
    tier: AchievementTier.PLATINUM,
    icon: '✨',
    points: 200,
    requirement: { type: 'score_threshold', value: 8.0 },
    isPremium: false,
    order: 13
  },
  {
    key: 'score_9',
    name: 'Expert User',
    description: 'Achieve a perfect 9.0 score',
    category: AchievementCategory.IMPROVEMENT,
    tier: AchievementTier.DIAMOND,
    icon: '🏆',
    points: 500,
    requirement: { type: 'score_threshold', value: 9.0 },
    isPremium: false,
    order: 14
  },
  {
    key: 'improvement_1_band',
    name: 'Progress Maker',
    description: 'Improve your average score by 1 full band',
    category: AchievementCategory.IMPROVEMENT,
    tier: AchievementTier.SILVER,
    icon: '📈',
    points: 75,
    requirement: { type: 'score_improvement', value: 1.0 },
    isPremium: false,
    order: 15
  },
  {
    key: 'improvement_2_bands',
    name: 'Transformation',
    description: 'Improve your average score by 2 full bands',
    category: AchievementCategory.IMPROVEMENT,
    tier: AchievementTier.GOLD,
    icon: '🚀',
    points: 200,
    requirement: { type: 'score_improvement', value: 2.0 },
    isPremium: false,
    order: 16
  },

  // ========== STREAK ACHIEVEMENTS ==========
  {
    key: 'streak_3',
    name: 'Three in a Row',
    description: 'Practice for 3 consecutive days',
    category: AchievementCategory.STREAK,
    tier: AchievementTier.BRONZE,
    icon: '🔥',
    points: 30,
    requirement: { type: 'streak_days', value: 3 },
    isPremium: false,
    order: 20
  },
  {
    key: 'streak_7',
    name: 'Weekly Warrior',
    description: 'Practice for 7 consecutive days',
    category: AchievementCategory.STREAK,
    tier: AchievementTier.SILVER,
    icon: '🔥',
    points: 70,
    requirement: { type: 'streak_days', value: 7 },
    isPremium: false,
    order: 21
  },
  {
    key: 'streak_30',
    name: 'Monthly Master',
    description: 'Practice for 30 consecutive days',
    category: AchievementCategory.STREAK,
    tier: AchievementTier.GOLD,
    icon: '🔥',
    points: 300,
    requirement: { type: 'streak_days', value: 30 },
    isPremium: false,
    order: 22
  },
  {
    key: 'streak_100',
    name: 'Unstoppable',
    description: 'Practice for 100 consecutive days',
    category: AchievementCategory.STREAK,
    tier: AchievementTier.PLATINUM,
    icon: '🔥',
    points: 1000,
    requirement: { type: 'streak_days', value: 100 },
    isPremium: false,
    order: 23
  },
  {
    key: 'streak_365',
    name: 'Year of Dedication',
    description: 'Practice for 365 consecutive days',
    category: AchievementCategory.STREAK,
    tier: AchievementTier.DIAMOND,
    icon: '🔥',
    points: 5000,
    requirement: { type: 'streak_days', value: 365 },
    isPremium: true,
    order: 24
  },

  // ========== SOCIAL ACHIEVEMENTS ==========
  {
    key: 'friend_first',
    name: 'Making Friends',
    description: 'Add your first friend',
    category: AchievementCategory.SOCIAL,
    tier: AchievementTier.BRONZE,
    icon: '🤝',
    points: 20,
    requirement: { type: 'friend_count', value: 1 },
    isPremium: false,
    order: 30
  },
  {
    key: 'friend_5',
    name: 'Social Circle',
    description: 'Add 5 friends',
    category: AchievementCategory.SOCIAL,
    tier: AchievementTier.SILVER,
    icon: '👥',
    points: 50,
    requirement: { type: 'friend_count', value: 5 },
    isPremium: false,
    order: 31
  },
  {
    key: 'friend_25',
    name: 'Social Butterfly',
    description: 'Add 25 friends',
    category: AchievementCategory.SOCIAL,
    tier: AchievementTier.GOLD,
    icon: '🦋',
    points: 150,
    requirement: { type: 'friend_count', value: 25 },
    isPremium: false,
    order: 32
  },
  {
    key: 'group_join',
    name: 'Team Player',
    description: 'Join your first study group',
    category: AchievementCategory.SOCIAL,
    tier: AchievementTier.BRONZE,
    icon: '👫',
    points: 30,
    requirement: { type: 'group_count', value: 1 },
    isPremium: false,
    order: 33
  },
  {
    key: 'referral_3',
    name: 'Influencer',
    description: 'Refer 3 friends to the app',
    category: AchievementCategory.SOCIAL,
    tier: AchievementTier.SILVER,
    icon: '📣',
    points: 100,
    requirement: { type: 'referral_count', value: 3 },
    isPremium: false,
    order: 34
  },

  // ========== SPEED ACHIEVEMENTS ==========
  {
    key: 'speed_part1_5min',
    name: 'Quick Thinker',
    description: 'Complete Part 1 in under 5 minutes',
    category: AchievementCategory.SPEED,
    tier: AchievementTier.SILVER,
    icon: '⚡',
    points: 40,
    requirement: { type: 'speed_completion', value: 300, metadata: { partNumber: 1 } },
    isPremium: false,
    order: 40
  },
  {
    key: 'speed_part2_3min',
    name: 'Fluent Speaker',
    description: 'Complete Part 2 (2-minute talk) efficiently',
    category: AchievementCategory.SPEED,
    tier: AchievementTier.SILVER,
    icon: '💨',
    points: 50,
    requirement: { type: 'speed_completion', value: 180, metadata: { partNumber: 2 } },
    isPremium: false,
    order: 41
  },
  {
    key: 'speed_demon',
    name: 'Speed Demon',
    description: 'Complete 10 practice sessions in under target time',
    category: AchievementCategory.SPEED,
    tier: AchievementTier.GOLD,
    icon: '🏎️',
    points: 100,
    requirement: { type: 'speed_streak', value: 10 },
    isPremium: false,
    order: 42
  },

  // ========== CONSISTENCY ACHIEVEMENTS ==========
  {
    key: 'morning_person',
    name: 'Early Bird',
    description: 'Practice before 9 AM on 10 different days',
    category: AchievementCategory.CONSISTENCY,
    tier: AchievementTier.SILVER,
    icon: '🌅',
    points: 60,
    requirement: { type: 'time_based', value: 10, metadata: { timeRange: 'morning' } },
    isPremium: false,
    order: 50
  },
  {
    key: 'night_owl',
    name: 'Night Owl',
    description: 'Practice after 10 PM on 10 different days',
    category: AchievementCategory.CONSISTENCY,
    tier: AchievementTier.SILVER,
    icon: '🦉',
    points: 60,
    requirement: { type: 'time_based', value: 10, metadata: { timeRange: 'night' } },
    isPremium: false,
    order: 51
  },
  {
    key: 'weekend_warrior',
    name: 'Weekend Warrior',
    description: 'Complete 10 practice sessions on weekends',
    category: AchievementCategory.CONSISTENCY,
    tier: AchievementTier.SILVER,
    icon: '🎮',
    points: 50,
    requirement: { type: 'day_based', value: 10, metadata: { dayType: 'weekend' } },
    isPremium: false,
    order: 52
  },
  {
    key: 'balanced_learner',
    name: 'Balanced Learner',
    description: 'Practice all 3 parts at least 10 times each',
    category: AchievementCategory.CONSISTENCY,
    tier: AchievementTier.GOLD,
    icon: '⚖️',
    points: 150,
    requirement: { type: 'part_balance', value: 10 },
    isPremium: false,
    order: 53
  },
  {
    key: 'daily_dedication',
    name: 'Daily Dedication',
    description: 'Practice at least once every day for a month',
    category: AchievementCategory.CONSISTENCY,
    tier: AchievementTier.GOLD,
    icon: '📅',
    points: 200,
    requirement: { type: 'daily_practice', value: 30 },
    isPremium: false,
    order: 54
  },

  // ========== MASTERY ACHIEVEMENTS ==========
  {
    key: 'topic_master_family',
    name: 'Family Expert',
    description: 'Score 8.0+ on Family topic 3 times',
    category: AchievementCategory.MASTERY,
    tier: AchievementTier.GOLD,
    icon: '👨‍👩‍👧‍👦',
    points: 100,
    requirement: { type: 'topic_mastery', value: 3, metadata: { topicKey: 'family', minScore: 8.0 } },
    isPremium: false,
    order: 60
  },
  {
    key: 'topic_master_work',
    name: 'Work & Career Expert',
    description: 'Score 8.0+ on Work topic 3 times',
    category: AchievementCategory.MASTERY,
    tier: AchievementTier.GOLD,
    icon: '💼',
    points: 100,
    requirement: { type: 'topic_mastery', value: 3, metadata: { topicKey: 'work', minScore: 8.0 } },
    isPremium: false,
    order: 61
  },
  {
    key: 'topic_master_education',
    name: 'Education Expert',
    description: 'Score 8.0+ on Education topic 3 times',
    category: AchievementCategory.MASTERY,
    tier: AchievementTier.GOLD,
    icon: '🎓',
    points: 100,
    requirement: { type: 'topic_mastery', value: 3, metadata: { topicKey: 'education', minScore: 8.0 } },
    isPremium: false,
    order: 62
  },
  {
    key: 'all_rounder',
    name: 'All-Rounder',
    description: 'Score 7.0+ on 10 different topics',
    category: AchievementCategory.MASTERY,
    tier: AchievementTier.PLATINUM,
    icon: '🌐',
    points: 250,
    requirement: { type: 'diverse_mastery', value: 10, metadata: { minScore: 7.0 } },
    isPremium: false,
    order: 63
  },

  // ========== MILESTONE ACHIEVEMENTS ==========
  {
    key: 'profile_complete',
    name: 'Profile Perfect',
    description: 'Complete your profile with photo and bio',
    category: AchievementCategory.MILESTONE,
    tier: AchievementTier.BRONZE,
    icon: '✅',
    points: 25,
    requirement: { type: 'profile_complete', value: 1 },
    isPremium: false,
    order: 70
  },
  {
    key: 'first_simulation',
    name: 'Test Taker',
    description: 'Complete your first full simulation test',
    category: AchievementCategory.MILESTONE,
    tier: AchievementTier.SILVER,
    icon: '📝',
    points: 100,
    requirement: { type: 'simulation_count', value: 1 },
    isPremium: false,
    order: 71
  },
  {
    key: 'simulation_10',
    name: 'Exam Ready',
    description: 'Complete 10 full simulation tests',
    category: AchievementCategory.MILESTONE,
    tier: AchievementTier.GOLD,
    icon: '🎯',
    points: 500,
    requirement: { type: 'simulation_count', value: 10 },
    isPremium: false,
    order: 72
  },
  {
    key: 'leaderboard_top_10',
    name: 'Rising Star',
    description: 'Reach top 10 on the leaderboard',
    category: AchievementCategory.MILESTONE,
    tier: AchievementTier.PLATINUM,
    icon: '🌟',
    points: 300,
    requirement: { type: 'leaderboard_rank', value: 10 },
    isPremium: false,
    order: 73
  },
  {
    key: 'leaderboard_top_3',
    name: 'Champion',
    description: 'Reach top 3 on the leaderboard',
    category: AchievementCategory.MILESTONE,
    tier: AchievementTier.DIAMOND,
    icon: '🏅',
    points: 1000,
    requirement: { type: 'leaderboard_rank', value: 3 },
    isPremium: true,
    order: 74
  },

  // ========== SEASONAL ACHIEVEMENTS ==========
  {
    key: 'new_year_resolution',
    name: 'New Year Resolution',
    description: 'Practice 10 times in January',
    category: AchievementCategory.SEASONAL,
    tier: AchievementTier.SILVER,
    icon: '🎊',
    points: 100,
    requirement: { type: 'seasonal_practice', value: 10, metadata: { month: 1 } },
    isPremium: false,
    order: 80
  },
  {
    key: 'summer_scholar',
    name: 'Summer Scholar',
    description: 'Practice 20 times during summer months (June-August)',
    category: AchievementCategory.SEASONAL,
    tier: AchievementTier.GOLD,
    icon: '☀️',
    points: 150,
    requirement: { type: 'seasonal_practice', value: 20, metadata: { season: 'summer' } },
    isPremium: false,
    order: 81
  },
  {
    key: 'holiday_hustle',
    name: 'Holiday Hustle',
    description: 'Practice during December holidays',
    category: AchievementCategory.SEASONAL,
    tier: AchievementTier.SILVER,
    icon: '🎄',
    points: 100,
    requirement: { type: 'seasonal_practice', value: 10, metadata: { month: 12 } },
    isPremium: false,
    order: 82
  }
];

async function seedAchievements() {
  try {
    // Connect to MongoDB
    log.info('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    log.info('✅ Connected to MongoDB');

    // Clear existing achievements (optional - comment out in production)
    log.info('🗑️  Clearing existing achievements...');
    await Achievement.deleteMany({});
    log.info('✅ Cleared existing achievements');

    // Insert new achievements
    log.info(`📝 Inserting ${achievements.length} achievements...`);
    const result = await Achievement.insertMany(achievements, { ordered: false });
    log.info(`✅ Successfully inserted ${result.length} achievements`);

    // Show summary by category
    const summary = await Achievement.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          totalPoints: { $sum: '$points' },
          premiumCount: {
            $sum: { $cond: [{ $eq: ['$isPremium', true] }, 1, 0] }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    log.info('\n📊 Achievement Summary by Category:');
    console.table(summary);

    // Show tier distribution
    const tierSummary = await Achievement.aggregate([
      { $match: { tier: { $exists: true } } },
      {
        $group: {
          _id: '$tier',
          count: { $sum: 1 },
          avgPoints: { $avg: '$points' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    log.info('\n🏆 Achievement Tier Distribution:');
    console.table(tierSummary);

    const totalAchievements = await Achievement.countDocuments({ isActive: true });
    const totalPoints = await Achievement.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: null, total: { $sum: '$points' } } }
    ]);

    log.info(`\n🎯 Total Active Achievements: ${totalAchievements}`);
    log.info(`💰 Total Available Points: ${totalPoints[0]?.total || 0}`);
    log.info('\n✨ Achievement seeding completed successfully!\n');
  } catch (error) {
    log.error('❌ Error seeding achievements:', error);
    throw error;
  } finally {
    await mongoose.connection.close();
    log.info('🔌 Database connection closed');
  }
}

// Run the seed function
if (require.main === module) {
  seedAchievements()
    .then(() => {
      process.exit(0);
    })
    .catch(error => {
      log.error('Fatal error:', error);
      process.exit(1);
    });
}

export { achievements, seedAchievements };
