import { env } from '@env';
import { Logger } from '../../lib/logger';
import { getSupabaseAdmin } from '@lib/supabaseClient';
import { DISCOUNT_TIERS, DiscountTier } from '@api/constants/points';

const log = new Logger(__filename);

type PointsSummary = {
  balance: number;
  totalEarned: number;
  totalRedeemed: number;
  currentTier: { tier: DiscountTier; percentage: number; pointsRequired: number } | null;
  nextTier: { tier: DiscountTier; percentage: number; pointsRequired: number; pointsNeeded: number } | null;
  canRedeem: boolean;
  activeDiscounts: any[];
  availableDiscounts?: Array<{
    tier: DiscountTier;
    pointsRequired: number;
    discountPercentage: number;
    isAvailable: boolean;
  }>;
};

type PointsTransaction = {
  _id: string;
  userId: string;
  amount: number;
  type: string;
  description: string;
  metadata?: Record<string, any>;
  createdAt: string;
};

export class PointsService {
  private static async getOrCreateStatsRow(userId: string) {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('user_stats')
      .select('user_id, total_points, redeemed_points')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      log.warn('Failed to read user_stats; falling back to zeros', { userId, error: error.message });
      return { user_id: userId, total_points: 0, redeemed_points: 0 };
    }

    if (data) {
      return data as { user_id: string; total_points: number; redeemed_points: number };
    }

    // Provision defaults once.
    const { error: insertError } = await supabase.from('user_stats').insert({ user_id: userId });
    if (insertError) {
      log.warn('Failed to provision user_stats row', { userId, error: insertError.message });
    }

    return { user_id: userId, total_points: 0, redeemed_points: 0 };
  }

  static async getBalance(userId: string): Promise<number> {
    const stats = await this.getOrCreateStatsRow(userId);
    return Math.max(0, Number(stats.total_points || 0) - Number(stats.redeemed_points || 0));
  }

  static async getPointsSummary(userId: string): Promise<PointsSummary> {
    const stats = await this.getOrCreateStatsRow(userId);
    const totalEarned = Number(stats.total_points || 0);
    const totalRedeemed = Number(stats.redeemed_points || 0);
    const balance = Math.max(0, totalEarned - totalRedeemed);

    let currentTier: PointsSummary['currentTier'] = null;
    for (const tier of [...DISCOUNT_TIERS].reverse()) {
      if (balance >= tier.pointsRequired) {
        currentTier = { tier: tier.tier, percentage: tier.percentage, pointsRequired: tier.pointsRequired };
        break;
      }
    }

    let nextTier: PointsSummary['nextTier'] = null;
    for (const tier of DISCOUNT_TIERS) {
      if (balance < tier.pointsRequired) {
        nextTier = {
          tier: tier.tier,
          percentage: tier.percentage,
          pointsRequired: tier.pointsRequired,
          pointsNeeded: tier.pointsRequired - balance
        };
        break;
      }
    }

    const canRedeem = env.payments?.disabled ? false : balance >= DISCOUNT_TIERS[0].pointsRequired;

    return {
      balance,
      totalEarned,
      totalRedeemed,
      currentTier,
      nextTier,
      canRedeem,
      activeDiscounts: [],
      availableDiscounts: DISCOUNT_TIERS.map(tier => ({
        tier: tier.tier,
        pointsRequired: tier.pointsRequired,
        discountPercentage: tier.percentage,
        isAvailable: balance >= tier.pointsRequired
      }))
    };
  }

  static async getRecentTransactions(_userId: string, _limit: number = 20): Promise<PointsTransaction[]> {
    // Full points transaction history migration is not in place yet.
    return [];
  }

  static async redeemForDiscount(_userId: string, _discountTier: DiscountTier): Promise<never> {
    // Payments are disabled. This prevents downstream assumptions (Stripe checkout, coupons, etc).
    throw new Error('Billing is disabled');
  }
}

