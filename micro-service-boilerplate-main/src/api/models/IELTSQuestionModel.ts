import { Document, Schema, model } from 'mongoose';

export type IELTSQuestionCategory = 'part1' | 'part2' | 'part3';
export type IELTSQuestionDifficulty = 'easy' | 'medium' | 'hard';

export interface IIELTSCueCard {
  mainTopic?: string;
  bulletPoints?: string[];
  preparationTime?: number;
  timeToSpeak?: number;
}

export interface IIELTSQuestion {
  category: IELTSQuestionCategory;
  difficulty: IELTSQuestionDifficulty;
  question: string;
  followUpQuestions?: string[];
  cueCard?: IIELTSCueCard;
  relatedTopics?: string[];
  keywords?: string[];
  topic: string;
  source?: string;
  timesUsed: number;
  lastUsedAt?: Date;
  verified?: boolean;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IELTSQuestionDocument extends Document, IIELTSQuestion {}

const CueCardSchema = new Schema<IIELTSCueCard>(
  {
    mainTopic: { type: String },
    bulletPoints: [{ type: String }],
    preparationTime: { type: Number, default: 60 },
    timeToSpeak: { type: Number, default: 120 }
  },
  { _id: false }
);

const IELTSQuestionSchema = new Schema<IELTSQuestionDocument>(
  {
    category: {
      type: String,
      enum: ['part1', 'part2', 'part3'],
      required: true,
      index: true
    },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      required: true,
      index: true
    },
    question: {
      type: String,
      required: true
    },
    followUpQuestions: [{ type: String }],
    cueCard: CueCardSchema,
    relatedTopics: [{ type: String }],
    keywords: [{ type: String }],
    topic: {
      type: String,
      required: true,
      index: true
    },
    source: { type: String },
    timesUsed: {
      type: Number,
      default: 0,
      index: true
    },
    lastUsedAt: {
      type: Date,
      index: true
    },
    verified: {
      type: Boolean,
      default: false
    },
    active: {
      type: Boolean,
      default: true,
      index: true
    }
  },
  {
    timestamps: true
  }
);

IELTSQuestionSchema.index({ category: 1, difficulty: 1, active: 1 });
IELTSQuestionSchema.index({ topic: 1, active: 1 });
IELTSQuestionSchema.index({ keywords: 1 });
IELTSQuestionSchema.index({ timesUsed: 1, lastUsedAt: 1 });
IELTSQuestionSchema.index({ question: 'text', keywords: 'text' });

export const IELTSQuestionModel = model<IELTSQuestionDocument>('IELTSQuestion', IELTSQuestionSchema);
