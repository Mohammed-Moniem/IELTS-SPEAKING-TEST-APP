import { Document, Schema, Types, model } from 'mongoose';

export interface IStudyGroup extends Document {
  name: string;
  description?: string;
  avatar?: string;
  creatorId: Types.ObjectId;
  adminIds: Types.ObjectId[];
  memberIds: Types.ObjectId[];
  maxMembers: number;
  isPremiumOnly: boolean;
  settings: {
    isPrivate: boolean;
    allowMemberInvites: boolean;
    requireApproval: boolean;
  };
  metadata: {
    ieltsType?: 'academic' | 'general';
    targetCountry?: string;
    targetUniversity?: string;
    studyPurpose?: string;
    skillLevel?: 'beginner' | 'intermediate' | 'advanced';
  };
  createdAt: Date;
  updatedAt: Date;
}

const StudyGroupSchema = new Schema<IStudyGroup>(
  {
    name: {
      type: String,
      required: true,
      maxlength: 100,
      trim: true
    },
    description: {
      type: String,
      maxlength: 500,
      trim: true
    },
    avatar: {
      type: String, // URL to group avatar image
      default: null
    },
    creatorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    adminIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User'
      }
    ],
    memberIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User'
      }
    ],
    maxMembers: {
      type: Number,
      default: 15,
      min: 2,
      max: 50
    },
    isPremiumOnly: {
      type: Boolean,
      default: true // Groups are premium feature
    },
    settings: {
      isPrivate: {
        type: Boolean,
        default: false
      },
      allowMemberInvites: {
        type: Boolean,
        default: true
      },
      requireApproval: {
        type: Boolean,
        default: false
      }
    },
    metadata: {
      ieltsType: {
        type: String,
        enum: ['academic', 'general', null],
        default: null
      },
      targetCountry: {
        type: String,
        maxlength: 100
      },
      targetUniversity: {
        type: String,
        maxlength: 200
      },
      studyPurpose: {
        type: String,
        maxlength: 200
      },
      skillLevel: {
        type: String,
        enum: ['beginner', 'intermediate', 'advanced', null],
        default: null
      }
    }
  },
  {
    timestamps: true
  }
);

// Indexes
StudyGroupSchema.index({ creatorId: 1 });
StudyGroupSchema.index({ memberIds: 1 });
StudyGroupSchema.index({ 'metadata.ieltsType': 1 });
StudyGroupSchema.index({ 'metadata.targetCountry': 1 });
StudyGroupSchema.index({ 'settings.isPrivate': 1 });
StudyGroupSchema.index({ createdAt: -1 });

// Virtual to check if group is full
StudyGroupSchema.virtual('isFull').get(function () {
  return this.memberIds.length >= this.maxMembers;
});

export const StudyGroup = model<IStudyGroup>('StudyGroup', StudyGroupSchema);

// Study Group Invitation model
export interface IStudyGroupInvite extends Document {
  groupId: Types.ObjectId;
  inviterId: Types.ObjectId;
  inviteeId: Types.ObjectId;
  status: 'pending' | 'accepted' | 'declined';
  message?: string;
  createdAt: Date;
  updatedAt: Date;
}

const StudyGroupInviteSchema = new Schema<IStudyGroupInvite>(
  {
    groupId: {
      type: Schema.Types.ObjectId,
      ref: 'StudyGroup',
      required: true,
      index: true
    },
    inviterId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    inviteeId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined'],
      default: 'pending',
      required: true
    },
    message: {
      type: String,
      maxlength: 300
    }
  },
  {
    timestamps: true
  }
);

// Compound index to prevent duplicate invites
StudyGroupInviteSchema.index({ groupId: 1, inviteeId: 1 }, { unique: true });
StudyGroupInviteSchema.index({ inviteeId: 1, status: 1 });

export const StudyGroupInvite = model<IStudyGroupInvite>('StudyGroupInvite', StudyGroupInviteSchema);
