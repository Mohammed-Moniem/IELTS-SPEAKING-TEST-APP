import { env } from '@env';
import { UserStats } from '@models/AchievementModel';
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  NotificationSettings,
  NotificationState,
  UserProfile
} from '@models/UserProfileModel';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import { Types } from '@lib/db/mongooseCompat';
import { Service } from 'typedi';

import { Logger } from '../../lib/logger';

const HOURS_IN_DAY = 24;
const MIN_INACTIVITY_REMINDER_GAP_HOURS = 24;

interface DirectMessagePayload {
  recipientId: string;
  senderId: string;
  message: string;
  conversationId: string;
}

interface GroupMessagePayload {
  recipientIds: string[];
  senderId: string;
  message: string;
  groupId: string;
  groupName?: string;
}

interface SystemMessagePayload {
  userIds?: string[];
  title: string;
  body: string;
  type: 'system' | 'offer';
  data?: Record<string, any>;
}

@Service()
export class NotificationService {
  private expo: Expo;
  private log = new Logger(__filename);

  constructor() {
    this.expo = new Expo({ accessToken: env.push.expoAccessToken || undefined });
  }

  private isEnabled(): boolean {
    return env.push.enabled !== false;
  }

  private toObjectId(id: string) {
    return new Types.ObjectId(id);
  }

  private mergeSettings(
    current?: NotificationSettings | null,
    updates?: Partial<NotificationSettings>
  ): NotificationSettings {
    return {
      ...DEFAULT_NOTIFICATION_SETTINGS,
      ...(current || {}),
      ...(updates || {})
    };
  }

  private truncateMessage(message: string): string {
    if (!message) return 'You have a new message';
    const trimmed = message.trim();
    return trimmed.length > 120 ? `${trimmed.slice(0, 117)}...` : trimmed;
  }

  private async getUserDisplayName(userId: string): Promise<string> {
    try {
      const profile = await UserProfile.findOne({ userId: this.toObjectId(userId) }).select('username');
      if (profile?.username) {
        return profile.username;
      }
    } catch (error) {
      this.log.warn('Failed to fetch user display name', { userId, error });
    }
    return 'A friend';
  }

  private async sendPush(to: string[], message: Omit<ExpoPushMessage, 'to'>): Promise<void> {
    if (!this.isEnabled() || to.length === 0) {
      return;
    }

    const notifications = to
      .filter(token => {
        if (!Expo.isExpoPushToken(token)) {
          this.log.warn('Skipping invalid Expo push token', { token });
          return false;
        }
        return true;
      })
      .map(token => ({
        to: token,
        ...message
      }));

    if (notifications.length === 0) {
      return;
    }

    const chunks = this.expo.chunkPushNotifications(notifications);
    for (const chunk of chunks) {
      try {
        await this.expo.sendPushNotificationsAsync(chunk);
      } catch (error) {
        this.log.error('Failed to send push notification chunk', { error });
      }
    }
  }

  async registerDeviceToken(userId: string, token: string): Promise<void> {
    if (!this.isEnabled() || !token) {
      return;
    }

    if (!Expo.isExpoPushToken(token)) {
      this.log.warn('Attempted to register invalid Expo push token', { userId, token });
      return;
    }

    await UserProfile.updateOne(
      { userId: this.toObjectId(userId) },
      {
        $addToSet: { deviceTokens: token },
        $setOnInsert: { notificationSettings: DEFAULT_NOTIFICATION_SETTINGS }
      },
      { upsert: true }
    );
  }

  async removeDeviceToken(userId: string, token: string): Promise<void> {
    if (!token) return;
    await UserProfile.updateOne({ userId: this.toObjectId(userId) }, { $pull: { deviceTokens: token } });
  }

  async getNotificationSettings(userId: string): Promise<NotificationSettings> {
    const profile = await UserProfile.findOne({ userId: this.toObjectId(userId) }).select('notificationSettings');
    return this.mergeSettings(profile?.notificationSettings);
  }

  async updateNotificationSettings(userId: string, payload: NotificationSettings): Promise<NotificationSettings> {
    const merged = this.mergeSettings(undefined, payload);
    await UserProfile.updateOne(
      { userId: this.toObjectId(userId) },
      { $set: { notificationSettings: merged } },
      { upsert: true }
    );
    return merged;
  }

  private async getEligibleProfiles(userIds: string[], preferenceKey: keyof NotificationSettings) {
    if (userIds.length === 0) {
      return [];
    }

    const profiles = await UserProfile.find({
      userId: { $in: userIds.map(id => this.toObjectId(id)) },
      deviceTokens: { $exists: true, $ne: [] }
    }).select('userId deviceTokens notificationSettings notificationState username');

    return profiles.filter(profile => {
      const settings = this.mergeSettings(profile.notificationSettings);
      return settings[preferenceKey] !== false;
    });
  }

  async notifyDirectMessage(payload: DirectMessagePayload): Promise<void> {
    if (!this.isEnabled()) return;

    const profiles = await this.getEligibleProfiles([payload.recipientId], 'directMessagesEnabled');
    const profile = profiles[0];
    if (!profile) return;

    const senderName = await this.getUserDisplayName(payload.senderId);

    await this.sendPush(profile.deviceTokens || [], {
      title: `${senderName} sent you a message`,
      body: this.truncateMessage(payload.message),
      data: {
        type: 'direct_message',
        conversationId: payload.conversationId,
        senderId: payload.senderId
      },
      sound: 'default',
      priority: 'high'
    });
  }

  async notifyGroupMessage(payload: GroupMessagePayload): Promise<void> {
    if (!this.isEnabled()) return;

    const uniqueRecipients = Array.from(new Set(payload.recipientIds.filter(id => id !== payload.senderId)));
    if (uniqueRecipients.length === 0) return;

    const profiles = await this.getEligibleProfiles(uniqueRecipients, 'groupMessagesEnabled');
    if (profiles.length === 0) return;

    const senderName = await this.getUserDisplayName(payload.senderId);
    const baseData = {
      type: 'group_message',
      groupId: payload.groupId,
      senderId: payload.senderId
    };

    await Promise.all(
      profiles.map(profile =>
        this.sendPush(profile.deviceTokens || [], {
          title: payload.groupName
            ? `${payload.groupName}: new message from ${senderName}`
            : `${senderName} in your study group`,
          body: this.truncateMessage(payload.message),
          data: baseData,
          sound: 'default',
          priority: 'high'
        })
      )
    );
  }

  async notifySystemMessage(payload: SystemMessagePayload): Promise<void> {
    if (!this.isEnabled()) return;

    const preferenceKey =
      payload.type === 'offer' ? ('offersEnabled' as const) : ('systemAnnouncementsEnabled' as const);

    let profiles;
    if (payload.userIds?.length) {
      profiles = await this.getEligibleProfiles(payload.userIds, preferenceKey);
    } else {
      profiles = await UserProfile.find({
        [`notificationSettings.${preferenceKey}`]: { $ne: false },
        deviceTokens: { $exists: true, $ne: [] }
      }).select('deviceTokens');
    }

    if (!profiles || profiles.length === 0) return;

    const tokens = profiles.flatMap(profile => profile.deviceTokens || []);
    await this.sendPush(tokens, {
      title: payload.title,
      body: payload.body,
      data: {
        type: payload.type,
        ...payload.data
      },
      sound: 'default'
    });
  }

  private shouldThrottleNotification(
    state?: NotificationState | null,
    hours: number = MIN_INACTIVITY_REMINDER_GAP_HOURS
  ) {
    if (!state?.lastInactivityNotificationAt) return false;
    const elapsed = Date.now() - state.lastInactivityNotificationAt.getTime();
    return elapsed < hours * 60 * 60 * 1000;
  }

  async findUsersNeedingInactivityReminder(
    minHoursInactive: number = HOURS_IN_DAY
  ): Promise<Array<{ userId: string; daysInactive: number }>> {
    if (!this.isEnabled()) return [];

    const cutoff = new Date(Date.now() - minHoursInactive * 60 * 60 * 1000);
    const stats = await UserStats.find({
      lastPracticeDate: { $lte: cutoff }
    }).select('userId lastPracticeDate');

    if (stats.length === 0) return [];

    const userIds = stats.map(stat => stat.userId.toString());
    const profiles = await UserProfile.find({
      userId: { $in: userIds.map(id => this.toObjectId(id)) },
      deviceTokens: { $exists: true, $ne: [] },
      $or: [
        { 'notificationSettings.inactivityRemindersEnabled': { $exists: false } },
        { 'notificationSettings.inactivityRemindersEnabled': { $ne: false } }
      ]
    }).select('userId notificationSettings notificationState');

    const profileMap = new Map<string, (typeof profiles)[number]>();
    profiles.forEach(profile => profileMap.set(profile.userId.toString(), profile));

    const now = Date.now();
    const matches: Array<{ userId: string; daysInactive: number }> = [];

    stats.forEach(stat => {
      const userId = stat.userId.toString();
      const profile = profileMap.get(userId);
      if (!profile) return;

      const settings = this.mergeSettings(profile.notificationSettings);
      if (!settings.inactivityRemindersEnabled) return;
      if (this.shouldThrottleNotification(profile.notificationState)) return;

      const lastPractice = stat.lastPracticeDate ? stat.lastPracticeDate.getTime() : 0;
      if (!lastPractice) return;

      const daysInactive = Math.floor((now - lastPractice) / (1000 * 60 * 60 * 24));
      if (daysInactive >= 1) {
        matches.push({ userId, daysInactive });
      }
    });

    return matches;
  }

  async notifyInactivity(userId: string, daysInactive: number): Promise<void> {
    if (!this.isEnabled()) return;

    const profile = await UserProfile.findOne({
      userId: this.toObjectId(userId),
      deviceTokens: { $exists: true, $ne: [] }
    }).select('deviceTokens notificationSettings notificationState');

    if (!profile) return;
    const settings = this.mergeSettings(profile.notificationSettings);
    if (!settings.inactivityRemindersEnabled) return;
    if (this.shouldThrottleNotification(profile.notificationState)) return;

    await this.sendPush(profile.deviceTokens || [], {
      title: "Let's keep your streak alive!",
      body:
        daysInactive === 1
          ? 'You missed practice yesterday. Jump back in for a quick session?'
          : `It's been ${daysInactive} days since your last practice. Ready for a quick speaking warm-up?`,
      data: {
        type: 'inactivity_reminder',
        daysInactive
      },
      sound: 'default'
    });

    await UserProfile.updateOne(
      { _id: profile._id },
      { $set: { 'notificationState.lastInactivityNotificationAt': new Date() } }
    );
  }
}
