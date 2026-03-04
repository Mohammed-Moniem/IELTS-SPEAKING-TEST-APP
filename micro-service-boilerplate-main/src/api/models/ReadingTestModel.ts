import { HydratedDocument, Schema, Types, model } from '@lib/db/mongooseCompat';
import { IELTSModuleTrack } from './WritingTaskModel';

export type ReadingQuestionType =
  | 'multiple_choice'
  | 'multiple_choice_single'
  | 'multiple_choice_multiple'
  | 'true_false_not_given'
  | 'yes_no_not_given'
  | 'matching_headings'
  | 'matching_information'
  | 'matching_features'
  | 'matching_sentence_endings'
  | 'sentence_completion'
  | 'summary_completion'
  | 'note_table_flow_completion'
  | 'diagram_label_completion'
  | 'short_answer';

export interface IReadingAnswerSpec {
  kind: 'single' | 'multi' | 'ordered' | 'map';
  value: string | string[] | Record<string, string>;
  caseSensitive?: boolean;
  maxWords?: number;
}

export interface IReadingQuestion {
  questionId: string;
  sectionId?: 'p1' | 'p2' | 'p3';
  type: ReadingQuestionType;
  prompt: string;
  instructions?: string;
  groupId?: string;
  options?: string[];
  correctAnswer?: string;
  answerSpec?: IReadingAnswerSpec;
  explanation?: string;
}

export interface IReadingSection {
  sectionId: 'p1' | 'p2' | 'p3';
  title: string;
  passageText: string;
  suggestedMinutes: number;
  questions: IReadingQuestion[];
}

export interface IReadingTest {
  track: IELTSModuleTrack;
  title: string;
  schemaVersion?: 'v1' | 'v2';
  sectionCount?: number;
  sections?: IReadingSection[];
  passageTitle?: string;
  passageText?: string;
  suggestedTimeMinutes: number;
  questions?: IReadingQuestion[];
  source: 'bank' | 'ai';
  autoPublished: boolean;
  active: boolean;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type ReadingTestDocument = HydratedDocument<IReadingTest>;

const ReadingAnswerSpecSchema = new Schema<IReadingAnswerSpec>(
  {
    kind: {
      type: String,
      enum: ['single', 'multi', 'ordered', 'map'],
      required: true
    },
    value: { type: Schema.Types.Mixed, required: true },
    caseSensitive: { type: Boolean, default: false },
    maxWords: { type: Number }
  },
  { _id: false }
);

const ReadingQuestionSchema = new Schema<IReadingQuestion>(
  {
    questionId: { type: String, required: true },
    sectionId: {
      type: String,
      enum: ['p1', 'p2', 'p3']
    },
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
    correctAnswer: { type: String },
    answerSpec: { type: ReadingAnswerSpecSchema },
    explanation: { type: String }
  },
  { _id: false }
);

const ReadingSectionSchema = new Schema<IReadingSection>(
  {
    sectionId: {
      type: String,
      enum: ['p1', 'p2', 'p3'],
      required: true
    },
    title: { type: String, required: true },
    passageText: { type: String, required: true },
    suggestedMinutes: { type: Number, min: 1, default: 20 },
    questions: {
      type: [ReadingQuestionSchema],
      default: []
    }
  },
  { _id: false }
);

const ReadingTestSchema = new Schema<IReadingTest>(
  {
    track: {
      type: String,
      enum: ['academic', 'general'],
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true
    },
    schemaVersion: {
      type: String,
      enum: ['v1', 'v2'],
      default: 'v2'
    },
    sectionCount: {
      type: Number,
      default: 3,
      min: 1
    },
    sections: {
      type: [ReadingSectionSchema],
      default: []
    },
    passageTitle: {
      type: String
    },
    passageText: {
      type: String
    },
    suggestedTimeMinutes: {
      type: Number,
      default: 60,
      min: 1
    },
    questions: {
      type: [ReadingQuestionSchema],
      default: []
    },
    source: {
      type: String,
      enum: ['bank', 'ai'],
      default: 'bank'
    },
    autoPublished: {
      type: Boolean,
      default: true
    },
    active: {
      type: Boolean,
      default: true,
      index: true
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true
  }
);

ReadingTestSchema.index({ track: 1, active: 1, autoPublished: 1, schemaVersion: 1, updatedAt: -1 });

export const ReadingTestModel = model<IReadingTest>('ReadingTest', ReadingTestSchema);
