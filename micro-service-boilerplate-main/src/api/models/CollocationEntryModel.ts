import { HydratedDocument, Schema, model } from '@lib/db/mongooseCompat';

export interface ICollocationEntry {
  phrase: string;
  meaning: string;
  module: 'speaking' | 'writing' | 'reading' | 'listening';
  cefr: 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  topic?: string;
  bandTargetMin: number;
  bandTargetMax: number;
  examples: string[];
  alternatives: string[];
  frequencyRank?: number;
  sourceType: 'curated' | 'ai_assist';
  qualityScore: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type CollocationEntryDocument = HydratedDocument<ICollocationEntry>;

const CollocationEntrySchema = new Schema<ICollocationEntry>(
  {
    phrase: { type: String, required: true, trim: true, index: true },
    meaning: { type: String, required: true, trim: true },
    module: { type: String, enum: ['speaking', 'writing', 'reading', 'listening'], required: true, index: true },
    cefr: { type: String, enum: ['A2', 'B1', 'B2', 'C1', 'C2'], required: true, index: true },
    topic: { type: String, trim: true, index: true },
    bandTargetMin: { type: Number, required: true, default: 5 },
    bandTargetMax: { type: Number, required: true, default: 9 },
    examples: [{ type: String, trim: true }],
    alternatives: [{ type: String, trim: true }],
    frequencyRank: { type: Number },
    sourceType: { type: String, enum: ['curated', 'ai_assist'], default: 'curated', index: true },
    qualityScore: { type: Number, default: 0.7 },
    active: { type: Boolean, default: true, index: true }
  },
  { timestamps: true }
);

CollocationEntrySchema.index({ phrase: 1, module: 1 }, { unique: true });

export const CollocationEntryModel = model<ICollocationEntry>('CollocationEntry', CollocationEntrySchema);
