import { useCallback, useState } from "react";
import leaderboardService, {
  LeaderboardEntry,
  UserPosition,
} from "../services/api/leaderboardService";

type LeaderboardPeriod = "all-time" | "daily" | "weekly" | "monthly";
type LeaderboardMetric = "score" | "practices" | "achievements" | "streak";

export const useLeaderboard = () => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [friendsLeaderboard, setFriendsLeaderboard] = useState<
    LeaderboardEntry[]
  >([]);
  const [userPosition, setUserPosition] = useState<UserPosition | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLeaderboard = useCallback(
    async (
      period: LeaderboardPeriod = "all-time",
      metric: LeaderboardMetric = "score",
      limit: number = 100
    ) => {
      try {
        setLoading(true);
        setError(null);
        const data = await leaderboardService.getLeaderboard(
          period,
          metric,
          limit
        );
        setLeaderboard(data);
      } catch (err: any) {
        setError(err.response?.data?.message || "Failed to load leaderboard");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const loadFriendsLeaderboard = useCallback(
    async (
      period: LeaderboardPeriod = "all-time",
      metric: LeaderboardMetric = "score"
    ) => {
      try {
        setLoading(true);
        setError(null);
        const data = await leaderboardService.getFriendsLeaderboard(
          period,
          metric
        );
        setFriendsLeaderboard(data);
      } catch (err: any) {
        setError(
          err.response?.data?.message || "Failed to load friends leaderboard"
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const loadUserPosition = useCallback(
    async (
      period: LeaderboardPeriod = "all-time",
      metric: LeaderboardMetric = "score"
    ) => {
      try {
        setLoading(true);
        setError(null);
        const data = await leaderboardService.getUserPosition(period, metric);
        setUserPosition(data);
      } catch (err: any) {
        setError(err.response?.data?.message || "Failed to load position");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const optIn = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      await leaderboardService.optIn();
      return true;
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to opt in");
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const optOut = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      await leaderboardService.optOut();
      return true;
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to opt out");
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    leaderboard,
    friendsLeaderboard,
    userPosition,
    loading,
    error,
    loadLeaderboard,
    loadFriendsLeaderboard,
    loadUserPosition,
    optIn,
    optOut,
  };
};
