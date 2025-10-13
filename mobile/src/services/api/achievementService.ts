import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { API_BASE_URL } from "../../config";

export interface Achievement {
  _id: string;
  key: string;
  name: string;
  description: string;
  category: "PRACTICE" | "IMPROVEMENT" | "STREAK" | "SOCIAL" | "MILESTONE";
  icon: string;
  points: number;
  requirement: {
    type: string;
    value: number;
  };
  isPremium: boolean;
  order: number;
}

export interface UserAchievement extends Achievement {
  progress: number;
  isUnlocked: boolean;
  unlockedAt?: string;
  progressPercentage: number;
}

export type AchievementCategory =
  | "PRACTICE"
  | "IMPROVEMENT"
  | "STREAK"
  | "SOCIAL"
  | "MILESTONE"
  | "all";

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

class AchievementService {
  /**
   * Get all achievements with user progress
   */
  async getAchievements(
    category?: AchievementCategory
  ): Promise<UserAchievement[]> {
    const headers = await getAuthHeaders();
    const response = await axios.get(`${API_BASE_URL}/achievements`, {
      headers,
      params: category && category !== "all" ? { category } : undefined,
    });
    return response.data.data;
  }

  /**
   * Get user's unlocked achievements
   */
  async getUserAchievements(userId?: string): Promise<UserAchievement[]> {
    const headers = await getAuthHeaders();
    const endpoint = userId
      ? `${API_BASE_URL}/achievements/user/${userId}`
      : `${API_BASE_URL}/achievements/me`;
    const response = await axios.get(endpoint, { headers });
    return response.data.data;
  }

  /**
   * Get achievements with progress for current user
   */
  async getAchievementsProgress(): Promise<UserAchievement[]> {
    const headers = await getAuthHeaders();
    const response = await axios.get(
      `${API_BASE_URL}/achievements/progress`,
      { headers }
    );
    return response.data.data;
  }
}

export default new AchievementService();
