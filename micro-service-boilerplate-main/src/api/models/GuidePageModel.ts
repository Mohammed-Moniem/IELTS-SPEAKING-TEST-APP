import { HydratedDocument, Schema, Types, model } from '@lib/db/mongooseCompat';

export type GuideState =
  | 'inventory'
  | 'mapped'
  | 'outline_ready'
  | 'drafting'
  | 'review'
  | 'qa_passed'
  | 'published'
  | 'archived';

export type GuideModule =
  | 'speaking'
  | 'writing'
  | 'reading'
  | 'listening'
  | 'vocabulary'
  | 'exam-strategy'
  | 'band-scores'
  | 'resources'
  | 'faq'
  | 'updates'
  | 'offers'
  | 'membership';

export type GuideTrack = 'academic' | 'general' | 'both';

export type GuidePageType =
  | 'module_hub'
  | 'question_bank'
  | 'lesson'
  | 'model_answer'
  | 'faq_reference'
  | 'update'
  | 'offer'
  | 'membership_info';

export type GuideIntent = 'informational' | 'commercial' | 'transactional' | 'navigational';

export type GuideContentClass = 'class_a_core_learning' | 'class_b_reference' | 'class_c_updates_promo';

export type GuideTemplateType =
  | 'ModuleHubTemplate'
  | 'QuestionBankTemplate'
  | 'LessonTemplate'
  | 'ModelAnswerTemplate'
  | 'FAQReferenceTemplate'
  | 'UpdateTemplate'
  | 'OfferTemplate'
  | 'MembershipInfoTemplate';

export interface IGuideFaqItem {
  question: string;
  answer: string;
}

export interface IGuidePracticeBlocks {
  quickAnswer?: string;
  commonMistakes?: string[];
  stepByStepMethod?: string[];
  timedPracticeDrill?: string;
  selfCheckChecklist?: string[];
}

export interface IGuideCtaConfig {
  primary?: {
    label: string;
    href: string;
  };
  secondary?: {
    label: string;
    href: string;
  };
}

export interface IGuidePage {
  slug: string;
  canonicalPath: string;
  legacySlugs: string[];
  parentId?: Types.ObjectId;
  depth: number;
  order: number;
  module: GuideModule;
  track?: GuideTrack;
  pageType: GuidePageType;
  intent: GuideIntent;
  contentClass: GuideContentClass;
  templateType: GuideTemplateType;
  title: string;
  metaTitle?: string;
  metaDescription?: string;
  excerpt?: string;
  bodyMarkdown: string;
  keyTakeaways: string[];
  faqItems: IGuideFaqItem[];
  practiceBlocks: IGuidePracticeBlocks;
  ctaConfig?: IGuideCtaConfig;
  state: GuideState;
  contentRisk: 'low' | 'medium' | 'high';
  authorId?: Types.ObjectId;
  reviewerId?: Types.ObjectId;
  lastReviewedAt?: Date;
  publishedAt?: Date;
  qaPassed: boolean;
  qaScore?: number;
  citationCoverageScore?: number;
  duplicationScore?: number;
  readabilityScore?: number;
  linkValidationPassed?: boolean;
  schemaValidationPassed?: boolean;
  sourceUrls: string[];
  sourceSnapshotVersion?: string;
  rewriteNotes?: string;
  noindex: boolean;
  changeFrequency?: 'daily' | 'weekly' | 'monthly';
  priority?: number;
  createdAt: Date;
  updatedAt: Date;
}

export type GuidePageDocument = HydratedDocument<IGuidePage>;

const GuideFaqItemSchema = new Schema<IGuideFaqItem>(
  {
    question: { type: String, required: true, trim: true, maxlength: 300 },
    answer: { type: String, required: true, trim: true }
  },
  { _id: false }
);

const GuidePracticeBlocksSchema = new Schema<IGuidePracticeBlocks>(
  {
    quickAnswer: { type: String, trim: true },
    commonMistakes: [{ type: String, trim: true }],
    stepByStepMethod: [{ type: String, trim: true }],
    timedPracticeDrill: { type: String, trim: true },
    selfCheckChecklist: [{ type: String, trim: true }]
  },
  { _id: false }
);

const GuideCtaSchema = new Schema(
  {
    label: { type: String, required: true, trim: true, maxlength: 120 },
    href: { type: String, required: true, trim: true, maxlength: 240 }
  },
  { _id: false }
);

const GuideCtaConfigSchema = new Schema<IGuideCtaConfig>(
  {
    primary: { type: GuideCtaSchema },
    secondary: { type: GuideCtaSchema }
  },
  { _id: false }
);

const GuidePageSchema = new Schema<IGuidePage>(
  {
    slug: { type: String, required: true, trim: true, maxlength: 240, index: true },
    canonicalPath: { type: String, required: true, trim: true, maxlength: 320, index: true },
    legacySlugs: [{ type: String, trim: true, maxlength: 240 }],
    parentId: { type: Schema.Types.ObjectId, ref: 'GuidePage', index: true },
    depth: { type: Number, default: 1, min: 1, max: 8, index: true },
    order: { type: Number, default: 100, min: 0, max: 9999 },
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
    track: { type: String, enum: ['academic', 'general', 'both'] },
    pageType: {
      type: String,
      enum: ['module_hub', 'question_bank', 'lesson', 'model_answer', 'faq_reference', 'update', 'offer', 'membership_info'],
      default: 'lesson',
      index: true
    },
    intent: {
      type: String,
      enum: ['informational', 'commercial', 'transactional', 'navigational'],
      default: 'informational',
      index: true
    },
    contentClass: {
      type: String,
      enum: ['class_a_core_learning', 'class_b_reference', 'class_c_updates_promo'],
      default: 'class_a_core_learning',
      index: true
    },
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
    title: { type: String, required: true, trim: true, maxlength: 220 },
    metaTitle: { type: String, trim: true, maxlength: 260 },
    metaDescription: { type: String, trim: true, maxlength: 400 },
    excerpt: { type: String, trim: true, maxlength: 500 },
    bodyMarkdown: { type: String, default: '' },
    keyTakeaways: [{ type: String, trim: true }],
    faqItems: { type: [GuideFaqItemSchema], default: [] },
    practiceBlocks: { type: GuidePracticeBlocksSchema, default: {} },
    ctaConfig: { type: GuideCtaConfigSchema },
    state: {
      type: String,
      enum: ['inventory', 'mapped', 'outline_ready', 'drafting', 'review', 'qa_passed', 'published', 'archived'],
      default: 'inventory',
      index: true
    },
    contentRisk: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
      index: true
    },
    authorId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    reviewerId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    lastReviewedAt: { type: Date },
    publishedAt: { type: Date, index: true },
    qaPassed: { type: Boolean, default: false },
    qaScore: { type: Number, default: 0 },
    citationCoverageScore: { type: Number, default: 0 },
    duplicationScore: { type: Number, default: 0 },
    readabilityScore: { type: Number, default: 0 },
    linkValidationPassed: { type: Boolean, default: false },
    schemaValidationPassed: { type: Boolean, default: false },
    sourceUrls: [{ type: String, trim: true }],
    sourceSnapshotVersion: { type: String, trim: true, maxlength: 120 },
    rewriteNotes: { type: String, trim: true },
    noindex: { type: Boolean, default: false, index: true },
    changeFrequency: { type: String, enum: ['daily', 'weekly', 'monthly'], default: 'weekly' },
    priority: { type: Number, default: 0.7 }
  },
  { timestamps: true }
);

GuidePageSchema.index({ canonicalPath: 1 }, { unique: true });
GuidePageSchema.index({ module: 1, state: 1, updatedAt: -1 });
GuidePageSchema.index({ contentClass: 1, state: 1, updatedAt: -1 });
GuidePageSchema.index({ legacySlugs: 1 });

export const GuidePageModel = model<IGuidePage>('GuidePage', GuidePageSchema);
