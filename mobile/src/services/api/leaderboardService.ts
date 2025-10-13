import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { API_BASE_URL } from "../../config";

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

const getAuthToken = async (): Promise<string | null> => {
  return await AsyncStorage.getItem("authToken");
};

const getAuthHeaders = async () => {
  const token = await getAuthToken();
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
};

class LeaderboardService {
  /**
   * Get leaderboard rankings
   */
  async getLeaderboard(
    period: LeaderboardPeriod = "all-time",
    metric: LeaderboardMetric = "score",
    limit: number = 100
  ): Promise<LeaderboardEntry[]> {
    const headers = await getAuthHeaders();
    const response = await axios.get(`${API_BASE_URL}/leaderboard`, {
      headers,
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
    const headers = await getAuthHeaders();
    const response = await axios.get(
      `${API_BASE_URL}/leaderboard/friends`,
      {
        headers,
        params: { period, metric },
      }
    );
    return response.data.data;
  }

  /**
   * Get user's position in leaderboard
   */
  async getUserPosition(
    period: LeaderboardPeriod = "all-time",
    metric: LeaderboardMetric = "score"
  ): Promise<UserPosition> {
    const headers = await getAuthHeaders();
    const response = await axios.get(
      `${API_BASE_URL}/leaderboard/position`,
      {
        headers,
        params: { period, metric },
      }
    );
    return response.data.data;
  }

  /**
   * Opt in to leaderboard
   */
  async optIn(): Promise<{ message: string }> {
    const headers = await getAuthHeaders();
    const response = await axios.post(
      `${API_BASE_URL}/leaderboard/opt-in`,
      {},
      { headers }
    );
    return response.data;
  }

  /**
   * Opt out from leaderboard
   */
  async optOut(): Promise<{ message: string }> {
    const headers = await getAuthHeaders();
    const response = await axios.post(
      `${API_BASE_URL}/leaderboard/opt-out`,
      {},
      { headers }
    );
    return response.data;
  }
}

export default new LeaderboardService();
