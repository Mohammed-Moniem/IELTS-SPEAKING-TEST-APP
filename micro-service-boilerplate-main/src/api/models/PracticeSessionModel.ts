import { HydratedDocument, Schema, Types, model } from 'mongoose';

export type PracticeSessionStatus = 'in_progress' | 'completed';

export interface IBandBreakdown {
  pronunciation?: number;
  fluency?: number;
  lexicalResource?: number;
  grammaticalRange?: number;
}

export interface IPracticeFeedback {
  overallBand?: number;
  bandBreakdown?: IBandBreakdown;
  summary?: string;
  strengths?: string[];
  improvements?: string[];
  generatedAt?: Date;
  model?: string;
}

export interface IPracticeSession {
  user: Types.ObjectId;
  topicId: string;
  topicTitle: string;
  question: string;
  part: number;
  category?: string;
  difficulty?: string;
  status: PracticeSessionStatus;
  userResponse?: string;
  timeSpent?: number;
  feedback?: IPracticeFeedback;
  startedAt: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type PracticeSessionDocument = HydratedDocument<IPracticeSession>;

const PracticeSessionSchema = new Schema<IPracticeSession>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    topicId: {
      type: String,
      required: true,
      index: true
    },
    topicTitle: {
      type: String,
      required: true
    },
    question: {
      type: String,
      required: true
    },
    part: {
      type: Number,
      required: true
    },
    category: {
      type: String
    },
    difficulty: {
      type: String
    },
    status: {
      type: String,
      enum: ['in_progress', 'completed'],
      default: 'in_progress'
    },
    userResponse: {
      type: String
    },
    timeSpent: {
      type: Number
    },
    feedback: {
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

export const PracticeSessionModel = model<PracticeSessionDocument>('PracticeSession', PracticeSessionSchema);
