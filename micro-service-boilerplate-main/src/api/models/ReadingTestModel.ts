import { HydratedDocument, Schema, Types, model } from '@lib/db/mongooseCompat';
import { IELTSModuleTrack } from './WritingTaskModel';

export type ReadingQuestionType =
  | 'multiple_choice'
  | 'true_false_not_given'
  | 'matching_headings'
  | 'sentence_completion'
  | 'summary_completion'
  | 'short_answer';

export interface IReadingQuestion {
  questionId: string;
  type: ReadingQuestionType;
  prompt: string;
  options?: string[];
  correctAnswer: string;
  explanation?: string;
}

export interface IReadingTest {
  track: IELTSModuleTrack;
  title: string;
  passageTitle: string;
  passageText: string;
  suggestedTimeMinutes: number;
  questions: IReadingQuestion[];
  source: 'bank' | 'ai';
  autoPublished: boolean;
  active: boolean;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type ReadingTestDocument = HydratedDocument<IReadingTest>;

const ReadingQuestionSchema = new Schema<IReadingQuestion>(
  {
    questionId: { type: String, required: true },
    type: {
      type: String,
      enum: [
        'multiple_choice',
        'true_false_not_given',
        'matching_headings',
        'sentence_completion',
        'summary_completion',
        'short_answer'
      ],
      required: true
    },
    prompt: { type: String, required: true },
    options: { type: [String], default: [] },
    correctAnswer: { type: String, required: true },
    explanation: { type: String }
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
    passageTitle: {
      type: String,
      required: true
    },
    passageText: {
      type: String,
      required: true
    },
    suggestedTimeMinutes: {
      type: Number,
      default: 20,
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

ReadingTestSchema.index({ track: 1, active: 1, updatedAt: -1 });

export const ReadingTestModel = model<IReadingTest>('ReadingTest', ReadingTestSchema);
