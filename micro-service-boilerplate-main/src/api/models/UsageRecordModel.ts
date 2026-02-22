import { HydratedDocument, Schema, Types, model } from '@lib/db/mongooseCompat';

export interface IUsageRecord {
  user: Types.ObjectId;
  practiceCount: number;
  testCount: number;
  writingCount: number;
  readingCount: number;
  listeningCount: number;
  aiRequestCount: number;
  aiTokenCount: number;
  aiEstimatedCostUsd: number;
  lastReset: Date;
  monthlyResets: {
    resetAt: Date;
    practiceCount: number;
    testCount: number;
    writingCount: number;
    readingCount: number;
    listeningCount: number;
    aiRequestCount: number;
    aiTokenCount: number;
    aiEstimatedCostUsd: number;
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
    writingCount: {
      type: Number,
      default: 0
    },
    readingCount: {
      type: Number,
      default: 0
    },
    listeningCount: {
      type: Number,
      default: 0
    },
    aiRequestCount: {
      type: Number,
      default: 0
    },
    aiTokenCount: {
      type: Number,
      default: 0
    },
    aiEstimatedCostUsd: {
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
        testCount: { type: Number, required: true },
        writingCount: { type: Number, required: true, default: 0 },
        readingCount: { type: Number, required: true, default: 0 },
        listeningCount: { type: Number, required: true, default: 0 },
        aiRequestCount: { type: Number, required: true, default: 0 },
        aiTokenCount: { type: Number, required: true, default: 0 },
        aiEstimatedCostUsd: { type: Number, required: true, default: 0 }
      }
    ]
  },
  {
    timestamps: true
  }
);

export const UsageRecordModel = model<UsageRecordDocument>('UsageRecord', UsageRecordSchema);
