import { env } from '@env';
import { UserStats } from '@models/AchievementModel';
import { NotificationEndpointModel } from '@models/NotificationEndpointModel';
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  NotificationSettings,
  NotificationState,
  UserProfile
} from '@models/UserProfileModel';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import admin from 'firebase-admin';
import { Types } from '@lib/db/mongooseCompat';
import { Service } from 'typedi';
import crypto from 'crypto';

import { Logger } from '../../lib/logger';

const HOURS_IN_DAY = 24;
const MIN_INACTIVITY_REMINDER_GAP_HOURS = 24;
const PARTNER_AUDIENCE_FLAG = 'partnerOffer';

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

interface FriendRequestPayload {
  recipientId: string;
  senderId: string;
  requestId: string;
}

interface FriendAcceptedPayload {
  recipientId: string;
  accepterId: string;
  requestId: string;
}

interface SystemMessagePayload {
  userIds?: string[];
  title: string;
  body: string;
  type: 'system' | 'offer';
  data?: Record<string, any>;
}

type NotificationChannel = 'expo' | 'fcm_web';
type NotificationStatus = 'sent' | 'failed' | 'skipped';
type PushProvider = 'expo' | 'fcm';

type DeliveryAttempt = {
  userId: string;
  channel: NotificationChannel;
  provider: PushProvider;
  token?: string;
  tokenHash?: string;
  status: NotificationStatus;
  providerMessageId?: string;
  errorCode?: string;
  errorMessage?: string;
};

type UserRecipient = {
  userId: string;
  settings: NotificationSettings;
  expoTokens: string[];
  webTokens: string[];
};

type CampaignSendInput = {
  userIds: string[];
  title: string;
  body: string;
  type: 'system' | 'offer';
  data?: Record<string, unknown>;
  channels?: NotificationChannel[];
};

@Service()
export class NotificationService {
  private expo: Expo;
  private firebaseMessaging: admin.messaging.Messaging | null = null;
  private log = new Logger(__filename);

  constructor() {
    this.expo = new Expo({ accessToken: env.push.expoAccessToken || undefined });
    this.initializeFirebaseMessaging();
  }

  private initializeFirebaseMessaging() {
    const hasFirebaseConfig = Boolean(
      env.push.firebaseProjectId && env.push.firebaseClientEmail && env.push.firebasePrivateKey
    );

    if (!hasFirebaseConfig) {
      return;
    }

    try {
      const existingApp = admin.apps.length > 0 ? admin.app() : null;

      if (!existingApp) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: env.push.firebaseProjectId,
            clientEmail: env.push.firebaseClientEmail,
            privateKey: env.push.firebasePrivateKey
          })
        });
      }

      this.firebaseMessaging = admin.app().messaging();
    } catch (error) {
      this.firebaseMessaging = null;
      this.log.error('Failed to initialize Firebase Admin messaging', { error });
    }
  }

  private isEnabled(): boolean {
    return env.push.enabled !== false;
  }

  private toObjectId(id: string) {
    return new Types.ObjectId(id);
  }

  private toObjectIds(ids: string[]): Types.ObjectId[] {
    return ids.filter(id => Types.ObjectId.isValid(id)).map(id => new Types.ObjectId(id));
  }

  private normalizeUserIds(ids: string[]): string[] {
    return Array.from(new Set(ids.filter(id => Types.ObjectId.isValid(id))));
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
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

  private async upsertEndpoint(params: {
    userId: string;
    channel: NotificationChannel;
    provider: PushProvider;
    platform: 'ios' | 'android' | 'web';
    token: string;
    locale?: string;
    timezoneOffsetMinutes?: number;
    appVersion?: string;
    deviceId?: string;
    userAgent?: string;
    metadata?: Record<string, unknown>;
  }) {
    if (!params.token) return;

    await NotificationEndpointModel.findOneAndUpdate(
      { token: params.token },
      {
        $set: {
          userId: this.toObjectId(params.userId),
          channel: params.channel,
          provider: params.provider,
          platform: params.platform,
          token: params.token,
          tokenHash: this.hashToken(params.token),
          isActive: true,
          locale: params.locale,
          timezoneOffsetMinutes: params.timezoneOffsetMinutes,
          appVersion: params.appVersion,
          deviceId: params.deviceId,
          userAgent: params.userAgent,
          metadata: params.metadata || {}
        }
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true
      }
    );
  }

  private async deactivateEndpointToken(token: string, channel?: NotificationChannel) {
    if (!token) return;
    const query: Record<string, unknown> = { token };
    if (channel) {
      query.channel = channel;
    }

    await NotificationEndpointModel.updateMany(query, {
      $set: {
        isActive: false
      }
    });
  }

  private async sendExpoPushWithResults(
    tokens: string[],
    message: Omit<ExpoPushMessage, 'to'>
  ): Promise<Array<DeliveryAttempt & { channel: 'expo'; provider: 'expo' }>> {
    const attempts: Array<DeliveryAttempt & { channel: 'expo'; provider: 'expo' }> = [];
    if (!this.isEnabled() || tokens.length === 0) {
      return attempts;
    }

    const valid: string[] = [];
    const uniqueTokens = Array.from(new Set(tokens));

    for (const token of uniqueTokens) {
      if (!Expo.isExpoPushToken(token)) {
        attempts.push({
          userId: '',
          channel: 'expo',
          provider: 'expo',
          token,
          tokenHash: this.hashToken(token),
          status: 'failed',
          errorCode: 'invalid_expo_token',
          errorMessage: 'Invalid Expo push token format'
        });
        await this.deactivateEndpointToken(token, 'expo');
        continue;
      }

      valid.push(token);
    }

    if (valid.length === 0) {
      return attempts;
    }

    const notifications = valid.map(token => ({
      to: token,
      ...message
    }));

    const chunks = this.expo.chunkPushNotifications(notifications);
    let indexOffset = 0;

    for (const chunk of chunks) {
      const chunkTokens = valid.slice(indexOffset, indexOffset + chunk.length);
      indexOffset += chunk.length;

      try {
        const tickets = await this.expo.sendPushNotificationsAsync(chunk);
        for (let i = 0; i < tickets.length; i += 1) {
          const ticket = tickets[i];
          const token = chunkTokens[i];
          if (!token) continue;

          if ((ticket as any).status === 'ok') {
            attempts.push({
              userId: '',
              channel: 'expo',
              provider: 'expo',
              token,
              tokenHash: this.hashToken(token),
              status: 'sent',
              providerMessageId: (ticket as any).id
            });
            continue;
          }

          const errorCode = (ticket as any)?.details?.error || 'expo_send_error';
          attempts.push({
            userId: '',
            channel: 'expo',
            provider: 'expo',
            token,
            tokenHash: this.hashToken(token),
            status: 'failed',
            errorCode,
            errorMessage: (ticket as any)?.message
          });

          if (errorCode === 'DeviceNotRegistered') {
            await Promise.all([
              UserProfile.updateMany(
                {
                  deviceTokens: token
                },
                {
                  $pull: { deviceTokens: token }
                }
              ),
              this.deactivateEndpointToken(token, 'expo')
            ]);
          }
        }
      } catch (error) {
        this.log.error('Failed to send Expo notification chunk', { error });
        chunkTokens.forEach(token => {
          attempts.push({
            userId: '',
            channel: 'expo',
            provider: 'expo',
            token,
            tokenHash: this.hashToken(token),
            status: 'failed',
            errorCode: 'expo_chunk_send_failed',
            errorMessage: error instanceof Error ? error.message : JSON.stringify(error)
          });
        });
      }
    }

    return attempts;
  }

  private toFcmData(data?: Record<string, any>): Record<string, string> | undefined {
    if (!data) return undefined;
    const entries = Object.entries(data).map(([key, value]) => {
      if (value === undefined || value === null) {
        return [key, ''];
      }
      if (typeof value === 'string') {
        return [key, value];
      }
      return [key, JSON.stringify(value)];
    });

    return Object.fromEntries(entries);
  }

  private isInvalidFcmTokenError(errorCode?: string): boolean {
    return [
      'messaging/registration-token-not-registered',
      'messaging/invalid-registration-token',
      'messaging/invalid-argument'
    ].includes(errorCode || '');
  }

  private async sendWebPushWithResults(params: {
    tokens: string[];
    title: string;
    body: string;
    data?: Record<string, any>;
  }): Promise<Array<DeliveryAttempt & { channel: 'fcm_web'; provider: 'fcm' }>> {
    const uniqueTokens = Array.from(new Set(params.tokens.filter(Boolean)));
    if (!this.isEnabled() || uniqueTokens.length === 0) {
      return [];
    }

    if (!this.firebaseMessaging) {
      return uniqueTokens.map(token => ({
        userId: '',
        channel: 'fcm_web',
        provider: 'fcm',
        token,
        tokenHash: this.hashToken(token),
        status: 'failed',
        errorCode: 'fcm_not_configured',
        errorMessage: 'FCM is not configured on backend'
      }));
    }

    const message = {
      tokens: uniqueTokens,
      notification: {
        title: params.title,
        body: params.body
      },
      data: this.toFcmData(params.data),
      webpush: {
        notification: {
          title: params.title,
          body: params.body
        }
      }
    };

    try {
      const result = await this.firebaseMessaging.sendEachForMulticast(message as any);
      const attempts: Array<DeliveryAttempt & { channel: 'fcm_web'; provider: 'fcm' }> = [];

      for (let i = 0; i < result.responses.length; i += 1) {
        const response = result.responses[i];
        const token = uniqueTokens[i];
        if (!token) continue;

        if (response.success) {
          attempts.push({
            userId: '',
            channel: 'fcm_web',
            provider: 'fcm',
            token,
            tokenHash: this.hashToken(token),
            status: 'sent',
            providerMessageId: response.messageId
          });
          continue;
        }

        const code = response.error?.code || 'fcm_send_error';
        attempts.push({
          userId: '',
          channel: 'fcm_web',
          provider: 'fcm',
          token,
          tokenHash: this.hashToken(token),
          status: 'failed',
          errorCode: code,
          errorMessage: response.error?.message
        });

        if (this.isInvalidFcmTokenError(code)) {
          await this.deactivateEndpointToken(token, 'fcm_web');
        }
      }

      return attempts;
    } catch (error) {
      this.log.error('Failed to send FCM web push notifications', { error });
      return uniqueTokens.map(token => ({
        userId: '',
        channel: 'fcm_web',
        provider: 'fcm',
        token,
        tokenHash: this.hashToken(token),
        status: 'failed',
        errorCode: 'fcm_batch_send_failed',
        errorMessage: error instanceof Error ? error.message : JSON.stringify(error)
      }));
    }
  }

  async registerDeviceToken(
    userId: string,
    token: string,
    context?: {
      platform?: 'ios' | 'android';
      locale?: string;
      timezoneOffsetMinutes?: number;
      appVersion?: string;
      deviceId?: string;
    }
  ): Promise<void> {
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

    await this.upsertEndpoint({
      userId,
      channel: 'expo',
      provider: 'expo',
      platform: context?.platform || 'android',
      token,
      locale: context?.locale,
      timezoneOffsetMinutes: context?.timezoneOffsetMinutes,
      appVersion: context?.appVersion,
      deviceId: context?.deviceId
    });
  }

  async registerWebDeviceToken(
    userId: string,
    payload: {
      token: string;
      locale?: string;
      timezoneOffsetMinutes?: number;
      userAgent?: string;
    }
  ): Promise<void> {
    if (!this.isEnabled() || !payload.token) {
      return;
    }

    await this.upsertEndpoint({
      userId,
      channel: 'fcm_web',
      provider: 'fcm',
      platform: 'web',
      token: payload.token,
      locale: payload.locale,
      timezoneOffsetMinutes: payload.timezoneOffsetMinutes,
      userAgent: payload.userAgent
    });
  }

  async removeDeviceToken(userId: string, token: string): Promise<void> {
    if (!token) return;
    await Promise.all([
      UserProfile.updateOne({ userId: this.toObjectId(userId) }, { $pull: { deviceTokens: token } }),
      NotificationEndpointModel.updateMany(
        { userId: this.toObjectId(userId), token, channel: 'expo' },
        { $set: { isActive: false } }
      )
    ]);
  }

  async removeWebDeviceToken(userId: string, token: string): Promise<void> {
    if (!token) return;

    await NotificationEndpointModel.updateMany(
      {
        userId: this.toObjectId(userId),
        token,
        channel: 'fcm_web'
      },
      {
        $set: { isActive: false }
      }
    );
  }

  async getNotificationSettings(userId: string): Promise<NotificationSettings> {
    const profile = await UserProfile.findOne({ userId: this.toObjectId(userId) }).select('notificationSettings');
    return this.mergeSettings(profile?.notificationSettings);
  }

  async updateNotificationSettings(
    userId: string,
    payload: Partial<NotificationSettings>
  ): Promise<NotificationSettings> {
    const current = await this.getNotificationSettings(userId);
    const merged = this.mergeSettings(current, payload);
    await UserProfile.updateOne(
      { userId: this.toObjectId(userId) },
      { $set: { notificationSettings: merged } },
      { upsert: true }
    );
    return merged;
  }

  private async buildRecipients(userIds: string[], preferenceKey: keyof NotificationSettings): Promise<UserRecipient[]> {
    const normalizedIds = this.normalizeUserIds(userIds);
    if (normalizedIds.length === 0) {
      return [];
    }

    const objectIds = this.toObjectIds(normalizedIds);
    const [profiles, endpoints] = await Promise.all([
      UserProfile.find({
        userId: { $in: objectIds }
      }).select('userId deviceTokens notificationSettings'),
      NotificationEndpointModel.find({
        userId: { $in: objectIds },
        isActive: true
      }).select('userId channel token')
    ]);

    const profileMap = new Map<string, (typeof profiles)[number]>();
    profiles.forEach(profile => profileMap.set(profile.userId.toString(), profile));

    const endpointMap = new Map<
      string,
      {
        expo: string[];
        fcmWeb: string[];
      }
    >();

    endpoints.forEach(endpoint => {
      const key = endpoint.userId.toString();
      if (!endpointMap.has(key)) {
        endpointMap.set(key, { expo: [], fcmWeb: [] });
      }

      const entry = endpointMap.get(key)!;
      if (endpoint.channel === 'expo') {
        entry.expo.push(endpoint.token);
      } else if (endpoint.channel === 'fcm_web') {
        entry.fcmWeb.push(endpoint.token);
      }
    });

    const recipients: UserRecipient[] = [];
    normalizedIds.forEach(userId => {
      const profile = profileMap.get(userId);
      const settings = this.mergeSettings(profile?.notificationSettings);
      if (settings[preferenceKey] === false) {
        return;
      }

      const endpointTokens = endpointMap.get(userId) || { expo: [], fcmWeb: [] };
      const profileExpoTokens = profile?.deviceTokens || [];

      recipients.push({
        userId,
        settings,
        expoTokens: Array.from(new Set([...profileExpoTokens, ...endpointTokens.expo])),
        webTokens: Array.from(new Set(endpointTokens.fcmWeb))
      });
    });

    return recipients;
  }

  private withUserId<T extends DeliveryAttempt>(attempts: T[], userId: string): T[] {
    return attempts.map(attempt => ({
      ...attempt,
      userId
    }));
  }

  private resolveSystemPreferenceKey(payload: {
    type: 'system' | 'offer';
    data?: Record<string, unknown>;
  }): keyof NotificationSettings {
    if (payload.type === 'system') {
      return 'systemAnnouncementsEnabled';
    }

    const isPartnerOffer = Boolean(payload.data?.[PARTNER_AUDIENCE_FLAG]);
    return isPartnerOffer ? 'partnerOffersEnabled' : 'offersEnabled';
  }

  async sendCampaignMessage(input: CampaignSendInput): Promise<{
    targetedUsers: number;
    attempts: number;
    sent: number;
    failed: number;
    skipped: number;
    deliveries: DeliveryAttempt[];
  }> {
    if (!this.isEnabled()) {
      return {
        targetedUsers: 0,
        attempts: 0,
        sent: 0,
        failed: 0,
        skipped: 0,
        deliveries: []
      };
    }

    const preferenceKey = this.resolveSystemPreferenceKey({
      type: input.type,
      data: input.data
    });

    const channels = input.channels?.length ? input.channels : (['expo', 'fcm_web'] as NotificationChannel[]);
    const recipients = await this.buildRecipients(input.userIds, preferenceKey);
    const deliveries: DeliveryAttempt[] = [];

    for (const recipient of recipients) {
      if (channels.includes('expo')) {
        if (recipient.expoTokens.length === 0) {
          deliveries.push({
            userId: recipient.userId,
            channel: 'expo',
            provider: 'expo',
            status: 'skipped',
            errorCode: 'no_active_tokens',
            errorMessage: 'No active Expo token'
          });
        } else {
          const expoResult = await this.sendExpoPushWithResults(recipient.expoTokens, {
            title: input.title,
            body: input.body,
            data: {
              type: input.type,
              ...(input.data || {})
            },
            sound: 'default'
          });

          deliveries.push(...this.withUserId(expoResult, recipient.userId));
        }
      }

      if (channels.includes('fcm_web')) {
        if (recipient.webTokens.length === 0) {
          deliveries.push({
            userId: recipient.userId,
            channel: 'fcm_web',
            provider: 'fcm',
            status: 'skipped',
            errorCode: 'no_active_tokens',
            errorMessage: 'No active web push token'
          });
        } else {
          const fcmResult = await this.sendWebPushWithResults({
            tokens: recipient.webTokens,
            title: input.title,
            body: input.body,
            data: {
              type: input.type,
              ...(input.data || {})
            }
          });

          deliveries.push(...this.withUserId(fcmResult, recipient.userId));
        }
      }
    }

    return {
      targetedUsers: recipients.length,
      attempts: deliveries.length,
      sent: deliveries.filter(item => item.status === 'sent').length,
      failed: deliveries.filter(item => item.status === 'failed').length,
      skipped: deliveries.filter(item => item.status === 'skipped').length,
      deliveries
    };
  }

  async notifyDirectMessage(payload: DirectMessagePayload): Promise<void> {
    if (!this.isEnabled()) return;

    const recipients = await this.buildRecipients([payload.recipientId], 'directMessagesEnabled');
    const recipient = recipients[0];
    if (!recipient || recipient.expoTokens.length === 0) return;

    const senderName = await this.getUserDisplayName(payload.senderId);

    await this.sendExpoPushWithResults(recipient.expoTokens, {
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

    const recipients = await this.buildRecipients(uniqueRecipients, 'groupMessagesEnabled');
    if (recipients.length === 0) return;

    const senderName = await this.getUserDisplayName(payload.senderId);
    const baseData = {
      type: 'group_message',
      groupId: payload.groupId,
      senderId: payload.senderId
    };

    await Promise.all(
      recipients.map(recipient => {
        if (recipient.expoTokens.length === 0) return Promise.resolve();
        return this.sendExpoPushWithResults(recipient.expoTokens, {
          title: payload.groupName
            ? `${payload.groupName}: new message from ${senderName}`
            : `${senderName} in your study group`,
          body: this.truncateMessage(payload.message),
          data: baseData,
          sound: 'default',
          priority: 'high'
        }).then(() => undefined);
      })
    );
  }

  async notifyFriendRequest(payload: FriendRequestPayload): Promise<void> {
    if (!this.isEnabled()) return;

    const recipients = await this.buildRecipients([payload.recipientId], 'friendRequestsEnabled');
    const recipient = recipients[0];
    if (!recipient || recipient.expoTokens.length === 0) return;

    const senderName = await this.getUserDisplayName(payload.senderId);
    await this.sendExpoPushWithResults(recipient.expoTokens, {
      title: `${senderName} sent you a friend request`,
      body: 'Open Social to accept or decline.',
      data: {
        type: 'friend_request',
        senderId: payload.senderId,
        requestId: payload.requestId
      },
      sound: 'default',
      priority: 'high'
    });
  }

  async notifyFriendAccepted(payload: FriendAcceptedPayload): Promise<void> {
    if (!this.isEnabled()) return;

    const recipients = await this.buildRecipients([payload.recipientId], 'friendAcceptancesEnabled');
    const recipient = recipients[0];
    if (!recipient || recipient.expoTokens.length === 0) return;

    const accepterName = await this.getUserDisplayName(payload.accepterId);
    await this.sendExpoPushWithResults(recipient.expoTokens, {
      title: `${accepterName} accepted your friend request`,
      body: 'You can now chat and compare progress together.',
      data: {
        type: 'friend_accepted',
        accepterId: payload.accepterId,
        requestId: payload.requestId
      },
      sound: 'default',
      priority: 'high'
    });
  }

  async notifySystemMessage(payload: SystemMessagePayload): Promise<void> {
    if (!this.isEnabled()) return;

    let userIds = payload.userIds || [];
    if (!userIds.length) {
      const profiles = await UserProfile.find({}).select('userId');
      userIds = profiles.map(profile => profile.userId.toString());
    }

    await this.sendCampaignMessage({
      userIds,
      title: payload.title,
      body: payload.body,
      type: payload.type,
      data: payload.data || {}
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
      userId: this.toObjectId(userId)
    }).select('notificationSettings notificationState deviceTokens');

    if (!profile) return;
    const settings = this.mergeSettings(profile.notificationSettings);
    if (!settings.inactivityRemindersEnabled) return;
    if (this.shouldThrottleNotification(profile.notificationState)) return;

    const recipient = (await this.buildRecipients([userId], 'inactivityRemindersEnabled'))[0];
    if (!recipient) return;

    if (recipient.expoTokens.length > 0) {
      await this.sendExpoPushWithResults(recipient.expoTokens, {
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
    }

    await UserProfile.updateOne(
      { userId: this.toObjectId(userId) },
      { $set: { 'notificationState.lastInactivityNotificationAt': new Date() } }
    );
  }
}
