import bcrypt from 'bcryptjs';
import { HydratedDocument, Schema, model } from 'mongoose';

export type SubscriptionPlan = 'free' | 'premium' | 'pro';

export interface IUser {
  email: string;
  phone?: string;
  firstName: string;
  lastName: string;
  password: string;
  emailVerified: boolean;
  subscriptionPlan: SubscriptionPlan;
  /**
   * Guest users are device-bound sessions that can use the app without
   * registering. They can later "upgrade" into a real account.
   */
  isGuest?: boolean;
  /**
   * Device/installation identifier used to consistently map a device to the
   * same guest user.
   */
  guestDeviceId?: string;
  refreshTokens: string[];
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidate: string): Promise<boolean>;
}

export type UserDocument = HydratedDocument<IUser>;

const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true
    },
    phone: {
      type: String,
      trim: true
    },
    firstName: {
      type: String,
      required: true,
      trim: true
    },
    lastName: {
      type: String,
      required: true,
      trim: true
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
      select: false
    },
    emailVerified: {
      type: Boolean,
      default: false
    },
    subscriptionPlan: {
      type: String,
      enum: ['free', 'premium', 'pro'],
      default: 'free'
    },
    isGuest: {
      type: Boolean,
      default: false
    },
    guestDeviceId: {
      type: String,
      trim: true,
      index: true
    },
    refreshTokens: {
      type: [String],
      default: []
    },
    lastLoginAt: {
      type: Date
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        delete ret.password;
        delete ret.refreshTokens;
        delete ret.guestDeviceId;
        return ret;
      }
    },
    toObject: {
      transform: (_doc, ret) => {
        delete ret.password;
        delete ret.refreshTokens;
        delete ret.guestDeviceId;
        return ret;
      }
    }
  }
);

UserSchema.pre('save', async function (this: UserDocument, next) {
  const user = this;
  if (!user.isModified('password')) return next();

  const saltRounds = 10;
  user.password = await bcrypt.hash(user.password, saltRounds);
  next();
});

UserSchema.methods.comparePassword = async function (candidate: string) {
  return bcrypt.compare(candidate, this.password);
};

export const UserModel = model<IUser>('User', UserSchema);
