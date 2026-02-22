import { HydratedDocument, Schema, model } from '@lib/db/mongooseCompat';

export interface IFeatureFlag {
  key: string;
  description?: string;
  enabled: boolean;
  rolloutPercentage: number;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export type FeatureFlagDocument = HydratedDocument<IFeatureFlag>;

const FeatureFlagSchema = new Schema<IFeatureFlag>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true
    },
    description: {
      type: String
    },
    enabled: {
      type: Boolean,
      default: false,
      index: true
    },
    rolloutPercentage: {
      type: Number,
      default: 100,
      min: 0,
      max: 100
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true
  }
);

export const FeatureFlagModel = model<IFeatureFlag>('FeatureFlag', FeatureFlagSchema);
