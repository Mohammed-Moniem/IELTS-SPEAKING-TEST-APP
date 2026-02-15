import { Document, Schema, Types, model } from 'mongoose';

export enum AchievementCategory {
  PRACTICE = 'practice',
  IMPROVEMENT = 'improvement',
  STREAK = 'streak',
  SOCIAL = 'social',
  MILESTONE = 'milestone',
  SPEED = 'speed',
  CONSISTENCY = 'consistency',
  MASTERY = 'mastery',
  SEASONAL = 'seasonal'
}

export enum AchievementTier {
  BRONZE = 'bronze',
  SILVER = 'silver',
  GOLD = 'gold',
  PLATINUM = 'platinum',
  DIAMOND = 'diamond'
}

export interface IAchievement extends Document {
  key: string; // Unique identifier (e.g., "first_practice", "week_streak_7")
  name: string;
  description: string;
  category: AchievementCategory;
  tier?: AchievementTier; // Bronze, Silver, Gold, Platinum, Diamond
  icon: string; // Emoji or icon name
  points: number;
  requirement: {
    type: string; // "practice_count", "streak_days", "score_average", etc.
    value: number;
    metadata?: any;
  };
  isPremium: boolean; // Some achievements only for premium users
  isActive: boolean;
  order: number; // Display order
  createdAt: Date;
  updatedAt: Date;
}

const AchievementSchema = new Schema<IAchievement>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      maxlength: 100
    },
    description: {
      type: String,
      required: true,
      maxlength: 300
    },
    category: {
      type: String,
      enum: Object.values(AchievementCategory),
      required: true,
      index: true
    },
    tier: {
      type: String,
      enum: Object.values(AchievementTier),
      required: false
    },
    icon: {
      type: String,
      required: true
    },
    points: {
      type: Number,
      required: true,
      min: 0,
      default: 10
    },
    requirement: {
      type: {
        type: String,
        required: true
      },
      value: {
        type: Number,
        required: true
      },
      metadata: Schema.Types.Mixed
    },
    isPremium: {
      type: Boolean,
      default: false
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    order: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

// Indexes
AchievementSchema.index({ category: 1, order: 1 });
AchievementSchema.index({ isActive: 1, isPremium: 1 });

export const Achievement = model<IAchievement>('Achievement', AchievementSchema);

// User Achievement model (tracks unlocked achievements per user)
export interface IUserAchievement extends Document {
  userId: Types.ObjectId;
  achievementId: Types.ObjectId;
  achievementKey: string; // Denormalized for quick access
  progress: number; // Current progress towards achievement
  isUnlocked: boolean;
  unlockedAt?: Date;
  metadata?: any; // Additional data (e.g., which friend helped unlock social achievement)
  createdAt: Date;
  updatedAt: Date;
}

const UserAchievementSchema = new Schema<IUserAchievement>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    achievementId: {
      type: Schema.Types.ObjectId,
      ref: 'Achievement',
      required: true
    },
    achievementKey: {
      type: String,
      required: true,
      index: true
    },
    progress: {
      type: Number,
      default: 0,
      min: 0
    },
    isUnlocked: {
      type: Boolean,
      default: false,
      index: true
    },
    unlockedAt: {
      type: Date
    },
    metadata: Schema.Types.Mixed
  },
  {
    timestamps: true
  }
);

// Compound index to prevent duplicate achievement records
UserAchievementSchema.index({ userId: 1, achievementId: 1 }, { unique: true });
UserAchievementSchema.index({ userId: 1, achievementKey: 1 });
UserAchievementSchema.index({ userId: 1, isUnlocked: 1, unlockedAt: -1 });

export const UserAchievement = model<IUserAchievement>('UserAchievement', UserAchievementSchema);

// User Stats model (for leaderboard and achievements)
export interface IUserStats extends Document {
  userId: Types.ObjectId;
  totalPracticeSessions: number;
  totalSimulations: number;
  averageScore: number;
  highestScore: number;
  currentStreak: number;
  longestStreak: number;
  totalAchievements: number;
  achievementPoints: number;
  totalPoints: number;
  redeemedPoints: number;
  lastPracticeDate?: Date;
  weeklyScore: number; // This week's average
  monthlyScore: number; // This month's average
  weeklyPractices: number;
  monthlyPractices: number;
  rank?: number; // Global rank (computed)
  leaderboardOptIn: boolean;
  profileVisibility: 'public' | 'private' | 'friends-only';
  lastPointsUpdate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserStatsSchema = new Schema<IUserStats>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true
    },
    totalPracticeSessions: {
      type: Number,
      default: 0,
      min: 0
    },
    totalSimulations: {
      type: Number,
      default: 0,
      min: 0
    },
    averageScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 9
    },
    highestScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 9
    },
    currentStreak: {
      type: Number,
      default: 0,
      min: 0
    },
    longestStreak: {
      type: Number,
      default: 0,
      min: 0
    },
    totalAchievements: {
      type: Number,
      default: 0,
      min: 0
    },
    achievementPoints: {
      type: Number,
      default: 0,
      min: 0,
      index: true
    },
    totalPoints: {
      type: Number,
      default: 0,
      min: 0,
      index: true
    },
    redeemedPoints: {
      type: Number,
      default: 0,
      min: 0
    },
    lastPracticeDate: {
      type: Date
    },
    weeklyScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 9,
      index: true
    },
    monthlyScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 9,
      index: true
    },
    weeklyPractices: {
      type: Number,
      default: 0,
      min: 0
    },
    monthlyPractices: {
      type: Number,
      default: 0,
      min: 0
    },
    lastPointsUpdate: {
      type: Date
    },
    rank: {
      type: Number,
      min: 1
    },
    leaderboardOptIn: {
      type: Boolean,
      default: false, // User must opt-in
      index: true
    },
    profileVisibility: {
      type: String,
      enum: ['public', 'private', 'friends-only'],
      default: 'friends-only',
      index: true
    }
  },
  {
    timestamps: true
  }
);

// Indexes for leaderboard queries
UserStatsSchema.index({ leaderboardOptIn: 1, averageScore: -1 });
UserStatsSchema.index({ leaderboardOptIn: 1, weeklyScore: -1 });
UserStatsSchema.index({ leaderboardOptIn: 1, monthlyScore: -1 });
UserStatsSchema.index({ leaderboardOptIn: 1, achievementPoints: -1 });
UserStatsSchema.index({ currentStreak: -1 });

export const UserStats = model<IUserStats>('UserStats', UserStatsSchema);
