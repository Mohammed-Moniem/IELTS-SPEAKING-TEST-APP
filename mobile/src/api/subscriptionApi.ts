import { apiClient } from "./client";

export interface SubscriptionPlan {
  tier: "free" | "premium" | "pro";
  name: string;
  price: number;
  priceId: string;
  features: string[];
  limits: {
    practiceSessionsPerMonth: number;
    simulationSessionsPerMonth: number;
  };
}

export interface UsageStats {
  tier: "free" | "premium" | "pro";
  practiceUsed: number;
  practiceLimit: number;
  simulationUsed: number;
  simulationLimit: number;
  resetDate: Date;
}

export interface UsageLimitCheck {
  allowed: boolean;
  remaining: number;
  used: number;
  limit: number;
  tier: string;
  reason?: string;
  resetDate: Date;
}

/**
 * Get all available subscription plans
 */
export const getSubscriptionPlans = async (): Promise<SubscriptionPlan[]> => {
  try {
    console.log("💳 Getting subscription plans");

    const response = await apiClient.get("/subscription/plans");

    if (!response.data.success) {
      throw new Error(
        response.data.message || "Failed to get subscription plans"
      );
    }

    console.log(
      "✅ Subscription plans loaded:",
      response.data.data.plans.length
    );
    return response.data.data.plans;
  } catch (error) {
    console.error("❌ Get subscription plans error:", error);
    throw error;
  }
};

/**
 * Check if user can start a session (usage limit check)
 */
export const checkUsageLimit = async (
  userId: string,
  sessionType: "practice" | "simulation"
): Promise<UsageLimitCheck> => {
  try {
    console.log(`🔍 Checking usage limit for ${userId}, type: ${sessionType}`);

    const response = await apiClient.get("/subscription/check-limit", {
      params: {
        userId,
        sessionType,
      },
    });

    if (!response.data.success) {
      throw new Error(response.data.message || "Failed to check usage limit");
    }

    console.log("✅ Usage limit check:", response.data.data);
    return response.data.data;
  } catch (error) {
    console.error("❌ Check usage limit error:", error);
    throw error;
  }
};

/**
 * Log session usage
 */
export const logSessionUsage = async (
  userId: string,
  sessionType: "practice" | "simulation",
  metadata?: {
    testPart?: number;
    overallBand?: number;
    topic?: string;
    completed?: boolean;
    duration?: number;
  }
): Promise<void> => {
  try {
    console.log(`📊 Logging session usage for ${userId}`);

    const response = await apiClient.post("/subscriptions/log-usage", {
      userId,
      sessionType,
      metadata,
    });

    if (!response.data.success) {
      throw new Error(response.data.message || "Failed to log usage");
    }

    console.log("✅ Usage logged");
  } catch (error) {
    console.error("❌ Log usage error:", error);
    throw error;
  }
};

/**
 * Get user's usage statistics
 */
export const getUserUsageStats = async (
  userId: string
): Promise<UsageStats> => {
  try {
    console.log(`📈 Getting usage stats for ${userId}`);

    const response = await apiClient.get("/subscriptions/usage", {
      params: { userId },
    });

    if (!response.data.success) {
      throw new Error(response.data.message || "Failed to get usage stats");
    }

    console.log("✅ Usage stats loaded");
    return response.data.data;
  } catch (error) {
    console.error("❌ Get usage stats error:", error);
    throw error;
  }
};

/**
 * Upgrade user subscription (for testing/demo)
 */
export const upgradeSubscription = async (
  userId: string,
  tier: "free" | "premium" | "pro"
): Promise<{ tier: string; plan: SubscriptionPlan }> => {
  try {
    console.log(`⬆️ Upgrading ${userId} to ${tier}`);

    const response = await apiClient.post("/subscriptions/upgrade", {
      userId,
      tier,
    });

    if (!response.data.success) {
      throw new Error(
        response.data.message || "Failed to upgrade subscription"
      );
    }

    console.log("✅ Subscription upgraded");
    return response.data.data;
  } catch (error) {
    console.error("❌ Upgrade subscription error:", error);
    throw error;
  }
};
