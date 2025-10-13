import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { API_BASE_URL } from "../../config";

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

class ProfileService {
  /**
   * Get current user's profile
   */
  async getMyProfile(): Promise<UserProfile> {
    const headers = await getAuthHeaders();
    const response = await axios.get(`${API_BASE_URL}/profile/me`, {
      headers,
    });
    return response.data.data;
  }

  /**
   * Get another user's profile
   */
  async getUserProfile(userId: string): Promise<UserProfile> {
    const headers = await getAuthHeaders();
    const response = await axios.get(`${API_BASE_URL}/profile/${userId}`, {
      headers,
    });
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
    const headers = await getAuthHeaders();
    const response = await axios.put(`${API_BASE_URL}/profile`, updates, {
      headers,
    });
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
    const headers = await getAuthHeaders();
    const response = await axios.put(
      `${API_BASE_URL}/profile/settings`,
      privacySettings,
      {
        headers,
      }
    );
    return response.data.data;
  }

  /**
   * Get user statistics
   */
  async getUserStatistics(userId?: string): Promise<UserStatistics> {
    const headers = await getAuthHeaders();
    const endpoint = userId
      ? `${API_BASE_URL}/profile/stats/${userId}`
      : `${API_BASE_URL}/profile/stats/me`;
    const response = await axios.get(endpoint, { headers });
    return response.data.data;
  }

  /**
   * Generate/refresh QR code
   */
  async generateQRCode(): Promise<{ qrCode: string }> {
    const headers = await getAuthHeaders();
    const response = await axios.post(
      `${API_BASE_URL}/profile/qr-code`,
      {},
      { headers }
    );
    return response.data.data;
  }
}

export default new ProfileService();
