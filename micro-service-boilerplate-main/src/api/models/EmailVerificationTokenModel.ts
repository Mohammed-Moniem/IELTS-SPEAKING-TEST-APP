import { Schema, model, HydratedDocument } from '@lib/db/mongooseCompat';

export interface IEmailVerificationToken {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  used: boolean;
  createdAt: Date;
}

export type EmailVerificationTokenDocument = HydratedDocument<IEmailVerificationToken>;

const EmailVerificationTokenSchema = new Schema<IEmailVerificationToken>(
  {
    userId: {
      type: String,
      required: true,
      index: true
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }
    },
    used: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false }
  }
);

export const EmailVerificationTokenModel = model<IEmailVerificationToken>('EmailVerificationToken', EmailVerificationTokenSchema);
