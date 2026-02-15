import { useCallback, useEffect, useRef, useState } from "react";
import referralService, {
  ReferralHistory,
  ReferralLeaderboardEntry,
  ReferralStats,
} from "../services/api/referralService";

const EMPTY_STATS: ReferralStats = {
  referralCode: "",
  referralLink: "",
  totalReferrals: 0,
  successfulReferrals: 0,
  pendingReferrals: 0,
  lifetimeEarnings: {
    practiceSessionsGranted: 0,
    simulationSessionsGranted: 0,
  },
  canReferToday: true,
  remainingToday: 0,
};

const normalizeReferralStats = (
  payload: any,
  fallback?: ReferralStats | null
): ReferralStats => {
  const base = fallback ?? EMPTY_STATS;
  const baseLifetime =
    fallback?.lifetimeEarnings ?? EMPTY_STATS.lifetimeEarnings;

  return {
    referralCode:
      payload?.referralCode ??
      payload?.code ??
      base.referralCode ??
      EMPTY_STATS.referralCode,
    referralLink:
      payload?.referralLink ??
      payload?.link ??
      base.referralLink ??
      EMPTY_STATS.referralLink,
    totalReferrals:
      typeof payload?.totalReferrals === "number"
        ? payload.totalReferrals
        : base.totalReferrals,
    successfulReferrals:
      typeof payload?.successfulReferrals === "number"
        ? payload.successfulReferrals
        : base.successfulReferrals,
    pendingReferrals:
      typeof payload?.pendingReferrals === "number"
        ? payload.pendingReferrals
        : base.pendingReferrals,
    lifetimeEarnings: {
      practiceSessionsGranted:
        payload?.lifetimeEarnings?.practiceSessionsGranted ??
        baseLifetime.practiceSessionsGranted,
      simulationSessionsGranted:
        payload?.lifetimeEarnings?.simulationSessionsGranted ??
        baseLifetime.simulationSessionsGranted,
    },
    canReferToday:
      typeof payload?.canReferToday === "boolean"
        ? payload.canReferToday
        : base.canReferToday,
    remainingToday:
      typeof payload?.remainingToday === "number"
        ? payload.remainingToday
        : base.remainingToday,
  };
};

export const useReferrals = () => {
  const [referralStats, setReferralStats] = useState<ReferralStats | null>(
    null
  );
  const [history, setHistory] = useState<ReferralHistory[]>([]);
  const [leaderboard, setLeaderboard] = useState<ReferralLeaderboardEntry[]>(
    []
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const statsRef = useRef<ReferralStats | null>(null);

  useEffect(() => {
    statsRef.current = referralStats;
  }, [referralStats]);

  const loadReferralCode = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await referralService.getReferralCode();
      const normalized = normalizeReferralStats(data, statsRef.current);
      statsRef.current = normalized;
      setReferralStats(normalized);
      return normalized;
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load referral code");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await referralService.getReferralStats();
      const normalized = normalizeReferralStats(data, statsRef.current);
      statsRef.current = normalized;
      setReferralStats(normalized);
      return normalized;
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load stats");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await referralService.getReferralHistory();
      setHistory(data);
      return data;
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load history");
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLeaderboard = useCallback(async (limit: number = 10) => {
    try {
      setLoading(true);
      setError(null);
      const data = await referralService.getReferralLeaderboard(limit);
      setLeaderboard(data);
      return data;
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load leaderboard");
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    referralStats,
    history,
    leaderboard,
    loading,
    error,
    loadReferralCode,
    loadStats,
    loadHistory,
    loadLeaderboard,
  };
};
