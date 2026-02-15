/**
 * Achievement Service (Supabase/Postgres)
 *
 * Achievements are defined in `public.achievements`.
 * Per-user progress/unlocks are stored in `public.user_achievements`.
 * Some counters come from `public.user_stats` (updated via Analytics).
 */

import { getSupabaseAdmin } from '@lib/supabaseClient';
import { Logger } from '@lib/logger';

const log = new Logger(__filename);

type AchievementRow = {
  id: string;
  key: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  points: number;
  requirement: any;
  is_premium: boolean;
  sort_order: number;
  is_active: boolean;
};

type UserAchievementRow = {
  id: string;
  user_id: string;
  achievement_key: string;
  progress: number;
  is_unlocked: boolean;
  unlocked_at: string | null;
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
  last_practice_at?: string | null;
};

export type AchievementCategory = 'PRACTICE' | 'IMPROVEMENT' | 'STREAK' | 'SOCIAL' | 'MILESTONE' | 'all';

export class AchievementService {
  private async getOrCreateUserStats(userId: string): Promise<UserStatsRow> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('user_stats')
      .select(
        'user_id, total_practice_sessions, total_simulations, average_score, highest_score, current_streak, longest_streak, total_achievements, achievement_points, last_practice_at'
      )
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      log.warn('Failed to load user_stats', { userId, error: error.message });
    }

    if (data) {
      return data as UserStatsRow;
    }

    const insert = await supabase.from('user_stats').insert({ user_id: userId }).select(
      'user_id, total_practice_sessions, total_simulations, average_score, highest_score, current_streak, longest_streak, total_achievements, achievement_points, last_practice_at'
    );

    if (insert.error) {
      log.warn('Failed to provision user_stats row', { userId, error: insert.error.message });
      return {
        user_id: userId,
        total_practice_sessions: 0,
        total_simulations: 0,
        average_score: 0,
        highest_score: 0,
        current_streak: 0,
        longest_streak: 0,
        total_achievements: 0,
        achievement_points: 0,
        last_practice_at: null
      };
    }

    const row = (insert.data?.[0] || null) as any;
    if (!row) {
      return {
        user_id: userId,
        total_practice_sessions: 0,
        total_simulations: 0,
        average_score: 0,
        highest_score: 0,
        current_streak: 0,
        longest_streak: 0,
        total_achievements: 0,
        achievement_points: 0,
        last_practice_at: null
      };
    }

    return row as UserStatsRow;
  }

  private computeProgressForRequirement(requirement: any, stats: UserStatsRow): number {
    const type = String(requirement?.type || '').trim();
    const target = Number(requirement?.value || 0);

    switch (type) {
      case 'practice_count':
        return Math.min(Number(stats.total_practice_sessions || 0), target || Number(stats.total_practice_sessions || 0));
      case 'simulation_count':
        return Math.min(Number(stats.total_simulations || 0), target || Number(stats.total_simulations || 0));
      case 'streak_days':
        return Math.min(Number(stats.current_streak || 0), target || Number(stats.current_streak || 0));
      case 'score_threshold':
        // Track best score so far.
        return Math.min(Number(stats.highest_score || 0), target || Number(stats.highest_score || 0));
      default:
        return 0;
    }
  }

  private calcProgressPercentage(progress: number, requirement: any): number {
    const target = Number(requirement?.value || 0);
    if (!Number.isFinite(target) || target <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((Number(progress || 0) / target) * 100)));
  }

  private mapAchievementWithUserProgress(a: AchievementRow, ua: UserAchievementRow | null, computedProgress: number) {
    const progress = ua ? Number(ua.progress || 0) : Number(computedProgress || 0);
    const isUnlocked = ua ? Boolean(ua.is_unlocked) : computedProgress >= Number(a.requirement?.value || 0);
    const unlockedAt = ua?.unlocked_at || undefined;

    return {
      _id: a.id,
      key: a.key,
      name: a.name,
      description: a.description,
      category: a.category,
      icon: a.icon,
      points: Number(a.points || 0),
      requirement: a.requirement,
      isPremium: Boolean(a.is_premium),
      order: Number(a.sort_order || 0),
      progress,
      isUnlocked,
      unlockedAt,
      progressPercentage: this.calcProgressPercentage(progress, a.requirement)
    };
  }

  /**
   * Get all achievements (optionally filtered by category) with per-user progress.
   */
  async getAllAchievementsWithProgress(userId: string, category?: AchievementCategory): Promise<any[]> {
    const supabase = getSupabaseAdmin();

    let query = supabase
      .from('achievements')
      .select('id, key, name, description, category, icon, points, requirement, is_premium, sort_order, is_active')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (category && category !== 'all') {
      query = query.eq('category', category);
    }

    const { data: achievements, error } = await query;
    if (error) {
      log.error('Failed to load achievements', { error: error.message });
      throw new Error('Failed to load achievements');
    }

    const rows = (achievements || []) as AchievementRow[];
    if (!rows.length) return [];

    const stats = await this.getOrCreateUserStats(userId);
    const keys = rows.map(a => a.key);

    const { data: userRows, error: userError } = await supabase
      .from('user_achievements')
      .select('id, user_id, achievement_key, progress, is_unlocked, unlocked_at')
      .eq('user_id', userId)
      .in('achievement_key', keys);

    if (userError) {
      log.warn('Failed to load user achievements', { userId, error: userError.message });
    }

    const byKey = new Map<string, UserAchievementRow>();
    (userRows || []).forEach((r: any) => {
      byKey.set(String(r.achievement_key), r as UserAchievementRow);
    });

    // Upsert progress/unlocks for basic requirement types.
    const upserts: Array<{
      user_id: string;
      achievement_key: string;
      progress: number;
      is_unlocked: boolean;
      unlocked_at?: string | null;
    }> = [];

    const nowIso = new Date().toISOString();
    for (const a of rows) {
      const computedProgress = this.computeProgressForRequirement(a.requirement, stats);
      const requiredValue = Number(a.requirement?.value || 0);
      const computedUnlocked = requiredValue > 0 ? computedProgress >= requiredValue : false;
      const existing = byKey.get(a.key);

      const nextProgress = Math.max(Number(existing?.progress || 0), Number(computedProgress || 0));
      const nextUnlocked = Boolean(existing?.is_unlocked) || computedUnlocked;
      const shouldSetUnlockedAt = !existing?.is_unlocked && computedUnlocked;

      upserts.push({
        user_id: userId,
        achievement_key: a.key,
        progress: nextProgress,
        is_unlocked: nextUnlocked,
        unlocked_at: shouldSetUnlockedAt ? nowIso : existing?.unlocked_at || null
      });
    }

    if (upserts.length) {
      const upsertResult = await supabase.from('user_achievements').upsert(upserts, {
        onConflict: 'user_id,achievement_key'
      });
      if (upsertResult.error) {
        log.warn('Failed to upsert achievement progress', { userId, error: upsertResult.error.message });
      } else {
        // Reload updated rows so response reflects unlocking.
        const { data: updatedUserRows } = await supabase
          .from('user_achievements')
          .select('id, user_id, achievement_key, progress, is_unlocked, unlocked_at')
          .eq('user_id', userId)
          .in('achievement_key', keys);
        (updatedUserRows || []).forEach((r: any) => {
          byKey.set(String(r.achievement_key), r as UserAchievementRow);
        });
      }
    }

    const mapped = rows.map(a => {
      const ua = byKey.get(a.key) || null;
      const computedProgress = this.computeProgressForRequirement(a.requirement, stats);
      return this.mapAchievementWithUserProgress(a, ua, computedProgress);
    });

    // Update aggregate stats (best-effort).
    const unlocked = mapped.filter(m => m.isUnlocked);
    const achievementPoints = unlocked.reduce((sum, a) => sum + Number(a.points || 0), 0);
    await supabase
      .from('user_stats')
      .upsert(
        {
          user_id: userId,
          total_achievements: unlocked.length,
          achievement_points: achievementPoints
        },
        { onConflict: 'user_id' }
      )
      .then(({ error: updateError }) => {
        if (updateError) {
          log.warn('Failed to update user_stats achievement aggregates', { userId, error: updateError.message });
        }
      });

    return mapped;
  }

  /**
   * Get only unlocked achievements for the user.
   */
  async getUserAchievements(userId: string): Promise<any[]> {
    const supabase = getSupabaseAdmin();

    const { data: unlockedRows, error } = await supabase
      .from('user_achievements')
      .select('achievement_key, progress, is_unlocked, unlocked_at')
      .eq('user_id', userId)
      .eq('is_unlocked', true);

    if (error) {
      log.warn('Failed to load unlocked achievements', { userId, error: error.message });
      return [];
    }

    const keys = (unlockedRows || []).map((r: any) => String(r.achievement_key));
    if (!keys.length) return [];

    const { data: achievements, error: aError } = await supabase
      .from('achievements')
      .select('id, key, name, description, category, icon, points, requirement, is_premium, sort_order, is_active')
      .in('key', keys)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (aError) {
      log.warn('Failed to load achievement definitions', { error: aError.message });
      return [];
    }

    const byKey = new Map<string, any>();
    (unlockedRows || []).forEach((r: any) => byKey.set(String(r.achievement_key), r));

    return (achievements || []).map((a: any) => {
      const ua = byKey.get(String(a.key)) || null;
      return this.mapAchievementWithUserProgress(a as AchievementRow, ua as UserAchievementRow, Number(ua?.progress || 0));
    });
  }

  /**
   * Backwards-compatible helper for old controller path.
   */
  async getAchievementsByCategory(category: AchievementCategory): Promise<any[]> {
    // Without a userId, we cannot compute progress; return definitions only.
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('achievements')
      .select('id, key, name, description, category, icon, points, requirement, is_premium, sort_order, is_active')
      .eq('is_active', true)
      .eq('category', category)
      .order('sort_order', { ascending: true });
    if (error) {
      throw new Error('Failed to load achievements');
    }
    return (data || []).map((a: any) => ({
      _id: a.id,
      key: a.key,
      name: a.name,
      description: a.description,
      category: a.category,
      icon: a.icon,
      points: a.points,
      requirement: a.requirement,
      isPremium: Boolean(a.is_premium),
      order: Number(a.sort_order || 0),
      progress: 0,
      isUnlocked: false,
      progressPercentage: 0
    }));
  }
}

export const achievementService = new AchievementService();

