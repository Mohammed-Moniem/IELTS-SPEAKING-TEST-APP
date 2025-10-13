import { HydratedDocument, Schema, model } from 'mongoose';

export interface ITopic {
  slug: string;
  title: string;
  description: string;
  part: number;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  isPremium: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type TopicDocument = HydratedDocument<ITopic>;

const TopicSchema = new Schema<ITopic>(
  {
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    title: {
      type: String,
      required: true
    },
    description: {
      type: String,
      required: true
    },
    part: {
      type: Number,
      required: true
    },
    category: {
      type: String,
      required: true
    },
    difficulty: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced'],
      required: true
    },
    isPremium: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

export const TopicModel = model<ITopic>('Topic', TopicSchema);
