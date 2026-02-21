import { apiClient } from "../../api/client";

export interface UserProfile {
  _id: string;
  userId: string;
  username: string;
  avatar?: string;
  bio?: string;
  level: number;
  xp: number;
  badges: string[];
  ieltsInfo?: {
    type: "academic" | "general";
    targetBand?: number;
    testDate?: string;
  };
  studyGoals?: {
    purpose?: string;
    targetCountry?: string;
    dailyGoal?: number;
  };
  social: {
    qrCode?: string;
    allowFriendSuggestions: boolean;
    showOnlineStatus: boolean;
  };
  privacy: {
    profileVisibility: "public" | "friends-only" | "private";
    leaderboardOptIn: boolean;
    showStatistics: boolean;
    showActivity: boolean;
  };
  lastActive: string;
  createdAt: string;
}

export interface UserStatistics {
  totalPracticeSessions: number;
  totalSimulations: number;
  averageScore: number;
  highestScore: number;
  currentStreak: number;
  longestStreak: number;
  weeklyScore: number;
  monthlyScore: number;
  totalAchievements: number;
  achievementPoints: number;
}

export type ResolvedQRCode =
  | {
      type: "friend_invite";
      user: {
        userId: string;
        username: string;
        avatar?: string;
        bio?: string;
        level?: number;
        xp?: number;
      };
      status: {
        isFriend: boolean;
        hasPendingRequest: boolean;
        pendingDirection: "outgoing" | "incoming" | null;
      };
    }
  | {
      type: "referral";
      referrer: {
        userId: string;
        username: string;
        avatar?: string;
      };
      referralCode: string;
      referralLink?: string;
    };

class ProfileService {
  /**
   * Get current user's profile
   */
  async getMyProfile(): Promise<UserProfile> {
    const response = await apiClient.get(`/profile/me`);
    return response.data.data;
  }

  /**
   * Get another user's profile
   */
  async getUserProfile(userId: string): Promise<UserProfile> {
    const response = await apiClient.get(`/profile/${userId}`);
    return response.data.data;
  }

  /**
   * Update profile
   */
  async updateProfile(updates: {
    username?: string;
    avatar?: string;
    bio?: string;
    ieltsInfo?: {
      type?: "academic" | "general";
      targetBand?: number;
      testDate?: string;
    };
    studyGoals?: {
      purpose?: string;
      targetCountry?: string;
      dailyGoal?: number;
    };
    social?: {
      allowFriendSuggestions?: boolean;
      showOnlineStatus?: boolean;
    };
  }): Promise<UserProfile> {
    const response = await apiClient.put(`/profile`, updates);
    return response.data.data;
  }

  /**
   * Update privacy settings
   */
  async updatePrivacySettings(privacySettings: {
    profileVisibility?: "public" | "friends-only" | "private";
    leaderboardOptIn?: boolean;
    showStatistics?: boolean;
    showActivity?: boolean;
  }): Promise<UserProfile> {
    const response = await apiClient.put(`/profile/settings`, privacySettings);
    return response.data.data;
  }

  /**
   * Get user statistics
   */
  async getUserStatistics(userId?: string): Promise<UserStatistics> {
    const endpoint = userId ? `/profile/stats/${userId}` : `/profile/stats/me`;
    const response = await apiClient.get(endpoint);
    return response.data.data;
  }

  /**
   * Generate/refresh QR code
   */
  async generateQRCode(
    purpose: "friend" | "referral" = "friend"
  ): Promise<{ qrCode: string; purpose: "friend" | "referral" }> {
    const response = await apiClient.post(`/profile/qr-code`, { purpose });
    return response.data.data;
  }

  /**
   * Resolve QR payload scanned by user
   */
  async resolveQRCode(code: string): Promise<ResolvedQRCode> {
    const response = await apiClient.post(`/profile/qr-code/resolve`, { code });
    return response.data.data;
  }
}

export default new ProfileService();
