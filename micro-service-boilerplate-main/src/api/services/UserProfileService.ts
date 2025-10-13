import { Types } from 'mongoose';
import * as QRCode from 'qrcode';
import { Logger } from '../../lib/logger';
import { UserStats } from '../models/AchievementModel';
import { IUserProfile, UserProfile } from '../models/UserProfileModel';

const log = new Logger(__filename);

export class UserProfileService {
  /**
   * Create user profile (called during registration)
   */
  async createProfile(userId: string, username: string, email: string): Promise<IUserProfile> {
    // Check if username is taken
    const existing = await UserProfile.findOne({ username: username.toLowerCase() });
    if (existing) {
      throw new Error('Username already taken');
    }

    // Generate QR code for user
    const qrData = JSON.stringify({
      userId,
      username,
      type: 'friend_request'
    });
    const qrCode = await QRCode.toDataURL(qrData);

    const profile = new UserProfile({
      userId: new Types.ObjectId(userId),
      username: username.toLowerCase(),
      social: {
        qrCode,
        allowFriendSuggestions: true,
        showOnlineStatus: true,
        allowDirectMessages: true
      },
      privacy: {
        profileVisibility: 'friends-only',
        leaderboardOptIn: false, // User must opt in
        showStatistics: true,
        showActivity: true,
        showStudyGoals: true
      }
    });

    await profile.save();

    // Initialize user stats
    const stats = new UserStats({
      userId: new Types.ObjectId(userId),
      leaderboardOptIn: false,
      profileVisibility: 'friends-only'
    });
    await stats.save();

    log.info(`Profile created for user ${userId} with username ${username}`);
    return profile;
  }

  /**
   * Get user profile
   */
  async getProfile(userId: string): Promise<IUserProfile | null> {
    return await UserProfile.findOne({ userId: new Types.ObjectId(userId) }).populate('userId', 'name email');
  }

  /**
   * Get profile by username
   */
  async getProfileByUsername(username: string): Promise<IUserProfile | null> {
    return await UserProfile.findOne({ username: username.toLowerCase() }).populate('userId', 'name email');
  }

  /**
   * Update user profile
   */
  async updateProfile(userId: string, updates: Partial<IUserProfile>): Promise<IUserProfile> {
    const profile = await UserProfile.findOne({ userId: new Types.ObjectId(userId) });

    if (!profile) {
      throw new Error('Profile not found');
    }

    // Handle username change (check availability)
    if (updates.username && updates.username !== profile.username) {
      const existing = await UserProfile.findOne({
        username: updates.username.toLowerCase(),
        userId: { $ne: new Types.ObjectId(userId) }
      });

      if (existing) {
        throw new Error('Username already taken');
      }

      profile.username = updates.username.toLowerCase();
    }

    // Update other fields
    if (updates.avatar !== undefined) profile.avatar = updates.avatar;
    if (updates.bio !== undefined) profile.bio = updates.bio;

    if (updates.ieltsInfo) {
      profile.ieltsInfo = { ...profile.ieltsInfo, ...updates.ieltsInfo };
    }

    if (updates.studyGoals) {
      profile.studyGoals = { ...profile.studyGoals, ...updates.studyGoals };
    }

    if (updates.social) {
      profile.social = { ...profile.social, ...updates.social };
    }

    // Update last active
    profile.lastActive = new Date();

    await profile.save();
    log.info(`Profile updated for user ${userId}`);
    return profile;
  }

  /**
   * Update privacy settings
   */
  async updatePrivacySettings(
    userId: string,
    privacySettings: Partial<IUserProfile['privacy']>
  ): Promise<IUserProfile> {
    const profile = await UserProfile.findOne({ userId: new Types.ObjectId(userId) });

    if (!profile) {
      throw new Error('Profile not found');
    }

    profile.privacy = { ...profile.privacy, ...privacySettings };

    // Sync leaderboard opt-in with UserStats
    if (privacySettings.leaderboardOptIn !== undefined) {
      await UserStats.updateOne(
        { userId: new Types.ObjectId(userId) },
        {
          leaderboardOptIn: privacySettings.leaderboardOptIn,
          profileVisibility: privacySettings.profileVisibility || profile.privacy.profileVisibility
        }
      );
    }

    await profile.save();
    log.info(`Privacy settings updated for user ${userId}`);
    return profile;
  }

  /**
   * Get user statistics
   */
  async getUserStatistics(userId: string, requesterId?: string): Promise<any> {
    const profile = await UserProfile.findOne({ userId: new Types.ObjectId(userId) });
    const stats = await UserStats.findOne({ userId: new Types.ObjectId(userId) });

    if (!profile || !stats) {
      throw new Error('User not found');
    }

    // Check privacy settings
    if (profile.privacy.profileVisibility === 'private' && userId !== requesterId) {
      throw new Error('Profile is private');
    }

    if (profile.privacy.profileVisibility === 'friends-only' && userId !== requesterId) {
      // Check if they're friends
      const { friendService } = await import('./FriendService');
      const areFriends = requesterId ? await friendService.areFriends(userId, requesterId) : false;

      if (!areFriends) {
        throw new Error('Can only view friend profiles');
      }
    }

    // Return statistics based on privacy settings
    return {
      userId,
      username: profile.username,
      avatar: profile.avatar,
      bio: profile.bio,
      level: profile.level,
      xp: profile.xp,
      badges: profile.badges,
      statistics: profile.privacy.showStatistics
        ? {
            totalPracticeSessions: stats.totalPracticeSessions,
            totalSimulations: stats.totalSimulations,
            averageScore: stats.averageScore,
            highestScore: stats.highestScore,
            currentStreak: stats.currentStreak,
            longestStreak: stats.longestStreak,
            totalAchievements: stats.totalAchievements,
            achievementPoints: stats.achievementPoints
          }
        : null,
      studyGoals: profile.privacy.showStudyGoals ? profile.studyGoals : null,
      lastActive: profile.privacy.showActivity ? profile.lastActive : null
    };
  }

  /**
   * Generate new QR code for user
   */
  async generateQRCode(userId: string): Promise<string> {
    const profile = await UserProfile.findOne({ userId: new Types.ObjectId(userId) });

    if (!profile) {
      throw new Error('Profile not found');
    }

    const qrData = JSON.stringify({
      userId,
      username: profile.username,
      type: 'friend_request',
      timestamp: Date.now()
    });

    const qrCode = await QRCode.toDataURL(qrData);
    profile.social.qrCode = qrCode;
    await profile.save();

    log.info(`QR code generated for user ${userId}`);
    return qrCode;
  }

  /**
   * Update last active timestamp
   */
  async updateLastActive(userId: string): Promise<void> {
    await UserProfile.updateOne({ userId: new Types.ObjectId(userId) }, { lastActive: new Date() });
  }

  /**
   * Add device token for push notifications
   */
  async addDeviceToken(userId: string, token: string): Promise<void> {
    const profile = await UserProfile.findOne({ userId: new Types.ObjectId(userId) });

    if (profile) {
      if (!profile.deviceTokens) {
        profile.deviceTokens = [];
      }

      if (!profile.deviceTokens.includes(token)) {
        profile.deviceTokens.push(token);
        await profile.save();
      }
    }
  }

  /**
   * Remove device token
   */
  async removeDeviceToken(userId: string, token: string): Promise<void> {
    await UserProfile.updateOne({ userId: new Types.ObjectId(userId) }, { $pull: { deviceTokens: token } });
  }

  /**
   * Check if profile is complete
   */
  async isProfileComplete(userId: string): Promise<boolean> {
    const profile = await UserProfile.findOne({ userId: new Types.ObjectId(userId) });

    if (!profile) {
      return false;
    }

    return !!(profile.username && profile.ieltsInfo?.type && profile.studyGoals?.purpose && profile.bio);
  }

  /**
   * Add XP and update level
   */
  async addExperience(userId: string, xpAmount: number): Promise<{ newLevel?: number; leveledUp: boolean }> {
    const profile = await UserProfile.findOne({ userId: new Types.ObjectId(userId) });

    if (!profile) {
      throw new Error('Profile not found');
    }

    profile.xp += xpAmount;

    // Calculate level (100 XP per level)
    const newLevel = Math.floor(profile.xp / 100) + 1;
    const leveledUp = newLevel > profile.level;

    if (leveledUp) {
      profile.level = newLevel;
      log.info(`User ${userId} leveled up to ${newLevel}`);
    }

    await profile.save();

    return {
      newLevel: leveledUp ? newLevel : undefined,
      leveledUp
    };
  }

  /**
   * Award badge to user
   */
  async awardBadge(userId: string, badgeKey: string): Promise<void> {
    const profile = await UserProfile.findOne({ userId: new Types.ObjectId(userId) });

    if (profile && !profile.badges.includes(badgeKey)) {
      profile.badges.push(badgeKey);
      await profile.save();
      log.info(`Badge ${badgeKey} awarded to user ${userId}`);
    }
  }

  /**
   * Search profiles (respecting privacy)
   */
  async searchProfiles(query: string, requesterId: string, limit: number = 20): Promise<any[]> {
    const regex = new RegExp(query, 'i');

    const profiles = await UserProfile.find({
      $and: [
        {
          $or: [{ username: regex }, { bio: regex }]
        },
        {
          userId: { $ne: new Types.ObjectId(requesterId) }
        },
        {
          'privacy.profileVisibility': { $in: ['public', 'friends-only'] }
        }
      ]
    })
      .select('userId username avatar bio lastActive')
      .limit(limit);

    return profiles;
  }

  /**
   * Get online status
   */
  async getOnlineStatus(userId: string): Promise<boolean> {
    const profile = await UserProfile.findOne({ userId: new Types.ObjectId(userId) });

    if (!profile || !profile.social.showOnlineStatus || !profile.lastActive) {
      return false;
    }

    // Consider online if active within last 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return profile.lastActive > fiveMinutesAgo;
  }
}

export const userProfileService = new UserProfileService();
