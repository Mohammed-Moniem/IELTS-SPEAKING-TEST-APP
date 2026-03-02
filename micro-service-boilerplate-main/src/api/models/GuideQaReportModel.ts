import { HydratedDocument, Schema, Types, model } from '@lib/db/mongooseCompat';

export interface IGuideQaReport {
  guidePageId: Types.ObjectId;
  citationCoverageScore: number;
  duplicationScore: number;
  readabilityScore: number;
  linkValidationPassed: boolean;
  schemaValidationPassed: boolean;
  passed: boolean;
  warnings: string[];
  createdByUserId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type GuideQaReportDocument = HydratedDocument<IGuideQaReport>;

const GuideQaReportSchema = new Schema<IGuideQaReport>(
  {
    guidePageId: { type: Schema.Types.ObjectId, ref: 'GuidePage', required: true, index: true },
    citationCoverageScore: { type: Number, default: 0 },
    duplicationScore: { type: Number, default: 0 },
    readabilityScore: { type: Number, default: 0 },
    linkValidationPassed: { type: Boolean, default: false },
    schemaValidationPassed: { type: Boolean, default: false },
    passed: { type: Boolean, default: false, index: true },
    warnings: [{ type: String, trim: true }],
    createdByUserId: { type: Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

GuideQaReportSchema.index({ guidePageId: 1, createdAt: -1 });

export const GuideQaReportModel = model<IGuideQaReport>('GuideQaReport', GuideQaReportSchema);
