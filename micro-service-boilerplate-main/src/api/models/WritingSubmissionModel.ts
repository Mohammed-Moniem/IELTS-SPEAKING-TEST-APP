import { HydratedDocument, Schema, Types, model } from '@lib/db/mongooseCompat';
import { IELTSModuleTrack, WritingTaskType } from './WritingTaskModel';

export interface IWritingScoreBreakdown {
  taskResponse: number;
  coherenceCohesion: number;
  lexicalResource: number;
  grammaticalRangeAccuracy: number;
}

export interface IWritingSubmission {
  userId: Types.ObjectId;
  taskId: Types.ObjectId;
  track: IELTSModuleTrack;
  taskType: WritingTaskType;
  responseText: string;
  wordCount: number;
  durationSeconds: number;
  overallBand: number;
  breakdown: IWritingScoreBreakdown;
  feedback: {
    summary: string;
    inlineSuggestions: string[];
    strengths: string[];
    improvements: string[];
  };
  model?: string;
  status: 'submitted' | 'evaluated';
  createdAt: Date;
  updatedAt: Date;
}

export type WritingSubmissionDocument = HydratedDocument<IWritingSubmission>;

const WritingScoreBreakdownSchema = new Schema<IWritingScoreBreakdown>(
  {
    taskResponse: { type: Number, required: true, min: 0, max: 9 },
    coherenceCohesion: { type: Number, required: true, min: 0, max: 9 },
    lexicalResource: { type: Number, required: true, min: 0, max: 9 },
    grammaticalRangeAccuracy: { type: Number, required: true, min: 0, max: 9 }
  },
  { _id: false }
);

const WritingSubmissionSchema = new Schema<IWritingSubmission>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    taskId: {
      type: Schema.Types.ObjectId,
      ref: 'WritingTask',
      required: true,
      index: true
    },
    track: {
      type: String,
      enum: ['academic', 'general'],
      required: true,
      index: true
    },
    taskType: {
      type: String,
      enum: ['task1', 'task2'],
      required: true,
      index: true
    },
    responseText: {
      type: String,
      required: true
    },
    wordCount: {
      type: Number,
      default: 0
    },
    durationSeconds: {
      type: Number,
      default: 0
    },
    overallBand: {
      type: Number,
      required: true,
      min: 0,
      max: 9
    },
    breakdown: {
      type: WritingScoreBreakdownSchema,
      required: true
    },
    feedback: {
      summary: { type: String, required: true },
      inlineSuggestions: { type: [String], default: [] },
      strengths: { type: [String], default: [] },
      improvements: { type: [String], default: [] }
    },
    model: {
      type: String
    },
    status: {
      type: String,
      enum: ['submitted', 'evaluated'],
      default: 'evaluated',
      index: true
    }
  },
  {
    timestamps: true
  }
);

WritingSubmissionSchema.index({ userId: 1, createdAt: -1 });
WritingSubmissionSchema.index({ userId: 1, track: 1, taskType: 1, createdAt: -1 });

export const WritingSubmissionModel = model<IWritingSubmission>('WritingSubmission', WritingSubmissionSchema);
