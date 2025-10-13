import { Document, Schema, Types, model } from 'mongoose';

export interface IUserProfile extends Document {
  userId: Types.ObjectId;
  username: string; // Unique username for search
  avatar?: string; // Profile picture URL
  bio?: string;

  // IELTS Information for friend suggestions
  ieltsInfo: {
    type: 'academic' | 'general' | null;
    targetScore?: number;
    currentLevel?: 'beginner' | 'intermediate' | 'advanced';
  };

  // Study Goals
  studyGoals: {
    purpose?: 'immigration' | 'university' | 'work' | 'personal' | 'other';
    targetCountry?: string;
    targetUniversity?: string;
    targetDate?: Date; // When they plan to take IELTS
    hoursPerWeek?: number; // Study commitment
  };

  // Social Settings
  social: {
    qrCode?: string; // Generated QR code for easy friend adding
    allowFriendSuggestions: boolean;
    showOnlineStatus: boolean;
    allowDirectMessages: boolean;
  };

  // Privacy Settings
  privacy: {
    profileVisibility: 'public' | 'private' | 'friends-only';
    leaderboardOptIn: boolean;
    showStatistics: boolean;
    showActivity: boolean;
    showStudyGoals: boolean;
  };

  // Gamification
  badges: string[]; // Array of badge IDs/keys
  level: number;
  xp: number;

  // Metadata
  lastActive?: Date;
  deviceTokens?: string[]; // For push notifications

  createdAt: Date;
  updatedAt: Date;
}

const UserProfileSchema = new Schema<IUserProfile>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true
    },
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
      match: /^[a-z0-9_]+$/, // Only lowercase letters, numbers, and underscores
      index: true
    },
    avatar: {
      type: String
    },
    bio: {
      type: String,
      maxlength: 500,
      trim: true
    },
    ieltsInfo: {
      type: {
        type: String,
        enum: ['academic', 'general', null],
        default: null
      },
      targetScore: {
        type: Number,
        min: 0,
        max: 9
      },
      currentLevel: {
        type: String,
        enum: ['beginner', 'intermediate', 'advanced', null],
        default: null
      }
    },
    studyGoals: {
      purpose: {
        type: String,
        enum: ['immigration', 'university', 'work', 'personal', 'other', null],
        default: null
      },
      targetCountry: {
        type: String,
        maxlength: 100,
        trim: true
      },
      targetUniversity: {
        type: String,
        maxlength: 200,
        trim: true
      },
      targetDate: {
        type: Date
      },
      hoursPerWeek: {
        type: Number,
        min: 0,
        max: 168 // Max hours in a week
      }
    },
    social: {
      qrCode: {
        type: String // Base64 encoded QR code or URL
      },
      allowFriendSuggestions: {
        type: Boolean,
        default: true
      },
      showOnlineStatus: {
        type: Boolean,
        default: true
      },
      allowDirectMessages: {
        type: Boolean,
        default: true
      }
    },
    privacy: {
      profileVisibility: {
        type: String,
        enum: ['public', 'private', 'friends-only'],
        default: 'friends-only',
        index: true
      },
      leaderboardOptIn: {
        type: Boolean,
        default: false, // Must opt-in
        index: true
      },
      showStatistics: {
        type: Boolean,
        default: true
      },
      showActivity: {
        type: Boolean,
        default: true
      },
      showStudyGoals: {
        type: Boolean,
        default: true
      }
    },
    badges: [
      {
        type: String
      }
    ],
    level: {
      type: Number,
      default: 1,
      min: 1
    },
    xp: {
      type: Number,
      default: 0,
      min: 0
    },
    lastActive: {
      type: Date,
      index: true
    },
    deviceTokens: [
      {
        type: String
      }
    ]
  },
  {
    timestamps: true
  }
);

// Indexes for friend suggestions and search
UserProfileSchema.index({ username: 'text' });
UserProfileSchema.index({ 'ieltsInfo.type': 1 });
UserProfileSchema.index({ 'studyGoals.purpose': 1 });
UserProfileSchema.index({ 'studyGoals.targetCountry': 1 });
UserProfileSchema.index({ 'studyGoals.targetUniversity': 1 });
UserProfileSchema.index({ 'social.allowFriendSuggestions': 1 });
UserProfileSchema.index({ 'privacy.profileVisibility': 1 });
UserProfileSchema.index({ lastActive: -1 });

// Virtual for checking if profile is complete
UserProfileSchema.virtual('isProfileComplete').get(function () {
  return !!(this.username && this.ieltsInfo.type && this.studyGoals.purpose);
});

export const UserProfile = model<IUserProfile>('UserProfile', UserProfileSchema);
