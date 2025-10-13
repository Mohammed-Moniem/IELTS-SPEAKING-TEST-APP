import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { API_BASE_URL } from "../../config";

export interface ReferralStats {
  referralCode: string;
  referralLink: string;
  totalReferrals: number;
  successfulReferrals: number;
  pendingReferrals: number;
  lifetimeEarnings: {
    practiceSessionsGranted: number;
    simulationSessionsGranted: number;
  };
  canReferToday: boolean;
  remainingToday: number;
}

export interface ReferralHistory {
  _id: string;
  referredUserId?: {
    _id: string;
    email: string;
    username?: string;
  };
  referralCode: string;
  email?: string;
  status: "pending" | "completed" | "expired";
  rewards: {
    practiceSessionsGranted: number;
    simulationSessionsGranted: number;
  };
  createdAt: string;
  completedAt?: string;
}

export interface ReferralLeaderboardEntry {
  userId: {
    _id: string;
    email: string;
    username?: string;
    avatar?: string;
  };
  successfulReferrals: number;
  rank: number;
}

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

class ReferralService {
  /**
   * Get user's referral code and stats
   */
  async getReferralCode(): Promise<ReferralStats> {
    const headers = await getAuthHeaders();
    const response = await axios.get(`${API_BASE_URL}/referrals/code`, {
      headers,
    });
    return response.data.data;
  }

  /**
   * Get referral statistics
   */
  async getReferralStats(): Promise<ReferralStats> {
    const headers = await getAuthHeaders();
    const response = await axios.get(`${API_BASE_URL}/referrals/stats`, {
      headers,
    });
    return response.data.data;
  }

  /**
   * Get referral history
   */
  async getReferralHistory(): Promise<ReferralHistory[]> {
    const headers = await getAuthHeaders();
    const response = await axios.get(`${API_BASE_URL}/referrals/history`, {
      headers,
    });
    return response.data.data;
  }

  /**
   * Get referral leaderboard
   */
  async getReferralLeaderboard(
    limit: number = 10
  ): Promise<ReferralLeaderboardEntry[]> {
    const headers = await getAuthHeaders();
    const response = await axios.get(
      `${API_BASE_URL}/referrals/leaderboard`,
      {
        headers,
        params: { limit },
      }
    );
    return response.data.data;
  }
}

export default new ReferralService();
