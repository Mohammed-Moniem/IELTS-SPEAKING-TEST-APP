import { HydratedDocument, Schema, Types, model } from '@lib/db/mongooseCompat';

import { AdPlacementType } from './AdPackageModel';

export interface IAdCreative {
  campaignId: Types.ObjectId;
  placementType: AdPlacementType;
  headline: string;
  body?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  imageUrl?: string;
  status: 'draft' | 'pending_review' | 'approved' | 'rejected';
  validation: {
    passed: boolean;
    warnings: string[];
    errors: string[];
  };
  submittedAt?: Date;
  approvedAt?: Date;
  reviewedByUserId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type AdCreativeDocument = HydratedDocument<IAdCreative>;

const AdCreativeSchema = new Schema<IAdCreative>(
  {
    campaignId: { type: Schema.Types.ObjectId, ref: 'AdCampaign', required: true, index: true },
    placementType: {
      type: String,
      enum: ['homepage_sponsor', 'module_panel', 'blog_block', 'newsletter_slot', 'partner_spotlight'],
      required: true,
      index: true
    },
    headline: { type: String, required: true, trim: true, maxlength: 120 },
    body: { type: String, trim: true, maxlength: 2000 },
    ctaLabel: { type: String, trim: true, maxlength: 60 },
    ctaUrl: { type: String, trim: true, maxlength: 1000 },
    imageUrl: { type: String, trim: true, maxlength: 1000 },
    status: {
      type: String,
      enum: ['draft', 'pending_review', 'approved', 'rejected'],
      default: 'draft',
      index: true
    },
    validation: {
      passed: { type: Boolean, default: false },
      warnings: [{ type: String, trim: true }],
      errors: [{ type: String, trim: true }]
    },
    submittedAt: { type: Date },
    approvedAt: { type: Date },
    reviewedByUserId: { type: Schema.Types.ObjectId, ref: 'User', index: true }
  },
  { timestamps: true }
);

AdCreativeSchema.index({ campaignId: 1, updatedAt: -1 });

export const AdCreativeModel = model<IAdCreative>('AdCreative', AdCreativeSchema);
