import { Types } from '@lib/db/mongooseCompat';
import { Logger } from '../../lib/logger';
import { UserStats } from '../models/AchievementModel';
import { IUserProfile, UserProfile } from '../models/UserProfileModel';

const log = new Logger(__filename);

export class UserProfileService {
  /**
   * Create user profile (called during registration)
   */
  async createProfile(userId: string, username: string, _email: string): Promise<IUserProfile> {
    // Check if username is taken
    const existing = await UserProfile.findOne({ username: username.toLowerCase() });
    if (existing) {
      throw new Error('Username already taken');
    }

    const profile = new UserProfile({
      userId: new Types.ObjectId(userId),
      username: username.toLowerCase(),
      social: {
        qrCode: this.buildFriendQrPayload(userId, username),
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
    try {
      const profile = await UserProfile.findOne({ userId: new Types.ObjectId(userId) })
        .populate('userId', 'firstName lastName email')
        .lean();
      log.info(`getProfile: Found profile for user ${userId}:`, profile ? 'yes' : 'no');
      return profile as any;
    } catch (error: any) {
      log.error(`getProfile: Error fetching profile for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get profile by username
   */
  async getProfileByUsername(username: string): Promise<IUserProfile | null> {
    return (await UserProfile.findOne({ username: username.toLowerCase() })
      .populate('userId', 'firstName lastName email')
      .lean()) as any;
  }

  /**
   * Update user profile (creates if doesn't exist)
   */
  async updateProfile(userId: string, updates: Partial<IUserProfile>): Promise<IUserProfile> {
    let profile = await UserProfile.findOne({ userId: new Types.ObjectId(userId) });

    // If profile doesn't exist, create it first
    if (!profile) {
      log.info(`Profile not found for user ${userId}, creating new profile`);

      // Generate default username if not provided (only lowercase, numbers, underscores)
      const defaultUsername = updates.username || `user_${userId.slice(-8).replace(/[^a-z0-9_]/gi, '')}`;

      // Check if username is taken
      const existingUsername = await UserProfile.findOne({ username: defaultUsername.toLowerCase() });
      if (existingUsername) {
        throw new Error('Username already taken');
      }

      // Build initial friend QR payload
      const qrPayload = this.buildFriendQrPayload(userId, defaultUsername);

      profile = new UserProfile({
        userId: new Types.ObjectId(userId),
        username: defaultUsername.toLowerCase(),
        social: {
          qrCode: qrPayload,
          allowFriendSuggestions: true,
          showOnlineStatus: true,
          allowDirectMessages: true
        },
        privacy: {
          profileVisibility: 'friends-only',
          leaderboardOptIn: false,
          showStatistics: true,
          showActivity: true,
          showStudyGoals: true
        }
      });

      // Initialize user stats
      const existingStats = await UserStats.findOne({ userId: new Types.ObjectId(userId) });
      if (!existingStats) {
        const stats = new UserStats({
          userId: new Types.ObjectId(userId),
          leaderboardOptIn: false,
          profileVisibility: 'friends-only'
        });
        await stats.save();
      }
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

    try {
      await profile.save();
      log.info(`Profile ${profile._id ? 'updated' : 'created'} for user ${userId}`);
      return profile;
    } catch (saveError: any) {
      log.error(`Error saving profile for user ${userId}:`, saveError);
      throw new Error(saveError.message || 'Failed to save profile');
    }
  }

  /**
   * Update privacy settings (creates profile if doesn't exist)
   */
  async updatePrivacySettings(
    userId: string,
    privacySettings: Partial<IUserProfile['privacy']>
  ): Promise<IUserProfile> {
    let profile = await UserProfile.findOne({ userId: new Types.ObjectId(userId) });

    // If profile doesn't exist, create it first with minimal data
    if (!profile) {
      log.info(`Profile not found for user ${userId}, creating new profile for privacy settings`);
      await this.updateProfile(userId, {});
      profile = await UserProfile.findOne({ userId: new Types.ObjectId(userId) });
      if (!profile) {
        throw new Error('Failed to create profile');
      }
    }

    profile.privacy = { ...profile.privacy, ...privacySettings };

    // Sync leaderboard opt-in with UserStats
    if (privacySettings.leaderboardOptIn !== undefined) {
      await UserStats.updateOne(
        { userId: new Types.ObjectId(userId) },
        {
          leaderboardOptIn: privacySettings.leaderboardOptIn,
          profileVisibility: privacySettings.profileVisibility || profile.privacy.profileVisibility
        },
        { upsert: true }
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
   * Generate new QR payload for the requested purpose
   */
  async generateQRCode(userId: string, purpose: 'friend' | 'referral' = 'friend'): Promise<string> {
    const profile = await UserProfile.findOne({ userId: new Types.ObjectId(userId) });

    if (!profile) {
      throw new Error('Profile not found');
    }

    const username = profile.username;
    let payload: string;

    if (purpose === 'referral') {
      const { referralService } = await import('./ReferralService');
      const referralCode = await referralService.getUserReferralCode(userId);
      const referralLink = await referralService.createReferralLink(userId);

      payload = JSON.stringify({
        version: 1,
        type: 'referral',
        userId,
        username,
        referralCode,
        referralLink,
        ts: Date.now()
      });
    } else {
      payload = this.buildFriendQrPayload(userId, username);
      profile.social.qrCode = payload;
      await profile.save();
    }

    log.info(`QR payload generated for user ${userId} (purpose=${purpose})`);
    return payload;
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

  /**
   * Resolve QR payload scanned by requester
   */
  async resolveQRCodePayload(code: string, requesterId: string) {
    const payload = this.parseQrPayload(code);

    if (payload.type === 'friend_invite') {
      if (!payload.userId) {
        throw new Error('Invalid friend QR payload');
      }

      if (payload.userId === requesterId) {
        throw new Error('You cannot scan your own QR code');
      }

      const profile = await UserProfile.findOne({
        userId: new Types.ObjectId(payload.userId)
      })
        .select('username avatar bio level xp')
        .lean();

      if (!profile) {
        throw new Error('User not found');
      }

      const { friendService } = await import('./FriendService');
      const status = await friendService.getRelationshipStatus(requesterId, payload.userId);

      return {
        type: 'friend_invite',
        user: {
          userId: payload.userId,
          username: profile.username,
          avatar: profile.avatar,
          bio: profile.bio,
          level: profile.level,
          xp: profile.xp
        },
        status
      };
    }

    if (payload.type === 'referral') {
      if (!payload.referralCode) {
        throw new Error('Invalid referral QR payload');
      }

      const profile = await UserProfile.findOne({
        userId: new Types.ObjectId(payload.userId)
      })
        .select('username avatar')
        .lean();

      return {
        type: 'referral',
        referrer: {
          userId: payload.userId,
          username: profile?.username || payload.username,
          avatar: profile?.avatar
        },
        referralCode: payload.referralCode,
        referralLink: payload.referralLink
      };
    }

    throw new Error('Unsupported QR code type');
  }

  private buildFriendQrPayload(userId: string, username: string): string {
    return JSON.stringify({
      version: 1,
      type: 'friend_invite',
      userId,
      username,
      ts: Date.now()
    });
  }

  private parseQrPayload(code: string): any {
    if (!code || typeof code !== 'string') {
      throw new Error('Invalid QR code data');
    }

    try {
      const payload = JSON.parse(code);
      if (!payload.type) {
        throw new Error('Missing QR code type');
      }
      return payload;
    } catch (error) {
      throw new Error('Invalid QR code format');
    }
  }
}

export const userProfileService = new UserProfileService();
