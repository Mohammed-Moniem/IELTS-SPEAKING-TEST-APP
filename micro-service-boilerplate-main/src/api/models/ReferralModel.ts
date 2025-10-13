import { Document, Schema, Types, model } from 'mongoose';

export interface IReferral extends Document {
  referrerId: Types.ObjectId; // User who shared the referral code
  referredUserId?: Types.ObjectId; // User who was referred (null until they register)
  referralCode: string; // Unique code (e.g., "JOHN2024")
  email?: string; // Email of referred user (before registration)
  status: 'pending' | 'completed' | 'expired';
  rewards: {
    practiceSessionsGranted: number;
    simulationSessionsGranted: number;
    grantedAt?: Date;
  };
  metadata: {
    registeredAt?: Date;
    ipAddress?: string;
    userAgent?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const ReferralSchema = new Schema<IReferral>(
  {
    referrerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    referredUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },
    referralCode: {
      type: String,
      required: true,
      index: true
    },
    email: {
      type: String,
      lowercase: true,
      trim: true
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'expired'],
      default: 'pending',
      required: true,
      index: true
    },
    rewards: {
      practiceSessionsGranted: {
        type: Number,
        default: 0
      },
      simulationSessionsGranted: {
        type: Number,
        default: 0
      },
      grantedAt: {
        type: Date
      }
    },
    metadata: {
      registeredAt: Date,
      ipAddress: String,
      userAgent: String
    }
  },
  {
    timestamps: true
  }
);

// Indexes
ReferralSchema.index({ referralCode: 1, status: 1 });
ReferralSchema.index({ referrerId: 1, createdAt: -1 });
ReferralSchema.index({ referredUserId: 1 });
ReferralSchema.index({ email: 1 });
ReferralSchema.index({ createdAt: 1 }); // For finding referrals by date

export const Referral = model<IReferral>('Referral', ReferralSchema);

// User Referral Stats model (for tracking user's referral performance)
export interface IUserReferralStats extends Document {
  userId: Types.ObjectId;
  referralCode: string; // User's unique referral code
  totalReferrals: number;
  successfulReferrals: number;
  pendingReferrals: number;
  todayReferrals: number; // Count for today (resets at midnight)
  lastReferralDate: Date;
  totalPracticeSessionsEarned: number;
  totalSimulationSessionsEarned: number;
  lifetimeEarnings: {
    practices: number;
    simulations: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const UserReferralStatsSchema = new Schema<IUserReferralStats>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true
    },
    referralCode: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    totalReferrals: {
      type: Number,
      default: 0
    },
    successfulReferrals: {
      type: Number,
      default: 0
    },
    pendingReferrals: {
      type: Number,
      default: 0
    },
    todayReferrals: {
      type: Number,
      default: 0
    },
    lastReferralDate: {
      type: Date
    },
    totalPracticeSessionsEarned: {
      type: Number,
      default: 0
    },
    totalSimulationSessionsEarned: {
      type: Number,
      default: 0
    },
    lifetimeEarnings: {
      practices: {
        type: Number,
        default: 0
      },
      simulations: {
        type: Number,
        default: 0
      }
    }
  },
  {
    timestamps: true
  }
);

export const UserReferralStats = model<IUserReferralStats>('UserReferralStats', UserReferralStatsSchema);
