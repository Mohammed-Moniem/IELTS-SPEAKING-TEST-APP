import { HydratedDocument, Schema, Types, model } from '@lib/db/mongooseCompat';
import { IELTSModuleTrack } from './WritingTaskModel';

export type IELTSModule = 'speaking' | 'writing' | 'reading' | 'listening';

export interface IExamSectionState {
  module: IELTSModule;
  status: 'pending' | 'in_progress' | 'completed';
  attemptId?: string;
  score?: number;
  submittedAt?: Date;
}

export interface IFullExamRuntimeState {
  currentModule?: IELTSModule;
  currentQuestionIndex?: number;
  remainingSecondsByModule?: Partial<Record<IELTSModule, number>>;
  interruptedAt?: Date;
  lastHeartbeatAt?: Date;
  resumeToken?: string;
}

export interface IFullExamSession {
  userId: Types.ObjectId;
  track: IELTSModuleTrack;
  status: 'in_progress' | 'completed';
  sections: IExamSectionState[];
  runtime?: IFullExamRuntimeState;
  overallBand?: number;
  startedAt: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type FullExamSessionDocument = HydratedDocument<IFullExamSession>;

const ExamSectionStateSchema = new Schema<IExamSectionState>(
  {
    module: {
      type: String,
      enum: ['speaking', 'writing', 'reading', 'listening'],
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed'],
      default: 'pending'
    },
    attemptId: { type: String },
    score: { type: Number, min: 0, max: 9 },
    submittedAt: { type: Date }
  },
  { _id: false }
);

const FullExamRuntimeSchema = new Schema<IFullExamRuntimeState>(
  {
    currentModule: {
      type: String,
      enum: ['speaking', 'writing', 'reading', 'listening']
    },
    currentQuestionIndex: { type: Number, min: 0 },
    remainingSecondsByModule: {
      speaking: { type: Number, min: 0 },
      writing: { type: Number, min: 0 },
      reading: { type: Number, min: 0 },
      listening: { type: Number, min: 0 }
    },
    interruptedAt: { type: Date },
    lastHeartbeatAt: { type: Date },
    resumeToken: { type: String }
  },
  { _id: false }
);

const FullExamSessionSchema = new Schema<IFullExamSession>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    track: {
      type: String,
      enum: ['academic', 'general'],
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: ['in_progress', 'completed'],
      default: 'in_progress',
      index: true
    },
    sections: {
      type: [ExamSectionStateSchema],
      default: []
    },
    runtime: {
      type: FullExamRuntimeSchema,
      default: {}
    },
    overallBand: {
      type: Number,
      min: 0,
      max: 9
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

FullExamSessionSchema.index({ userId: 1, createdAt: -1 });

export const FullExamSessionModel = model<IFullExamSession>('FullExamSession', FullExamSessionSchema);
