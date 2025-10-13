import { Types } from 'mongoose';
import { Logger } from '../../lib/logger';
import { UserStats } from '../models/AchievementModel';
import { UserProfile } from '../models/UserProfileModel';

const log = new Logger(__filename);

export type LeaderboardPeriod = 'daily' | 'weekly' | 'monthly' | 'all-time';
export type LeaderboardMetric = 'score' | 'practices' | 'achievements' | 'streak';

export class LeaderboardService {
  /**
   * Get leaderboard for a specific period
   */
  async getLeaderboard(
    period: LeaderboardPeriod,
    metric: LeaderboardMetric = 'score',
    limit: number = 100,
    userId?: string
  ): Promise<any[]> {
    // Build query based on filters
    const query: any = {
      leaderboardOptIn: true // Only users who opted in
    };

    // Determine sort field based on period and metric
    let sortField: string;

    if (period === 'daily' || period === 'weekly') {
      sortField = period === 'daily' ? 'weeklyScore' : 'weeklyScore'; // Both use weekly for now
    } else if (period === 'monthly') {
      sortField = 'monthlyScore';
    } else {
      sortField = this.getMetricField(metric);
    }

    // Get leaderboard data
    const leaderboard = await UserStats.find(query)
      .sort({ [sortField]: -1 })
      .limit(limit)
      .populate('userId', 'name email')
      .lean();

    // Add user profiles
    const enrichedLeaderboard = [];

    for (let i = 0; i < leaderboard.length; i++) {
      const stats = leaderboard[i];

      const profile = await UserProfile.findOne({ userId: stats.userId }).select('username avatar');

      enrichedLeaderboard.push({
        rank: i + 1,
        userId: stats.userId,
        username: profile?.username || 'Anonymous',
        avatar: profile?.avatar,
        score: this.getMetricValue(stats, metric, period),
        totalSessions: stats.totalPracticeSessions + stats.totalSimulations,
        achievements: stats.totalAchievements,
        streak: stats.currentStreak,
        isCurrentUser: userId ? stats.userId.toString() === userId : false
      });
    }

    return enrichedLeaderboard;
  }

  /**
   * Get friends-only leaderboard
   */
  async getFriendsLeaderboard(
    userId: string,
    period: LeaderboardPeriod,
    metric: LeaderboardMetric = 'score'
  ): Promise<any[]> {
    // Get user's friends (import friendService to avoid circular dependency)
    const { friendService } = await import('./FriendService');
    const friends = await friendService.getFriends(userId);
    const friendIds = friends.map(f => f.userId.toString());

    // Include current user
    friendIds.push(userId);

    const query: any = {
      userId: { $in: friendIds.map(id => new Types.ObjectId(id)) },
      leaderboardOptIn: true
    };

    const sortField = this.getMetricField(metric, period);

    const leaderboard = await UserStats.find(query)
      .sort({ [sortField]: -1 })
      .populate('userId', 'name email')
      .lean();

    // Enrich with profiles
    const enrichedLeaderboard = [];

    for (let i = 0; i < leaderboard.length; i++) {
      const stats = leaderboard[i];

      const profile = await UserProfile.findOne({ userId: stats.userId }).select('username avatar');

      enrichedLeaderboard.push({
        rank: i + 1,
        userId: stats.userId,
        username: profile?.username || 'Anonymous',
        avatar: profile?.avatar,
        score: this.getMetricValue(stats, metric, period),
        totalSessions: stats.totalPracticeSessions + stats.totalSimulations,
        achievements: stats.totalAchievements,
        streak: stats.currentStreak,
        isCurrentUser: stats.userId.toString() === userId,
        isFriend: stats.userId.toString() !== userId
      });
    }

    return enrichedLeaderboard;
  }

  /**
   * Get user's leaderboard position
   */
  async getUserPosition(
    userId: string,
    period: LeaderboardPeriod,
    metric: LeaderboardMetric = 'score'
  ): Promise<{
    rank: number;
    score: number;
    totalUsers: number;
    percentile: number;
  } | null> {
    const userStats = await UserStats.findOne({ userId: new Types.ObjectId(userId) });

    if (!userStats || !userStats.leaderboardOptIn) {
      return null;
    }

    const sortField = this.getMetricField(metric, period);
    const userScore = this.getMetricValue(userStats, metric, period);

    // Count users with better scores
    const betterCount = await UserStats.countDocuments({
      leaderboardOptIn: true,
      [sortField]: { $gt: userScore }
    });

    const rank = betterCount + 1;

    // Get total opted-in users
    const totalUsers = await UserStats.countDocuments({ leaderboardOptIn: true });

    const percentile = totalUsers > 0 ? ((totalUsers - rank + 1) / totalUsers) * 100 : 0;

    return {
      rank,
      score: userScore,
      totalUsers,
      percentile: Math.round(percentile * 10) / 10
    };
  }

  /**
   * Opt user in to leaderboard
   */
  async optInToLeaderboard(userId: string): Promise<void> {
    let stats = await UserStats.findOne({ userId: new Types.ObjectId(userId) });

    if (!stats) {
      stats = new UserStats({
        userId: new Types.ObjectId(userId),
        leaderboardOptIn: true
      });
    } else {
      stats.leaderboardOptIn = true;
    }

    await stats.save();
    log.info(`User ${userId} opted in to leaderboard`);
  }

  /**
   * Opt user out from leaderboard
   */
  async optOutFromLeaderboard(userId: string): Promise<void> {
    const stats = await UserStats.findOne({ userId: new Types.ObjectId(userId) });

    if (stats) {
      stats.leaderboardOptIn = false;
      await stats.save();
      log.info(`User ${userId} opted out from leaderboard`);
    }
  }

  /**
   * Update user stats (called after practice sessions)
   */
  async updateUserStats(userId: string, score: number, isPractice: boolean = true): Promise<void> {
    let stats = await UserStats.findOne({ userId: new Types.ObjectId(userId) });

    if (!stats) {
      stats = new UserStats({
        userId: new Types.ObjectId(userId)
      });
    }

    // Update session counts
    if (isPractice) {
      stats.totalPracticeSessions += 1;
      stats.weeklyPractices += 1;
      stats.monthlyPractices += 1;
    } else {
      stats.totalSimulations += 1;
    }

    // Update scores
    const totalSessions = stats.totalPracticeSessions + stats.totalSimulations;
    stats.averageScore = (stats.averageScore * (totalSessions - 1) + score) / totalSessions;

    if (score > stats.highestScore) {
      stats.highestScore = score;
    }

    // Update weekly/monthly scores (simplified - recalculate from recent sessions)
    stats.weeklyScore = stats.averageScore; // Simplified
    stats.monthlyScore = stats.averageScore; // Simplified

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
        // Consecutive day
        stats.currentStreak += 1;
        if (stats.currentStreak > stats.longestStreak) {
          stats.longestStreak = stats.currentStreak;
        }
      } else {
        // Streak broken
        stats.currentStreak = 1;
      }
    } else {
      stats.currentStreak = 1;
    }

    stats.lastPracticeDate = new Date();
    await stats.save();

    log.info(`Stats updated for user ${userId}: Score=${score}, Streak=${stats.currentStreak}`);
  }

  /**
   * Reset weekly stats (run via cron job every Monday)
   */
  async resetWeeklyStats(): Promise<void> {
    await UserStats.updateMany(
      {},
      {
        $set: {
          weeklyScore: 0,
          weeklyPractices: 0
        }
      }
    );

    log.info('Weekly stats reset completed');
  }

  /**
   * Reset monthly stats (run via cron job on 1st of each month)
   */
  async resetMonthlyStats(): Promise<void> {
    await UserStats.updateMany(
      {},
      {
        $set: {
          monthlyScore: 0,
          monthlyPractices: 0
        }
      }
    );

    log.info('Monthly stats reset completed');
  }

  /**
   * Get metric field name for sorting
   */
  private getMetricField(metric: LeaderboardMetric, period?: LeaderboardPeriod): string {
    if (period === 'daily' || period === 'weekly') {
      return metric === 'score' ? 'weeklyScore' : 'weeklyPractices';
    } else if (period === 'monthly') {
      return metric === 'score' ? 'monthlyScore' : 'monthlyPractices';
    }

    switch (metric) {
      case 'score':
        return 'averageScore';
      case 'practices':
        return 'totalPracticeSessions';
      case 'achievements':
        return 'achievementPoints';
      case 'streak':
        return 'currentStreak';
      default:
        return 'averageScore';
    }
  }

  /**
   * Get metric value from stats
   */
  private getMetricValue(stats: any, metric: LeaderboardMetric, period: LeaderboardPeriod): number {
    if (period === 'daily' || period === 'weekly') {
      return metric === 'score' ? stats.weeklyScore : stats.weeklyPractices;
    } else if (period === 'monthly') {
      return metric === 'score' ? stats.monthlyScore : stats.monthlyPractices;
    }

    switch (metric) {
      case 'score':
        return stats.averageScore;
      case 'practices':
        return stats.totalPracticeSessions;
      case 'achievements':
        return stats.achievementPoints;
      case 'streak':
        return stats.currentStreak;
      default:
        return stats.averageScore;
    }
  }
}

export const leaderboardService = new LeaderboardService();
