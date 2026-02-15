import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { subscriptionApi, usageApi } from "../api/services";
import type { SubscriptionInfo, UsageSummary } from "../types/api";

export type SessionType = "practice" | "simulation";

export interface UsageLimitState {
  sessionType: SessionType;
  currentTier: string;
  used: number;
  limit: number;
  resetDate?: Date;
}

const mapUsage = (summary: UsageSummary | undefined, type: SessionType) => {
  if (!summary) {
    return { used: 0, limit: null as number | null };
  }
  if (type === "practice") {
    return {
      used: summary.practiceCount,
      limit: summary.practiceLimit,
    };
  }
  return {
    used: summary.testCount,
    limit: summary.testLimit,
  };
};

export const useUsageGuard = () => {
  const usageQuery = useQuery({
    queryKey: ["usage-summary"],
    queryFn: usageApi.summary,
  });

  const subscriptionQuery = useQuery({
    queryKey: ["subscription-current"],
    queryFn: subscriptionApi.current,
  });

  const [limitState, setLimitState] = useState<UsageLimitState | null>(null);

  const ensureCanStart = useCallback(
    (sessionType: SessionType) => {
      const summary = usageQuery.data;
      const subscription = subscriptionQuery.data;
      if (!summary) {
        return true;
      }

      const { used, limit } = mapUsage(summary, sessionType);
      if (limit != null && used >= limit) {
        const planLabel =
          subscription?.metadata?.label ||
          subscription?.planType?.toUpperCase() ||
          "Free";
        setLimitState({
          sessionType,
          currentTier: planLabel,
          used,
          limit,
          resetDate: summary.lastReset ? new Date(summary.lastReset) : undefined,
        });
        return false;
      }
      return true;
    },
    [subscriptionQuery.data, usageQuery.data]
  );

  const dismissLimit = useCallback(() => {
    setLimitState(null);
  }, []);

  const refreshUsage = useCallback(() => {
    return usageQuery.refetch();
  }, [usageQuery]);

  const subscriptionInfo: SubscriptionInfo | undefined = subscriptionQuery.data;

  const usageSummary = useMemo(() => usageQuery.data, [usageQuery.data]);

  return {
    ensureCanStart,
    limitState,
    dismissLimit,
    refreshUsage,
    usageSummary,
    subscriptionInfo,
    usageLoading: usageQuery.isLoading,
  };
};
