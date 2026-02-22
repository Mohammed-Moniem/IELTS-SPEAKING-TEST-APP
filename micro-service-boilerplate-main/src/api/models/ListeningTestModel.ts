import { HydratedDocument, Schema, Types, model } from '@lib/db/mongooseCompat';
import { IELTSModuleTrack } from './WritingTaskModel';
import { ReadingQuestionType } from './ReadingTestModel';

export interface IListeningQuestion {
  questionId: string;
  type: ReadingQuestionType;
  prompt: string;
  options?: string[];
  correctAnswer: string;
  explanation?: string;
}

export interface IListeningTest {
  track: IELTSModuleTrack;
  title: string;
  sectionTitle: string;
  transcript: string;
  audioUrl?: string;
  suggestedTimeMinutes: number;
  questions: IListeningQuestion[];
  source: 'bank' | 'ai';
  autoPublished: boolean;
  active: boolean;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type ListeningTestDocument = HydratedDocument<IListeningTest>;

const ListeningQuestionSchema = new Schema<IListeningQuestion>(
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

const ListeningTestSchema = new Schema<IListeningTest>(
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
    sectionTitle: {
      type: String,
      required: true
    },
    transcript: {
      type: String,
      required: true
    },
    audioUrl: {
      type: String
    },
    suggestedTimeMinutes: {
      type: Number,
      default: 20,
      min: 1
    },
    questions: {
      type: [ListeningQuestionSchema],
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

ListeningTestSchema.index({ track: 1, active: 1, updatedAt: -1 });

export const ListeningTestModel = model<IListeningTest>('ListeningTest', ListeningTestSchema);
