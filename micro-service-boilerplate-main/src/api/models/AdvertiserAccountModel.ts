import { HydratedDocument, Schema, Types, model } from '@lib/db/mongooseCompat';

export type AdvertiserStatus = 'pending' | 'active' | 'suspended' | 'cancelled';
export type AdvertiserBillingStatus = 'active' | 'trialing' | 'past_due' | 'unpaid' | 'canceled' | 'unknown';

export interface IAdvertiserAccount {
  ownerUserId: Types.ObjectId;
  displayName: string;
  contactEmail: string;
  companyName?: string;
  website?: string;
  status: AdvertiserStatus;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  billingStatus?: AdvertiserBillingStatus;
  lastInvoiceId?: string;
  lastInvoiceStatus?: string;
  lastInvoiceAt?: Date;
  failedPaymentCount?: number;
  activePackageId?: Types.ObjectId;
  affiliateCode?: string;
  monthlyBudgetUsd?: number;
  createdAt: Date;
  updatedAt: Date;
}

export type AdvertiserAccountDocument = HydratedDocument<IAdvertiserAccount>;

const AdvertiserAccountSchema = new Schema<IAdvertiserAccount>(
  {
    ownerUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    displayName: { type: String, required: true, trim: true, maxlength: 160 },
    contactEmail: { type: String, required: true, trim: true, lowercase: true, maxlength: 190, index: true },
    companyName: { type: String, trim: true, maxlength: 190 },
    website: { type: String, trim: true, maxlength: 500 },
    status: { type: String, enum: ['pending', 'active', 'suspended', 'cancelled'], default: 'pending', index: true },
    stripeCustomerId: { type: String, trim: true, index: true },
    stripeSubscriptionId: { type: String, trim: true, index: true },
    billingStatus: { type: String, enum: ['active', 'trialing', 'past_due', 'unpaid', 'canceled', 'unknown'], default: 'unknown' },
    lastInvoiceId: { type: String, trim: true, index: true },
    lastInvoiceStatus: { type: String, trim: true },
    lastInvoiceAt: { type: Date },
    failedPaymentCount: { type: Number, min: 0, default: 0 },
    activePackageId: { type: Schema.Types.ObjectId, ref: 'AdPackage', index: true },
    affiliateCode: { type: String, trim: true, uppercase: true, maxlength: 120, index: true },
    monthlyBudgetUsd: { type: Number, min: 0 }
  },
  { timestamps: true }
);

AdvertiserAccountSchema.index({ ownerUserId: 1 }, { unique: true });

export const AdvertiserAccountModel = model<IAdvertiserAccount>('AdvertiserAccount', AdvertiserAccountSchema);
