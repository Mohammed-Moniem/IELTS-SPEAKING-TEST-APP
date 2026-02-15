import { apiClient } from "../../api/client";

export interface LeaderboardEntry {
  userId: {
    _id: string;
    email: string;
    username?: string;
    avatar?: string;
  };
  rank: number;
  score: number;
  totalPracticeSessions?: number;
  achievementPoints?: number;
  currentStreak?: number;
}

export interface UserPosition {
  rank: number;
  totalUsers: number;
  percentile: number;
  score: number;
}

type LeaderboardPeriod = "all-time" | "daily" | "weekly" | "monthly";
type LeaderboardMetric = "score" | "practices" | "achievements" | "streak";

class LeaderboardService {
  /**
   * Get leaderboard rankings
   */
  async getLeaderboard(
    period: LeaderboardPeriod = "all-time",
    metric: LeaderboardMetric = "score",
    limit: number = 100
  ): Promise<LeaderboardEntry[]> {
    const response = await apiClient.get(`/leaderboard`, {
      params: { period, metric, limit },
    });
    return response.data.data;
  }

  /**
   * Get friends-only leaderboard
   */
  async getFriendsLeaderboard(
    period: LeaderboardPeriod = "all-time",
    metric: LeaderboardMetric = "score"
  ): Promise<LeaderboardEntry[]> {
    const response = await apiClient.get(`/leaderboard/friends`, {
      params: { period, metric },
    });
    return response.data.data;
  }

  /**
   * Get user's position in leaderboard
   */
  async getUserPosition(
    period: LeaderboardPeriod = "all-time",
    metric: LeaderboardMetric = "score"
  ): Promise<UserPosition> {
    const response = await apiClient.get(`/leaderboard/position`, {
      params: { period, metric },
    });
    return response.data.data;
  }

  /**
   * Opt in to leaderboard
   */
  async optIn(): Promise<{ message: string }> {
    const response = await apiClient.post(`/leaderboard/opt-in`, {});
    return response.data;
  }

  /**
   * Opt out from leaderboard
   */
  async optOut(): Promise<{ message: string }> {
    const response = await apiClient.post(`/leaderboard/opt-out`, {});
    return response.data;
  }
}

export default new LeaderboardService();
