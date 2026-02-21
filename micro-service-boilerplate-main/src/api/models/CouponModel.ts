import { Document, Schema, Types, model } from '@lib/db/mongooseCompat';

export enum CouponType {
  PERCENTAGE = 'percentage', // e.g., 20% off
  FIXED_AMOUNT = 'fixed_amount', // e.g., $5 off
  TRIAL_EXTENSION = 'trial_extension', // e.g., +7 days trial
  FREE_SESSIONS = 'free_sessions' // e.g., 5 free practice sessions
}

export interface ICoupon extends Document {
  code: string; // Unique coupon code (e.g., "SAVE20", "INFLUENCER50")
  type: CouponType;
  value: number; // Percentage, amount, days, or session count
  description: string;
  isActive: boolean;
  isInfluencerCode: boolean;
  influencerId?: Types.ObjectId; // If this is an influencer's code
  influencerCommissionRate?: number; // Commission percentage (e.g., 10 for 10%)
  restrictions: {
    minPurchaseAmount?: number;
    maxDiscountAmount?: number; // Max discount for percentage coupons
    applicableSubscriptions?: ('premium' | 'pro')[]; // Which tiers this applies to
    newUsersOnly?: boolean;
    onePerUser?: boolean;
  };
  usage: {
    maxUses?: number; // Total usage limit (null = unlimited)
    currentUses: number;
    maxUsesPerUser?: number; // Per-user limit
  };
  validFrom: Date;
  validUntil: Date;
  createdBy?: Types.ObjectId; // Admin who created it
  createdAt: Date;
  updatedAt: Date;
}

const CouponSchema = new Schema<ICoupon>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true
    },
    type: {
      type: String,
      enum: Object.values(CouponType),
      required: true
    },
    value: {
      type: Number,
      required: true,
      min: 0
    },
    description: {
      type: String,
      required: true,
      maxlength: 500
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    isInfluencerCode: {
      type: Boolean,
      default: false,
      index: true
    },
    influencerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },
    influencerCommissionRate: {
      type: Number,
      min: 0,
      max: 100 // Percentage
    },
    restrictions: {
      minPurchaseAmount: {
        type: Number,
        min: 0
      },
      maxDiscountAmount: {
        type: Number,
        min: 0
      },
      applicableSubscriptions: [
        {
          type: String,
          enum: ['premium', 'pro']
        }
      ],
      newUsersOnly: {
        type: Boolean,
        default: false
      },
      onePerUser: {
        type: Boolean,
        default: true
      }
    },
    usage: {
      maxUses: {
        type: Number,
        min: 1
      },
      currentUses: {
        type: Number,
        default: 0,
        min: 0
      },
      maxUsesPerUser: {
        type: Number,
        default: 1,
        min: 1
      }
    },
    validFrom: {
      type: Date,
      required: true,
      default: Date.now
    },
    validUntil: {
      type: Date,
      required: true,
      index: true
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

// Indexes
CouponSchema.index({ code: 1, isActive: 1 });
CouponSchema.index({ validFrom: 1, validUntil: 1 });
CouponSchema.index({ influencerId: 1 });

// Virtual to check if coupon is valid
CouponSchema.virtual('isValid').get(function () {
  const now = new Date();
  const isTimeValid = now >= this.validFrom && now <= this.validUntil;
  const isNotExhausted = !this.usage.maxUses || this.usage.currentUses < this.usage.maxUses;
  return this.isActive && isTimeValid && isNotExhausted;
});

export const Coupon = model<ICoupon>('Coupon', CouponSchema);

// Coupon Usage model (tracks individual uses)
export interface ICouponUsage extends Document {
  couponId: Types.ObjectId;
  userId: Types.ObjectId;
  orderId?: string; // Payment/subscription order ID
  discountAmount: number;
  subscriptionTier?: 'premium' | 'pro';
  metadata: {
    originalAmount?: number;
    finalAmount?: number;
    commissionEarned?: number; // For influencer codes
  };
  usedAt: Date;
  createdAt: Date;
}

const CouponUsageSchema = new Schema<ICouponUsage>(
  {
    couponId: {
      type: Schema.Types.ObjectId,
      ref: 'Coupon',
      required: true,
      index: true
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    orderId: {
      type: String,
      index: true
    },
    discountAmount: {
      type: Number,
      required: true,
      min: 0
    },
    subscriptionTier: {
      type: String,
      enum: ['premium', 'pro', null],
      default: null
    },
    metadata: {
      originalAmount: Number,
      finalAmount: Number,
      commissionEarned: Number
    },
    usedAt: {
      type: Date,
      default: Date.now,
      required: true
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false }
  }
);

// Compound index for checking user's usage of specific coupon
CouponUsageSchema.index({ couponId: 1, userId: 1 });
CouponUsageSchema.index({ userId: 1, usedAt: -1 });
CouponUsageSchema.index({ usedAt: -1 }); // For reporting

export const CouponUsage = model<ICouponUsage>('CouponUsage', CouponUsageSchema);
