import { HydratedDocument, Schema, model } from '@lib/db/mongooseCompat';

export interface IResourceRecommendation {
  title: string;
  type: 'book' | 'channel';
  provider?: string;
  url?: string;
  description?: string;
  module: 'speaking' | 'writing' | 'reading' | 'listening' | 'all';
  topic?: string;
  bandTargetMin: number;
  bandTargetMax: number;
  cefr?: 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  sponsored: boolean;
  sponsorPartnerId?: string;
  sourceType: 'curated' | 'ai_assist';
  qualityScore: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type ResourceRecommendationDocument = HydratedDocument<IResourceRecommendation>;

const ResourceRecommendationSchema = new Schema<IResourceRecommendation>(
  {
    title: { type: String, required: true, trim: true, index: true },
    type: { type: String, enum: ['book', 'channel'], required: true, index: true },
    provider: { type: String, trim: true },
    url: { type: String, trim: true },
    description: { type: String, trim: true },
    module: {
      type: String,
      enum: ['speaking', 'writing', 'reading', 'listening', 'all'],
      required: true,
      index: true
    },
    topic: { type: String, trim: true, index: true },
    bandTargetMin: { type: Number, default: 5 },
    bandTargetMax: { type: Number, default: 9 },
    cefr: { type: String, enum: ['A2', 'B1', 'B2', 'C1', 'C2'] },
    difficulty: { type: String, enum: ['beginner', 'intermediate', 'advanced'] },
    sponsored: { type: Boolean, default: false, index: true },
    sponsorPartnerId: { type: String, trim: true, index: true },
    sourceType: { type: String, enum: ['curated', 'ai_assist'], default: 'curated', index: true },
    qualityScore: { type: Number, default: 0.7 },
    active: { type: Boolean, default: true, index: true }
  },
  { timestamps: true }
);

ResourceRecommendationSchema.index({ type: 1, module: 1, active: 1 });

export const ResourceRecommendationModel = model<IResourceRecommendation>(
  'ResourceRecommendation',
  ResourceRecommendationSchema
);
