import { useCallback, useEffect, useState } from "react";
import achievementService, {
  AchievementCategory,
  UserAchievement,
} from "../services/api/achievementService";
import socketService from "../services/socketService";

export const useAchievements = () => {
  const [achievements, setAchievements] = useState<UserAchievement[]>([]);
  const [unlockedAchievements, setUnlockedAchievements] = useState<
    UserAchievement[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newlyUnlocked, setNewlyUnlocked] = useState<UserAchievement | null>(
    null
  );

  const loadAchievements = useCallback(
    async (category?: AchievementCategory) => {
      try {
        setLoading(true);
        setError(null);
        const data = await achievementService.getAchievements(category);
        setAchievements(data);
      } catch (err: any) {
        setError(err.response?.data?.message || "Failed to load achievements");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const loadUnlockedAchievements = useCallback(async (userId?: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await achievementService.getUserAchievements(userId);
      setUnlockedAchievements(data);
    } catch (err: any) {
      setError(
        err.response?.data?.message || "Failed to load unlocked achievements"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const loadProgress = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await achievementService.getAchievementsProgress();
      setAchievements(data);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load progress");
    } finally {
      setLoading(false);
    }
  }, []);

  // Listen for achievement unlocks in real-time
  useEffect(() => {
    const handleAchievementUnlocked = (achievement: any) => {
      setNewlyUnlocked(achievement);
      loadProgress(); // Refresh all achievements
      loadUnlockedAchievements(); // Refresh unlocked list
    };

    socketService.on("achievement:unlocked", handleAchievementUnlocked);

    return () => {
      socketService.off("achievement:unlocked", handleAchievementUnlocked);
    };
  }, [loadProgress, loadUnlockedAchievements]);

  const clearNewlyUnlocked = useCallback(() => {
    setNewlyUnlocked(null);
  }, []);

  return {
    achievements,
    unlockedAchievements,
    loading,
    error,
    newlyUnlocked,
    loadAchievements,
    loadUnlockedAchievements,
    loadProgress,
    clearNewlyUnlocked,
  };
};
