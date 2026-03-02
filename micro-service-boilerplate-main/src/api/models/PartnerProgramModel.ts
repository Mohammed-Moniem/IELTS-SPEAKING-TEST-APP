import { HydratedDocument, Schema, Types, model } from '@lib/db/mongooseCompat';

export type PartnerType = 'influencer' | 'institute';
export type PartnerStatus = 'pending' | 'active' | 'suspended' | 'rejected';
export type PartnerMemberRole = 'owner';
export type PartnerMemberStatus = 'pending' | 'active' | 'disabled';
export type PartnerCodeSource = 'register' | 'checkout' | 'manual';
export type PartnerTargetMetric = 'paid_conversions' | 'net_revenue_usd';
export type PartnerTargetPeriod = 'monthly';
export type PartnerAwardStatus = 'pending' | 'approved' | 'paid';
export type PartnerLedgerStatus = 'unpaid' | 'batched' | 'paid';
export type PartnerPayoutBatchStatus = 'draft' | 'approved' | 'paid';

export interface IPartner {
  partnerType: PartnerType;
  displayName: string;
  legalName?: string;
  status: PartnerStatus;
  ownerUserId: Types.ObjectId;
  contactEmail?: string;
  currency: 'USD';
  defaultCommissionRate: number;
  metadata?: {
    notes?: string;
    website?: string;
    tags?: string[];
  };
  createdBy?: Types.ObjectId;
  activatedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type PartnerDocument = HydratedDocument<IPartner>;

const PartnerSchema = new Schema<IPartner>(
  {
    partnerType: {
      type: String,
      enum: ['influencer', 'institute'],
      required: true,
      index: true
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 140
    },
    legalName: {
      type: String,
      trim: true,
      maxlength: 240
    },
    status: {
      type: String,
      enum: ['pending', 'active', 'suspended', 'rejected'],
      default: 'pending',
      index: true
    },
    ownerUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    contactEmail: {
      type: String,
      trim: true,
      lowercase: true
    },
    currency: {
      type: String,
      enum: ['USD'],
      default: 'USD'
    },
    defaultCommissionRate: {
      type: Number,
      min: 0,
      max: 100,
      default: 10
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {}
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    activatedAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

PartnerSchema.index({ ownerUserId: 1, status: 1 });

export const Partner = model<IPartner>('Partner', PartnerSchema);

export interface IPartnerMember {
  partnerId: Types.ObjectId;
  userId: Types.ObjectId;
  role: PartnerMemberRole;
  status: PartnerMemberStatus;
  invitedBy?: Types.ObjectId;
  joinedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type PartnerMemberDocument = HydratedDocument<IPartnerMember>;

const PartnerMemberSchema = new Schema<IPartnerMember>(
  {
    partnerId: {
      type: Schema.Types.ObjectId,
      ref: 'Partner',
      required: true,
      index: true
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    role: {
      type: String,
      enum: ['owner'],
      default: 'owner'
    },
    status: {
      type: String,
      enum: ['pending', 'active', 'disabled'],
      default: 'pending',
      index: true
    },
    invitedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    joinedAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

PartnerMemberSchema.index({ partnerId: 1, userId: 1 }, { unique: true });

export const PartnerMember = model<IPartnerMember>('PartnerMember', PartnerMemberSchema);

export interface IPartnerCode {
  partnerId: Types.ObjectId;
  code: string;
  isActive: boolean;
  description?: string;
  attributionOnly: boolean;
  couponId?: Types.ObjectId;
  linkedCouponCode?: string;
  stripePromotionCodeId?: string;
  commissionRateOverride?: number;
  validFrom: Date;
  validUntil?: Date;
  metadata?: Record<string, unknown>;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type PartnerCodeDocument = HydratedDocument<IPartnerCode>;

const PartnerCodeSchema = new Schema<IPartnerCode>(
  {
    partnerId: {
      type: Schema.Types.ObjectId,
      ref: 'Partner',
      required: true,
      index: true
    },
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500
    },
    attributionOnly: {
      type: Boolean,
      default: false
    },
    couponId: {
      type: Schema.Types.ObjectId,
      ref: 'Coupon'
    },
    linkedCouponCode: {
      type: String,
      trim: true,
      uppercase: true
    },
    stripePromotionCodeId: {
      type: String,
      trim: true
    },
    commissionRateOverride: {
      type: Number,
      min: 0,
      max: 100
    },
    validFrom: {
      type: Date,
      default: Date.now,
      required: true
    },
    validUntil: {
      type: Date,
      index: true
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {}
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true
  }
);

PartnerCodeSchema.index({ partnerId: 1, isActive: 1 });

export const PartnerCode = model<IPartnerCode>('PartnerCode', PartnerCodeSchema);

export interface IPartnerAttributionTouch {
  partnerId: Types.ObjectId;
  partnerCodeId: Types.ObjectId;
  userId?: Types.ObjectId;
  email?: string;
  code: string;
  source: PartnerCodeSource;
  touchedAt: Date;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export type PartnerAttributionTouchDocument = HydratedDocument<IPartnerAttributionTouch>;

const PartnerAttributionTouchSchema = new Schema<IPartnerAttributionTouch>(
  {
    partnerId: {
      type: Schema.Types.ObjectId,
      ref: 'Partner',
      required: true,
      index: true
    },
    partnerCodeId: {
      type: Schema.Types.ObjectId,
      ref: 'PartnerCode',
      required: true,
      index: true
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      index: true
    },
    code: {
      type: String,
      required: true,
      uppercase: true,
      trim: true
    },
    source: {
      type: String,
      enum: ['register', 'checkout', 'manual'],
      required: true,
      index: true
    },
    touchedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true
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

PartnerAttributionTouchSchema.index({ userId: 1, touchedAt: -1 });

export const PartnerAttributionTouch = model<IPartnerAttributionTouch>(
  'PartnerAttributionTouch',
  PartnerAttributionTouchSchema
);

export interface IPartnerConversion {
  partnerId: Types.ObjectId;
  partnerCodeId: Types.ObjectId;
  userId: Types.ObjectId;
  code: string;
  stripeInvoiceId: string;
  stripeSubscriptionId?: string;
  stripeCustomerId?: string;
  amountPaidUsd: number;
  commissionRate: number;
  commissionAmountUsd: number;
  netRevenueUsd: number;
  payoutStatus: PartnerLedgerStatus;
  payoutBatchId?: Types.ObjectId;
  metadata?: {
    currency?: string;
    billingReason?: string;
    stripeEventId?: string;
    stripeEventType?: string;
    stripeEventCreatedAt?: string;
  };
  convertedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type PartnerConversionDocument = HydratedDocument<IPartnerConversion>;

const PartnerConversionSchema = new Schema<IPartnerConversion>(
  {
    partnerId: {
      type: Schema.Types.ObjectId,
      ref: 'Partner',
      required: true,
      index: true
    },
    partnerCodeId: {
      type: Schema.Types.ObjectId,
      ref: 'PartnerCode',
      required: true,
      index: true
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true
    },
    code: {
      type: String,
      required: true,
      uppercase: true,
      trim: true
    },
    stripeInvoiceId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    stripeSubscriptionId: {
      type: String,
      index: true
    },
    stripeCustomerId: {
      type: String,
      index: true
    },
    amountPaidUsd: {
      type: Number,
      required: true,
      min: 0
    },
    commissionRate: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    commissionAmountUsd: {
      type: Number,
      required: true,
      min: 0
    },
    netRevenueUsd: {
      type: Number,
      required: true,
      min: 0
    },
    payoutStatus: {
      type: String,
      enum: ['unpaid', 'batched', 'paid'],
      default: 'unpaid',
      index: true
    },
    payoutBatchId: {
      type: Schema.Types.ObjectId,
      ref: 'PartnerPayoutBatch'
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {}
    },
    convertedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true
    }
  },
  {
    timestamps: true
  }
);

PartnerConversionSchema.index({ partnerId: 1, convertedAt: -1 });

export const PartnerConversion = model<IPartnerConversion>('PartnerConversion', PartnerConversionSchema);

export interface IPartnerTarget {
  partnerId: Types.ObjectId;
  name: string;
  metric: PartnerTargetMetric;
  period: PartnerTargetPeriod;
  thresholdValue: number;
  bonusAmountUsd: number;
  commissionUpliftPercent?: number;
  upliftDurationDays?: number;
  isActive: boolean;
  startsAt: Date;
  endsAt?: Date;
  createdBy?: Types.ObjectId;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export type PartnerTargetDocument = HydratedDocument<IPartnerTarget>;

const PartnerTargetSchema = new Schema<IPartnerTarget>(
  {
    partnerId: {
      type: Schema.Types.ObjectId,
      ref: 'Partner',
      required: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160
    },
    metric: {
      type: String,
      enum: ['paid_conversions', 'net_revenue_usd'],
      required: true,
      index: true
    },
    period: {
      type: String,
      enum: ['monthly'],
      default: 'monthly'
    },
    thresholdValue: {
      type: Number,
      required: true,
      min: 0
    },
    bonusAmountUsd: {
      type: Number,
      required: true,
      min: 0
    },
    commissionUpliftPercent: {
      type: Number,
      min: 0,
      max: 100
    },
    upliftDurationDays: {
      type: Number,
      min: 1,
      max: 365
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    startsAt: {
      type: Date,
      required: true,
      default: Date.now
    },
    endsAt: {
      type: Date,
      index: true
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
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

PartnerTargetSchema.index({ partnerId: 1, isActive: 1, startsAt: 1, endsAt: 1 });

export const PartnerTarget = model<IPartnerTarget>('PartnerTarget', PartnerTargetSchema);

export interface IPartnerTargetAward {
  partnerId: Types.ObjectId;
  partnerTargetId: Types.ObjectId;
  periodStart: Date;
  periodEnd: Date;
  metricAchieved: number;
  thresholdValue: number;
  bonusAmountUsd: number;
  commissionUpliftPercent?: number;
  upliftStartsAt?: Date;
  upliftEndsAt?: Date;
  status: PartnerAwardStatus;
  payoutStatus: PartnerLedgerStatus;
  payoutBatchId?: Types.ObjectId;
  awardedAt: Date;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export type PartnerTargetAwardDocument = HydratedDocument<IPartnerTargetAward>;

const PartnerTargetAwardSchema = new Schema<IPartnerTargetAward>(
  {
    partnerId: {
      type: Schema.Types.ObjectId,
      ref: 'Partner',
      required: true,
      index: true
    },
    partnerTargetId: {
      type: Schema.Types.ObjectId,
      ref: 'PartnerTarget',
      required: true,
      index: true
    },
    periodStart: {
      type: Date,
      required: true,
      index: true
    },
    periodEnd: {
      type: Date,
      required: true,
      index: true
    },
    metricAchieved: {
      type: Number,
      required: true,
      min: 0
    },
    thresholdValue: {
      type: Number,
      required: true,
      min: 0
    },
    bonusAmountUsd: {
      type: Number,
      required: true,
      min: 0
    },
    commissionUpliftPercent: {
      type: Number,
      min: 0,
      max: 100
    },
    upliftStartsAt: {
      type: Date,
      index: true
    },
    upliftEndsAt: {
      type: Date,
      index: true
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'paid'],
      default: 'approved',
      index: true
    },
    payoutStatus: {
      type: String,
      enum: ['unpaid', 'batched', 'paid'],
      default: 'unpaid',
      index: true
    },
    payoutBatchId: {
      type: Schema.Types.ObjectId,
      ref: 'PartnerPayoutBatch'
    },
    awardedAt: {
      type: Date,
      default: Date.now,
      required: true,
      index: true
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

PartnerTargetAwardSchema.index({ partnerTargetId: 1, partnerId: 1, periodStart: 1 }, { unique: true });

export const PartnerTargetAward = model<IPartnerTargetAward>('PartnerTargetAward', PartnerTargetAwardSchema);

export interface IPartnerPayoutBatch {
  periodStart: Date;
  periodEnd: Date;
  status: PartnerPayoutBatchStatus;
  partnerCount: number;
  totals: {
    commissionUsd: number;
    bonusUsd: number;
    totalUsd: number;
  };
  createdBy: Types.ObjectId;
  approvedBy?: Types.ObjectId;
  paidBy?: Types.ObjectId;
  approvedAt?: Date;
  paidAt?: Date;
  externalReference?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type PartnerPayoutBatchDocument = HydratedDocument<IPartnerPayoutBatch>;

const PartnerPayoutBatchSchema = new Schema<IPartnerPayoutBatch>(
  {
    periodStart: {
      type: Date,
      required: true,
      index: true
    },
    periodEnd: {
      type: Date,
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: ['draft', 'approved', 'paid'],
      default: 'draft',
      index: true
    },
    partnerCount: {
      type: Number,
      default: 0,
      min: 0
    },
    totals: {
      commissionUsd: {
        type: Number,
        default: 0,
        min: 0
      },
      bonusUsd: {
        type: Number,
        default: 0,
        min: 0
      },
      totalUsd: {
        type: Number,
        default: 0,
        min: 0
      }
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    paidBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    approvedAt: {
      type: Date
    },
    paidAt: {
      type: Date
    },
    externalReference: {
      type: String,
      trim: true,
      index: true
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 1000
    }
  },
  {
    timestamps: true
  }
);

PartnerPayoutBatchSchema.index({ periodStart: 1, periodEnd: 1, status: 1 });

export const PartnerPayoutBatch = model<IPartnerPayoutBatch>('PartnerPayoutBatch', PartnerPayoutBatchSchema);

export interface IPartnerPayoutItem {
  payoutBatchId: Types.ObjectId;
  partnerId: Types.ObjectId;
  partnerConversionIds: Types.ObjectId[];
  partnerAwardIds: Types.ObjectId[];
  commissionUsd: number;
  bonusUsd: number;
  totalUsd: number;
  status: PartnerLedgerStatus;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type PartnerPayoutItemDocument = HydratedDocument<IPartnerPayoutItem>;

const PartnerPayoutItemSchema = new Schema<IPartnerPayoutItem>(
  {
    payoutBatchId: {
      type: Schema.Types.ObjectId,
      ref: 'PartnerPayoutBatch',
      required: true,
      index: true
    },
    partnerId: {
      type: Schema.Types.ObjectId,
      ref: 'Partner',
      required: true,
      index: true
    },
    partnerConversionIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'PartnerConversion'
      }
    ],
    partnerAwardIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'PartnerTargetAward'
      }
    ],
    commissionUsd: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    },
    bonusUsd: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    },
    totalUsd: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    },
    status: {
      type: String,
      enum: ['unpaid', 'batched', 'paid'],
      default: 'batched',
      index: true
    },
    paidAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

PartnerPayoutItemSchema.index({ payoutBatchId: 1, partnerId: 1 }, { unique: true });

export const PartnerPayoutItem = model<IPartnerPayoutItem>('PartnerPayoutItem', PartnerPayoutItemSchema);

export interface IProcessedWebhookEvent {
  provider: 'stripe';
  eventId: string;
  eventType: string;
  processedAt: Date;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export type ProcessedWebhookEventDocument = HydratedDocument<IProcessedWebhookEvent>;

const ProcessedWebhookEventSchema = new Schema<IProcessedWebhookEvent>(
  {
    provider: {
      type: String,
      enum: ['stripe'],
      required: true,
      index: true
    },
    eventId: {
      type: String,
      required: true,
      index: true
    },
    eventType: {
      type: String,
      required: true,
      index: true
    },
    processedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true
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

ProcessedWebhookEventSchema.index({ provider: 1, eventId: 1 }, { unique: true });

export const ProcessedWebhookEvent = model<IProcessedWebhookEvent>('ProcessedWebhookEvent', ProcessedWebhookEventSchema);
