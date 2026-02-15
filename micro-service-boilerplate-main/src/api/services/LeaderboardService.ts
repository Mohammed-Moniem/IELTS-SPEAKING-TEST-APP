/**
 * Leaderboard Service (Supabase/Postgres)
 *
 * Leaderboard uses `public.user_stats` for scores/counts and joins
 * `public.user_profiles` + `public.profiles` for display information.
 */

import { getSupabaseAdmin } from '@lib/supabaseClient';
import { Logger } from '@lib/logger';

const log = new Logger(__filename);

export type LeaderboardPeriod = 'daily' | 'weekly' | 'monthly' | 'all-time';
export type LeaderboardMetric = 'score' | 'practices' | 'achievements' | 'streak';

type CacheEntry = { data: any; timestamp: number };
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const leaderboardCache = new Map<string, CacheEntry>();

type UserStatsRow = {
  user_id: string;
  leaderboard_opt_in: boolean;
  average_score: number;
  total_practice_sessions: number;
  achievement_points: number;
  current_streak: number;
  weekly_score: number;
  weekly_practices: number;
  monthly_score: number;
  monthly_practices: number;
};

export class LeaderboardService {
  private getFromCache(key: string): any | null {
    const cached = leaderboardCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }
    if (cached) {
      leaderboardCache.delete(key);
    }
    return null;
  }

  private setCache(key: string, data: any): void {
    leaderboardCache.set(key, { data, timestamp: Date.now() });
  }

  clearCache(): void {
    leaderboardCache.clear();
  }

  private getMetricField(metric: LeaderboardMetric, period: LeaderboardPeriod): keyof UserStatsRow {
    if (period === 'daily' || period === 'weekly') {
      return metric === 'score' ? 'weekly_score' : 'weekly_practices';
    }
    if (period === 'monthly') {
      return metric === 'score' ? 'monthly_score' : 'monthly_practices';
    }

    switch (metric) {
      case 'score':
        return 'average_score';
      case 'practices':
        return 'total_practice_sessions';
      case 'achievements':
        return 'achievement_points';
      case 'streak':
        return 'current_streak';
      default:
        return 'average_score';
    }
  }

  private getMetricValue(stats: UserStatsRow, metric: LeaderboardMetric, period: LeaderboardPeriod): number {
    const field = this.getMetricField(metric, period);
    return Number((stats as any)[field] || 0);
  }

  private async enrichUsers(userIds: string[]) {
    const supabase = getSupabaseAdmin();
    const unique = Array.from(new Set(userIds.filter(Boolean)));
    const byId = new Map<string, { _id: string; email?: string; username?: string; avatar?: string }>();
    unique.forEach(id => byId.set(id, { _id: id }));

    if (!unique.length) return byId;

    const [{ data: profiles }, { data: userProfiles }] = await Promise.all([
      supabase.from('profiles').select('id, email').in('id', unique),
      supabase.from('user_profiles').select('user_id, username, avatar').in('user_id', unique)
    ]);

    (profiles || []).forEach((row: any) => {
      const entry = byId.get(row.id) || { _id: row.id };
      entry.email = row.email;
      byId.set(row.id, entry);
    });

    (userProfiles || []).forEach((row: any) => {
      const userId = row.user_id;
      const entry = byId.get(userId) || { _id: userId };
      entry.username = row.username;
      entry.avatar = row.avatar || undefined;
      byId.set(userId, entry);
    });

    return byId;
  }

  async getLeaderboard(
    period: LeaderboardPeriod,
    metric: LeaderboardMetric = 'score',
    limit: number = 100,
    _userId?: string
  ): Promise<any[]> {
    const safeLimit = Math.max(1, Math.min(limit || 100, 200));
    const cacheKey = `leaderboard:${period}:${metric}:${safeLimit}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    const supabase = getSupabaseAdmin();
    const sortField = this.getMetricField(metric, period);

    const { data, error } = await supabase
      .from('user_stats')
      .select(
        'user_id, leaderboard_opt_in, average_score, total_practice_sessions, achievement_points, current_streak, weekly_score, weekly_practices, monthly_score, monthly_practices'
      )
      .eq('leaderboard_opt_in', true)
      .order(sortField as string, { ascending: false })
      .limit(safeLimit);

    if (error) {
      log.error('Failed to fetch leaderboard', { error: error.message });
      throw new Error('Failed to load leaderboard');
    }

    const rows = (data || []) as UserStatsRow[];
    const userMap = await this.enrichUsers(rows.map(r => r.user_id));

    const leaderboard = rows.map((stats, idx) => {
      const user = userMap.get(stats.user_id) || { _id: stats.user_id };
      return {
        userId: user,
        rank: idx + 1,
        score: this.getMetricValue(stats, metric, period),
        totalPracticeSessions: Number(stats.total_practice_sessions || 0),
        achievementPoints: Number(stats.achievement_points || 0),
        currentStreak: Number(stats.current_streak || 0)
      };
    });

    this.setCache(cacheKey, leaderboard);
    return leaderboard;
  }

  async getFriendsLeaderboard(
    userId: string,
    period: LeaderboardPeriod,
    metric: LeaderboardMetric = 'score'
  ): Promise<any[]> {
    const supabase = getSupabaseAdmin();

    const { data: friendships, error } = await supabase
      .from('friendships')
      .select('user1_id, user2_id')
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`);

    if (error) {
      log.warn('Failed to load friendships for friends leaderboard', { userId, error: error.message });
    }

    const friendIds = (friendships || [])
      .map((row: any) => (row.user1_id === userId ? row.user2_id : row.user1_id))
      .filter(Boolean);

    const participants = Array.from(new Set([userId, ...friendIds]));
    if (!participants.length) return [];

    const sortField = this.getMetricField(metric, period);
    const { data, error: statsError } = await supabase
      .from('user_stats')
      .select(
        'user_id, leaderboard_opt_in, average_score, total_practice_sessions, achievement_points, current_streak, weekly_score, weekly_practices, monthly_score, monthly_practices'
      )
      .eq('leaderboard_opt_in', true)
      .in('user_id', participants)
      .order(sortField as string, { ascending: false })
      .limit(200);

    if (statsError) {
      log.error('Failed to fetch friends leaderboard', { error: statsError.message });
      throw new Error('Failed to load friends leaderboard');
    }

    const rows = (data || []) as UserStatsRow[];
    const userMap = await this.enrichUsers(rows.map(r => r.user_id));

    return rows.map((stats, idx) => {
      const user = userMap.get(stats.user_id) || { _id: stats.user_id };
      return {
        userId: user,
        rank: idx + 1,
        score: this.getMetricValue(stats, metric, period),
        totalPracticeSessions: Number(stats.total_practice_sessions || 0),
        achievementPoints: Number(stats.achievement_points || 0),
        currentStreak: Number(stats.current_streak || 0)
      };
    });
  }

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
    const supabase = getSupabaseAdmin();
    const sortField = this.getMetricField(metric, period) as string;

    const { data: userStats } = await supabase
      .from('user_stats')
      .select(
        'user_id, leaderboard_opt_in, average_score, total_practice_sessions, achievement_points, current_streak, weekly_score, weekly_practices, monthly_score, monthly_practices'
      )
      .eq('user_id', userId)
      .maybeSingle();

    if (!userStats || !(userStats as any).leaderboard_opt_in) {
      return null;
    }

    const score = this.getMetricValue(userStats as UserStatsRow, metric, period);

    const [{ count: betterCount }, { count: totalUsers }] = await Promise.all([
      supabase
        .from('user_stats')
        .select('user_id', { head: true, count: 'exact' })
        .eq('leaderboard_opt_in', true)
        .gt(sortField, score),
      supabase.from('user_stats').select('user_id', { head: true, count: 'exact' }).eq('leaderboard_opt_in', true)
    ]);

    const rank = (betterCount || 0) + 1;
    const total = totalUsers || 0;
    const percentile = total > 0 ? ((total - rank + 1) / total) * 100 : 0;

    return {
      rank,
      score,
      totalUsers: total,
      percentile: Math.round(percentile * 10) / 10
    };
  }

  async optInToLeaderboard(userId: string): Promise<void> {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('user_stats')
      .upsert({ user_id: userId, leaderboard_opt_in: true }, { onConflict: 'user_id' });
    if (error) {
      throw new Error('Failed to opt in');
    }
    this.clearCache();
  }

  async optOutFromLeaderboard(userId: string): Promise<void> {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('user_stats')
      .upsert({ user_id: userId, leaderboard_opt_in: false }, { onConflict: 'user_id' });
    if (error) {
      throw new Error('Failed to opt out');
    }
    this.clearCache();
  }
}

export const leaderboardService = new LeaderboardService();

