import { apiClient } from "../../api/client";

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

type ReferralStatsPayload = Partial<ReferralStats> & {
  code?: string;
  link?: string;
};

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

class ReferralService {
  /**
   * Get user's referral code and stats
   */
  async getReferralCode(): Promise<ReferralStatsPayload> {
    const response = await apiClient.get(`/referrals/code`);
    return response.data.data;
  }

  /**
   * Get referral statistics
   */
  async getReferralStats(): Promise<ReferralStatsPayload> {
    const response = await apiClient.get(`/referrals/stats`);
    return response.data.data;
  }

  /**
   * Get referral history
   */
  async getReferralHistory(): Promise<ReferralHistory[]> {
    const response = await apiClient.get(`/referrals/history`);
    return response.data.data;
  }

  /**
   * Get referral leaderboard
   */
  async getReferralLeaderboard(
    limit: number = 10
  ): Promise<ReferralLeaderboardEntry[]> {
    const response = await apiClient.get(`/referrals/leaderboard`, {
      params: { limit },
    });
    return response.data.data;
  }
}

export default new ReferralService();
