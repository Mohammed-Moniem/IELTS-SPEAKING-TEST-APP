import { HydratedDocument, Schema, Types, model } from 'mongoose';

export interface IUsageRecord {
  user: Types.ObjectId;
  practiceCount: number;
  testCount: number;
  lastReset: Date;
  monthlyResets: {
    resetAt: Date;
    practiceCount: number;
    testCount: number;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

export type UsageRecordDocument = HydratedDocument<IUsageRecord>;

const UsageRecordSchema = new Schema<IUsageRecord>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true
    },
    practiceCount: {
      type: Number,
      default: 0
    },
    testCount: {
      type: Number,
      default: 0
    },
    lastReset: {
      type: Date,
      default: () => new Date()
    },
    monthlyResets: [
      {
        resetAt: { type: Date, required: true },
        practiceCount: { type: Number, required: true },
        testCount: { type: Number, required: true }
      }
    ]
  },
  {
    timestamps: true
  }
);

export const UsageRecordModel = model<UsageRecordDocument>('UsageRecord', UsageRecordSchema);
