import { Types } from '@lib/db/mongooseCompat';
import { Logger } from '../../lib/logger';
import {
  Achievement,
  AchievementCategory,
  IAchievement,
  IUserAchievement,
  UserAchievement,
  UserStats
} from '../models/AchievementModel';

const log = new Logger(__filename);

export class AchievementService {
  /**
   * Initialize default achievements (run once on server startup)
   */
  async initializeAchievements(): Promise<void> {
    const existingCount = await Achievement.countDocuments();

    if (existingCount > 0) {
      log.info('Achievements already initialized');
      return;
    }

    const achievements: Partial<IAchievement>[] = [
      // Practice Achievements
      {
        key: 'first_practice',
        name: 'First Steps',
        description: 'Complete your first practice session',
        category: AchievementCategory.PRACTICE,
        icon: '🎯',
        points: 10,
        requirement: { type: 'practice_count', value: 1 },
        isPremium: false,
        isActive: true,
        order: 1
      },
      {
        key: 'practice_10',
        name: 'Getting Started',
        description: 'Complete 10 practice sessions',
        category: AchievementCategory.PRACTICE,
        icon: '💪',
        points: 25,
        requirement: { type: 'practice_count', value: 10 },
        isPremium: false,
        isActive: true,
        order: 2
      },
      {
        key: 'practice_50',
        name: 'Dedicated Learner',
        description: 'Complete 50 practice sessions',
        category: AchievementCategory.PRACTICE,
        icon: '🏆',
        points: 50,
        requirement: { type: 'practice_count', value: 50 },
        isPremium: false,
        isActive: true,
        order: 3
      },
      {
        key: 'practice_100',
        name: 'Century Club',
        description: 'Complete 100 practice sessions',
        category: AchievementCategory.PRACTICE,
        icon: '💯',
        points: 100,
        requirement: { type: 'practice_count', value: 100 },
        isPremium: true,
        isActive: true,
        order: 4
      },

      // Improvement Achievements
      {
        key: 'first_band_6',
        name: 'Band 6 Achiever',
        description: 'Score 6.0 or higher',
        category: AchievementCategory.IMPROVEMENT,
        icon: '⭐',
        points: 20,
        requirement: { type: 'score_threshold', value: 6.0 },
        isPremium: false,
        isActive: true,
        order: 10
      },
      {
        key: 'first_band_7',
        name: 'Band 7 Achiever',
        description: 'Score 7.0 or higher',
        category: AchievementCategory.IMPROVEMENT,
        icon: '🌟',
        points: 40,
        requirement: { type: 'score_threshold', value: 7.0 },
        isPremium: false,
        isActive: true,
        order: 11
      },
      {
        key: 'first_band_8',
        name: 'Band 8 Achiever',
        description: 'Score 8.0 or higher - Excellent!',
        category: AchievementCategory.IMPROVEMENT,
        icon: '✨',
        points: 75,
        requirement: { type: 'score_threshold', value: 8.0 },
        isPremium: false,
        isActive: true,
        order: 12
      },
      {
        key: 'improvement_2_bands',
        name: 'Great Progress',
        description: 'Improve your score by 2 bands',
        category: AchievementCategory.IMPROVEMENT,
        icon: '📈',
        points: 60,
        requirement: { type: 'score_improvement', value: 2 },
        isPremium: true,
        isActive: true,
        order: 13
      },

      // Streak Achievements
      {
        key: 'streak_3',
        name: '3-Day Streak',
        description: 'Practice for 3 consecutive days',
        category: AchievementCategory.STREAK,
        icon: '🔥',
        points: 15,
        requirement: { type: 'streak_days', value: 3 },
        isPremium: false,
        isActive: true,
        order: 20
      },
      {
        key: 'streak_7',
        name: 'Week Warrior',
        description: 'Practice for 7 consecutive days',
        category: AchievementCategory.STREAK,
        icon: '🔥🔥',
        points: 35,
        requirement: { type: 'streak_days', value: 7 },
        isPremium: false,
        isActive: true,
        order: 21
      },
      {
        key: 'streak_30',
        name: 'Month Master',
        description: 'Practice for 30 consecutive days',
        category: AchievementCategory.STREAK,
        icon: '🔥🔥🔥',
        points: 100,
        requirement: { type: 'streak_days', value: 30 },
        isPremium: true,
        isActive: true,
        order: 22
      },

      // Social Achievements
      {
        key: 'first_friend',
        name: 'Social Butterfly',
        description: 'Add your first friend',
        category: AchievementCategory.SOCIAL,
        icon: '👥',
        points: 10,
        requirement: { type: 'friend_count', value: 1 },
        isPremium: false,
        isActive: true,
        order: 30
      },
      {
        key: 'friend_10',
        name: 'Popular',
        description: 'Have 10 friends',
        category: AchievementCategory.SOCIAL,
        icon: '🎉',
        points: 30,
        requirement: { type: 'friend_count', value: 10 },
        isPremium: true,
        isActive: true,
        order: 31
      },
      {
        key: 'first_group',
        name: 'Team Player',
        description: 'Join your first study group',
        category: AchievementCategory.SOCIAL,
        icon: '👨‍👩‍👧‍👦',
        points: 20,
        requirement: { type: 'group_count', value: 1 },
        isPremium: true,
        isActive: true,
        order: 32
      },
      {
        key: 'referral_5',
        name: 'Influencer',
        description: 'Successfully refer 5 friends',
        category: AchievementCategory.SOCIAL,
        icon: '📣',
        points: 50,
        requirement: { type: 'referral_count', value: 5 },
        isPremium: false,
        isActive: true,
        order: 33
      },

      // Milestone Achievements
      {
        key: 'profile_complete',
        name: 'Complete Profile',
        description: 'Fill out your complete profile',
        category: AchievementCategory.MILESTONE,
        icon: '📋',
        points: 15,
        requirement: { type: 'profile_complete', value: 1 },
        isPremium: false,
        isActive: true,
        order: 40
      },
      {
        key: 'leaderboard_top_10',
        name: 'Top 10 Finisher',
        description: 'Reach top 10 on the leaderboard',
        category: AchievementCategory.MILESTONE,
        icon: '🏅',
        points: 75,
        requirement: { type: 'leaderboard_rank', value: 10 },
        isPremium: true,
        isActive: true,
        order: 41
      },
      {
        key: 'leaderboard_top_3',
        name: 'Podium Finish',
        description: 'Reach top 3 on the leaderboard',
        category: AchievementCategory.MILESTONE,
        icon: '🥇',
        points: 150,
        requirement: { type: 'leaderboard_rank', value: 3 },
        isPremium: true,
        isActive: true,
        order: 42
      }
    ];

    await Achievement.insertMany(achievements);
    log.info(`Initialized ${achievements.length} achievements`);
  }

  /**
   * Check and unlock achievements for user
   */
  async checkAchievements(
    userId: string,
    context: {
      practiceCount?: number;
      score?: number;
      streak?: number;
      friendCount?: number;
      groupCount?: number;
      referralCount?: number;
      leaderboardRank?: number;
      // Speed achievements
      speedCompletion?: boolean;
      partNumber?: number;
      duration?: number;
      // Time-based achievements
      timeRange?: string; // 'morning' | 'night'
      dayType?: string; // 'weekend' | 'weekday'
      practiceDate?: Date;
      // Topic mastery
      topicMastery?: string; // topic key
      // Seasonal
      seasonalMonth?: number;
    }
  ): Promise<IUserAchievement[]> {
    const unlockedAchievements: IUserAchievement[] = [];

    // Get all active achievements
    const achievements = await Achievement.find({ isActive: true });

    for (const achievement of achievements) {
      // Check if already unlocked
      const existing = await UserAchievement.findOne({
        userId: new Types.ObjectId(userId),
        achievementId: achievement._id
      });

      if (existing?.isUnlocked) {
        continue; // Already unlocked
      }

      // Check if requirement is met
      const isMet = this.checkRequirement(achievement.requirement, context);

      if (isMet) {
        // Unlock achievement
        if (existing) {
          existing.isUnlocked = true;
          existing.unlockedAt = new Date();
          existing.progress = achievement.requirement.value;
          await existing.save();
          unlockedAchievements.push(existing);
        } else {
          const newAchievement = new UserAchievement({
            userId: new Types.ObjectId(userId),
            achievementId: achievement._id,
            achievementKey: achievement.key,
            progress: achievement.requirement.value,
            isUnlocked: true,
            unlockedAt: new Date()
          });
          await newAchievement.save();
          unlockedAchievements.push(newAchievement);
        }

        // Update user stats
        await this.updateUserAchievementStats(userId, achievement.points);

        log.info(`Achievement unlocked: ${achievement.key} for user ${userId}`);
      } else if (!existing) {
        // Create progress record
        const progress = this.calculateProgress(achievement.requirement, context);
        const userAchievement = new UserAchievement({
          userId: new Types.ObjectId(userId),
          achievementId: achievement._id,
          achievementKey: achievement.key,
          progress,
          isUnlocked: false
        });
        await userAchievement.save();
      } else {
        // Update progress
        const progress = this.calculateProgress(achievement.requirement, context);
        existing.progress = progress;
        await existing.save();
      }
    }

    return unlockedAchievements;
  }

  /**
   * Get user's achievements
   */
  async getUserAchievements(userId: string): Promise<any[]> {
    const userAchievements = await UserAchievement.find({
      userId: new Types.ObjectId(userId)
    })
      .populate('achievementId')
      .sort({ unlockedAt: -1 });

    return userAchievements.map(ua => ({
      ...ua.toObject(),
      achievement: ua.achievementId
    }));
  }

  /**
   * Get all achievements with user progress
   */
  async getAllAchievementsWithProgress(userId: string): Promise<any[]> {
    const allAchievements = await Achievement.find({ isActive: true }).sort({ category: 1, order: 1 });
    const userAchievements = await UserAchievement.find({ userId: new Types.ObjectId(userId) });

    const achievementMap = new Map<string, (typeof userAchievements)[number]>(
      userAchievements.map(ua => [ua.achievementKey, ua])
    );

    return allAchievements.map(achievement => {
      const userProgress = achievementMap.get(achievement.key);
      return {
        ...achievement.toObject(),
        userProgress: {
          progress: userProgress?.progress || 0,
          isUnlocked: userProgress?.isUnlocked || false,
          unlockedAt: userProgress?.unlockedAt
        }
      };
    });
  }

  /**
   * Get achievements by category
   */
  async getAchievementsByCategory(category: AchievementCategory): Promise<IAchievement[]> {
    return await Achievement.find({
      category,
      isActive: true
    }).sort({ order: 1 });
  }

  /**
   * Check if requirement is met
   */
  private checkRequirement(requirement: any, context: any): boolean {
    switch (requirement.type) {
      case 'practice_count':
        return (context.practiceCount || 0) >= requirement.value;

      case 'score_threshold':
        return (context.score || 0) >= requirement.value;

      case 'streak_days':
        return (context.streak || 0) >= requirement.value;

      case 'friend_count':
        return (context.friendCount || 0) >= requirement.value;

      case 'group_count':
        return (context.groupCount || 0) >= requirement.value;

      case 'referral_count':
        return (context.referralCount || 0) >= requirement.value;

      case 'leaderboard_rank':
        return (context.leaderboardRank || Infinity) <= requirement.value;

      case 'profile_complete':
        return true; // Checked separately

      default:
        return false;
    }
  }

  /**
   * Calculate progress towards achievement
   */
  private calculateProgress(requirement: any, context: any): number {
    switch (requirement.type) {
      case 'practice_count':
        return Math.min(context.practiceCount || 0, requirement.value);

      case 'streak_days':
        return Math.min(context.streak || 0, requirement.value);

      case 'friend_count':
        return Math.min(context.friendCount || 0, requirement.value);

      case 'group_count':
        return Math.min(context.groupCount || 0, requirement.value);

      case 'referral_count':
        return Math.min(context.referralCount || 0, requirement.value);

      default:
        return 0;
    }
  }

  /**
   * Update user's achievement statistics
   */
  private async updateUserAchievementStats(userId: string, points: number): Promise<void> {
    let stats = await UserStats.findOne({ userId: new Types.ObjectId(userId) });

    if (!stats) {
      stats = new UserStats({
        userId: new Types.ObjectId(userId),
        totalAchievements: 0,
        achievementPoints: 0
      });
    }

    stats.totalAchievements += 1;
    stats.achievementPoints += points;
    await stats.save();
  }
}

export const achievementService = new AchievementService();
