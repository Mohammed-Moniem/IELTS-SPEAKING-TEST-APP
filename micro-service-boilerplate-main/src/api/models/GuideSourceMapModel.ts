import { HydratedDocument, Schema, model } from '@lib/db/mongooseCompat';
import { GuideContentClass, GuideModule, GuidePageType, GuideState, GuideTemplateType } from './GuidePageModel';

export interface IGuideSourceMap {
  sourceUrl: string;
  sourceType: 'page' | 'post' | 'misc';
  lastmod?: string;
  title?: string;
  h1?: string;
  h2List: string[];
  internalLinks: string[];
  moduleGuess?: GuideModule;
  intent: 'informational' | 'commercial' | 'transactional' | 'navigational';
  contentClass: GuideContentClass;
  destinationPath: string;
  templateType: GuideTemplateType;
  module: GuideModule;
  pageType: GuidePageType;
  priority: number;
  publishWave: 1 | 2 | 3;
  status: GuideState;
  editorOwner?: string;
  inventoryDate: string;
  createdAt: Date;
  updatedAt: Date;
}

export type GuideSourceMapDocument = HydratedDocument<IGuideSourceMap>;

const GuideSourceMapSchema = new Schema<IGuideSourceMap>(
  {
    sourceUrl: { type: String, required: true, trim: true, maxlength: 2000, index: true },
    sourceType: { type: String, enum: ['page', 'post', 'misc'], default: 'post', index: true },
    lastmod: { type: String, trim: true, maxlength: 64 },
    title: { type: String, trim: true, maxlength: 220 },
    h1: { type: String, trim: true, maxlength: 260 },
    h2List: [{ type: String, trim: true }],
    internalLinks: [{ type: String, trim: true }],
    moduleGuess: {
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
      ]
    },
    intent: {
      type: String,
      enum: ['informational', 'commercial', 'transactional', 'navigational'],
      default: 'informational'
    },
    contentClass: {
      type: String,
      enum: ['class_a_core_learning', 'class_b_reference', 'class_c_updates_promo'],
      default: 'class_a_core_learning'
    },
    destinationPath: { type: String, required: true, trim: true, maxlength: 320, index: true },
    templateType: {
      type: String,
      enum: [
        'ModuleHubTemplate',
        'QuestionBankTemplate',
        'LessonTemplate',
        'ModelAnswerTemplate',
        'FAQReferenceTemplate',
        'UpdateTemplate',
        'OfferTemplate',
        'MembershipInfoTemplate'
      ],
      default: 'LessonTemplate'
    },
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
    pageType: {
      type: String,
      enum: ['module_hub', 'question_bank', 'lesson', 'model_answer', 'faq_reference', 'update', 'offer', 'membership_info'],
      default: 'lesson'
    },
    priority: { type: Number, default: 100 },
    publishWave: { type: Number, enum: [1, 2, 3], default: 2, index: true },
    status: {
      type: String,
      enum: ['inventory', 'mapped', 'outline_ready', 'drafting', 'review', 'qa_passed', 'published', 'archived'],
      default: 'inventory',
      index: true
    },
    editorOwner: { type: String, trim: true, maxlength: 120 },
    inventoryDate: { type: String, required: true, trim: true, maxlength: 32, index: true }
  },
  { timestamps: true }
);

GuideSourceMapSchema.index({ sourceUrl: 1 }, { unique: true });
GuideSourceMapSchema.index({ module: 1, status: 1, updatedAt: -1 });

export const GuideSourceMapModel = model<IGuideSourceMap>('GuideSourceMap', GuideSourceMapSchema);
