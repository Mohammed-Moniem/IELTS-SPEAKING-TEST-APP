import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength
} from 'class-validator';

export class BlogListQuery {
  @IsOptional()
  @IsString()
  cluster?: string;

  @IsOptional()
  @IsIn(['idea', 'outline', 'draft', 'qa_passed', 'pending_review', 'published', 'archived'])
  state?: 'idea' | 'outline' | 'draft' | 'qa_passed' | 'pending_review' | 'published' | 'archived';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number;
}

export class GenerateBlogIdeasRequest {
  @IsOptional()
  @IsString()
  cluster?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  count?: number;
}

export class CreateBlogDraftRequest {
  @IsString()
  @MinLength(8)
  title!: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  cluster?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  excerpt?: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsIn(['low_risk_update', 'pillar', 'commercial'])
  contentRisk?: 'low_risk_update' | 'pillar' | 'commercial';

  @IsOptional()
  @IsBoolean()
  scheduleAutoPublish?: boolean;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}

export class ReviewBlogPostRequest {
  @IsIn(['approved', 'rejected', 'changes_requested'])
  decision!: 'approved' | 'rejected' | 'changes_requested';

  @IsOptional()
  @IsString()
  notes?: string;
}

export class SeoRefreshQueueRequest {
  @IsOptional()
  @IsString()
  cluster?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}

export class StrengthMapQuery {
  @IsOptional()
  @IsIn(['7d', '30d', '90d'])
  range?: '7d' | '30d' | '90d';
}

export class ImprovementPlanQuery {
  @IsOptional()
  @IsIn(['speaking', 'writing', 'reading', 'listening', 'all'])
  module?: 'speaking' | 'writing' | 'reading' | 'listening' | 'all';
}

export class LibraryQuery {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  topic?: string;

  @IsOptional()
  @IsIn(['speaking', 'writing', 'reading', 'listening'])
  module?: 'speaking' | 'writing' | 'reading' | 'listening';

  @IsOptional()
  @IsIn(['A2', 'B1', 'B2', 'C1', 'C2'])
  cefr?: 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

  @IsOptional()
  @IsIn(['beginner', 'intermediate', 'advanced'])
  difficulty?: 'beginner' | 'intermediate' | 'advanced';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number;
}

export class CreateLibraryDeckRequest {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsIn(['collocation', 'vocabulary', 'resource'])
  entryType!: 'collocation' | 'vocabulary' | 'resource';

  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  entryIds!: string[];
}

export class LibraryReviewQueueQuery {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(300)
  limit?: number;
}

export class RecordDeckReviewEventRequest {
  @IsString()
  entryId!: string;

  @IsIn(['again', 'hard', 'good', 'easy', 'mastered'])
  rating!: 'again' | 'hard' | 'good' | 'easy' | 'mastered';

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  qualityScore?: number;
}

export class AdminAdCampaignListQuery {
  @IsOptional()
  @IsIn(['draft', 'pending_review', 'approved', 'scheduled', 'active', 'paused', 'completed', 'rejected'])
  status?: 'draft' | 'pending_review' | 'approved' | 'scheduled' | 'active' | 'paused' | 'completed' | 'rejected';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number;
}

export class AdminCreateAdPackageRequest {
  @IsString()
  @MinLength(2)
  key!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  description!: string;

  @IsIn(['homepage_sponsor', 'module_panel', 'blog_block', 'newsletter_slot', 'partner_spotlight'])
  placementType!:
    | 'homepage_sponsor'
    | 'module_panel'
    | 'blog_block'
    | 'newsletter_slot'
    | 'partner_spotlight';

  @IsIn(['monthly_subscription', 'quarterly_subscription', 'annual_subscription', 'one_time'])
  billingType!: 'monthly_subscription' | 'quarterly_subscription' | 'annual_subscription' | 'one_time';

  @IsOptional()
  @IsString()
  stripePriceId?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsNumber()
  @Min(0)
  priceAmount!: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  features?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AdminCreateAdCampaignRequest {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  packageId!: string;

  @IsOptional()
  @IsString()
  advertiserAccountId?: string;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @IsOptional()
  @IsObject()
  targeting?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  creative?: Record<string, unknown>;
}

export class AdminUpdateAdCampaignStatusRequest {
  @IsIn(['draft', 'pending_review', 'approved', 'scheduled', 'active', 'paused', 'completed', 'rejected'])
  status!: 'draft' | 'pending_review' | 'approved' | 'scheduled' | 'active' | 'paused' | 'completed' | 'rejected';

  @IsOptional()
  @IsString()
  notes?: string;
}

export class AdvertiserCheckoutSessionRequest {
  @IsString()
  packageId!: string;

  @IsString()
  successUrl!: string;

  @IsString()
  cancelUrl!: string;

  @IsOptional()
  @IsString()
  couponCode?: string;
}
