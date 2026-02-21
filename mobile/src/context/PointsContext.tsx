/**
 * PointsContext
 * Provides shared points state across the app to prevent duplicate API calls
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useAuth } from "../auth/AuthContext";
import {
  DiscountTier,
  pointsService,
  PointsSummary,
  PointsTransaction,
} from "../services/api";
import firebaseAnalyticsService from "../services/firebaseAnalyticsService";
import monitoringService from "../services/monitoringService";
import socketService from "../services/socketService";
import { logger } from "../utils/logger";

export interface PointsGrantedEvent {
  userId: string;
  amount: number;
  type: string;
  description: string;
  balance: number;
  metadata?: Record<string, any>;
}

interface PointsContextType {
  summary: PointsSummary | null;
  transactions: PointsTransaction[];
  loading: boolean;
  error: string | null;
  isRefreshing: boolean;
  balance: number;
  totalEarned: number;
  totalRedeemed: number;
  currentTier: string | null;
  currentTierName: string;
  nextTier: {
    name: string;
    pointsRemaining: number;
    pointsRequired: number;
    discountPercentage: number;
  } | null;
  availableDiscounts: any[];
  refresh: () => Promise<void>;
  redeemDiscount: (tier: DiscountTier) => Promise<any>;
  fetchTransactions: (limit?: number) => Promise<PointsTransaction[]>;
}

const PointsContext = createContext<PointsContextType | undefined>(undefined);

export const PointsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user, accessToken } = useAuth();
  const [summary, setSummary] = useState<PointsSummary | null>(null);
  const [transactions, setTransactions] = useState<PointsTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  /**
   * Fetch points summary from API
   */
  const fetchSummary = useCallback(async () => {
    console.log("📊 fetchSummary called, accessToken:", !!accessToken);

    if (!accessToken) {
      setSummary(null);
      setLoading(false);
      setIsRefreshing(false);
      return null;
    }

    try {
      setError(null);
      console.log("📊 Fetching points summary from API...");
      const data = await pointsService.getPointsSummary();
      console.log("✅ Points summary fetched successfully:", data.balance);
      setSummary(data);
      return data;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to fetch points";
      logger.error("❌ Error fetching points summary:", err);
      setError(message);
      throw err;
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [accessToken]);

  /**
   * Fetch recent transactions
   */
  const fetchTransactions = useCallback(
    async (limit: number = 20): Promise<PointsTransaction[]> => {
      console.log(
        "📜 fetchTransactions called, limit:",
        limit,
        "accessToken:",
        !!accessToken
      );

      if (!accessToken) {
        setTransactions([]);
        return [];
      }

      try {
        console.log("📜 Fetching transactions from API...");
        const data = await pointsService.getTransactions(limit);
        console.log(
          "✅ Transactions fetched successfully:",
          data.length,
          "items"
        );
        setTransactions(data);
        return data;
      } catch (err) {
        logger.error("❌ Error fetching transactions:", err);
        throw err;
      }
    },
    [accessToken]
  );

  /**
   * Refresh both summary and transactions
   */
  const refresh = useCallback(async () => {
    if (!accessToken) {
      setIsRefreshing(false);
      return;
    }
    setIsRefreshing(true);
    try {
      await Promise.all([fetchSummary(), fetchTransactions()]);
    } catch (err) {
      logger.error("❌ Error refreshing points data:", err);
    }
  }, [accessToken, fetchSummary, fetchTransactions]);

  /**
   * Redeem points for discount
   */
  const redeemDiscount = useCallback(
    async (tier: DiscountTier) => {
      try {
        const result = await pointsService.redeemDiscount(tier);
        // Refresh summary after redemption
        await fetchSummary();
        return result;
      } catch (err) {
        logger.error("❌ Error redeeming discount:", err);
        throw err;
      }
    },
    [fetchSummary]
  );

  /**
   * Handle socket event for points granted
   */
  const handlePointsGranted = useCallback(
    (event: PointsGrantedEvent) => {
      logger.info("🎉 Points granted:", event);

      // Track analytics for points granted
      try {
        monitoringService.trackEvent("points_granted", {
          amount: event.amount,
          type: event.type,
          newBalance: event.balance,
          source: event.metadata?.source || "unknown",
        });
        void firebaseAnalyticsService.trackEvent("points_granted", {
          amount: event.amount,
          type: event.type,
          newBalance: event.balance,
          source: event.metadata?.source || "unknown",
        });
        monitoringService.addBreadcrumb(
          `Points granted: +${event.amount} (${event.description})`,
          { type: event.type, newBalance: event.balance }
        );
      } catch (err) {
        logger.warn("⚠️ Analytics track for points_granted failed", err);
      }

      // Update summary with new balance
      if (summary) {
        setSummary({
          ...summary,
          balance: event.balance,
          totalEarned: summary.totalEarned + event.amount,
        });
      }

      // Add new transaction to the list
      const newTransaction: PointsTransaction = {
        _id: `temp-${Date.now()}`,
        userId: event.userId,
        amount: event.amount,
        type: event.type as any,
        description: event.description,
        metadata: event.metadata,
        createdAt: new Date().toISOString(),
      };

      setTransactions((prev) => [newTransaction, ...prev]);
    },
    [summary]
  );

  /**
   * Subscribe to socket events and fetch initial data
   */
  useEffect(() => {
    console.log(
      "🔍 PointsContext useEffect triggered, accessToken:",
      !!accessToken
    );

    if (!accessToken) {
      console.log("🔍 PointsContext: No accessToken, clearing state");
      setLoading(false);
      setTransactions([]);
      setSummary(null);
      return;
    }

    // Initial fetch
    console.log("📊 PointsContext: Fetching initial data...");
    fetchSummary();
    fetchTransactions();

    // Listen for points granted events
    socketService.on("points:granted", handlePointsGranted);

    // Cleanup
    return () => {
      console.log("🔍 PointsContext: Cleaning up socket listener");
      socketService.off("points:granted", handlePointsGranted);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]); // Only depend on accessToken to prevent re-fetching

  /**
   * Get tier name for display
   */
  const getTierName = useCallback(
    (tier: DiscountTier | string | null): string => {
      if (!tier) return "None";

      const normalizeToDiscountTier = (value: string): DiscountTier | null => {
        const upper = value.trim().toUpperCase();
        if ((Object.values(DiscountTier) as string[]).includes(upper)) {
          return upper as DiscountTier;
        }

        const percentage = parseInt(upper.replace(/[^0-9]/g, ""), 10);
        if (!Number.isNaN(percentage)) {
          const match = pointsService
            .getAllDiscountTiers()
            .find((option) => option.discountPercentage === percentage);
          if (match) {
            return match.tier;
          }
        }

        return null;
      };

      if (typeof tier === "string") {
        const mapped = normalizeToDiscountTier(tier);
        if (mapped) {
          const info = pointsService.getDiscountTierInfo(mapped);
          return info.name;
        }
        return tier.replace(/_/g, " ").trim();
      }

      const tierInfo = pointsService.getDiscountTierInfo(tier);
      return tierInfo.name;
    },
    []
  );

  /**
   * Get next tier info for display
   */
  const getNextTierInfo = useCallback(() => {
    if (!summary?.nextTier) {
      return null;
    }

    const pointsRequired =
      summary.nextTier.pointsRequired ?? summary.nextTier.pointsNeeded ?? 0;
    const remainingValue =
      summary.nextTier.pointsRemaining ?? summary.nextTier.pointsNeeded;
    const pointsRemaining =
      typeof remainingValue === "number" ? remainingValue : pointsRequired;

    return {
      name: getTierName(summary.nextTier.tier),
      pointsRemaining,
      pointsRequired,
      discountPercentage:
        summary.nextTier.discountPercentage ?? summary.nextTier.percentage ?? 0,
    };
  }, [summary, getTierName]);

  const value: PointsContextType = {
    summary,
    transactions,
    loading,
    error,
    isRefreshing,
    balance: summary?.balance ?? 0,
    totalEarned: summary?.totalEarned ?? 0,
    totalRedeemed: summary?.totalRedeemed ?? 0,
    currentTier: summary?.currentTier ?? null,
    currentTierName: getTierName(summary?.currentTier ?? null),
    nextTier: getNextTierInfo(),
    availableDiscounts: summary?.availableDiscounts ?? [],
    refresh,
    redeemDiscount,
    fetchTransactions,
  };

  return (
    <PointsContext.Provider value={value}>{children}</PointsContext.Provider>
  );
};

export const usePointsContext = (): PointsContextType => {
  const context = useContext(PointsContext);
  if (!context) {
    throw new Error("usePointsContext must be used within PointsProvider");
  }
  return context;
};
