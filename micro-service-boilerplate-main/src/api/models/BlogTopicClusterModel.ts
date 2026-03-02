import { HydratedDocument, Schema, model } from '@lib/db/mongooseCompat';

export interface IBlogTopicCluster {
  key: string;
  name: string;
  description?: string;
  priority: number;
  active: boolean;
  refreshCadenceDays: number;
  createdAt: Date;
  updatedAt: Date;
}

export type BlogTopicClusterDocument = HydratedDocument<IBlogTopicCluster>;

const BlogTopicClusterSchema = new Schema<IBlogTopicCluster>(
  {
    key: { type: String, required: true, trim: true, maxlength: 120, index: true },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, trim: true, maxlength: 1000 },
    priority: { type: Number, default: 100 },
    active: { type: Boolean, default: true, index: true },
    refreshCadenceDays: { type: Number, default: 30 }
  },
  { timestamps: true }
);

BlogTopicClusterSchema.index({ key: 1 }, { unique: true });

export const BlogTopicClusterModel = model<IBlogTopicCluster>('BlogTopicCluster', BlogTopicClusterSchema);
