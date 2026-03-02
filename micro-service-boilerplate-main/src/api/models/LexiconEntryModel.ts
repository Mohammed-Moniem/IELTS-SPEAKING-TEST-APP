import { HydratedDocument, Schema, model } from '@lib/db/mongooseCompat';

export interface ILexiconEntry {
  lemma: string;
  definition: string;
  cefr: 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  module: 'speaking' | 'writing' | 'reading' | 'listening';
  bandTargetMin: number;
  bandTargetMax: number;
  topic?: string;
  synonyms: string[];
  examples: string[];
  frequencyRank?: number;
  sourceType: 'curated' | 'ai_assist';
  qualityScore: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type LexiconEntryDocument = HydratedDocument<ILexiconEntry>;

const LexiconEntrySchema = new Schema<ILexiconEntry>(
  {
    lemma: { type: String, required: true, trim: true, index: true },
    definition: { type: String, required: true, trim: true },
    cefr: { type: String, enum: ['A2', 'B1', 'B2', 'C1', 'C2'], required: true, index: true },
    module: { type: String, enum: ['speaking', 'writing', 'reading', 'listening'], required: true, index: true },
    bandTargetMin: { type: Number, required: true, default: 5 },
    bandTargetMax: { type: Number, required: true, default: 9 },
    topic: { type: String, trim: true, index: true },
    synonyms: [{ type: String, trim: true }],
    examples: [{ type: String, trim: true }],
    frequencyRank: { type: Number },
    sourceType: { type: String, enum: ['curated', 'ai_assist'], default: 'curated', index: true },
    qualityScore: { type: Number, default: 0.7 },
    active: { type: Boolean, default: true, index: true }
  },
  { timestamps: true }
);

LexiconEntrySchema.index({ lemma: 1, module: 1 }, { unique: true });

export const LexiconEntryModel = model<ILexiconEntry>('LexiconEntry', LexiconEntrySchema);
