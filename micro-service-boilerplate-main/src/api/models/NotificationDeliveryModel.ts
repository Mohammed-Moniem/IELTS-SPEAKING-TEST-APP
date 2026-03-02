import { HydratedDocument, Schema, Types, model } from '@lib/db/mongooseCompat';

import { NotificationEndpointChannel, NotificationEndpointProvider } from './NotificationEndpointModel';

export type NotificationDeliveryStatus = 'sent' | 'failed' | 'skipped';

export interface INotificationDelivery {
  campaignId: Types.ObjectId;
  userId: Types.ObjectId;
  channel: NotificationEndpointChannel;
  provider: NotificationEndpointProvider;
  token?: string;
  tokenHash?: string;
  status: NotificationDeliveryStatus;
  providerMessageId?: string;
  errorCode?: string;
  errorMessage?: string;
  deliveredAt?: Date;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export type NotificationDeliveryDocument = HydratedDocument<INotificationDelivery>;

const NotificationDeliverySchema = new Schema<INotificationDelivery>(
  {
    campaignId: {
      type: Schema.Types.ObjectId,
      ref: 'NotificationCampaign',
      required: true,
      index: true
    },
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
    token: {
      type: String
    },
    tokenHash: {
      type: String,
      index: true
    },
    status: {
      type: String,
      enum: ['sent', 'failed', 'skipped'],
      required: true,
      index: true
    },
    providerMessageId: {
      type: String
    },
    errorCode: {
      type: String
    },
    errorMessage: {
      type: String
    },
    deliveredAt: {
      type: Date
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

NotificationDeliverySchema.index({ campaignId: 1, userId: 1, channel: 1 });

export const NotificationDeliveryModel = model<INotificationDelivery>(
  'NotificationDelivery',
  NotificationDeliverySchema
);
