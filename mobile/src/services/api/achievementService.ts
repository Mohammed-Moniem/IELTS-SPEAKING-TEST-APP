import { apiClient } from "../../api/client";

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

class AchievementService {
  /**
   * Get all achievements with user progress
   */
  async getAchievements(
    category?: AchievementCategory
  ): Promise<UserAchievement[]> {
    const response = await apiClient.get(`/achievements`, {
      params: category && category !== "all" ? { category } : undefined,
    });
    return response.data.data;
  }

  /**
   * Get user's unlocked achievements
   */
  async getUserAchievements(userId?: string): Promise<UserAchievement[]> {
    const endpoint = userId
      ? `/achievements/user/${userId}`
      : `/achievements/me`;
    const response = await apiClient.get(endpoint);
    return response.data.data;
  }

  /**
   * Get achievements with progress for current user
   */
  async getAchievementsProgress(): Promise<UserAchievement[]> {
    const response = await apiClient.get(`/achievements/progress`);
    return response.data.data;
  }
}

export default new AchievementService();
