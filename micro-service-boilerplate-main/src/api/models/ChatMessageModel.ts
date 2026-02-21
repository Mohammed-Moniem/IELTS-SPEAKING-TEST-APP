import { Document, Schema, Types, model } from '@lib/db/mongooseCompat';

export interface IEncryptedMessage {
  encryptedContent: string; // AES encrypted message content
  iv: string; // Initialization vector for decryption
  senderId: Types.ObjectId;
  timestamp: Date;
}

export interface IChatMessage extends Document {
  conversationId: string; // Format: "userId1_userId2" (sorted alphabetically) or "group_groupId"
  senderId: Types.ObjectId;
  recipientId?: Types.ObjectId; // For 1-on-1 chats
  groupId?: Types.ObjectId; // For group chats
  encryptedContent: string; // AES-256 encrypted message (text content or file description)
  iv: string; // Initialization vector
  messageType: 'text' | 'image' | 'audio' | 'video' | 'file' | 'gif' | 'system';
  isEdited: boolean;
  isDeleted: boolean;
  readBy: Types.ObjectId[]; // Users who have read the message
  deliveredTo: Types.ObjectId[]; // Users who have received the message
  reactions?: Map<string, Types.ObjectId[]>; // emoji -> array of userIds who reacted
  metadata?: {
    // File metadata
    fileName?: string;
    fileSize?: number;
    fileUrl?: string;
    thumbnailUrl?: string;

    // Audio/Video specific
    duration?: number; // Duration in seconds
    waveformData?: number[]; // For audio visualization (array of amplitudes)

    // Image/Video specific
    width?: number;
    height?: number;

    // Reply/Forward
    replyToMessageId?: Types.ObjectId;
    replyToContent?: string; // Preview of replied message
    forwardedFromUserId?: Types.ObjectId;

    // Link preview
    linkPreview?: {
      url: string;
      title?: string;
      description?: string;
      imageUrl?: string;
    };
  };
  createdAt: Date;
  updatedAt: Date;
}

const ChatMessageSchema = new Schema<IChatMessage>(
  {
    conversationId: {
      type: String,
      required: true,
      index: true
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    recipientId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },
    groupId: {
      type: Schema.Types.ObjectId,
      ref: 'StudyGroup',
      index: true
    },
    encryptedContent: {
      type: String,
      required: true
    },
    iv: {
      type: String,
      required: true
    },
    messageType: {
      type: String,
      enum: ['text', 'image', 'audio', 'video', 'file', 'gif', 'system'],
      default: 'text',
      required: true
    },
    isEdited: {
      type: Boolean,
      default: false
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true
    },
    readBy: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User'
      }
    ],
    deliveredTo: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User'
      }
    ],
    reactions: {
      type: Map,
      of: [Schema.Types.ObjectId],
      default: {}
    },
    metadata: {
      // File metadata
      fileName: String,
      fileSize: Number,
      fileUrl: String,
      thumbnailUrl: String,

      // Audio/Video specific
      duration: Number, // Duration in seconds
      waveformData: [Number], // For audio visualization

      // Image/Video specific
      width: Number,
      height: Number,

      // Reply/Forward
      replyToMessageId: Schema.Types.ObjectId,
      replyToContent: String,
      forwardedFromUserId: Schema.Types.ObjectId,

      // Link preview
      linkPreview: {
        url: String,
        title: String,
        description: String,
        imageUrl: String
      }
    }
  },
  {
    timestamps: true
  }
);

// Indexes for efficient queries
ChatMessageSchema.index({ conversationId: 1, createdAt: -1 });
ChatMessageSchema.index({ senderId: 1, createdAt: -1 });
ChatMessageSchema.index({ groupId: 1, createdAt: -1 });
ChatMessageSchema.index({ recipientId: 1, createdAt: -1 });

// TTL index to auto-delete messages after 1 year (optional, can be adjusted)
// ChatMessageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 31536000 });

export const ChatMessage = model<IChatMessage>('ChatMessage', ChatMessageSchema);

// Conversation metadata model (for quick conversation list retrieval)
export interface IConversation extends Document {
  conversationId: string;
  participants: Types.ObjectId[];
  isGroupChat: boolean;
  groupId?: Types.ObjectId;
  lastMessage?: {
    senderId: Types.ObjectId;
    preview: string; // Decrypted preview (last 50 chars)
    timestamp: Date;
  };
  unreadCount: Map<string, number>; // userId -> unread count
  createdAt: Date;
  updatedAt: Date;
}

const ConversationSchema = new Schema<IConversation>(
  {
    conversationId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    participants: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
      }
    ],
    isGroupChat: {
      type: Boolean,
      default: false
    },
    groupId: {
      type: Schema.Types.ObjectId,
      ref: 'StudyGroup'
    },
    lastMessage: {
      senderId: {
        type: Schema.Types.ObjectId,
        ref: 'User'
      },
      preview: String,
      timestamp: Date
    },
    unreadCount: {
      type: Map,
      of: Number,
      default: {}
    }
  },
  {
    timestamps: true
  }
);

// Index for finding user's conversations
ConversationSchema.index({ participants: 1, updatedAt: -1 });
ConversationSchema.index({ 'lastMessage.timestamp': -1 });

export const Conversation = model<IConversation>('Conversation', ConversationSchema);
