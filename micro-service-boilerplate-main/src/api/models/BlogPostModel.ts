import { HydratedDocument, Schema, Types, model } from '@lib/db/mongooseCompat';

export type BlogPostState =
  | 'idea'
  | 'outline'
  | 'draft'
  | 'qa_passed'
  | 'pending_review'
  | 'published'
  | 'archived';

export type BlogContentRisk = 'low_risk_update' | 'pillar' | 'commercial';

export interface IBlogPost {
  title: string;
  slug: string;
  excerpt?: string;
  body: string;
  cluster: string;
  tags: string[];
  state: BlogPostState;
  contentRisk: BlogContentRisk;
  qaReportId?: Types.ObjectId;
  qaPassed: boolean;
  qaScore?: number;
  factCheckConfidence?: number;
  duplicationScore?: number;
  readabilityScore?: number;
  linkValidationPassed?: boolean;
  schemaValidationPassed?: boolean;
  sourceLinks: string[];
  scheduledAt?: Date;
  publishedAt?: Date;
  lastReviewedAt?: Date;
  lastUpdatedAt?: Date;
  createdByUserId?: Types.ObjectId;
  reviewedByUserId?: Types.ObjectId;
  updatedByUserId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type BlogPostDocument = HydratedDocument<IBlogPost>;

const BlogPostSchema = new Schema<IBlogPost>(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    slug: { type: String, required: true, trim: true, maxlength: 240, index: true },
    excerpt: { type: String, trim: true, maxlength: 360 },
    body: { type: String, required: true },
    cluster: { type: String, required: true, trim: true, maxlength: 120, index: true },
    tags: [{ type: String, trim: true }],
    state: {
      type: String,
      enum: ['idea', 'outline', 'draft', 'qa_passed', 'pending_review', 'published', 'archived'],
      default: 'draft',
      index: true
    },
    contentRisk: {
      type: String,
      enum: ['low_risk_update', 'pillar', 'commercial'],
      default: 'low_risk_update',
      index: true
    },
    qaReportId: { type: Schema.Types.ObjectId, ref: 'BlogQaReport' },
    qaPassed: { type: Boolean, default: false },
    qaScore: { type: Number, default: 0 },
    factCheckConfidence: { type: Number, default: 0 },
    duplicationScore: { type: Number, default: 0 },
    readabilityScore: { type: Number, default: 0 },
    linkValidationPassed: { type: Boolean, default: false },
    schemaValidationPassed: { type: Boolean, default: false },
    sourceLinks: [{ type: String, trim: true }],
    scheduledAt: { type: Date },
    publishedAt: { type: Date, index: true },
    lastReviewedAt: { type: Date },
    lastUpdatedAt: { type: Date, index: true },
    createdByUserId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    reviewedByUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedByUserId: { type: Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

BlogPostSchema.index({ slug: 1 }, { unique: true });
BlogPostSchema.index({ state: 1, updatedAt: -1 });
BlogPostSchema.index({ cluster: 1, state: 1, updatedAt: -1 });

export const BlogPostModel = model<IBlogPost>('BlogPost', BlogPostSchema);
