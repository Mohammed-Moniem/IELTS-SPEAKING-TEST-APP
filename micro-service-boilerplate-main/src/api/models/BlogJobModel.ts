import { HydratedDocument, Schema, Types, model } from '@lib/db/mongooseCompat';

export type BlogJobType = 'generate_ideas' | 'draft_post' | 'refresh_content';
export type BlogJobStatus = 'queued' | 'running' | 'failed' | 'completed';

export interface IBlogJob {
  type: BlogJobType;
  status: BlogJobStatus;
  payload?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: string;
  postId?: Types.ObjectId;
  startedAt?: Date;
  finishedAt?: Date;
  createdByUserId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type BlogJobDocument = HydratedDocument<IBlogJob>;

const BlogJobSchema = new Schema<IBlogJob>(
  {
    type: {
      type: String,
      enum: ['generate_ideas', 'draft_post', 'refresh_content'],
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
    error: { type: String },
    postId: { type: Schema.Types.ObjectId, ref: 'BlogPost', index: true },
    startedAt: { type: Date },
    finishedAt: { type: Date },
    createdByUserId: { type: Schema.Types.ObjectId, ref: 'User', index: true }
  },
  { timestamps: true }
);

BlogJobSchema.index({ status: 1, createdAt: -1 });

export const BlogJobModel = model<IBlogJob>('BlogJob', BlogJobSchema);
