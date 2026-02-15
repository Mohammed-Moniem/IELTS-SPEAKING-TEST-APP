import { Document, Schema, Types, model } from 'mongoose';

export interface IUserStatus extends Document {
  userId: Types.ObjectId;
  isOnline: boolean;
  lastSeen: Date;
  socketIds: string[]; // Multiple devices support
  currentlyTypingIn: string[]; // Array of conversationIds where user is typing
  createdAt: Date;
  updatedAt: Date;
}

const UserStatusSchema = new Schema<IUserStatus>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true
    },
    isOnline: {
      type: Boolean,
      default: false,
      index: true
    },
    lastSeen: {
      type: Date,
      default: Date.now,
      index: true
    },
    socketIds: [
      {
        type: String
      }
    ],
    currentlyTypingIn: [
      {
        type: String
      }
    ]
  },
  {
    timestamps: true
  }
);

// Index for finding online users
UserStatusSchema.index({ isOnline: 1, lastSeen: -1 });

export const UserStatus = model<IUserStatus>('UserStatus', UserStatusSchema);
