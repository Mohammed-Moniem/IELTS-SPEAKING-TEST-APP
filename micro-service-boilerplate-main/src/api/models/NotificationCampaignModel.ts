import { HydratedDocument, Schema, Types, model } from '@lib/db/mongooseCompat';

import { PartnerType } from './PartnerProgramModel';

export type NotificationCampaignType = 'system' | 'offer';
export type NotificationCampaignStatus = 'draft' | 'scheduled' | 'processing' | 'sent' | 'cancelled' | 'failed';

export type NotificationCampaignAudienceKind =
  | 'all_users'
  | 'all_partner_owners'
  | 'partner_owners_by_type'
  | 'partner_owners_by_ids'
  | 'partner_attributed_users'
  | 'partner_owners_and_attributed';

export interface INotificationCampaign {
  title: string;
  body: string;
  type: NotificationCampaignType;
  data?: Record<string, unknown>;
  audience: {
    kind: NotificationCampaignAudienceKind;
    partnerType?: PartnerType;
    partnerIds?: Types.ObjectId[];
  };
  status: NotificationCampaignStatus;
  scheduledAt?: Date;
  sentAt?: Date;
  cancelledAt?: Date;
  cancelledByUserId?: Types.ObjectId;
  timezone: 'UTC';
  fallbackImmediateIfSchedulerUnavailable: boolean;
  createdByUserId: Types.ObjectId;
  lastError?: string;
  deliverySummary?: {
    targetedUsers: number;
    attempts: number;
    sent: number;
    failed: number;
    skipped: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export type NotificationCampaignDocument = HydratedDocument<INotificationCampaign>;

const NotificationCampaignSchema = new Schema<INotificationCampaign>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120
    },
    body: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000
    },
    type: {
      type: String,
      enum: ['system', 'offer'],
      required: true,
      index: true
    },
    data: {
      type: Schema.Types.Mixed,
      default: {}
    },
    audience: {
      kind: {
        type: String,
        enum: [
          'all_users',
          'all_partner_owners',
          'partner_owners_by_type',
          'partner_owners_by_ids',
          'partner_attributed_users',
          'partner_owners_and_attributed'
        ],
        required: true
      },
      partnerType: {
        type: String,
        enum: ['influencer', 'institute']
      },
      partnerIds: [
        {
          type: Schema.Types.ObjectId,
          ref: 'Partner'
        }
      ]
    },
    status: {
      type: String,
      enum: ['draft', 'scheduled', 'processing', 'sent', 'cancelled', 'failed'],
      required: true,
      default: 'draft',
      index: true
    },
    scheduledAt: {
      type: Date,
      index: true
    },
    sentAt: {
      type: Date
    },
    cancelledAt: {
      type: Date
    },
    cancelledByUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    timezone: {
      type: String,
      enum: ['UTC'],
      default: 'UTC'
    },
    fallbackImmediateIfSchedulerUnavailable: {
      type: Boolean,
      default: false
    },
    createdByUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    lastError: {
      type: String
    },
    deliverySummary: {
      targetedUsers: {
        type: Number,
        default: 0
      },
      attempts: {
        type: Number,
        default: 0
      },
      sent: {
        type: Number,
        default: 0
      },
      failed: {
        type: Number,
        default: 0
      },
      skipped: {
        type: Number,
        default: 0
      }
    }
  },
  {
    timestamps: true
  }
);

NotificationCampaignSchema.index({ status: 1, scheduledAt: 1 });

export const NotificationCampaignModel = model<INotificationCampaign>(
  'NotificationCampaign',
  NotificationCampaignSchema
);
