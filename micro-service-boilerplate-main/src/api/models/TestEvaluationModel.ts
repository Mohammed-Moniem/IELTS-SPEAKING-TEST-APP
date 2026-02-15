import { model, Schema, Document, Types } from 'mongoose';

export interface ICriteriaScore {
  band: number;
  feedback: string;
  strengths: string[];
  improvements: string[];
}

export interface ICorrection {
  original: string;
  corrected: string;
  explanation: string;
  category: string; // grammar, vocabulary, pronunciation
}

export interface ISuggestion {
  category: string;
  suggestion: string;
  priority: 'high' | 'medium' | 'low';
}

export interface ITestEvaluation {
  testSessionId: Types.ObjectId;
  userId: string;
  overallBand: number;
  criteria: {
    fluencyCoherence: ICriteriaScore;
    lexicalResource: ICriteriaScore;
    grammaticalRange: ICriteriaScore;
    pronunciation: ICriteriaScore;
  };
  spokenSummary: string;
  detailedFeedback: string;
  corrections: ICorrection[];
  suggestions: ISuggestion[];
  evaluatedAt: Date;
  evaluatedBy: 'ai' | 'human';
  evaluatorModel?: string; // e.g., "gpt-4", "claude-3"
  partScores?: {
    part1?: number;
    part2?: number;
    part3?: number;
  };
}

export interface ITestEvaluationDocument extends ITestEvaluation, Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CriteriaScoreSchema = new Schema<ICriteriaScore>(
  {
    band: {
      type: Number,
      required: true,
      min: 0,
      max: 9
    },
    feedback: {
      type: String,
      required: true
    },
    strengths: {
      type: [String],
      default: []
    },
    improvements: {
      type: [String],
      default: []
    }
  },
  { _id: false }
);

const CorrectionSchema = new Schema<ICorrection>(
  {
    original: {
      type: String,
      required: true
    },
    corrected: {
      type: String,
      required: true
    },
    explanation: {
      type: String,
      required: true
    },
    category: {
      type: String,
      required: true
    }
  },
  { _id: false }
);

const SuggestionSchema = new Schema<ISuggestion>(
  {
    category: {
      type: String,
      required: true
    },
    suggestion: {
      type: String,
      required: true
    },
    priority: {
      type: String,
      enum: ['high', 'medium', 'low'],
      default: 'medium'
    }
  },
  { _id: false }
);

const TestEvaluationSchema = new Schema<ITestEvaluationDocument>(
  {
    testSessionId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'TestSession',
      index: true,
      unique: true
    },
    userId: {
      type: String,
      required: true,
      index: true
    },
    overallBand: {
      type: Number,
      required: true,
      min: 0,
      max: 9,
      index: true
    },
    criteria: {
      fluencyCoherence: {
        type: CriteriaScoreSchema,
        required: true
      },
      lexicalResource: {
        type: CriteriaScoreSchema,
        required: true
      },
      grammaticalRange: {
        type: CriteriaScoreSchema,
        required: true
      },
      pronunciation: {
        type: CriteriaScoreSchema,
        required: true
      }
    },
    spokenSummary: {
      type: String,
      required: true
    },
    detailedFeedback: {
      type: String,
      required: true
    },
    corrections: {
      type: [CorrectionSchema],
      default: []
    },
    suggestions: {
      type: [SuggestionSchema],
      default: []
    },
    evaluatedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true
    },
    evaluatedBy: {
      type: String,
      enum: ['ai', 'human'],
      required: true,
      default: 'ai'
    },
    evaluatorModel: {
      type: String
    },
    partScores: {
      part1: Number,
      part2: Number,
      part3: Number
    }
  },
  {
    timestamps: true,
    collection: 'testevaluations'
  }
);

// Compound indexes for efficient queries
TestEvaluationSchema.index({ userId: 1, evaluatedAt: -1 });
TestEvaluationSchema.index({ userId: 1, overallBand: -1 });

export const TestEvaluationModel = model<ITestEvaluationDocument>('TestEvaluation', TestEvaluationSchema);
