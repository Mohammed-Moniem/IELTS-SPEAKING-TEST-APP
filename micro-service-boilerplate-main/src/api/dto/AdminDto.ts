import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsBooleanString,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min
} from 'class-validator';

export class AdminContentMutationRequest {
  @IsIn(['writing', 'reading', 'listening'])
  module!: 'writing' | 'reading' | 'listening';

  @IsOptional()
  @IsString()
  targetId?: string;

  @IsObject()
  payload!: Record<string, unknown>;
}

export class AdminFeatureFlagUpdateRequest {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  rolloutPercentage?: number;

  @IsOptional()
  @IsString()
  description?: string;
}

export class AdminPaginationQuery {
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

export class AdminRoleUpdateRequest {
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(3)
  @IsIn(['superadmin', 'content_manager', 'support_agent'], { each: true })
  roles!: Array<'superadmin' | 'content_manager' | 'support_agent'>;
}

export class AdminUsersQuery extends AdminPaginationQuery {
  @IsOptional()
  @IsString()
  query?: string;

  @IsOptional()
  @IsIn(['free', 'starter', 'premium', 'pro', 'team'])
  plan?: 'free' | 'starter' | 'premium' | 'pro' | 'team';

  @IsOptional()
  @IsIn(['active', 'idle', 'unverified'])
  status?: 'active' | 'idle' | 'unverified';

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsBooleanString()
  flagged?: 'true' | 'false';
}

export class AdminSubscriptionsQuery extends AdminPaginationQuery {
  @IsOptional()
  @IsString()
  query?: string;

  @IsOptional()
  @IsIn(['active', 'canceled', 'past_due', 'incomplete'])
  status?: 'active' | 'canceled' | 'past_due' | 'incomplete';

  @IsOptional()
  @IsIn(['free', 'starter', 'premium', 'pro', 'team'])
  plan?: 'free' | 'starter' | 'premium' | 'pro' | 'team';

  @IsOptional()
  @IsDateString()
  renewalFrom?: string;

  @IsOptional()
  @IsDateString()
  renewalTo?: string;
}

export class AdminSubscriptionStatusUpdateRequest {
  @IsIn(['active', 'canceled', 'past_due', 'incomplete'])
  status!: 'active' | 'canceled' | 'past_due' | 'incomplete';
}

export class AdminSubscriptionPlanUpdateRequest {
  @IsIn(['free', 'starter', 'premium', 'pro', 'team'])
  planType!: 'free' | 'starter' | 'premium' | 'pro' | 'team';
}

export class AdminSubscriptionRefundNoteRequest {
  @IsString()
  @IsNotEmpty()
  note!: string;
}

export class AdminAuditLogQuery {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number;

  @IsOptional()
  @IsString()
  actorUserId?: string;

  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;
}

export class AdminAIUsageQuery {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;

  @IsOptional()
  @IsString()
  module?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class AdminOverviewViewQuery {
  @IsOptional()
  @IsIn(['1h', '24h', '7d'])
  window?: '1h' | '24h' | '7d';
}

export class AdminAnalyticsViewQuery {
  @IsOptional()
  @IsIn(['7d', '30d', '90d'])
  range?: '7d' | '30d' | '90d';
}

export class AdminAnalyticsExportQuery extends AdminAnalyticsViewQuery {
  @IsOptional()
  @IsIn(['json', 'csv'])
  format?: 'json' | 'csv';
}
