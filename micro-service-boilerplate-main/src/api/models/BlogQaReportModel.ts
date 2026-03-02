import { HydratedDocument, Schema, Types, model } from '@lib/db/mongooseCompat';

export interface IBlogQaReport {
  postId: Types.ObjectId;
  factCheckConfidence: number;
  duplicationScore: number;
  readabilityScore: number;
  linkValidationPassed: boolean;
  schemaValidationPassed: boolean;
  passed: boolean;
  warnings: string[];
  createdAt: Date;
  updatedAt: Date;
}

export type BlogQaReportDocument = HydratedDocument<IBlogQaReport>;

const BlogQaReportSchema = new Schema<IBlogQaReport>(
  {
    postId: { type: Schema.Types.ObjectId, ref: 'BlogPost', required: true, index: true },
    factCheckConfidence: { type: Number, default: 0 },
    duplicationScore: { type: Number, default: 0 },
    readabilityScore: { type: Number, default: 0 },
    linkValidationPassed: { type: Boolean, default: false },
    schemaValidationPassed: { type: Boolean, default: false },
    passed: { type: Boolean, default: false, index: true },
    warnings: [{ type: String, trim: true }]
  },
  { timestamps: true }
);

BlogQaReportSchema.index({ postId: 1, createdAt: -1 });

export const BlogQaReportModel = model<IBlogQaReport>('BlogQaReport', BlogQaReportSchema);
