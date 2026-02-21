import { model, Schema, Document, Types } from '@lib/db/mongooseCompat';

export interface ITestRecording {
  partNumber: 1 | 2 | 3;
  questionIndex: number;
  transcript: string;
  duration: number; // seconds
  recordingUrl?: string;
  audioData?: string; // base64 encoded audio if needed
}

export interface ITestQuestion {
  questionId: Types.ObjectId;
  question: string;
  category: 'part1' | 'part2' | 'part3';
  difficulty: 'easy' | 'medium' | 'hard';
  topic?: string;
}

export interface ITestSession {
  userId: string;
  testType: 'practice' | 'full-test';
  part: 1 | 2 | 3 | 'full';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  startedAt: Date;
  completedAt?: Date;
  duration: number; // seconds
  questions: ITestQuestion[];
  recordings: ITestRecording[];
  fullTranscript: string;
  evaluationId?: Types.ObjectId;
  status: 'in-progress' | 'completed' | 'abandoned';
  metadata?: {
    deviceInfo?: string;
    appVersion?: string;
    [key: string]: any;
  };
}

export interface ITestSessionDocument extends ITestSession, Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const TestQuestionSchema = new Schema<ITestQuestion>(
  {
    questionId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'IELTSQuestion'
    },
    question: {
      type: String,
      required: true
    },
    category: {
      type: String,
      enum: ['part1', 'part2', 'part3'],
      required: true
    },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      required: true
    },
    topic: {
      type: String
    }
  },
  { _id: false }
);

const TestRecordingSchema = new Schema<ITestRecording>(
  {
    partNumber: {
      type: Number,
      required: true,
      enum: [1, 2, 3]
    },
    questionIndex: {
      type: Number,
      required: true
    },
    transcript: {
      type: String,
      required: true
    },
    duration: {
      type: Number,
      required: true
    },
    recordingUrl: {
      type: String
    },
    audioData: {
      type: String
    }
  },
  { _id: false }
);

const TestSessionSchema = new Schema<ITestSessionDocument>(
  {
    userId: {
      type: String,
      required: true,
      index: true
    },
    testType: {
      type: String,
      enum: ['practice', 'full-test'],
      required: true,
      index: true
    },
    part: {
      type: Schema.Types.Mixed,
      required: true
    },
    difficulty: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced'],
      required: true
    },
    startedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true
    },
    completedAt: {
      type: Date,
      index: true
    },
    duration: {
      type: Number,
      required: true,
      default: 0
    },
    questions: {
      type: [TestQuestionSchema],
      required: true,
      default: []
    },
    recordings: {
      type: [TestRecordingSchema],
      required: true,
      default: []
    },
    fullTranscript: {
      type: String,
      required: true,
      default: ''
    },
    evaluationId: {
      type: Schema.Types.ObjectId,
      ref: 'TestEvaluation'
    },
    status: {
      type: String,
      enum: ['in-progress', 'completed', 'abandoned'],
      required: true,
      default: 'in-progress',
      index: true
    },
    metadata: {
      type: Schema.Types.Mixed
    }
  },
  {
    timestamps: true,
    collection: 'testsessions'
  }
);

// Compound indexes for efficient queries
TestSessionSchema.index({ userId: 1, startedAt: -1 });
TestSessionSchema.index({ userId: 1, status: 1 });
TestSessionSchema.index({ userId: 1, testType: 1, completedAt: -1 });

export const TestSessionModel = model<ITestSessionDocument>('TestSession', TestSessionSchema);
