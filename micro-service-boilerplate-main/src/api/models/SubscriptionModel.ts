import { HydratedDocument, Schema, Types, model } from '@lib/db/mongooseCompat';
import { SubscriptionPlan } from './UserModel';

export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'incomplete';

export interface ISubscription {
  user: Types.ObjectId;
  planType: SubscriptionPlan;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  status: SubscriptionStatus;
  subscriptionDate?: Date;
  trialEndsAt?: Date;
  isTrialActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type SubscriptionDocument = HydratedDocument<ISubscription>;

const SubscriptionSchema = new Schema<ISubscription>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true
    },
    planType: {
      type: String,
      enum: ['free', 'premium', 'pro'],
      default: 'free'
    },
    stripeCustomerId: {
      type: String
    },
    stripeSubscriptionId: {
      type: String
    },
    status: {
      type: String,
      enum: ['active', 'canceled', 'past_due', 'incomplete'],
      default: 'active'
    },
    subscriptionDate: {
      type: Date
    },
    trialEndsAt: {
      type: Date
    },
    isTrialActive: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

export const SubscriptionModel = model<SubscriptionDocument>('Subscription', SubscriptionSchema);
