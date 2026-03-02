import { HydratedDocument, Schema, Types, model } from '@lib/db/mongooseCompat';

export type NotificationEndpointChannel = 'expo' | 'fcm_web';
export type NotificationEndpointProvider = 'expo' | 'fcm';
export type NotificationEndpointPlatform = 'ios' | 'android' | 'web';

export interface INotificationEndpoint {
  userId: Types.ObjectId;
  channel: NotificationEndpointChannel;
  provider: NotificationEndpointProvider;
  platform: NotificationEndpointPlatform;
  token: string;
  tokenHash?: string;
  isActive: boolean;
  locale?: string;
  timezoneOffsetMinutes?: number;
  appVersion?: string;
  deviceId?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export type NotificationEndpointDocument = HydratedDocument<INotificationEndpoint>;

const NotificationEndpointSchema = new Schema<INotificationEndpoint>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    channel: {
      type: String,
      enum: ['expo', 'fcm_web'],
      required: true,
      index: true
    },
    provider: {
      type: String,
      enum: ['expo', 'fcm'],
      required: true
    },
    platform: {
      type: String,
      enum: ['ios', 'android', 'web'],
      required: true
    },
    token: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    tokenHash: {
      type: String,
      index: true
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    locale: {
      type: String,
      trim: true
    },
    timezoneOffsetMinutes: {
      type: Number,
      min: -720,
      max: 840
    },
    appVersion: {
      type: String,
      trim: true
    },
    deviceId: {
      type: String,
      trim: true
    },
    userAgent: {
      type: String,
      trim: true
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true
  }
);

NotificationEndpointSchema.index({ token: 1 }, { unique: true });
NotificationEndpointSchema.index({ userId: 1, channel: 1, isActive: 1 });

export const NotificationEndpointModel = model<INotificationEndpoint>(
  'NotificationEndpoint',
  NotificationEndpointSchema
);
