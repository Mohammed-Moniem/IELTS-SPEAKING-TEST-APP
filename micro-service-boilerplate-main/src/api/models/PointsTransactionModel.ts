import { Document, Schema, Types, model } from 'mongoose';

export enum PointsTransactionType {
  PRACTICE_COMPLETION = 'practice_completion',
  PRACTICE_IMPROVEMENT = 'practice_improvement',
  PRACTICE_STREAK_BONUS = 'practice_streak_bonus',
  TEST_COMPLETION = 'test_completion',
  TEST_IMPROVEMENT = 'test_improvement',
  ACHIEVEMENT_UNLOCK = 'achievement_unlock',
  ACHIEVEMENT_MILESTONE = 'achievement_milestone',
  PROFILE_COMPLETION = 'profile_completion',
  REFERRAL_REWARD = 'referral_reward',
  REFERRAL_BONUS = 'referral_bonus',
  FRIEND_ADDED = 'friend_added',
  GROUP_JOINED = 'group_joined',
  DISCOUNT_REDEMPTION = 'discount_redemption',
  ADMIN_ADJUSTMENT = 'admin_adjustment',
  OTHER = 'other'
}

export interface IPointsTransaction extends Document {
  userId: Types.ObjectId;
  type: PointsTransactionType;
  amount: number; // Positive for grants, negative for redemptions
  balance: number; // Balance after this transaction
  reason: string;
  metadata?: {
    sessionId?: Types.ObjectId;
    achievementKey?: string;
    achievementId?: Types.ObjectId;
    referralCode?: string;
    discountTier?: string;
    scoreImprovement?: number;
    streakDays?: number;
    [key: string]: any;
  };
  createdAt: Date;
  updatedAt: Date;
}

const PointsTransactionSchema = new Schema<IPointsTransaction>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    type: {
      type: String,
      enum: Object.values(PointsTransactionType),
      required: true,
      index: true
    },
    amount: {
      type: Number,
      required: true
    },
    balance: {
      type: Number,
      required: true,
      min: 0
    },
    reason: {
      type: String,
      required: true,
      maxlength: 500
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
PointsTransactionSchema.index({ userId: 1, createdAt: -1 });
PointsTransactionSchema.index({ userId: 1, type: 1 });
PointsTransactionSchema.index({ createdAt: -1 });

export const PointsTransaction = model<IPointsTransaction>('PointsTransaction', PointsTransactionSchema);
