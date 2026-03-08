import { HydratedDocument, Schema, Types, model } from '@lib/db/mongooseCompat';
import { IELTSModuleTrack } from './WritingTaskModel';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface IListeningAnswer {
  questionId: string;
  sectionId?: string;
  questionType?: string;
  answer: string | string[] | Record<string, string>;
  isCorrect: boolean;
  expectedAnswer?: string | string[] | Record<string, string>;
  feedbackHint?: string;
}

export interface IListeningSectionCoaching {
  sectionId: string;
  focusAreas: string[];
  traps: string[];
  drills: string[];
}

export interface IListeningQuestionTypeCoaching {
  type: string;
  whyWrong: string[];
  fixes: string[];
  drills: string[];
}

export interface IListeningDeepFeedback {
  overallSummary?: string;
  sectionCoaching?: IListeningSectionCoaching[];
  questionTypeCoaching?: IListeningQuestionTypeCoaching[];
  top5Fixes?: string[];
  next24hPlan?: string[];
  next7dPlan?: string[];
}

export interface IListeningAttempt {
  userId: Types.ObjectId;
  testId: Types.ObjectId;
  track: IELTSModuleTrack;
  schemaVersion?: 'v1' | 'v2';
  feedbackVersion?: 'v1' | 'v2';
  answers: IListeningAnswer[];
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
  deepFeedbackReady?: boolean;
  deepFeedback?: IListeningDeepFeedback;
  sectionStats?: Array<{
    sectionId: string;
    score: number;
    total: number;
  }>;
  questionTypeStats?: Array<{
    type: string;
    correct: number;
    total: number;
  }>;
  workspaceState?: {
    answers?: Record<string, string | string[] | Record<string, string>>;
    activeSectionId?: string;
    activeQuestionIndex?: number;
    flaggedQuestionIds?: string[];
    isPaused?: boolean;
    durationSeconds?: number;
    updatedAt?: Date;
  };
  model?: string;
  status: 'in_progress' | 'completed';
  createdAt: Date;
  updatedAt: Date;
}

export type ListeningAttemptDocument = HydratedDocument<IListeningAttempt>;

/* ------------------------------------------------------------------ */
/*  Sub-schemas                                                       */
/* ------------------------------------------------------------------ */

const ListeningAnswerSchema = new Schema<IListeningAnswer>(
  {
    questionId: { type: String, required: true },
    sectionId: { type: String },
    questionType: { type: String },
    answer: { type: Schema.Types.Mixed, required: true },
    isCorrect: { type: Boolean, required: true },
    expectedAnswer: { type: Schema.Types.Mixed },
    feedbackHint: { type: String }
  },
  { _id: false }
);

const SectionStatSchema = new Schema(
  {
    sectionId: { type: String, required: true },
    score: { type: Number, default: 0 },
    total: { type: Number, default: 0 }
  },
  { _id: false }
);

const QuestionTypeStatSchema = new Schema(
  {
    type: { type: String, required: true },
    correct: { type: Number, default: 0 },
    total: { type: Number, default: 0 }
  },
  { _id: false }
);

const SectionCoachingSchema = new Schema(
  {
    sectionId: { type: String, required: true },
    focusAreas: { type: [String], default: [] },
    traps: { type: [String], default: [] },
    drills: { type: [String], default: [] }
  },
  { _id: false }
);

const QuestionTypeCoachingSchema = new Schema(
  {
    type: { type: String, required: true },
    whyWrong: { type: [String], default: [] },
    fixes: { type: [String], default: [] },
    drills: { type: [String], default: [] }
  },
  { _id: false }
);

const DeepFeedbackSchema = new Schema(
  {
    overallSummary: { type: String },
    sectionCoaching: { type: [SectionCoachingSchema], default: [] },
    questionTypeCoaching: { type: [QuestionTypeCoachingSchema], default: [] },
    top5Fixes: { type: [String], default: [] },
    next24hPlan: { type: [String], default: [] },
    next7dPlan: { type: [String], default: [] }
  },
  { _id: false }
);

const WorkspaceStateSchema = new Schema(
  {
    answers: { type: Schema.Types.Mixed },
    activeSectionId: { type: String },
    activeQuestionIndex: { type: Number },
    flaggedQuestionIds: { type: [String], default: [] },
    isPaused: { type: Boolean },
    durationSeconds: { type: Number },
    updatedAt: { type: Date }
  },
  { _id: false }
);

/* ------------------------------------------------------------------ */
/*  Main schema                                                       */
/* ------------------------------------------------------------------ */

const ListeningAttemptSchema = new Schema<IListeningAttempt>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    testId: {
      type: Schema.Types.ObjectId,
      ref: 'ListeningTest',
      required: true,
      index: true
    },
    track: {
      type: String,
      enum: ['academic', 'general'],
      required: true,
      index: true
    },
    schemaVersion: { type: String, enum: ['v1', 'v2'] },
    feedbackVersion: { type: String, enum: ['v1', 'v2'] },
    answers: { type: [ListeningAnswerSchema], default: [] },
    score: { type: Number, default: 0 },
    totalQuestions: { type: Number, default: 0 },
    normalizedBand: { type: Number, default: 0, min: 0, max: 9 },
    durationSeconds: { type: Number, default: 0 },
    feedback: {
      summary: { type: String, default: '' },
      suggestions: { type: [String], default: [] },
      strengths: { type: [String], default: [] },
      improvements: { type: [String], default: [] }
    },
    deepFeedbackReady: { type: Boolean, default: false },
    deepFeedback: { type: DeepFeedbackSchema },
    sectionStats: { type: [SectionStatSchema], default: [] },
    questionTypeStats: { type: [QuestionTypeStatSchema], default: [] },
    workspaceState: { type: WorkspaceStateSchema },
    model: { type: String },
    status: {
      type: String,
      enum: ['in_progress', 'completed'],
      default: 'in_progress',
      index: true
    }
  },
  { timestamps: true }
);

ListeningAttemptSchema.index({ userId: 1, createdAt: -1 });

export const ListeningAttemptModel = model<IListeningAttempt>('ListeningAttempt', ListeningAttemptSchema);
