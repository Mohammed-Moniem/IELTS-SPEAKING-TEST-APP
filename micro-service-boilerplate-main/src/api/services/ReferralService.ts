import { env } from '@env';
import { Logger } from '../../lib/logger';
import { getSupabaseAdmin } from '@lib/supabaseClient';
import { encryptionService } from './EncryptionService';

const log = new Logger(__filename);

type ReferralStatsRow = {
  user_id: string;
  referral_code: string;
  total_referrals: number;
  successful_referrals: number;
  pending_referrals: number;
  today_referrals: number;
  last_referral_date: string | null;
  lifetime_earnings: any;
  created_at: string;
  updated_at: string;
};

type ReferralRow = {
  id: string;
  referrer_id: string;
  referred_user_id: string | null;
  referral_code: string;
  email: string | null;
  status: string;
  rewards: any;
  metadata: any;
  created_at: string;
  updated_at: string;
};

export class ReferralService {
  private readonly MAX_REFERRALS_PER_DAY = 5;
  private readonly PRACTICE_REWARD_PER_REFERRAL = 1;
  private readonly SIMULATION_REWARD_THRESHOLD = 2;

  async getUserReferralCode(userId: string): Promise<string> {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from('referral_stats')
      .select('user_id, referral_code')
      .eq('user_id', userId)
      .maybeSingle();

    if (data?.referral_code) {
      return (data as any).referral_code;
    }

    const referralCode = await this.generateUniqueReferralCode();
    const { error } = await supabase
      .from('referral_stats')
      .insert({ user_id: userId, referral_code: referralCode })
      .throwOnError();

    if (error) {
      throw new Error('Failed to generate referral code');
    }

    log.info(`Referral code generated for user ${userId}: ${referralCode}`);
    return referralCode;
  }

  async getReferralStats(userId: string): Promise<any> {
    const supabase = getSupabaseAdmin();
    const code = await this.getUserReferralCode(userId);
    const link = await this.createReferralLink(userId);

    const { data } = await supabase
      .from('referral_stats')
      .select(
        'user_id, referral_code, total_referrals, successful_referrals, pending_referrals, today_referrals, last_referral_date, lifetime_earnings, created_at, updated_at'
      )
      .eq('user_id', userId)
      .maybeSingle();

    const row = (data as ReferralStatsRow | null) || {
      user_id: userId,
      referral_code: code,
      total_referrals: 0,
      successful_referrals: 0,
      pending_referrals: 0,
      today_referrals: 0,
      last_referral_date: null,
      lifetime_earnings: { practices: 0, simulations: 0 },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { canRefer, remaining } = await this.canReferToday(userId);

    const lifetime = row.lifetime_earnings || { practices: 0, simulations: 0 };

    return {
      referralCode: row.referral_code,
      referralLink: link,
      totalReferrals: Number(row.total_referrals || 0),
      successfulReferrals: Number(row.successful_referrals || 0),
      pendingReferrals: Number(row.pending_referrals || 0),
      lifetimeEarnings: {
        practiceSessionsGranted: Number(lifetime.practices || 0),
        simulationSessionsGranted: Number(lifetime.simulations || 0)
      },
      canReferToday: canRefer,
      remainingToday: remaining
    };
  }

  async canReferToday(userId: string): Promise<{ canRefer: boolean; remaining: number }> {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from('referral_stats')
      .select('user_id, today_referrals, last_referral_date')
      .eq('user_id', userId)
      .maybeSingle();

    if (!data) {
      return { canRefer: true, remaining: this.MAX_REFERRALS_PER_DAY };
    }

    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10); // YYYY-MM-DD
    const last = (data as any).last_referral_date as string | null;
    const isSameDay = last === todayStr;

    const todayReferrals = isSameDay ? Number((data as any).today_referrals || 0) : 0;

    if (!isSameDay) {
      // Reset counter for a new day.
      await supabase
        .from('referral_stats')
        .update({ today_referrals: 0 })
        .eq('user_id', userId);
    }

    const remaining = this.MAX_REFERRALS_PER_DAY - todayReferrals;
    return { canRefer: remaining > 0, remaining: Math.max(0, remaining) };
  }

  async createReferralLink(userId: string, baseUrl?: string): Promise<string> {
    const referralCode = await this.getUserReferralCode(userId);
    const configuredBase = (baseUrl ?? env.referral?.baseUrl ?? 'https://app.spokio.local').replace(/\/$/, '');
    return `${configuredBase}/referral/${encodeURIComponent(referralCode)}`;
  }

  async getReferralHistory(userId: string, limit: number = 50): Promise<any[]> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('referrals')
      .select(
        'id, referrer_id, referred_user_id, referral_code, email, status, rewards, metadata, created_at, updated_at'
      )
      .eq('referrer_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error('Failed to load referral history');
    }

    const rows = (data || []) as ReferralRow[];
    const referredIds = rows.map(r => r.referred_user_id).filter(Boolean) as string[];

    const [{ data: referredProfiles }, { data: referredSocial }] = await Promise.all([
      referredIds.length
        ? supabase.from('profiles').select('id, email').in('id', referredIds)
        : Promise.resolve({ data: [] as any[] }),
      referredIds.length
        ? supabase.from('user_profiles').select('user_id, username, avatar').in('user_id', referredIds)
        : Promise.resolve({ data: [] as any[] })
    ]);

    const profileById = new Map<string, any>((referredProfiles || []).map((p: any) => [p.id, p]));
    const socialById = new Map<string, any>((referredSocial || []).map((p: any) => [p.user_id, p]));

    return rows.map(row => {
      const rewards = row.rewards || {};
      const referred = row.referred_user_id ? profileById.get(row.referred_user_id) : null;
      const referredSocialRow = row.referred_user_id ? socialById.get(row.referred_user_id) : null;

      return {
        _id: row.id,
        referredUserId: row.referred_user_id
          ? {
              _id: row.referred_user_id,
              email: referred?.email,
              username: referredSocialRow?.username
            }
          : undefined,
        referralCode: row.referral_code,
        email: row.email || undefined,
        status: row.status,
        rewards: {
          practiceSessionsGranted: Number(rewards.practiceSessionsGranted || rewards.practice_sessions_granted || 0),
          simulationSessionsGranted: Number(rewards.simulationSessionsGranted || rewards.simulation_sessions_granted || 0)
        },
        createdAt: row.created_at,
        completedAt: rewards.grantedAt || rewards.granted_at || row.metadata?.registeredAt || undefined
      };
    });
  }

  async getReferralLeaderboard(limit: number = 10): Promise<any[]> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('referral_stats')
      .select('user_id, referral_code, successful_referrals')
      .order('successful_referrals', { ascending: false })
      .limit(limit);

    if (error) {
      return [];
    }

    const rows = (data || []) as Array<{ user_id: string; referral_code: string; successful_referrals: number }>;
    const userIds = rows.map(r => r.user_id);

    const [{ data: profiles }, { data: social }] = await Promise.all([
      userIds.length ? supabase.from('profiles').select('id, email').in('id', userIds) : Promise.resolve({ data: [] }),
      userIds.length ? supabase.from('user_profiles').select('user_id, username, avatar').in('user_id', userIds) : Promise.resolve({ data: [] })
    ]);

    const profileById = new Map<string, any>((profiles || []).map((p: any) => [p.id, p]));
    const socialById = new Map<string, any>((social || []).map((p: any) => [p.user_id, p]));

    return rows.map((row, idx) => {
      const p = profileById.get(row.user_id);
      const s = socialById.get(row.user_id);
      return {
        userId: {
          _id: row.user_id,
          email: p?.email,
          username: s?.username,
          avatar: s?.avatar
        },
        successfulReferrals: Number(row.successful_referrals || 0),
        rank: idx + 1
      };
    });
  }

  async getReferralLandingInfo(referralCode: string) {
    if (!referralCode) {
      return null;
    }

    const normalized = referralCode.trim().toUpperCase();
    if (!/^[A-Z0-9-]{4,32}$/.test(normalized)) {
      return null;
    }

    const supabase = getSupabaseAdmin();
    const { data: stats } = await supabase
      .from('referral_stats')
      .select('user_id, referral_code, total_referrals, successful_referrals')
      .eq('referral_code', normalized)
      .maybeSingle();

    if (!stats) {
      return null;
    }

    const referrerId = (stats as any).user_id as string;
    const [{ data: profile }, { data: social }] = await Promise.all([
      supabase.from('profiles').select('id, email, first_name, last_name').eq('id', referrerId).maybeSingle(),
      supabase.from('user_profiles').select('user_id, username, avatar').eq('user_id', referrerId).maybeSingle()
    ]);

    const displayName =
      (social as any)?.username
        ? `@${(social as any).username}`
        : [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim() || profile?.email || 'A fellow learner';

    return {
      referralCode: (stats as any).referral_code,
      referrer: {
        id: referrerId,
        name: displayName,
        avatar: (social as any)?.avatar ?? null,
        totalReferrals: Number((stats as any).total_referrals || 0),
        successfulReferrals: Number((stats as any).successful_referrals || 0)
      },
      rewards: {
        practicePerReferral: this.PRACTICE_REWARD_PER_REFERRAL,
        simulationThreshold: this.SIMULATION_REWARD_THRESHOLD,
        referrerPoints: 100,
        refereePoints: 100
      }
    } as const;
  }

  private async generateUniqueReferralCode(): Promise<string> {
    const supabase = getSupabaseAdmin();
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      const code = encryptionService.generateReferralCode();
      const { data } = await supabase.from('referral_stats').select('user_id').eq('referral_code', code).maybeSingle();
      if (!data) {
        return code;
      }
      attempts += 1;
    }

    throw new Error('Failed to generate unique referral code');
  }
}

export const referralService = new ReferralService();

