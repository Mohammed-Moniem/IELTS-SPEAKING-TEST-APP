import { HydratedDocument, Schema, Types, model } from '@lib/db/mongooseCompat';
import { FullTestEvaluationResult } from '@interfaces/ITestEvaluation';
import { IPracticeFeedback } from './PracticeSessionModel';

export type TestSimulationStatus = 'in_progress' | 'completed';
export type SpeakingSessionTurnType = 'examiner' | 'candidate' | 'system';
export type SpeakingSessionSegmentKind =
  | 'fixed_phrase'
  | 'seed_prompt'
  | 'cue_card'
  | 'transition'
  | 'dynamic_follow_up';
export type SpeakingTtsProvider = 'openai' | 'elevenlabs' | 'edge-tts';
export type TestSimulationRuntimeState =
  | 'preflight'
  | 'intro-examiner'
  | 'intro-candidate-turn'
  | 'part1-examiner'
  | 'part1-candidate-turn'
  | 'part1-processing'
  | 'part1-transition'
  | 'part2-intro'
  | 'part2-prep'
  | 'part2-examiner-launch'
  | 'part2-candidate-turn'
  | 'part2-cutoff'
  | 'part2-transition'
  | 'part3-intro'
  | 'part3-examiner'
  | 'part3-candidate-turn'
  | 'part3-processing'
  | 'evaluation'
  | 'completed'
  | 'paused-retryable'
  | 'failed-terminal';
export type TestSimulationRuntimeSegmentKind = 'cached_phrase' | 'dynamic_prompt';

export interface ITestSimulationRuntimeSegment {
  kind: TestSimulationRuntimeSegmentKind;
  phraseId?: string;
  text?: string;
}

export interface ITestSimulationConversationMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ITestSimulationTurnRecord {
  part: number;
  prompt: string;
  transcript?: string;
  durationSeconds?: number;
}

export interface ITestSimulationRuntime {
  state: TestSimulationRuntimeState;
  currentPart: number;
  currentTurnIndex: number;
  retryCount: number;
  retryBudgetRemaining?: number;
  introStep?: 'welcome' | 'id_check' | 'part1_begin';
  seedQuestionIndex?: number;
  followUpCount?: number;
  partFollowUpCount?: number;
  previousState?: TestSimulationRuntimeState;
  lastError?: string;
  failedStep?: string;
  conversationHistory?: ITestSimulationConversationMessage[];
  turnHistory?: ITestSimulationTurnRecord[];
  currentSegment: ITestSimulationRuntimeSegment;
}

export interface ITestSimulationExaminerProfile {
  id: string;
  label: string;
  accent: string;
  provider: SpeakingTtsProvider;
  voiceId: string;
  autoAssigned: boolean;
}

export interface ITestSimulationSessionSegment {
  segmentId: string;
  part: number;
  phase: string;
  kind: SpeakingSessionSegmentKind;
  turnType: SpeakingSessionTurnType;
  canAutoAdvance: boolean;
  phraseId?: string;
  promptIndex?: number;
  text: string;
  audioAssetId: string;
  audioUrl: string;
  cacheKey?: string;
  provider: SpeakingTtsProvider;
  durationSeconds?: number;
}

export interface ITestSimulationSessionPackage {
  version: number;
  preparedAt: Date;
  examinerProfile: ITestSimulationExaminerProfile;
  segments: ITestSimulationSessionSegment[];
}

export interface ITestPart {
  part: number;
  question: string;
  topicId: string;
  topicTitle?: string;
  timeLimit?: number;
  tips?: string[];
  response?: string;
  timeSpent?: number;
  feedback?: IPracticeFeedback;
}

export interface ITestSimulation {
  user: Types.ObjectId;
  status: TestSimulationStatus;
  parts: ITestPart[];
  runtime?: ITestSimulationRuntime;
  sessionPackage?: ITestSimulationSessionPackage;
  overallFeedback?: IPracticeFeedback;
  overallBand?: number;
  fullEvaluation?: FullTestEvaluationResult;
  startedAt: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type TestSimulationDocument = HydratedDocument<ITestSimulation>;

const FeedbackSchema = new Schema<IPracticeFeedback>(
  {
    overallBand: Number,
    bandBreakdown: {
      pronunciation: Number,
      fluency: Number,
      lexicalResource: Number,
      grammaticalRange: Number
    },
    summary: String,
    strengths: [String],
    improvements: [String],
    generatedAt: Date,
    model: String
  },
  { _id: false }
);

const TestPartSchema = new Schema<ITestPart>(
  {
    part: { type: Number, required: true },
    question: { type: String, required: true },
    topicId: { type: String, required: true },
    topicTitle: { type: String },
    timeLimit: { type: Number },
    tips: { type: [String], default: [] },
    response: { type: String },
    timeSpent: { type: Number },
    feedback: { type: FeedbackSchema }
  },
  { _id: false }
);

const RuntimeSegmentSchema = new Schema<ITestSimulationRuntimeSegment>(
  {
    kind: {
      type: String,
      enum: ['cached_phrase', 'dynamic_prompt'],
      required: true
    },
    phraseId: { type: String },
    text: { type: String }
  },
  { _id: false }
);

const RuntimeSchema = new Schema<ITestSimulationRuntime>(
  {
    state: {
      type: String,
      enum: [
        'preflight',
        'intro-examiner',
        'intro-candidate-turn',
        'part1-examiner',
        'part1-candidate-turn',
        'part1-processing',
        'part1-transition',
        'part2-intro',
        'part2-prep',
        'part2-examiner-launch',
        'part2-candidate-turn',
        'part2-cutoff',
        'part2-transition',
        'part3-intro',
        'part3-examiner',
        'part3-candidate-turn',
        'part3-processing',
        'evaluation',
        'completed',
        'paused-retryable',
        'failed-terminal'
      ],
      required: true
    },
    currentPart: { type: Number, required: true, default: 0 },
    currentTurnIndex: { type: Number, required: true, default: 0 },
    retryCount: { type: Number, required: true, default: 0 },
    retryBudgetRemaining: { type: Number, default: 1 },
    introStep: {
      type: String,
      enum: ['welcome', 'id_check', 'part1_begin']
    },
    seedQuestionIndex: { type: Number, default: 0 },
    followUpCount: { type: Number, default: 0 },
    partFollowUpCount: { type: Number, default: 0 },
    previousState: {
      type: String,
      enum: [
        'preflight',
        'intro-examiner',
        'intro-candidate-turn',
        'part1-examiner',
        'part1-candidate-turn',
        'part1-processing',
        'part1-transition',
        'part2-intro',
        'part2-prep',
        'part2-examiner-launch',
        'part2-candidate-turn',
        'part2-cutoff',
        'part2-transition',
        'part3-intro',
        'part3-examiner',
        'part3-candidate-turn',
        'part3-processing',
        'evaluation',
        'completed',
        'paused-retryable',
        'failed-terminal'
      ]
    },
    lastError: { type: String },
    failedStep: { type: String },
    conversationHistory: { type: [Schema.Types.Mixed], default: [] },
    turnHistory: { type: [Schema.Types.Mixed], default: [] },
    currentSegment: { type: RuntimeSegmentSchema, required: true }
  },
  { _id: false }
);

const SessionExaminerProfileSchema = new Schema<ITestSimulationExaminerProfile>(
  {
    id: { type: String, required: true },
    label: { type: String, required: true },
    accent: { type: String, required: true },
    provider: {
      type: String,
      enum: ['openai', 'elevenlabs', 'edge-tts'],
      required: true
    },
    voiceId: { type: String, required: true },
    autoAssigned: { type: Boolean, default: true }
  },
  { _id: false }
);

const SessionSegmentSchema = new Schema<ITestSimulationSessionSegment>(
  {
    segmentId: { type: String, required: true },
    part: { type: Number, required: true },
    phase: { type: String, required: true },
    kind: {
      type: String,
      enum: ['fixed_phrase', 'seed_prompt', 'cue_card', 'transition', 'dynamic_follow_up'],
      required: true
    },
    turnType: {
      type: String,
      enum: ['examiner', 'candidate', 'system'],
      required: true
    },
    canAutoAdvance: { type: Boolean, default: false },
    phraseId: { type: String },
    promptIndex: { type: Number },
    text: { type: String, required: true },
    audioAssetId: { type: String, required: true },
    audioUrl: { type: String, required: true },
    cacheKey: { type: String },
    provider: {
      type: String,
      enum: ['openai', 'elevenlabs', 'edge-tts'],
      required: true
    },
    durationSeconds: { type: Number }
  },
  { _id: false }
);

const SessionPackageSchema = new Schema<ITestSimulationSessionPackage>(
  {
    version: { type: Number, required: true, default: 1 },
    preparedAt: { type: Date, required: true, default: () => new Date() },
    examinerProfile: { type: SessionExaminerProfileSchema, required: true },
    segments: { type: [SessionSegmentSchema], default: [] }
  },
  { _id: false }
);

const TestSimulationSchema = new Schema<ITestSimulation>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: ['in_progress', 'completed'],
      default: 'in_progress'
    },
    parts: {
      type: [TestPartSchema],
      validate: {
        validator: (parts: ITestPart[]) => Array.isArray(parts) && parts.length > 0,
        message: 'Test simulation must include at least one part'
      }
    },
    runtime: {
      type: RuntimeSchema
    },
    sessionPackage: {
      type: SessionPackageSchema
    },
    overallFeedback: {
      type: FeedbackSchema
    },
    overallBand: {
      type: Number
    },
    fullEvaluation: {
      type: Schema.Types.Mixed
    },
    startedAt: {
      type: Date,
      default: () => new Date()
    },
    completedAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

export const TestSimulationModel = model<ITestSimulation>('TestSimulation', TestSimulationSchema);
