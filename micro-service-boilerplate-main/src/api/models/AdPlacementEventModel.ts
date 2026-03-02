import { HydratedDocument, Schema, Types, model } from '@lib/db/mongooseCompat';

import { AdPlacementType } from './AdPackageModel';

export interface IAdPlacementEvent {
  campaignId: Types.ObjectId;
  advertiserAccountId: Types.ObjectId;
  placementType: AdPlacementType;
  action: 'impression' | 'click';
  routePath?: string;
  userId?: Types.ObjectId;
  sessionId?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export type AdPlacementEventDocument = HydratedDocument<IAdPlacementEvent>;

const AdPlacementEventSchema = new Schema<IAdPlacementEvent>(
  {
    campaignId: { type: Schema.Types.ObjectId, ref: 'AdCampaign', required: true, index: true },
    advertiserAccountId: { type: Schema.Types.ObjectId, ref: 'AdvertiserAccount', required: true, index: true },
    placementType: {
      type: String,
      enum: ['homepage_sponsor', 'module_panel', 'blog_block', 'newsletter_slot', 'partner_spotlight'],
      required: true,
      index: true
    },
    action: { type: String, enum: ['impression', 'click'], required: true, index: true },
    routePath: { type: String, trim: true, maxlength: 300, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    sessionId: { type: String, trim: true, maxlength: 190, index: true },
    metadata: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

AdPlacementEventSchema.index({ campaignId: 1, action: 1, createdAt: -1 });
AdPlacementEventSchema.index({ advertiserAccountId: 1, createdAt: -1 });

export const AdPlacementEventModel = model<IAdPlacementEvent>('AdPlacementEvent', AdPlacementEventSchema);
