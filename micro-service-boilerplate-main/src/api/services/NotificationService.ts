import { env } from '@env';
import { Expo } from 'expo-server-sdk';
import { Service } from 'typedi';

import { getSupabaseAdmin } from '@lib/supabaseClient';
import { Logger } from '../../lib/logger';

export type NotificationSettings = {
  dailyReminderEnabled: boolean;
  dailyReminderHour: number;
  dailyReminderMinute: number;
  achievementsEnabled: boolean;
  streakRemindersEnabled: boolean;
  inactivityRemindersEnabled: boolean;
  feedbackNotificationsEnabled: boolean;
  directMessagesEnabled: boolean;
  groupMessagesEnabled: boolean;
  systemAnnouncementsEnabled: boolean;
  offersEnabled: boolean;
};

const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
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
  offersEnabled: true
};

type DirectMessagePayload = {
  recipientId: string;
  senderId: string;
  message: string;
  conversationId: string;
};

type GroupMessagePayload = {
  recipientIds: string[];
  senderId: string;
  message: string;
  groupId: string;
  groupName?: string;
};

type SystemMessagePayload = {
  userIds?: string[];
  title: string;
  body: string;
  type: 'system' | 'offer';
  data?: Record<string, any>;
};

@Service()
export class NotificationService {
  private log = new Logger(__filename);
  private expo: Expo;

  constructor() {
    this.expo = new Expo({ accessToken: env.push.expoAccessToken || undefined });
  }

  private isEnabled(): boolean {
    return env.push.enabled === true;
  }

  private mergeSettings(
    current?: Partial<NotificationSettings> | null,
    updates?: Partial<NotificationSettings>
  ): NotificationSettings {
    return {
      ...DEFAULT_NOTIFICATION_SETTINGS,
      ...(current || {}),
      ...(updates || {})
    };
  }

  private fromRow(row: any | null | undefined): NotificationSettings {
    if (!row) return DEFAULT_NOTIFICATION_SETTINGS;
    return this.mergeSettings({
      dailyReminderEnabled: row.daily_reminder_enabled,
      dailyReminderHour: row.daily_reminder_hour,
      dailyReminderMinute: row.daily_reminder_minute,
      achievementsEnabled: row.achievements_enabled,
      streakRemindersEnabled: row.streak_reminders_enabled,
      inactivityRemindersEnabled: row.inactivity_reminders_enabled,
      feedbackNotificationsEnabled: row.feedback_notifications_enabled,
      directMessagesEnabled: row.direct_messages_enabled,
      groupMessagesEnabled: row.group_messages_enabled,
      systemAnnouncementsEnabled: row.system_announcements_enabled,
      offersEnabled: row.offers_enabled
    });
  }

  private toRow(userId: string, payload: NotificationSettings) {
    return {
      user_id: userId,
      daily_reminder_enabled: payload.dailyReminderEnabled,
      daily_reminder_hour: payload.dailyReminderHour,
      daily_reminder_minute: payload.dailyReminderMinute,
      achievements_enabled: payload.achievementsEnabled,
      streak_reminders_enabled: payload.streakRemindersEnabled,
      inactivity_reminders_enabled: payload.inactivityRemindersEnabled,
      feedback_notifications_enabled: payload.feedbackNotificationsEnabled,
      direct_messages_enabled: payload.directMessagesEnabled,
      group_messages_enabled: payload.groupMessagesEnabled,
      system_announcements_enabled: payload.systemAnnouncementsEnabled,
      offers_enabled: payload.offersEnabled
    };
  }

  async registerDeviceToken(userId: string, token: string, platform?: 'ios' | 'android'): Promise<void> {
    if (!token) return;

    if (!Expo.isExpoPushToken(token)) {
      this.log.warn('Skipping invalid Expo push token', { userId, token });
      return;
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('device_tokens')
      .upsert(
        {
          token,
          user_id: userId,
          platform: platform || null
        },
        { onConflict: 'token' }
      );

    if (error) {
      this.log.warn('Failed to register device token', { userId, error: error.message });
    }
  }

  async removeDeviceToken(userId: string, token: string): Promise<void> {
    if (!token) return;

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('device_tokens').delete().eq('user_id', userId).eq('token', token);
    if (error) {
      this.log.warn('Failed to remove device token', { userId, error: error.message });
    }
  }

  async getNotificationSettings(userId: string): Promise<NotificationSettings> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('notification_preferences')
      .select(
        'daily_reminder_enabled, daily_reminder_hour, daily_reminder_minute, achievements_enabled, streak_reminders_enabled, inactivity_reminders_enabled, feedback_notifications_enabled, direct_messages_enabled, group_messages_enabled, system_announcements_enabled, offers_enabled'
      )
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      this.log.warn('Failed to fetch notification preferences; using defaults', { userId, error: error.message });
      return DEFAULT_NOTIFICATION_SETTINGS;
    }

    if (!data) {
      // Provision defaults once.
      const { error: insertError } = await supabase.from('notification_preferences').insert(this.toRow(userId, DEFAULT_NOTIFICATION_SETTINGS));
      if (insertError) {
        this.log.warn('Failed to provision default notification preferences', { userId, error: insertError.message });
      }
      return DEFAULT_NOTIFICATION_SETTINGS;
    }

    return this.fromRow(data);
  }

  async updateNotificationSettings(userId: string, payload: NotificationSettings): Promise<NotificationSettings> {
    const merged = this.mergeSettings(undefined, payload);

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('notification_preferences')
      .upsert(this.toRow(userId, merged), { onConflict: 'user_id' });

    if (error) {
      this.log.warn('Failed to update notification preferences', { userId, error: error.message });
      // Surface the merged state anyway so the client can continue to behave deterministically.
      return merged;
    }

    return merged;
  }

  // The remaining methods are used by social/chat and scheduled jobs. They're safe no-ops while
  // push notifications are disabled and/or until the rest of the social stack is migrated to Postgres.

  async notifyDirectMessage(_payload: DirectMessagePayload): Promise<void> {
    if (!this.isEnabled()) return;
    // TODO: implement using `device_tokens` + `notification_preferences` + Expo push.
  }

  async notifyGroupMessage(_payload: GroupMessagePayload): Promise<void> {
    if (!this.isEnabled()) return;
    // TODO: implement using `device_tokens` + `notification_preferences` + Expo push.
  }

  async notifySystemMessage(_payload: SystemMessagePayload): Promise<void> {
    if (!this.isEnabled()) return;
    // TODO: implement using `device_tokens` + `notification_preferences` + Expo push.
  }

  async findUsersNeedingInactivityReminder(): Promise<Array<{ userId: string; daysInactive: number }>> {
    if (!this.isEnabled()) return [];
    // TODO: implement using Postgres `user_stats` + preferences.
    return [];
  }

  async notifyInactivity(_userId: string, _daysInactive: number): Promise<void> {
    if (!this.isEnabled()) return;
    // TODO: implement.
  }
}

