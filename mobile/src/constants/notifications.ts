import { NotificationSettings } from "../types/api";

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  dailyReminderEnabled: true,
  dailyReminderHour: 19,
  dailyReminderMinute: 0,
  achievementsEnabled: true,
  streakRemindersEnabled: true,
  inactivityRemindersEnabled: true,
  feedbackNotificationsEnabled: true,
  directMessagesEnabled: true,
  groupMessagesEnabled: true,
  systemAnnouncementsEnabled: true,
  offersEnabled: true,
};
