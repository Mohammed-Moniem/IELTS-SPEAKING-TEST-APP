import { HydratedDocument, Schema, Types, model } from '@lib/db/mongooseCompat';
import { IELTSModuleTrack } from './WritingTaskModel';
import { ReadingQuestionType } from './ReadingTestModel';

export interface IReadingAnswer {
  questionId: string;
  sectionId?: 'p1' | 'p2' | 'p3';
  questionType?: ReadingQuestionType;
  answer: string | string[] | Record<string, string>;
  isCorrect: boolean;
  expectedAnswer?: string | string[] | Record<string, string>;
  pointsAwarded?: number;
  maxPoints?: number;
  feedbackHint?: string;
}

export interface IReadingSectionProgress {
  sectionId: 'p1' | 'p2' | 'p3';
  answeredCount: number;
  totalCount: number;
  correctCount: number;
}

export interface IReadingQuestionTypeStat {
  type: string;
  correct: number;
  total: number;
}

export interface IReadingAttempt {
  userId: Types.ObjectId;
  testId: Types.ObjectId;
  track: IELTSModuleTrack;
  schemaVersion?: 'v1' | 'v2';
  feedbackVersion?: 'v1' | 'v2';
  answers: IReadingAnswer[];
  sectionProgress?: IReadingSectionProgress[];
  questionTypeStats?: IReadingQuestionTypeStat[];
  sectionStats?: Array<{ sectionId: 'p1' | 'p2' | 'p3'; score: number; total: number }>;
  score: number;
  totalQuestions: number;
  normalizedBand: number;
  durationSeconds: number;
  deepFeedbackReady?: boolean;
  deepFeedback?: {
    overallSummary?: string;
    sectionCoaching?: Array<{
      sectionId: 'p1' | 'p2' | 'p3';
      focusAreas: string[];
      traps: string[];
      drills: string[];
    }>;
    questionTypeCoaching?: Array<{
      type: string;
      whyWrong: string[];
      fixes: string[];
      drills: string[];
    }>;
    top5Fixes?: string[];
    next24hPlan?: string[];
    next7dPlan?: string[];
  };
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
    sectionId: {
      type: String,
      enum: ['p1', 'p2', 'p3']
    },
    questionType: { type: String },
    answer: { type: Schema.Types.Mixed, required: true },
    isCorrect: { type: Boolean, required: true },
    expectedAnswer: { type: Schema.Types.Mixed },
    pointsAwarded: { type: Number, default: 0 },
    maxPoints: { type: Number, default: 1 },
    feedbackHint: { type: String }
  },
  { _id: false }
);

const ReadingSectionProgressSchema = new Schema<IReadingSectionProgress>(
  {
    sectionId: {
      type: String,
      enum: ['p1', 'p2', 'p3'],
      required: true
    },
    answeredCount: { type: Number, default: 0 },
    totalCount: { type: Number, default: 0 },
    correctCount: { type: Number, default: 0 }
  },
  { _id: false }
);

const ReadingQuestionTypeStatSchema = new Schema<IReadingQuestionTypeStat>(
  {
    type: { type: String, required: true },
    correct: { type: Number, default: 0 },
    total: { type: Number, default: 0 }
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
    schemaVersion: {
      type: String,
      enum: ['v1', 'v2'],
      default: 'v2'
    },
    feedbackVersion: {
      type: String,
      enum: ['v1', 'v2'],
      default: 'v2'
    },
    answers: {
      type: [ReadingAnswerSchema],
      default: []
    },
    sectionProgress: {
      type: [ReadingSectionProgressSchema],
      default: []
    },
    questionTypeStats: {
      type: [ReadingQuestionTypeStatSchema],
      default: []
    },
    sectionStats: {
      type: [Schema.Types.Mixed],
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
    deepFeedbackReady: {
      type: Boolean,
      default: false
    },
    deepFeedback: {
      type: Schema.Types.Mixed,
      default: {}
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
