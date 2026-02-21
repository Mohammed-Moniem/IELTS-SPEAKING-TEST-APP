import { Document, model, Schema } from '@lib/db/mongooseCompat';

export interface IPart1Question {
  topic: string;
  questions: string[];
  timeLimit: number;
}

export interface IPart2CueCard {
  topic: string;
  mainPrompt: string;
  bulletPoints: string[];
  preparationTime: number;
  responseTime: number;
}

export interface IPart3Question {
  topic: string;
  questions: string[];
  timeLimit: number;
}

export interface IGeneratedQuestion extends Document {
  userId: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  part1: IPart1Question;
  part2: IPart2CueCard;
  part3: IPart3Question;
  generatedAt: Date;
  expiresAt: Date;
  used: boolean;
}

const GeneratedQuestionSchema = new Schema<IGeneratedQuestion>(
  {
    userId: { type: String, required: true, index: true },
    difficulty: { type: String, enum: ['beginner', 'intermediate', 'advanced'], required: true },
    part1: {
      topic: { type: String, required: true },
      questions: [{ type: String }],
      timeLimit: { type: Number, default: 60 }
    },
    part2: {
      topic: { type: String, required: true },
      mainPrompt: { type: String, required: true },
      bulletPoints: [{ type: String }],
      preparationTime: { type: Number, default: 60 },
      responseTime: { type: Number, default: 120 }
    },
    part3: {
      topic: { type: String, required: true },
      questions: [{ type: String }],
      timeLimit: { type: Number, default: 90 }
    },
    generatedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    used: { type: Boolean, default: false }
  },
  {
    timestamps: true
  }
);

// Index for cleanup of expired questions
GeneratedQuestionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const GeneratedQuestionModel = model<IGeneratedQuestion>('GeneratedQuestion', GeneratedQuestionSchema);
