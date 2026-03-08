import { HydratedDocument, Schema, Types, model } from '@lib/db/mongooseCompat';
import { IELTSModuleTrack } from './WritingTaskModel';
import { ReadingQuestionType, IReadingAnswerSpec } from './ReadingTestModel';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface IListeningQuestion {
  questionId: string;
  sectionId?: 's1' | 's2' | 's3' | 's4';
  type: ReadingQuestionType;
  prompt: string;
  instructions?: string;
  groupId?: string;
  options?: string[];
  correctAnswer: string;
  answerSpec?: IReadingAnswerSpec;
  explanation?: string;
}

export interface IListeningTest {
  track: IELTSModuleTrack;
  title: string;
  schemaVersion?: 'v1' | 'v2';
  qualityTier?: 'legacy' | 'gen_v1';

  /* v2: section-based (per-section audio, mix & match) */
  sectionRefs?: Types.ObjectId[];
  sectionCount?: number;

  /* v1 legacy fields (kept for backward compat) */
  sectionTitle: string;
  transcript: string;
  audioUrl?: string;
  suggestedTimeMinutes: number;
  questions: IListeningQuestion[];

  source: 'bank' | 'ai' | 'pipeline';
  autoPublished: boolean;
  active: boolean;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type ListeningTestDocument = HydratedDocument<IListeningTest>;

/* ------------------------------------------------------------------ */
/*  Sub-schemas                                                       */
/* ------------------------------------------------------------------ */

const ListeningAnswerSpecSchema = new Schema<IReadingAnswerSpec>(
  {
    kind: { type: String, enum: ['single', 'multi', 'ordered', 'map'], required: true },
    value: { type: Schema.Types.Mixed, required: true },
    caseSensitive: { type: Boolean, default: false },
    maxWords: { type: Number }
  },
  { _id: false }
);

const ListeningQuestionSchema = new Schema<IListeningQuestion>(
  {
    questionId: { type: String, required: true },
    sectionId: { type: String, enum: ['s1', 's2', 's3', 's4'] },
    type: {
      type: String,
      enum: [
        'multiple_choice',
        'multiple_choice_single',
        'multiple_choice_multiple',
        'true_false_not_given',
        'yes_no_not_given',
        'matching_headings',
        'matching_information',
        'matching_features',
        'matching_sentence_endings',
        'sentence_completion',
        'summary_completion',
        'note_table_flow_completion',
        'diagram_label_completion',
        'short_answer'
      ],
      required: true
    },
    prompt: { type: String, required: true },
    instructions: { type: String },
    groupId: { type: String },
    options: { type: [String], default: [] },
    correctAnswer: { type: String, required: true },
    answerSpec: { type: ListeningAnswerSpecSchema },
    explanation: { type: String }
  },
  { _id: false }
);

/* ------------------------------------------------------------------ */
/*  Main schema                                                       */
/* ------------------------------------------------------------------ */

const ListeningTestSchema = new Schema<IListeningTest>(
  {
    track: {
      type: String,
      enum: ['academic', 'general'],
      required: true,
      index: true
    },
    title: { type: String, required: true },
    schemaVersion: {
      type: String,
      enum: ['v1', 'v2'],
      default: 'v1'
    },
    qualityTier: {
      type: String,
      enum: ['legacy', 'gen_v1'],
      default: 'legacy',
      index: true
    },

    /* v2 section references */
    sectionRefs: {
      type: [{ type: Schema.Types.ObjectId, ref: 'ListeningSection' }],
      default: []
    },
    sectionCount: { type: Number, default: 0 },

    /* v1 legacy fields */
    sectionTitle: { type: String, default: '' },
    transcript: { type: String, default: '' },
    audioUrl: { type: String },
    suggestedTimeMinutes: { type: Number, default: 30, min: 1 },
    questions: { type: [ListeningQuestionSchema], default: [] },

    source: {
      type: String,
      enum: ['bank', 'ai', 'pipeline'],
      default: 'bank'
    },
    autoPublished: { type: Boolean, default: true },
    active: { type: Boolean, default: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

ListeningTestSchema.index({ track: 1, active: 1, schemaVersion: 1, qualityTier: 1, updatedAt: -1 });

export const ListeningTestModel = model<IListeningTest>('ListeningTest', ListeningTestSchema);
