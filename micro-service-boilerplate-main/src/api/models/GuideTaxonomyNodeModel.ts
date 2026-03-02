import { HydratedDocument, Schema, model } from '@lib/db/mongooseCompat';
import { GuideContentClass, GuideModule } from './GuidePageModel';

export interface IGuideTaxonomyNode {
  key: string;
  name: string;
  slug: string;
  parentKey?: string;
  module: GuideModule;
  contentClass: GuideContentClass;
  order: number;
  depth: number;
  description?: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type GuideTaxonomyNodeDocument = HydratedDocument<IGuideTaxonomyNode>;

const GuideTaxonomyNodeSchema = new Schema<IGuideTaxonomyNode>(
  {
    key: { type: String, required: true, trim: true, maxlength: 140, index: true },
    name: { type: String, required: true, trim: true, maxlength: 180 },
    slug: { type: String, required: true, trim: true, maxlength: 200, index: true },
    parentKey: { type: String, trim: true, maxlength: 140, index: true },
    module: {
      type: String,
      enum: [
        'speaking',
        'writing',
        'reading',
        'listening',
        'vocabulary',
        'exam-strategy',
        'band-scores',
        'resources',
        'faq',
        'updates',
        'offers',
        'membership'
      ],
      required: true,
      index: true
    },
    contentClass: {
      type: String,
      enum: ['class_a_core_learning', 'class_b_reference', 'class_c_updates_promo'],
      default: 'class_a_core_learning',
      index: true
    },
    order: { type: Number, default: 100, min: 0, max: 9999 },
    depth: { type: Number, default: 1, min: 1, max: 8 },
    description: { type: String, trim: true, maxlength: 1000 },
    active: { type: Boolean, default: true, index: true }
  },
  { timestamps: true }
);

GuideTaxonomyNodeSchema.index({ key: 1 }, { unique: true });
GuideTaxonomyNodeSchema.index({ parentKey: 1, order: 1 });

export const GuideTaxonomyNodeModel = model<IGuideTaxonomyNode>('GuideTaxonomyNode', GuideTaxonomyNodeSchema);
