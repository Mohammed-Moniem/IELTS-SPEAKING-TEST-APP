import { Document, Schema, Types, model } from '@lib/db/mongooseCompat';

export enum FriendRequestStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
  BLOCKED = 'blocked'
}

export interface IFriendRequest extends Document {
  senderId: Types.ObjectId;
  receiverId: Types.ObjectId;
  status: FriendRequestStatus;
  message?: string;
  createdAt: Date;
  updatedAt: Date;
  acceptedAt?: Date;
}

const FriendRequestSchema = new Schema<IFriendRequest>(
  {
    senderId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    receiverId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: Object.values(FriendRequestStatus),
      default: FriendRequestStatus.PENDING,
      required: true,
      index: true
    },
    message: {
      type: String,
      maxlength: 500
    },
    acceptedAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

// Compound index to prevent duplicate requests
FriendRequestSchema.index({ senderId: 1, receiverId: 1 }, { unique: true });

// Index for finding pending requests
FriendRequestSchema.index({ receiverId: 1, status: 1 });
FriendRequestSchema.index({ senderId: 1, status: 1 });

export const FriendRequest = model<IFriendRequest>('FriendRequest', FriendRequestSchema);

// Friendship model (accepted friends only)
export interface IFriendship extends Document {
  user1Id: Types.ObjectId;
  user2Id: Types.ObjectId;
  createdAt: Date;
}

const FriendshipSchema = new Schema<IFriendship>(
  {
    user1Id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    user2Id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false }
  }
);

// Compound index for quick friendship lookups (both directions)
FriendshipSchema.index({ user1Id: 1, user2Id: 1 }, { unique: true });
FriendshipSchema.index({ user2Id: 1, user1Id: 1 });

export const Friendship = model<IFriendship>('Friendship', FriendshipSchema);
