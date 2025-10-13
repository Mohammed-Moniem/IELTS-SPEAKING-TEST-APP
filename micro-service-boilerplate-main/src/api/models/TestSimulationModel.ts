import { HydratedDocument, Schema, Types, model } from 'mongoose';
import { IPracticeFeedback } from './PracticeSessionModel';

export type TestSimulationStatus = 'in_progress' | 'completed';

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
  overallFeedback?: IPracticeFeedback;
  overallBand?: number;
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
    overallFeedback: {
      type: FeedbackSchema
    },
    overallBand: {
      type: Number
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
