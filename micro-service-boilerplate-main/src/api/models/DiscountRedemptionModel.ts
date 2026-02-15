import { Document, Schema, Types, model } from 'mongoose';

export enum DiscountTier {
  TIER_5 = '5%', // 1,000 points
  TIER_10 = '10%', // 2,500 points
  TIER_15 = '15%', // 5,000 points
  TIER_20 = '20%' // 7,500 points (cap)
}

export interface IDiscountRedemption extends Document {
  userId: Types.ObjectId;
  pointsRedeemed: number;
  discountTier: DiscountTier;
  discountPercentage: number;
  couponCode?: string; // Generated coupon code for subscription service
  billingPeriod: {
    start: Date;
    end: Date;
  };
  status: 'pending' | 'active' | 'used' | 'expired' | 'cancelled';
  appliedAt?: Date; // When discount was actually applied to billing
  expiresAt: Date;
  metadata?: {
    subscriptionId?: string;
    transactionId?: Types.ObjectId;
    [key: string]: any;
  };
  createdAt: Date;
  updatedAt: Date;
}

const DiscountRedemptionSchema = new Schema<IDiscountRedemption>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    pointsRedeemed: {
      type: Number,
      required: true,
      min: 0
    },
    discountTier: {
      type: String,
      enum: Object.values(DiscountTier),
      required: true
    },
    discountPercentage: {
      type: Number,
      required: true,
      min: 5,
      max: 20
    },
    couponCode: {
      type: String,
      unique: true,
      sparse: true,
      index: true
    },
    billingPeriod: {
      start: {
        type: Date,
        required: true
      },
      end: {
        type: Date,
        required: true
      }
    },
    status: {
      type: String,
      enum: ['pending', 'active', 'used', 'expired', 'cancelled'],
      default: 'pending',
      index: true
    },
    appliedAt: {
      type: Date
    },
    expiresAt: {
      type: Date,
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

// Indexes for efficient queries
DiscountRedemptionSchema.index({ userId: 1, status: 1 });
DiscountRedemptionSchema.index({ userId: 1, createdAt: -1 });
DiscountRedemptionSchema.index({ status: 1, expiresAt: 1 });
DiscountRedemptionSchema.index({ couponCode: 1 }, { unique: true, sparse: true });

export const DiscountRedemption = model<IDiscountRedemption>('DiscountRedemption', DiscountRedemptionSchema);

// Discount tier configuration
export const DISCOUNT_TIERS = [
  { tier: DiscountTier.TIER_5, pointsRequired: 1000, percentage: 5 },
  { tier: DiscountTier.TIER_10, pointsRequired: 2500, percentage: 10 },
  { tier: DiscountTier.TIER_15, pointsRequired: 5000, percentage: 15 },
  { tier: DiscountTier.TIER_20, pointsRequired: 7500, percentage: 20 }
] as const;

export const POINTS_REWARDS = {
  // Practice rewards
  PRACTICE_COMPLETION: 10,
  PRACTICE_IMPROVEMENT_BONUS: 5,
  PRACTICE_STREAK_BONUS: 5,

  // Test rewards
  TEST_COMPLETION: 25,
  TEST_IMPROVEMENT_BONUS: 10,

  // Social rewards
  REFERRAL_REFERRER: 150,
  REFERRAL_REFEREE: 50,
  FRIEND_ADDED: 5,
  GROUP_JOINED: 10,

  // Profile rewards
  PROFILE_COMPLETION: 50,

  // Achievement rewards
  ACHIEVEMENT_BASE: 10, // Will be overridden by Achievement.points field
  ACHIEVEMENT_MILESTONE_BONUS: 10
} as const;
