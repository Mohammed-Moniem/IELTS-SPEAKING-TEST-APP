/**
 * Notification Service
 * Handles push notifications, reminders, and local notifications
 */

import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export type NotificationCategory =
  | "daily_reminder"
  | "achievement"
  | "streak"
  | "inactivity"
  | "feedback_ready"
  | "milestone";

interface ScheduledNotification {
  identifier: string;
  title: string;
  body: string;
  data?: Record<string, any>;
}

class NotificationService {
  private isInitialized = false;
  private expoPushToken: string | null = null;

  /**
   * Initialize notification service and request permissions
   */
  async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;

    try {
      // Only real devices can receive notifications
      if (!Device.isDevice) {
        console.log("⚠️ Notifications only work on physical devices");
        return false;
      }

      // Request permissions
      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") {
        console.log("❌ Notification permission denied");
        return false;
      }

      // Get push token
      const token = await this.registerForPushNotifications();
      if (token) {
        this.expoPushToken = token;
        console.log("✅ Push token:", token);
      }

      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error("❌ Failed to initialize notifications:", error);
      return false;
    }
  }

  /**
   * Register for push notifications and get Expo push token
   */
  private async registerForPushNotifications(): Promise<string | null> {
    try {
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;

      if (!projectId) {
        console.log("⚠️ No project ID found. Push notifications require EAS.");
        return null;
      }

      const token = await Notifications.getExpoPushTokenAsync({
        projectId,
      });

      // Configure Android notification channel
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("default", {
          name: "Default",
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: "#4F46E5",
        });

        await Notifications.setNotificationChannelAsync("reminders", {
          name: "Practice Reminders",
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          sound: "default",
        });

        await Notifications.setNotificationChannelAsync("achievements", {
          name: "Achievements",
          importance: Notifications.AndroidImportance.DEFAULT,
          sound: "default",
        });
      }

      return token.data;
    } catch (error) {
      console.error("❌ Failed to get push token:", error);
      return null;
    }
  }

  /**
   * Get the Expo push token
   */
  getPushToken(): string | null {
    return this.expoPushToken;
  }

  /**
   * Schedule a daily practice reminder
   */
  async scheduleDailyReminder(
    hour: number,
    minute: number,
    enabled: boolean = true
  ): Promise<string | null> {
    try {
      // Cancel existing daily reminder
      await this.cancelNotificationsByCategory("daily_reminder");

      if (!enabled) {
        console.log("✅ Daily reminder disabled");
        return null;
      }

      // Schedule notification
      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title: "🎯 Time to practice!",
          body: "Keep your IELTS speaking skills sharp with a quick practice session.",
          data: { category: "daily_reminder" },
          sound: "default",
          categoryIdentifier: "reminders",
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour,
          minute,
        },
      });

      console.log(`✅ Daily reminder scheduled at ${hour}:${minute}`);
      return identifier;
    } catch (error) {
      console.error("❌ Failed to schedule daily reminder:", error);
      return null;
    }
  }

  /**
   * Send an achievement notification
   */
  async sendAchievementNotification(
    achievementName: string,
    description: string
  ): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `🏆 Achievement Unlocked!`,
          body: `${achievementName}: ${description}`,
          data: { category: "achievement", achievementName },
          sound: "default",
          categoryIdentifier: "achievements",
        },
        trigger: null, // Send immediately
      });

      console.log(`✅ Achievement notification sent: ${achievementName}`);
    } catch (error) {
      console.error("❌ Failed to send achievement notification:", error);
    }
  }

  /**
   * Send a streak reminder
   */
  async sendStreakNotification(
    streakDays: number,
    isAboutToBreak: boolean = false
  ): Promise<void> {
    try {
      const title = isAboutToBreak
        ? `🔥 Don't break your streak!`
        : `🔥 ${streakDays}-day streak!`;

      const body = isAboutToBreak
        ? `You're about to lose your ${streakDays}-day streak. Practice now to keep it going!`
        : `Amazing! You've practiced for ${streakDays} days in a row. Keep it up!`;

      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: { category: "streak", streakDays, isAboutToBreak },
          sound: "default",
        },
        trigger: null,
      });

      console.log(`✅ Streak notification sent: ${streakDays} days`);
    } catch (error) {
      console.error("❌ Failed to send streak notification:", error);
    }
  }

  /**
   * Send inactivity reminder
   */
  async sendInactivityReminder(daysSinceLastPractice: number): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "👋 We miss you!",
          body: `It's been ${daysSinceLastPractice} days since your last practice. Ready to get back on track?`,
          data: { category: "inactivity", daysSinceLastPractice },
          sound: "default",
        },
        trigger: null,
      });

      console.log(`✅ Inactivity reminder sent: ${daysSinceLastPractice} days`);
    } catch (error) {
      console.error("❌ Failed to send inactivity reminder:", error);
    }
  }

  /**
   * Send feedback ready notification
   */
  async sendFeedbackReadyNotification(sessionTitle: string): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "✅ Your feedback is ready!",
          body: `Check out your detailed feedback for "${sessionTitle}"`,
          data: { category: "feedback_ready", sessionTitle },
          sound: "default",
        },
        trigger: null,
      });

      console.log(`✅ Feedback notification sent for: ${sessionTitle}`);
    } catch (error) {
      console.error("❌ Failed to send feedback notification:", error);
    }
  }

  /**
   * Send milestone notification
   */
  async sendMilestoneNotification(
    milestone: string,
    description: string
  ): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `🎉 Milestone Reached!`,
          body: `${milestone}: ${description}`,
          data: { category: "milestone", milestone },
          sound: "default",
        },
        trigger: null,
      });

      console.log(`✅ Milestone notification sent: ${milestone}`);
    } catch (error) {
      console.error("❌ Failed to milestone notification:", error);
    }
  }

  /**
   * Schedule a custom notification
   */
  async scheduleNotification(
    title: string,
    body: string,
    trigger: Notifications.NotificationTriggerInput,
    data?: Record<string, any>
  ): Promise<string | null> {
    try {
      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: "default",
        },
        trigger,
      });

      console.log(`✅ Custom notification scheduled: ${identifier}`);
      return identifier;
    } catch (error) {
      console.error("❌ Failed to schedule notification:", error);
      return null;
    }
  }

  /**
   * Get all scheduled notifications
   */
  async getAllScheduledNotifications(): Promise<ScheduledNotification[]> {
    try {
      const notifications =
        await Notifications.getAllScheduledNotificationsAsync();
      return notifications.map((notif) => ({
        identifier: notif.identifier,
        title: notif.content.title || "",
        body: notif.content.body || "",
        data: notif.content.data,
      }));
    } catch (error) {
      console.error("❌ Failed to get scheduled notifications:", error);
      return [];
    }
  }

  /**
   * Cancel a specific notification
   */
  async cancelNotification(identifier: string): Promise<void> {
    try {
      await Notifications.cancelScheduledNotificationAsync(identifier);
      console.log(`✅ Cancelled notification: ${identifier}`);
    } catch (error) {
      console.error("❌ Failed to cancel notification:", error);
    }
  }

  /**
   * Cancel all notifications of a specific category
   */
  async cancelNotificationsByCategory(
    category: NotificationCategory
  ): Promise<void> {
    try {
      const notifications = await this.getAllScheduledNotifications();
      const toCancel = notifications.filter(
        (notif) => notif.data?.category === category
      );

      for (const notif of toCancel) {
        await this.cancelNotification(notif.identifier);
      }

      console.log(`✅ Cancelled ${toCancel.length} ${category} notifications`);
    } catch (error) {
      console.error("❌ Failed to cancel notifications by category:", error);
    }
  }

  /**
   * Cancel all scheduled notifications
   */
  async cancelAllNotifications(): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log("✅ Cancelled all notifications");
    } catch (error) {
      console.error("❌ Failed to cancel all notifications:", error);
    }
  }

  /**
   * Get notification permissions status
   */
  async getPermissionStatus(): Promise<"granted" | "denied" | "undetermined"> {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      return status;
    } catch (error) {
      console.error("❌ Failed to get permission status:", error);
      return "undetermined";
    }
  }

  /**
   * Request notification permissions
   */
  async requestPermissions(): Promise<boolean> {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      return status === "granted";
    } catch (error) {
      console.error("❌ Failed to request permissions:", error);
      return false;
    }
  }

  /**
   * Add notification received listener
   */
  addNotificationReceivedListener(
    listener: (notification: Notifications.Notification) => void
  ): Notifications.Subscription {
    return Notifications.addNotificationReceivedListener(listener);
  }

  /**
   * Add notification response listener (when user taps notification)
   */
  addNotificationResponseListener(
    listener: (response: Notifications.NotificationResponse) => void
  ): Notifications.Subscription {
    return Notifications.addNotificationResponseReceivedListener(listener);
  }

  /**
   * Get badge count
   */
  async getBadgeCount(): Promise<number> {
    try {
      return await Notifications.getBadgeCountAsync();
    } catch (error) {
      console.error("❌ Failed to get badge count:", error);
      return 0;
    }
  }

  /**
   * Set badge count
   */
  async setBadgeCount(count: number): Promise<void> {
    try {
      await Notifications.setBadgeCountAsync(count);
      console.log(`✅ Badge count set to: ${count}`);
    } catch (error) {
      console.error("❌ Failed to set badge count:", error);
    }
  }

  /**
   * Clear badge count
   */
  async clearBadgeCount(): Promise<void> {
    await this.setBadgeCount(0);
  }
}

export default new NotificationService();
