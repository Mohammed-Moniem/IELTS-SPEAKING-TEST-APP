/**
 * Notification Manager Hook
 * Manages notification triggers based on user activity
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useRef } from "react";

import { DEFAULT_NOTIFICATION_SETTINGS } from "../constants/notifications";
import notificationService from "../services/notificationService";
import { NotificationSettings } from "../types/api";
import { logger } from "../utils/logger";

interface UserActivity {
  lastPracticeDate: string | null;
  currentStreak: number;
  practiceCount: number;
}

const ACTIVITY_KEY = "user_activity";
const NOTIFICATION_SETTINGS_KEY = "notification_settings";

export const useNotificationManager = () => {
  const activityCheckInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Initialize notification service
    initializeNotifications();

    // Check activity daily
    activityCheckInterval.current = setInterval(
      checkUserActivity,
      24 * 60 * 60 * 1000 // 24 hours
    );

    // Initial check
    checkUserActivity();

    return () => {
      if (activityCheckInterval.current) {
        clearInterval(activityCheckInterval.current);
      }
    };
  }, []);

  const initializeNotifications = async () => {
    const initialized = await notificationService.initialize();
    if (initialized) {
      console.log("✅ Notification service initialized");

      // Set up daily reminder if enabled
      const settings = await getNotificationSettings();
      if (settings.dailyReminderEnabled) {
        await notificationService.scheduleDailyReminder(
          settings.dailyReminderHour || 19,
          settings.dailyReminderMinute || 0,
          true
        );
      }
    }
  };

  const getNotificationSettings = async (): Promise<NotificationSettings> => {
    try {
      const stored = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          ...DEFAULT_NOTIFICATION_SETTINGS,
          ...parsed,
        };
      }
    } catch (error) {
      logger.warn("Failed to get notification settings:", error);
    }

    return DEFAULT_NOTIFICATION_SETTINGS;
  };

  const getUserActivity = async (): Promise<UserActivity> => {
    try {
      const stored = await AsyncStorage.getItem(ACTIVITY_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      logger.warn("Failed to get user activity:", error);
    }

    return {
      lastPracticeDate: null,
      currentStreak: 0,
      practiceCount: 0,
    };
  };

  const checkUserActivity = async () => {
    try {
      const activity = await getUserActivity();
      const settings = await getNotificationSettings();

      const now = new Date();
      const lastPractice = activity.lastPracticeDate
        ? new Date(activity.lastPracticeDate)
        : null;

      if (!lastPractice) return;

      const daysSinceLastPractice = Math.floor(
        (now.getTime() - lastPractice.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Streak about to break (practiced yesterday but not today)
      if (
        settings.streakRemindersEnabled &&
        activity.currentStreak > 0 &&
        daysSinceLastPractice === 1
      ) {
        const hour = now.getHours();
        // Send reminder in the evening (after 6 PM) if not practiced today
        if (hour >= 18) {
          await notificationService.sendStreakNotification(
            activity.currentStreak,
            true
          );
        }
      }

      // Inactivity reminder (3 days, 7 days, 14 days)
      if (
        settings.inactivityRemindersEnabled &&
        [3, 7, 14].includes(daysSinceLastPractice)
      ) {
        await notificationService.sendInactivityReminder(daysSinceLastPractice);
      }
    } catch (error) {
      logger.warn("Failed to check user activity:", error);
    }
  };

  const trackPracticeSession = async () => {
    try {
      const activity = await getUserActivity();
      const now = new Date();
      const today = now.toISOString().split("T")[0];

      const lastPracticeDate = activity.lastPracticeDate;
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

      let newStreak = activity.currentStreak;

      if (lastPracticeDate === today) {
        // Already practiced today, don't update
        return;
      } else if (lastPracticeDate === yesterday) {
        // Practiced yesterday, increment streak
        newStreak = activity.currentStreak + 1;
      } else {
        // Streak broken, reset to 1
        newStreak = 1;
      }

      const newActivity: UserActivity = {
        lastPracticeDate: today,
        currentStreak: newStreak,
        practiceCount: activity.practiceCount + 1,
      };

      await AsyncStorage.setItem(ACTIVITY_KEY, JSON.stringify(newActivity));

      // Check for milestone achievements
      await checkMilestones(newActivity);
    } catch (error) {
      logger.warn("Failed to track practice session:", error);
    }
  };

  const checkMilestones = async (activity: UserActivity) => {
    const settings = await getNotificationSettings();
    if (!settings?.achievementsEnabled) return;

    // Streak milestones
    if ([7, 14, 30, 60, 100].includes(activity.currentStreak)) {
      await notificationService.sendStreakNotification(
        activity.currentStreak,
        false
      );
    }

    // Practice count milestones
    if ([10, 25, 50, 100, 250, 500].includes(activity.practiceCount)) {
      await notificationService.sendMilestoneNotification(
        `${activity.practiceCount} Practice Sessions`,
        `You've completed ${activity.practiceCount} practice sessions! Keep up the great work!`
      );
    }
  };

  const notifyFeedbackReady = async (sessionTitle: string) => {
    const settings = await getNotificationSettings();
    if (settings.feedbackNotificationsEnabled) {
      await notificationService.sendFeedbackReadyNotification(sessionTitle);
    }
  };

  const sendAchievement = async (
    achievementName: string,
    description: string
  ) => {
    const settings = await getNotificationSettings();
    if (settings.achievementsEnabled) {
      await notificationService.sendAchievementNotification(
        achievementName,
        description
      );
    }
  };

  return {
    trackPracticeSession,
    notifyFeedbackReady,
    sendAchievement,
  };
};
