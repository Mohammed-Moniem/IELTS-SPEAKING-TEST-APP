import { useCallback, useState } from "react";
import referralService, {
  ReferralHistory,
  ReferralLeaderboardEntry,
  ReferralStats,
} from "../services/api/referralService";

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

  const loadReferralCode = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await referralService.getReferralCode();
      setReferralStats(data);
      return data;
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
      setReferralStats(data);
      return data;
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
