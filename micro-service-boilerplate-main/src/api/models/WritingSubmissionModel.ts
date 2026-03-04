import { HydratedDocument, Schema, Types, model } from '@lib/db/mongooseCompat';
import { IELTSModuleTrack, WritingTaskType } from './WritingTaskModel';

export interface IWritingScoreBreakdown {
  taskResponse: number;
  coherenceCohesion: number;
  lexicalResource: number;
  grammaticalRangeAccuracy: number;
}

export interface IWritingEvidenceItem {
  issue: string;
  quotedText: string;
  whyItCostsBand: string;
  revision: string;
  whyRevisionIsBetter: string;
  practiceInstruction: string;
}

export interface IWritingBandUpgradeExamples {
  nextBandSnippet: string;
  band9Snippet: string;
  differenceNotes: string[];
}

export interface IWritingCriterionFeedback {
  band: number;
  descriptorSummary: string;
  strengths: string[];
  limitations: string[];
  evidence: IWritingEvidenceItem[];
  whyNotHigher: string[];
  howToReach8: string[];
  howToReach9: string[];
  targetedDrills: string[];
  commonExaminerPenaltyTriggers: string[];
  bandUpgradeExamples?: IWritingBandUpgradeExamples;
}

export interface IWritingOverallFeedback {
  band: number;
  label: string;
  examinerSummary: string;
  whyThisBand: string[];
  bandGapTo8: string[];
  bandGapTo9: string[];
  priorityOrder: string[];
  nextSteps24h: string[];
  nextSteps7d: string[];
  nextSteps14d: string[];
}

export interface IWritingSubmission {
  userId: Types.ObjectId;
  taskId: Types.ObjectId;
  taskSnapshot?: {
    taskId: string;
    track: IELTSModuleTrack;
    taskType: WritingTaskType;
    title: string;
    prompt: string;
    instructions: string[];
    suggestedTimeMinutes: number;
    minimumWords: number;
    tags: string[];
  };
  track: IELTSModuleTrack;
  taskType: WritingTaskType;
  responseText: string;
  wordCount: number;
  durationSeconds: number;
  overallBand: number;
  breakdown: IWritingScoreBreakdown;
  feedbackVersion: 'v1' | 'v2';
  deepFeedbackReady: boolean;
  feedback: {
    summary: string;
    inlineSuggestions: string[];
    strengths: string[];
    improvements: string[];
    overall?: IWritingOverallFeedback;
    criteria?: {
      taskAchievementOrResponse: IWritingCriterionFeedback;
      coherenceCohesion: IWritingCriterionFeedback;
      lexicalResource: IWritingCriterionFeedback;
      grammaticalRangeAccuracy: IWritingCriterionFeedback;
    };
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

const WritingEvidenceItemSchema = new Schema<IWritingEvidenceItem>(
  {
    issue: { type: String, default: '' },
    quotedText: { type: String, default: '' },
    whyItCostsBand: { type: String, default: '' },
    revision: { type: String, default: '' },
    whyRevisionIsBetter: { type: String, default: '' },
    practiceInstruction: { type: String, default: '' }
  },
  { _id: false }
);

const WritingBandUpgradeExamplesSchema = new Schema<IWritingBandUpgradeExamples>(
  {
    nextBandSnippet: { type: String, default: '' },
    band9Snippet: { type: String, default: '' },
    differenceNotes: { type: [String], default: [] }
  },
  { _id: false }
);

const WritingCriterionFeedbackSchema = new Schema<IWritingCriterionFeedback>(
  {
    band: { type: Number, required: true, min: 0, max: 9 },
    descriptorSummary: { type: String, default: '' },
    strengths: { type: [String], default: [] },
    limitations: { type: [String], default: [] },
    evidence: { type: [WritingEvidenceItemSchema], default: [] },
    whyNotHigher: { type: [String], default: [] },
    howToReach8: { type: [String], default: [] },
    howToReach9: { type: [String], default: [] },
    targetedDrills: { type: [String], default: [] },
    commonExaminerPenaltyTriggers: { type: [String], default: [] },
    bandUpgradeExamples: { type: WritingBandUpgradeExamplesSchema, default: undefined }
  },
  { _id: false }
);

const WritingOverallFeedbackSchema = new Schema<IWritingOverallFeedback>(
  {
    band: { type: Number, required: true, min: 0, max: 9 },
    label: { type: String, default: '' },
    examinerSummary: { type: String, default: '' },
    whyThisBand: { type: [String], default: [] },
    bandGapTo8: { type: [String], default: [] },
    bandGapTo9: { type: [String], default: [] },
    priorityOrder: { type: [String], default: [] },
    nextSteps24h: { type: [String], default: [] },
    nextSteps7d: { type: [String], default: [] },
    nextSteps14d: { type: [String], default: [] }
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
    taskSnapshot: {
      taskId: { type: String, default: '' },
      track: {
        type: String,
        enum: ['academic', 'general']
      },
      taskType: {
        type: String,
        enum: ['task1', 'task2']
      },
      title: { type: String, default: '' },
      prompt: { type: String, default: '' },
      instructions: { type: [String], default: [] },
      suggestedTimeMinutes: { type: Number, default: 0 },
      minimumWords: { type: Number, default: 0 },
      tags: { type: [String], default: [] }
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
    feedbackVersion: {
      type: String,
      enum: ['v1', 'v2'],
      default: 'v1',
      index: true
    },
    deepFeedbackReady: {
      type: Boolean,
      default: false,
      index: true
    },
    feedback: {
      summary: { type: String, required: true },
      inlineSuggestions: { type: [String], default: [] },
      strengths: { type: [String], default: [] },
      improvements: { type: [String], default: [] },
      overall: { type: WritingOverallFeedbackSchema, default: undefined },
      criteria: {
        taskAchievementOrResponse: { type: WritingCriterionFeedbackSchema, default: undefined },
        coherenceCohesion: { type: WritingCriterionFeedbackSchema, default: undefined },
        lexicalResource: { type: WritingCriterionFeedbackSchema, default: undefined },
        grammaticalRangeAccuracy: { type: WritingCriterionFeedbackSchema, default: undefined }
      }
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
WritingSubmissionSchema.index({ userId: 1, feedbackVersion: 1, deepFeedbackReady: 1, createdAt: -1 });

export const WritingSubmissionModel = model<IWritingSubmission>('WritingSubmission', WritingSubmissionSchema);
