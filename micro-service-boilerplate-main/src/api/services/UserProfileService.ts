import { getSupabaseAdmin } from '@lib/supabaseClient';
import { Logger } from '../../lib/logger';

const log = new Logger(__filename);

type UserProfileRow = {
  id: string;
  user_id: string;
  username: string;
  avatar: string | null;
  bio: string | null;
  ielts_info: any;
  study_goals: any;
  social: any;
  privacy: any;
  badges: string[] | null;
  level: number;
  xp: number;
  last_active: string;
  created_at: string;
  updated_at: string;
};

type UserStatsRow = {
  user_id: string;
  total_practice_sessions: number;
  total_simulations: number;
  average_score: number;
  highest_score: number;
  current_streak: number;
  longest_streak: number;
  total_achievements: number;
  achievement_points: number;
  weekly_score: number;
  monthly_score: number;
  leaderboard_opt_in: boolean;
  profile_visibility: string;
};

const DEFAULT_SOCIAL = {
  qrCode: null,
  allowFriendSuggestions: true,
  showOnlineStatus: true,
  allowDirectMessages: true
};

const DEFAULT_PRIVACY = {
  profileVisibility: 'friends-only',
  leaderboardOptIn: false,
  showStatistics: true,
  showActivity: true,
  showStudyGoals: true
};

function buildFriendQrPayload(userId: string, username: string): string {
  return JSON.stringify({
    version: 1,
    type: 'friend_invite',
    userId,
    username,
    ts: Date.now()
  });
}

function parseQrPayload(code: string): any {
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

export class UserProfileService {
  /**
   * Create user profile (legacy entry point; most users are provisioned via DB trigger)
   */
  async createProfile(userId: string, username: string, _email: string): Promise<any> {
    const supabase = getSupabaseAdmin();
    const normalized = username.trim().toLowerCase();

    const { data: existing } = await supabase.from('user_profiles').select('id').eq('username', normalized).maybeSingle();
    if (existing) {
      throw new Error('Username already taken');
    }

    const qrCode = buildFriendQrPayload(userId, normalized);
    const { data, error } = await supabase
      .from('user_profiles')
      .insert({
        user_id: userId,
        username: normalized,
        social: { ...DEFAULT_SOCIAL, qrCode },
        privacy: { ...DEFAULT_PRIVACY }
      })
      .select(
        'id, user_id, username, avatar, bio, ielts_info, study_goals, social, privacy, badges, level, xp, last_active, created_at, updated_at'
      )
      .single();

    if (error || !data) {
      throw new Error('Failed to create profile');
    }

    return this.mapProfile(data as UserProfileRow);
  }

  /**
   * Get user profile
   */
  async getProfile(userId: string): Promise<any | null> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('user_profiles')
      .select(
        'id, user_id, username, avatar, bio, ielts_info, study_goals, social, privacy, badges, level, xp, last_active, created_at, updated_at'
      )
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      throw new Error('Failed to load profile');
    }
    if (!data) {
      return null;
    }

    return this.mapProfile(data as UserProfileRow);
  }

  /**
   * Update user profile (creates if it doesn't exist)
   */
  async updateProfile(userId: string, updates: any): Promise<any> {
    const supabase = getSupabaseAdmin();
    const existing = await this.getProfileRow(userId);

    const current = existing || (await this.provisionDefaultProfile(userId, updates?.username));

    let nextUsername = current.username;
    if (typeof updates?.username === 'string' && updates.username.trim()) {
      const candidate = updates.username.trim().toLowerCase();
      if (candidate !== current.username) {
        const { data: taken } = await supabase
          .from('user_profiles')
          .select('id, user_id')
          .eq('username', candidate)
          .maybeSingle();
        if (taken && (taken as any).user_id !== userId) {
          throw new Error('Username already taken');
        }
        nextUsername = candidate;
      }
    }

    const mergedIelts = updates?.ieltsInfo ? { ...(current.ielts_info || {}), ...updates.ieltsInfo } : current.ielts_info;
    const mergedGoals = updates?.studyGoals ? { ...(current.study_goals || {}), ...updates.studyGoals } : current.study_goals;
    const mergedSocial = updates?.social ? { ...(current.social || DEFAULT_SOCIAL), ...updates.social } : current.social;

    const payload: Record<string, any> = {
      username: nextUsername,
      avatar: updates?.avatar !== undefined ? updates.avatar : current.avatar,
      bio: updates?.bio !== undefined ? updates.bio : current.bio,
      ielts_info: mergedIelts || {},
      study_goals: mergedGoals || {},
      social: mergedSocial || DEFAULT_SOCIAL,
      last_active: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('user_profiles')
      .update(payload)
      .eq('user_id', userId)
      .select(
        'id, user_id, username, avatar, bio, ielts_info, study_goals, social, privacy, badges, level, xp, last_active, created_at, updated_at'
      )
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'Failed to update profile');
    }

    return this.mapProfile(data as UserProfileRow);
  }

  /**
   * Update privacy settings (creates profile if doesn't exist)
   */
  async updatePrivacySettings(userId: string, privacySettings: any): Promise<any> {
    const supabase = getSupabaseAdmin();
    const current = (await this.getProfileRow(userId)) || (await this.provisionDefaultProfile(userId));

    const mergedPrivacy = { ...(current.privacy || DEFAULT_PRIVACY), ...(privacySettings || {}) };

    const { data, error } = await supabase
      .from('user_profiles')
      .update({ privacy: mergedPrivacy })
      .eq('user_id', userId)
      .select(
        'id, user_id, username, avatar, bio, ielts_info, study_goals, social, privacy, badges, level, xp, last_active, created_at, updated_at'
      )
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'Failed to update privacy settings');
    }

    // Sync leaderboard opt-in + visibility into user_stats (used by leaderboard endpoints).
    await supabase
      .from('user_stats')
      .upsert(
        {
          user_id: userId,
          leaderboard_opt_in: Boolean(mergedPrivacy.leaderboardOptIn),
          profile_visibility: String(mergedPrivacy.profileVisibility || 'friends-only')
        },
        { onConflict: 'user_id' }
      )
      .throwOnError();

    return this.mapProfile(data as UserProfileRow);
  }

  /**
   * Get user statistics (respects privacy; returns the legacy response shape used by mobile)
   */
  async getUserStatistics(userId: string, requesterId?: string): Promise<any> {
    const supabase = getSupabaseAdmin();
    const profile = await this.getProfileRow(userId);
    if (!profile) {
      throw new Error('User not found');
    }

    const visibility = profile.privacy?.profileVisibility || 'friends-only';

    if (visibility === 'private' && userId !== requesterId) {
      throw new Error('Profile is private');
    }

    if (visibility === 'friends-only' && userId !== requesterId) {
      const { friendService } = await import('./FriendService');
      const areFriends = requesterId ? await friendService.areFriends(userId, requesterId) : false;
      if (!areFriends) {
        throw new Error('Can only view friend profiles');
      }
    }

    const { data: stats } = await supabase
      .from('user_stats')
      .select(
        'user_id, total_practice_sessions, total_simulations, average_score, highest_score, current_streak, longest_streak, total_achievements, achievement_points, weekly_score, monthly_score'
      )
      .eq('user_id', userId)
      .maybeSingle();

    const safe = (stats as UserStatsRow | null) || {
      user_id: userId,
      total_practice_sessions: 0,
      total_simulations: 0,
      average_score: 0,
      highest_score: 0,
      current_streak: 0,
      longest_streak: 0,
      total_achievements: 0,
      achievement_points: 0,
      weekly_score: 0,
      monthly_score: 0,
      leaderboard_opt_in: false,
      profile_visibility: visibility
    };

    return {
      userId,
      username: profile.username,
      avatar: profile.avatar || undefined,
      bio: profile.bio || undefined,
      level: profile.level,
      xp: profile.xp,
      badges: profile.badges || [],
      statistics: profile.privacy?.showStatistics
        ? {
            totalPracticeSessions: Number(safe.total_practice_sessions || 0),
            totalSimulations: Number(safe.total_simulations || 0),
            averageScore: Number(safe.average_score || 0),
            highestScore: Number(safe.highest_score || 0),
            currentStreak: Number(safe.current_streak || 0),
            longestStreak: Number(safe.longest_streak || 0),
            weeklyScore: Number(safe.weekly_score || 0),
            monthlyScore: Number(safe.monthly_score || 0),
            totalAchievements: Number(safe.total_achievements || 0),
            achievementPoints: Number(safe.achievement_points || 0)
          }
        : null,
      studyGoals: profile.privacy?.showStudyGoals ? profile.study_goals || {} : null,
      lastActive: profile.privacy?.showActivity ? profile.last_active : null
    };
  }

  /**
   * Generate/refresh QR payload for the requested purpose
   */
  async generateQRCode(userId: string, purpose: 'friend' | 'referral' = 'friend'): Promise<string> {
    const supabase = getSupabaseAdmin();
    const profile = await this.getProfileRow(userId);
    if (!profile) {
      throw new Error('Profile not found');
    }

    if (purpose === 'referral') {
      const { referralService } = await import('./ReferralService');
      const referralCode = await referralService.getUserReferralCode(userId);
      const referralLink = await referralService.createReferralLink(userId);

      return JSON.stringify({
        version: 1,
        type: 'referral',
        userId,
        username: profile.username,
        referralCode,
        referralLink,
        ts: Date.now()
      });
    }

    const payload = buildFriendQrPayload(userId, profile.username);
    const mergedSocial = { ...(profile.social || DEFAULT_SOCIAL), qrCode: payload };
    await supabase.from('user_profiles').update({ social: mergedSocial }).eq('user_id', userId);
    return payload;
  }

  async updateLastActive(userId: string): Promise<void> {
    const supabase = getSupabaseAdmin();
    await supabase.from('user_profiles').update({ last_active: new Date().toISOString() }).eq('user_id', userId);
  }

  async resolveQRCodePayload(code: string, requesterId: string) {
    const payload = parseQrPayload(code);

    if (payload.type === 'friend_invite') {
      if (!payload.userId) {
        throw new Error('Invalid friend QR payload');
      }
      if (payload.userId === requesterId) {
        throw new Error('You cannot scan your own QR code');
      }

      const profile = await this.getProfileRow(payload.userId);
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
          avatar: profile.avatar || undefined,
          bio: profile.bio || undefined,
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

      const profile = payload.userId ? await this.getProfileRow(payload.userId) : null;

      return {
        type: 'referral',
        referrer: {
          userId: payload.userId,
          username: profile?.username || payload.username,
          avatar: profile?.avatar || undefined
        },
        referralCode: payload.referralCode,
        referralLink: payload.referralLink
      };
    }

    throw new Error('Unsupported QR code type');
  }

  private async getProfileRow(userId: string): Promise<UserProfileRow | null> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('user_profiles')
      .select(
        'id, user_id, username, avatar, bio, ielts_info, study_goals, social, privacy, badges, level, xp, last_active, created_at, updated_at'
      )
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }
    return (data as UserProfileRow | null) || null;
  }

  private async provisionDefaultProfile(userId: string, preferredUsername?: string): Promise<UserProfileRow> {
    const supabase = getSupabaseAdmin();
    const base = preferredUsername?.trim().toLowerCase() || `user_${userId.replace(/-/g, '').slice(0, 12)}`;
    const username = base;
    const qrCode = buildFriendQrPayload(userId, username);

    const { data, error } = await supabase
      .from('user_profiles')
      .upsert(
        {
          user_id: userId,
          username,
          social: { ...DEFAULT_SOCIAL, qrCode },
          privacy: { ...DEFAULT_PRIVACY }
        },
        { onConflict: 'user_id' }
      )
      .select(
        'id, user_id, username, avatar, bio, ielts_info, study_goals, social, privacy, badges, level, xp, last_active, created_at, updated_at'
      )
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'Failed to provision profile');
    }

    return data as UserProfileRow;
  }

  private mapProfile(row: UserProfileRow) {
    const social = { ...DEFAULT_SOCIAL, ...(row.social || {}) };
    const privacy = { ...DEFAULT_PRIVACY, ...(row.privacy || {}) };

    return {
      _id: row.id,
      userId: row.user_id,
      username: row.username,
      avatar: row.avatar || undefined,
      bio: row.bio || undefined,
      level: row.level,
      xp: row.xp,
      badges: row.badges || [],
      ieltsInfo: row.ielts_info || {},
      studyGoals: row.study_goals || {},
      social,
      privacy,
      lastActive: row.last_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export const userProfileService = new UserProfileService();

