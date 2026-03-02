import { HydratedDocument, Schema, Types, model } from '@lib/db/mongooseCompat';

export type AdPlacementType =
  | 'homepage_sponsor'
  | 'module_panel'
  | 'blog_block'
  | 'newsletter_slot'
  | 'partner_spotlight';

export type AdBillingType = 'monthly_subscription' | 'quarterly_subscription' | 'annual_subscription' | 'one_time';

export interface IAdPackage {
  key: string;
  name: string;
  description: string;
  placementType: AdPlacementType;
  billingType: AdBillingType;
  stripePriceId?: string;
  currency: string;
  priceAmount: number;
  features: string[];
  isActive: boolean;
  createdByUserId?: Types.ObjectId;
  updatedByUserId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type AdPackageDocument = HydratedDocument<IAdPackage>;

const AdPackageSchema = new Schema<IAdPackage>(
  {
    key: { type: String, required: true, trim: true, maxlength: 120, index: true },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, required: true, trim: true, maxlength: 2000 },
    placementType: {
      type: String,
      enum: ['homepage_sponsor', 'module_panel', 'blog_block', 'newsletter_slot', 'partner_spotlight'],
      required: true,
      index: true
    },
    billingType: {
      type: String,
      enum: ['monthly_subscription', 'quarterly_subscription', 'annual_subscription', 'one_time'],
      required: true,
      index: true
    },
    stripePriceId: { type: String, trim: true, index: true },
    currency: { type: String, trim: true, uppercase: true, default: 'USD' },
    priceAmount: { type: Number, required: true, min: 0 },
    features: [{ type: String, trim: true }],
    isActive: { type: Boolean, default: true, index: true },
    createdByUserId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    updatedByUserId: { type: Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

AdPackageSchema.index({ key: 1 }, { unique: true });
AdPackageSchema.index({ isActive: 1, placementType: 1 });

export const AdPackageModel = model<IAdPackage>('AdPackage', AdPackageSchema);
