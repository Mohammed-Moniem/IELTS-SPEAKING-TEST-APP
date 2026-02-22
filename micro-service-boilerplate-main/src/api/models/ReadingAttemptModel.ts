import { HydratedDocument, Schema, Types, model } from '@lib/db/mongooseCompat';
import { IELTSModuleTrack } from './WritingTaskModel';

export interface IReadingAnswer {
  questionId: string;
  answer: string;
  isCorrect: boolean;
}

export interface IReadingAttempt {
  userId: Types.ObjectId;
  testId: Types.ObjectId;
  track: IELTSModuleTrack;
  answers: IReadingAnswer[];
  score: number;
  totalQuestions: number;
  normalizedBand: number;
  durationSeconds: number;
  feedback: {
    summary: string;
    suggestions: string[];
    strengths: string[];
    improvements: string[];
  };
  model?: string;
  status: 'in_progress' | 'completed';
  createdAt: Date;
  updatedAt: Date;
}

export type ReadingAttemptDocument = HydratedDocument<IReadingAttempt>;

const ReadingAnswerSchema = new Schema<IReadingAnswer>(
  {
    questionId: { type: String, required: true },
    answer: { type: String, required: true },
    isCorrect: { type: Boolean, required: true }
  },
  { _id: false }
);

const ReadingAttemptSchema = new Schema<IReadingAttempt>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    testId: {
      type: Schema.Types.ObjectId,
      ref: 'ReadingTest',
      required: true,
      index: true
    },
    track: {
      type: String,
      enum: ['academic', 'general'],
      required: true,
      index: true
    },
    answers: {
      type: [ReadingAnswerSchema],
      default: []
    },
    score: {
      type: Number,
      default: 0
    },
    totalQuestions: {
      type: Number,
      default: 0
    },
    normalizedBand: {
      type: Number,
      default: 0,
      min: 0,
      max: 9
    },
    durationSeconds: {
      type: Number,
      default: 0
    },
    feedback: {
      summary: { type: String, default: '' },
      suggestions: { type: [String], default: [] },
      strengths: { type: [String], default: [] },
      improvements: { type: [String], default: [] }
    },
    model: {
      type: String
    },
    status: {
      type: String,
      enum: ['in_progress', 'completed'],
      default: 'in_progress',
      index: true
    }
  },
  {
    timestamps: true
  }
);

ReadingAttemptSchema.index({ userId: 1, createdAt: -1 });

export const ReadingAttemptModel = model<IReadingAttempt>('ReadingAttempt', ReadingAttemptSchema);
