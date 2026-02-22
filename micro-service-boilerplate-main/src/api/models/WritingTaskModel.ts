import { HydratedDocument, Schema, Types, model } from '@lib/db/mongooseCompat';

export type IELTSModuleTrack = 'academic' | 'general';
export type WritingTaskType = 'task1' | 'task2';

export interface IWritingTask {
  track: IELTSModuleTrack;
  taskType: WritingTaskType;
  title: string;
  prompt: string;
  instructions: string[];
  suggestedTimeMinutes: number;
  minimumWords: number;
  tags: string[];
  source: 'bank' | 'ai';
  autoPublished: boolean;
  active: boolean;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type WritingTaskDocument = HydratedDocument<IWritingTask>;

const WritingTaskSchema = new Schema<IWritingTask>(
  {
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
    title: {
      type: String,
      required: true,
      trim: true
    },
    prompt: {
      type: String,
      required: true,
      trim: true
    },
    instructions: {
      type: [String],
      default: []
    },
    suggestedTimeMinutes: {
      type: Number,
      default: 20,
      min: 1
    },
    minimumWords: {
      type: Number,
      default: 150,
      min: 1
    },
    tags: {
      type: [String],
      default: []
    },
    source: {
      type: String,
      enum: ['bank', 'ai'],
      default: 'bank'
    },
    autoPublished: {
      type: Boolean,
      default: true
    },
    active: {
      type: Boolean,
      default: true,
      index: true
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true
  }
);

WritingTaskSchema.index({ track: 1, taskType: 1, active: 1, updatedAt: -1 });

export const WritingTaskModel = model<IWritingTask>('WritingTask', WritingTaskSchema);
