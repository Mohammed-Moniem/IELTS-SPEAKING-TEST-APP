import { HydratedDocument, Schema, Types, model } from '@lib/db/mongooseCompat';

import { AdPlacementType } from './AdPackageModel';

export type AdCampaignStatus =
  | 'draft'
  | 'pending_review'
  | 'approved'
  | 'scheduled'
  | 'active'
  | 'paused'
  | 'completed'
  | 'rejected';

export interface IAdCampaign {
  name: string;
  packageId: Types.ObjectId;
  advertiserAccountId: Types.ObjectId;
  placementType: AdPlacementType;
  status: AdCampaignStatus;
  targeting?: Record<string, unknown>;
  startsAt?: Date;
  endsAt?: Date;
  reviewNotes?: string;
  approvedByUserId?: Types.ObjectId;
  approvedAt?: Date;
  metrics: {
    impressions: number;
    clicks: number;
    conversions: number;
  };
  createdByUserId?: Types.ObjectId;
  updatedByUserId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type AdCampaignDocument = HydratedDocument<IAdCampaign>;

const AdCampaignSchema = new Schema<IAdCampaign>(
  {
    name: { type: String, required: true, trim: true, maxlength: 180 },
    packageId: { type: Schema.Types.ObjectId, ref: 'AdPackage', required: true, index: true },
    advertiserAccountId: { type: Schema.Types.ObjectId, ref: 'AdvertiserAccount', required: true, index: true },
    placementType: {
      type: String,
      enum: ['homepage_sponsor', 'module_panel', 'blog_block', 'newsletter_slot', 'partner_spotlight'],
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: ['draft', 'pending_review', 'approved', 'scheduled', 'active', 'paused', 'completed', 'rejected'],
      default: 'draft',
      index: true
    },
    targeting: { type: Schema.Types.Mixed, default: {} },
    startsAt: { type: Date, index: true },
    endsAt: { type: Date, index: true },
    reviewNotes: { type: String, trim: true, maxlength: 2000 },
    approvedByUserId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    approvedAt: { type: Date },
    metrics: {
      impressions: { type: Number, default: 0 },
      clicks: { type: Number, default: 0 },
      conversions: { type: Number, default: 0 }
    },
    createdByUserId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    updatedByUserId: { type: Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

AdCampaignSchema.index({ advertiserAccountId: 1, status: 1, createdAt: -1 });
AdCampaignSchema.index({ status: 1, startsAt: 1, endsAt: 1 });

export const AdCampaignModel = model<IAdCampaign>('AdCampaign', AdCampaignSchema);
