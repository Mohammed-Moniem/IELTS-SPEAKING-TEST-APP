import { HydratedDocument, Schema, Types, model } from '@lib/db/mongooseCompat';

export type GuideImportJobType = 'sitemap_import' | 'refresh_queue';
export type GuideImportJobStatus = 'queued' | 'running' | 'failed' | 'completed';

export interface IGuideImportJob {
  type: GuideImportJobType;
  status: GuideImportJobStatus;
  payload?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: string;
  startedAt?: Date;
  finishedAt?: Date;
  createdByUserId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type GuideImportJobDocument = HydratedDocument<IGuideImportJob>;

const GuideImportJobSchema = new Schema<IGuideImportJob>(
  {
    type: {
      type: String,
      enum: ['sitemap_import', 'refresh_queue'],
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: ['queued', 'running', 'failed', 'completed'],
      default: 'queued',
      index: true
    },
    payload: { type: Schema.Types.Mixed, default: {} },
    result: { type: Schema.Types.Mixed, default: {} },
    error: { type: String, trim: true },
    startedAt: { type: Date },
    finishedAt: { type: Date },
    createdByUserId: { type: Schema.Types.ObjectId, ref: 'User', index: true }
  },
  { timestamps: true }
);

GuideImportJobSchema.index({ status: 1, createdAt: -1 });

export const GuideImportJobModel = model<IGuideImportJob>('GuideImportJob', GuideImportJobSchema);
