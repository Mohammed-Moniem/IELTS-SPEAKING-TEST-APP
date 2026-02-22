import { HydratedDocument, Schema, Types, model } from '@lib/db/mongooseCompat';

export type AIUsageModule = 'speaking' | 'writing' | 'reading' | 'listening' | 'admin';

export interface IAIUsageLog {
  userId?: Types.ObjectId;
  module: AIUsageModule;
  operation: string;
  model: string;
  requestHash: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  cacheHit: boolean;
  status: 'success' | 'error' | 'blocked';
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type AIUsageLogDocument = HydratedDocument<IAIUsageLog>;

const AIUsageLogSchema = new Schema<IAIUsageLog>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },
    module: {
      type: String,
      enum: ['speaking', 'writing', 'reading', 'listening', 'admin'],
      required: true,
      index: true
    },
    operation: {
      type: String,
      required: true,
      index: true
    },
    model: {
      type: String,
      required: true
    },
    requestHash: {
      type: String,
      required: true,
      index: true
    },
    inputTokens: {
      type: Number,
      default: 0
    },
    outputTokens: {
      type: Number,
      default: 0
    },
    estimatedCostUsd: {
      type: Number,
      default: 0
    },
    cacheHit: {
      type: Boolean,
      default: false,
      index: true
    },
    status: {
      type: String,
      enum: ['success', 'error', 'blocked'],
      default: 'success',
      index: true
    },
    errorMessage: {
      type: String
    }
  },
  {
    timestamps: true
  }
);

AIUsageLogSchema.index({ createdAt: -1 });

export const AIUsageLogModel = model<IAIUsageLog>('AIUsageLog', AIUsageLogSchema);
