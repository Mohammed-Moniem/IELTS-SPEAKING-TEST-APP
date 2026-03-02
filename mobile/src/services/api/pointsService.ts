/**
 * Points Service
 * Handles all points-related API calls for the gamification system
 */

import { apiClient } from "../../api/client";
import firebaseAnalyticsService from "../../services/firebaseAnalyticsService";
import monitoringService from "../../services/monitoringService";
import { logger } from "../../utils/logger";

export enum DiscountTier {
  BRONZE = "BRONZE", // 1,000 pts → 5% off
  SILVER = "SILVER", // 2,500 pts → 10% off
  GOLD = "GOLD", // 5,000 pts → 15% off
  PLATINUM = "PLATINUM", // 7,500 pts → 20% off
}

export interface PointsSummary {
  balance: number;
  totalEarned: number;
  totalRedeemed: number;
  canRedeem?: boolean;
  activeDiscounts?: Array<Record<string, unknown>>;
  currentTier: DiscountTier | string | null;
  nextTier: {
    tier: DiscountTier | string;
    pointsRequired?: number;
    pointsRemaining?: number;
    pointsNeeded?: number;
    discountPercentage?: number;
    percentage?: number;
  } | null;
  availableDiscounts?: Array<{
    tier: DiscountTier | string;
    pointsRequired?: number;
    discountPercentage?: number;
    isAvailable?: boolean;
  }>;
}

export interface PointsTransaction {
  _id: string;
  userId: string;
  amount: number;
  type:
    | "practice_completion"
    | "achievement_unlock"
    | "referral_reward"
    | "profile_completion"
    | "discount_redemption";
  description: string;
  metadata?: {
    achievementId?: string;
    practiceSessionId?: string;
    referralId?: string;
    discountTier?: string;
  };
  createdAt: string;
}

export interface RedeemDiscountResponse {
  success: boolean;
  couponCode: string;
  discountPercentage: number;
  expiresAt: string;
  newBalance: number;
}

class PointsService {
  private basePath = "/points";

  private isUnauthorizedError(error: unknown): boolean {
    const status =
      (error as { response?: { status?: number; data?: { status?: number } } })
        ?.response?.status ??
      (error as { response?: { data?: { status?: number } } })?.response?.data
        ?.status ??
      (error as { status?: number })?.status;
    return status === 401 || status === 403;
  }

  private normalizeTierLabel(
    tier: DiscountTier | string | null | undefined
  ): DiscountTier | string | null {
    if (!tier) return null;
    if (typeof tier !== "string") {
      return tier;
    }

    const trimmed = tier.trim();
    const upper = trimmed.toUpperCase();
    const discountTierMatch = Object.values(DiscountTier).find(
      (value) => value === upper
    );
    if (discountTierMatch) {
      return discountTierMatch;
    }

    // Attempt to map by percentage (e.g. \"5%\" -> BRONZE)
    const percentageMatch = parseInt(trimmed.replace(/[^0-9]/g, ""), 10);
    if (!Number.isNaN(percentageMatch)) {
      const tierByPercentage = this.getAllDiscountTiers().find(
        (option) => option.discountPercentage === percentageMatch
      );
      if (tierByPercentage) {
        return tierByPercentage.tier;
      }
    }

    return trimmed;
  }

  private normalizePointsSummary(payload: any): PointsSummary {
    const normalizedNextTier = payload?.nextTier
      ? {
          tier: this.normalizeTierLabel(
            payload.nextTier.tier ||
              payload.nextTier.label ||
              payload.nextTier.name
          ) ?? payload.nextTier.tier,
          pointsRequired:
            typeof payload.nextTier.pointsRequired === "number"
              ? payload.nextTier.pointsRequired
              : typeof payload.nextTier.targetPoints === "number"
              ? payload.nextTier.targetPoints
              : typeof payload.nextTier.pointsNeeded === "number"
              ? payload.nextTier.pointsNeeded
              : undefined,
          pointsRemaining:
            typeof payload.nextTier.pointsRemaining === "number"
              ? payload.nextTier.pointsRemaining
              : typeof payload.nextTier.pointsNeeded === "number"
              ? payload.nextTier.pointsNeeded
              : undefined,
          pointsNeeded:
            typeof payload.nextTier.pointsNeeded === "number"
              ? payload.nextTier.pointsNeeded
              : undefined,
          discountPercentage:
            typeof payload.nextTier.discountPercentage === "number"
              ? payload.nextTier.discountPercentage
              : typeof payload.nextTier.percentage === "number"
              ? payload.nextTier.percentage
              : undefined,
          percentage:
            typeof payload.nextTier.percentage === "number"
              ? payload.nextTier.percentage
              : undefined,
        }
      : null;

    return {
      balance: payload?.balance ?? 0,
      totalEarned: payload?.totalEarned ?? 0,
      totalRedeemed: payload?.totalRedeemed ?? 0,
      canRedeem: payload?.canRedeem ?? undefined,
      activeDiscounts: payload?.activeDiscounts ?? undefined,
      currentTier:
        this.normalizeTierLabel(
          payload?.currentTier?.tier ?? payload?.currentTier
        ) ?? payload?.currentTier ?? null,
      nextTier: normalizedNextTier,
      availableDiscounts: Array.isArray(payload?.availableDiscounts)
        ? payload.availableDiscounts.map((discount: any) => ({
            tier:
              this.normalizeTierLabel(discount?.tier || discount?.label) ??
              discount?.tier,
            pointsRequired:
              typeof discount?.pointsRequired === "number"
                ? discount.pointsRequired
                : undefined,
            discountPercentage:
              typeof discount?.discountPercentage === "number"
                ? discount.discountPercentage
                : undefined,
            isAvailable:
              typeof discount?.isAvailable === "boolean"
                ? discount.isAvailable
                : undefined,
          }))
        : undefined,
    };
  }

  /**
   * Get user's points summary including balance, tier info, and available discounts
   */
  async getPointsSummary(): Promise<PointsSummary> {
    try {
      logger.info("📊 Fetching points summary...");
      const response = await apiClient.get<{ data: PointsSummary }>(
        `${this.basePath}/summary`
      );
      const normalized = this.normalizePointsSummary(response.data.data);
      logger.info("✅ Points summary fetched:", normalized);
      return normalized;
    } catch (error) {
      if (this.isUnauthorizedError(error)) {
        logger.warn("⚠️ Points summary unauthorized");
        throw error;
      }
      logger.warn("⚠️ Failed to fetch points summary:", error);
      throw error;
    }
  }

  /**
   * Get recent points transactions
   */
  async getTransactions(limit: number = 20): Promise<PointsTransaction[]> {
    try {
      logger.info(`📜 Fetching ${limit} recent transactions...`);
      const response = await apiClient.get<{ data: PointsTransaction[] }>(
        `${this.basePath}/transactions`,
        {
          params: { limit },
        }
      );
      logger.info(`✅ Fetched ${response.data.data.length} transactions`);
      return response.data.data;
    } catch (error) {
      if (this.isUnauthorizedError(error)) {
        logger.warn("⚠️ Points transactions unauthorized");
        throw error;
      }
      logger.warn("⚠️ Failed to fetch transactions:", error);
      throw error;
    }
  }

  /**
   * Redeem points for a discount coupon
   */
  async redeemDiscount(tier: DiscountTier): Promise<RedeemDiscountResponse> {
    try {
      logger.info(`💰 Redeeming ${tier} discount...`);
      const response = await apiClient.post<{ data: RedeemDiscountResponse }>(
        `${this.basePath}/redeem`,
        { discountTier: tier }
      );
      const payload = response.data.data;
      logger.info("✅ Discount redeemed successfully:", payload);

      // Track analytics + monitoring
      try {
        monitoringService.trackEvent("discount_redeemed", {
          tier,
          discountPercentage: payload.discountPercentage,
          newBalance: payload.newBalance,
        });
        void firebaseAnalyticsService.trackEvent("discount_redeemed", {
          tier,
          discountPercentage: payload.discountPercentage,
          newBalance: payload.newBalance,
        });
        // addBreadcrumb expects (message, data?)
        monitoringService.addBreadcrumb(
          `Redeemed ${tier} discount: ${payload.couponCode}`,
          { couponCode: payload.couponCode }
        );
      } catch (err) {
        // swallow analytics errors
        logger.warn("⚠️ Analytics track for discount_redeemed failed", err);
      }
      return response.data.data;
    } catch (error) {
      logger.warn("⚠️ Failed to redeem discount:", error);
      try {
        monitoringService.trackEvent("discount_redeem_failed", { tier });
        void firebaseAnalyticsService.trackEvent("discount_redeem_failed", {
          tier,
        });
      } catch (err) {
        logger.warn(
          "⚠️ Analytics track for discount_redeem_failed failed",
          err
        );
      }
      throw error;
    }
  }

  /**
   * Get discount tier info (points required, percentage)
   */
  getDiscountTierInfo(tier: DiscountTier): {
    pointsRequired: number;
    discountPercentage: number;
    name: string;
  } {
    const tiers = {
      [DiscountTier.BRONZE]: {
        pointsRequired: 1000,
        discountPercentage: 5,
        name: "Bronze",
      },
      [DiscountTier.SILVER]: {
        pointsRequired: 2500,
        discountPercentage: 10,
        name: "Silver",
      },
      [DiscountTier.GOLD]: {
        pointsRequired: 5000,
        discountPercentage: 15,
        name: "Gold",
      },
      [DiscountTier.PLATINUM]: {
        pointsRequired: 7500,
        discountPercentage: 20,
        name: "Platinum",
      },
    };

    return tiers[tier];
  }

  /**
   * Get all discount tiers
   */
  getAllDiscountTiers(): Array<{
    tier: DiscountTier;
    pointsRequired: number;
    discountPercentage: number;
    name: string;
  }> {
    return Object.values(DiscountTier).map((tier) => ({
      tier,
      ...this.getDiscountTierInfo(tier),
    }));
  }
}

export const pointsService = new PointsService();
export default pointsService;
