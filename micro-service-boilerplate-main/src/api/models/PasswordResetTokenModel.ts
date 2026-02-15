import { HydratedDocument, Schema, Types, model } from 'mongoose';

export interface IPasswordResetToken {
  user: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type PasswordResetTokenDocument = HydratedDocument<IPasswordResetToken>;

const PasswordResetTokenSchema = new Schema<IPasswordResetToken>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true
    }
  },
  {
    timestamps: true
  }
);

// TTL index: tokens are removed automatically after they expire.
PasswordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PasswordResetTokenModel = model<PasswordResetTokenDocument>(
  'PasswordResetToken',
  PasswordResetTokenSchema
);

