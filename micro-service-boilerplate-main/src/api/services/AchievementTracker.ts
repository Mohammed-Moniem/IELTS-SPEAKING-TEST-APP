import { Types } from 'mongoose';
import { Logger } from '../../lib/logger';
import { emitToUser } from '../../loaders/SocketIOLoader';
import { UserStats } from '../models/AchievementModel';
import { achievementService } from './AchievementService';
import { PointsService } from './PointsService';

const log = new Logger(__filename);

/**
 * AchievementTracker - Automatically tracks and unlocks achievements
 * based on user actions across the application
 */
export class AchievementTracker {
  /**
   * Track practice session completion
   * Call this after a practice session is completed
   */
  static async trackPracticeCompletion(
    userId: string,
    sessionData: {
      score?: number;
      partNumber?: number;
      duration?: number;
      topicId?: string;
    }
  ): Promise<void> {
    try {
      log.info('🎯 Tracking practice completion for achievements', {
        userId,
        score: sessionData.score,
        duration: sessionData.duration
      });

      // Get or create user stats
      let stats = await UserStats.findOne({ userId: new Types.ObjectId(userId) });
      if (!stats) {
        stats = new UserStats({
          userId: new Types.ObjectId(userId),
          totalPracticeSessions: 0,
          totalSimulations: 0,
          averageScore: 0,
          highestScore: 0,
          currentStreak: 0,
          longestStreak: 0
        });
      }

      // Update stats
      stats.totalPracticeSessions += 1;

      if (sessionData.score) {
        // Update highest score
        if (sessionData.score > stats.highestScore) {
          stats.highestScore = sessionData.score;
        }

        // Update average score
        const totalScore = stats.averageScore * (stats.totalPracticeSessions - 1) + sessionData.score;
        stats.averageScore = totalScore / stats.totalPracticeSessions;
      }

      // Update streak
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (stats.lastPracticeDate) {
        const lastDate = new Date(stats.lastPracticeDate);
        lastDate.setHours(0, 0, 0, 0);

        const daysDiff = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

        if (daysDiff === 0) {
          // Same day, no streak change
        } else if (daysDiff === 1) {
          // Consecutive day, increment streak
          stats.currentStreak += 1;
          if (stats.currentStreak > stats.longestStreak) {
            stats.longestStreak = stats.currentStreak;
          }
        } else {
          // Streak broken, reset
          stats.currentStreak = 1;
        }
      } else {
        // First practice
        stats.currentStreak = 1;
        stats.longestStreak = 1;
      }

      stats.lastPracticeDate = new Date();
      await stats.save();

      // Check achievements
      const unlockedAchievements = await achievementService.checkAchievements(userId, {
        practiceCount: stats.totalPracticeSessions,
        score: sessionData.score || stats.highestScore,
        streak: stats.currentStreak
      });

      // Emit socket events for newly unlocked achievements
      if (unlockedAchievements.length > 0) {
        log.info('🏆 Achievements unlocked!', {
          userId,
          count: unlockedAchievements.length,
          achievements: unlockedAchievements.map(a => a.achievementKey)
        });

        for (const userAchievement of unlockedAchievements) {
          emitToUser(userId, 'achievement:unlocked', {
            achievement: userAchievement,
            timestamp: new Date()
          });

          // Grant achievement points (Phase 2: Gamification)
          try {
            // Fetch full achievement details to get points and category
            const { Achievement } = await import('../models/AchievementModel');
            const fullAchievement = await Achievement.findOne({
              key: userAchievement.achievementKey
            });

            if (fullAchievement) {
              const isMilestone = fullAchievement.category === 'MILESTONE';
              const pointsResult = await PointsService.grantAchievementPoints(
                userId,
                userAchievement.achievementKey,
                fullAchievement.points || 0,
                isMilestone
              );

              // Emit points granted event
              emitToUser(userId, 'points:granted', {
                points: pointsResult.points,
                source: 'achievement',
                achievementKey: userAchievement.achievementKey,
                isMilestone
              });

              log.info(`💰 Granted ${pointsResult.points} points for achievement ${userAchievement.achievementKey}`);
            }
          } catch (pointsError: any) {
            log.error('❌ Error granting achievement points:', {
              error: pointsError.message,
              achievementKey: userAchievement.achievementKey,
              userId
            });
            // Don't fail achievement unlock if points grant fails
          }
        }
      }
    } catch (error: any) {
      log.error('❌ Error tracking practice completion:', {
        error: error.message,
        stack: error.stack,
        userId
      });
    }
  }

  /**
   * Track full test simulation completion
   */
  static async trackSimulationCompletion(
    userId: string,
    simulationData: {
      overallScore?: number;
      duration?: number;
    }
  ): Promise<void> {
    try {
      log.info('📝 Tracking simulation completion for achievements', {
        userId,
        score: simulationData.overallScore
      });

      let stats = await UserStats.findOne({ userId: new Types.ObjectId(userId) });
      if (!stats) {
        stats = new UserStats({
          userId: new Types.ObjectId(userId),
          totalSimulations: 0
        });
      }

      stats.totalSimulations += 1;
      await stats.save();

      // Check achievements (simulations could unlock special achievements)
      await achievementService.checkAchievements(userId, {
        practiceCount: stats.totalPracticeSessions,
        score: simulationData.overallScore || stats.highestScore,
        streak: stats.currentStreak
      });
    } catch (error: any) {
      log.error('❌ Error tracking simulation completion:', {
        error: error.message,
        userId
      });
    }
  }

  /**
   * Track friend addition
   */
  static async trackFriendAdded(userId: string, friendCount: number): Promise<void> {
    try {
      log.info('👥 Tracking friend added for achievements', { userId, friendCount });

      const unlockedAchievements = await achievementService.checkAchievements(userId, {
        friendCount
      });

      if (unlockedAchievements.length > 0) {
        for (const achievement of unlockedAchievements) {
          emitToUser(userId, 'achievement:unlocked', {
            achievement,
            timestamp: new Date()
          });
        }
      }
    } catch (error: any) {
      log.error('❌ Error tracking friend addition:', {
        error: error.message,
        userId
      });
    }
  }

  /**
   * Track group join
   */
  static async trackGroupJoined(userId: string, groupCount: number): Promise<void> {
    try {
      log.info('👨‍👩‍👧‍👦 Tracking group joined for achievements', { userId, groupCount });

      const unlockedAchievements = await achievementService.checkAchievements(userId, {
        groupCount
      });

      if (unlockedAchievements.length > 0) {
        for (const achievement of unlockedAchievements) {
          emitToUser(userId, 'achievement:unlocked', {
            achievement,
            timestamp: new Date()
          });
        }
      }
    } catch (error: any) {
      log.error('❌ Error tracking group join:', {
        error: error.message,
        userId
      });
    }
  }

  /**
   * Track referral success
   */
  static async trackReferralSuccess(userId: string, referralCount: number): Promise<void> {
    try {
      log.info('📣 Tracking referral success for achievements', { userId, referralCount });

      const unlockedAchievements = await achievementService.checkAchievements(userId, {
        referralCount
      });

      if (unlockedAchievements.length > 0) {
        for (const achievement of unlockedAchievements) {
          emitToUser(userId, 'achievement:unlocked', {
            achievement,
            timestamp: new Date()
          });
        }
      }
    } catch (error: any) {
      log.error('❌ Error tracking referral:', {
        error: error.message,
        userId
      });
    }
  }

  /**
   * Track profile completion
   */
  static async trackProfileCompleted(userId: string): Promise<void> {
    try {
      log.info('📋 Tracking profile completion for achievements', { userId });

      const unlockedAchievements = await achievementService.checkAchievements(userId, {
        // Profile complete is a special check
      });

      if (unlockedAchievements.length > 0) {
        for (const achievement of unlockedAchievements) {
          emitToUser(userId, 'achievement:unlocked', {
            achievement,
            timestamp: new Date()
          });
        }
      }
    } catch (error: any) {
      log.error('❌ Error tracking profile completion:', {
        error: error.message,
        userId
      });
    }
  }

  /**
   * Track leaderboard rank update
   */
  static async trackLeaderboardRank(userId: string, rank: number): Promise<void> {
    try {
      log.info('🏅 Tracking leaderboard rank for achievements', { userId, rank });

      const unlockedAchievements = await achievementService.checkAchievements(userId, {
        leaderboardRank: rank
      });

      if (unlockedAchievements.length > 0) {
        for (const achievement of unlockedAchievements) {
          emitToUser(userId, 'achievement:unlocked', {
            achievement,
            timestamp: new Date()
          });
        }
      }
    } catch (error: any) {
      log.error('❌ Error tracking leaderboard rank:', {
        error: error.message,
        userId
      });
    }
  }

  /**
   * Track speed achievement (fast completion)
   * Call this when a practice session is completed quickly
   */
  static async trackSpeedCompletion(
    userId: string,
    data: {
      partNumber: number;
      duration: number; // in seconds
      targetDuration: number; // in seconds
    }
  ): Promise<void> {
    try {
      if (data.duration <= data.targetDuration) {
        log.info('⚡ Tracking speed completion for achievements', {
          userId,
          partNumber: data.partNumber,
          duration: data.duration,
          target: data.targetDuration
        });

        const unlockedAchievements = await achievementService.checkAchievements(userId, {
          speedCompletion: true,
          partNumber: data.partNumber,
          duration: data.duration
        });

        if (unlockedAchievements.length > 0) {
          for (const achievement of unlockedAchievements) {
            emitToUser(userId, 'achievement:unlocked', {
              achievement,
              timestamp: new Date()
            });
          }
        }
      }
    } catch (error: any) {
      log.error('❌ Error tracking speed completion:', {
        error: error.message,
        userId
      });
    }
  }

  /**
   * Track time-based practice (morning/night/weekend)
   * Call this after each practice session
   */
  static async trackTimeBased(userId: string, practiceTime: Date): Promise<void> {
    try {
      const hour = practiceTime.getHours();
      const day = practiceTime.getDay(); // 0 = Sunday, 6 = Saturday

      let timeRange: string | undefined;
      let dayType: string | undefined;

      // Determine time range
      if (hour >= 5 && hour < 9) {
        timeRange = 'morning';
        log.info('🌅 Early morning practice detected', { userId, hour });
      } else if (hour >= 22 || hour < 5) {
        timeRange = 'night';
        log.info('🦉 Night practice detected', { userId, hour });
      }

      // Determine day type
      if (day === 0 || day === 6) {
        dayType = 'weekend';
        log.info('🎮 Weekend practice detected', { userId, day });
      }

      if (timeRange || dayType) {
        const unlockedAchievements = await achievementService.checkAchievements(userId, {
          timeRange,
          dayType,
          practiceDate: practiceTime
        });

        if (unlockedAchievements.length > 0) {
          for (const achievement of unlockedAchievements) {
            emitToUser(userId, 'achievement:unlocked', {
              achievement,
              timestamp: new Date()
            });
          }
        }
      }
    } catch (error: any) {
      log.error('❌ Error tracking time-based practice:', {
        error: error.message,
        userId
      });
    }
  }

  /**
   * Track topic mastery
   * Call this when a user scores well on a specific topic
   */
  static async trackTopicMastery(
    userId: string,
    data: {
      topicKey: string;
      topicName: string;
      score: number;
    }
  ): Promise<void> {
    try {
      if (data.score >= 8.0) {
        log.info('🎯 High score on topic detected', {
          userId,
          topic: data.topicName,
          score: data.score
        });

        const unlockedAchievements = await achievementService.checkAchievements(userId, {
          topicMastery: data.topicKey,
          score: data.score
        });

        if (unlockedAchievements.length > 0) {
          for (const achievement of unlockedAchievements) {
            emitToUser(userId, 'achievement:unlocked', {
              achievement,
              timestamp: new Date()
            });
          }
        }
      }
    } catch (error: any) {
      log.error('❌ Error tracking topic mastery:', {
        error: error.message,
        userId
      });
    }
  }

  /**
   * Track seasonal achievements
   * Call this during practice sessions to check seasonal goals
   */
  static async trackSeasonalPractice(userId: string, practiceDate: Date): Promise<void> {
    try {
      const month = practiceDate.getMonth() + 1; // 1-12

      log.info('🎊 Checking seasonal achievements', { userId, month });

      const unlockedAchievements = await achievementService.checkAchievements(userId, {
        seasonalMonth: month,
        practiceDate
      });

      if (unlockedAchievements.length > 0) {
        for (const achievement of unlockedAchievements) {
          emitToUser(userId, 'achievement:unlocked', {
            achievement,
            timestamp: new Date()
          });
        }
      }
    } catch (error: any) {
      log.error('❌ Error tracking seasonal practice:', {
        error: error.message,
        userId
      });
    }
  }

  /**
   * Manually trigger achievement check for a user
   * Useful for recalculating all achievements
   */
  static async recheckAllAchievements(userId: string): Promise<void> {
    try {
      log.info('🔄 Rechecking all achievements for user', { userId });

      const stats = await UserStats.findOne({ userId: new Types.ObjectId(userId) });
      if (!stats) {
        log.warn('⚠️ No stats found for user', { userId });
        return;
      }

      // Get friend count (you'll need to implement this based on your friendship model)
      // const friendCount = await getFriendCount(userId);
      const friendCount = 0; // Placeholder

      await achievementService.checkAchievements(userId, {
        practiceCount: stats.totalPracticeSessions,
        score: stats.highestScore,
        streak: stats.currentStreak,
        friendCount
        // Add other context as needed
      });

      log.info('✅ Achievement recheck complete', { userId });
    } catch (error: any) {
      log.error('❌ Error rechecking achievements:', {
        error: error.message,
        userId
      });
    }
  }
}

export const achievementTracker = AchievementTracker;
