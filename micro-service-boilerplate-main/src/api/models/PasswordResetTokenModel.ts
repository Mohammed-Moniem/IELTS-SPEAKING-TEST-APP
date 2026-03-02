import { Schema, model, HydratedDocument } from '@lib/db/mongooseCompat';

export interface IPasswordResetToken {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  used: boolean;
  createdAt: Date;
}

export type PasswordResetTokenDocument = HydratedDocument<IPasswordResetToken>;

const PasswordResetTokenSchema = new Schema<IPasswordResetToken>(
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

export const PasswordResetTokenModel = model<IPasswordResetToken>('PasswordResetToken', PasswordResetTokenSchema);
