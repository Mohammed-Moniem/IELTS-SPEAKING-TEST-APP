import { model, Schema, Document, Types } from '@lib/db/mongooseCompat';

export interface IUserQuestionHistory {
  userId: string;
  questionId: Types.ObjectId;
  usedAt: Date;
  testId?: Types.ObjectId;
  testType: 'practice' | 'full-test';
}

export interface IUserQuestionHistoryDocument extends IUserQuestionHistory, Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const UserQuestionHistorySchema = new Schema<IUserQuestionHistoryDocument>(
  {
    userId: {
      type: String,
      required: true,
      index: true
    },
    questionId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'IELTSQuestion',
      index: true
    },
    usedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true
    },
    testId: {
      type: Schema.Types.ObjectId,
      ref: 'TestSession'
    },
    testType: {
      type: String,
      enum: ['practice', 'full-test'],
      required: true
    }
  },
  {
    timestamps: true,
    collection: 'userquestionhistory'
  }
);

// Compound indexes for efficient queries
UserQuestionHistorySchema.index({ userId: 1, usedAt: -1 });
UserQuestionHistorySchema.index({ userId: 1, questionId: 1 });
UserQuestionHistorySchema.index({ testId: 1 });

// TTL index to automatically delete records older than 90 days
UserQuestionHistorySchema.index({ usedAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const UserQuestionHistoryModel = model<IUserQuestionHistoryDocument>(
  'UserQuestionHistory',
  UserQuestionHistorySchema
);
