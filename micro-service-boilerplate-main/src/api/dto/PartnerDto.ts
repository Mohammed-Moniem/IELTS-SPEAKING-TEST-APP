import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength
} from 'class-validator';

export class PartnerApplicationRequest {
  @IsIn(['influencer', 'institute'])
  partnerType!: 'influencer' | 'institute';

  @IsString()
  @MinLength(2)
  displayName!: string;

  @IsOptional()
  @IsString()
  legalName?: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class PartnerListQuery {
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
  @IsIn(['influencer', 'institute'])
  partnerType?: 'influencer' | 'institute';

  @IsOptional()
  @IsIn(['pending', 'active', 'suspended', 'rejected'])
  status?: 'pending' | 'active' | 'suspended' | 'rejected';
}

export class PartnerActivityQuery {
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

export class AdminPayoutOperationsViewQuery extends PartnerActivityQuery {
  @IsOptional()
  @IsIn(['all', 'pending', 'processing', 'paid'])
  status?: 'all' | 'pending' | 'processing' | 'paid';

  @IsOptional()
  @IsIn(['amount_desc', 'amount_asc', 'name_asc', 'name_desc'])
  sort?: 'amount_desc' | 'amount_asc' | 'name_asc' | 'name_desc';
}

export class AdminCreatePartnerRequest {
  @IsIn(['influencer', 'institute'])
  partnerType!: 'influencer' | 'institute';

  @IsString()
  @MinLength(2)
  displayName!: string;

  @IsString()
  ownerUserId!: string;

  @IsOptional()
  @IsString()
  legalName?: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  defaultCommissionRate?: number;

  @IsOptional()
  @IsBoolean()
  activateNow?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class AdminUpdatePartnerRequest {
  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsString()
  legalName?: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsIn(['pending', 'active', 'suspended', 'rejected'])
  status?: 'pending' | 'active' | 'suspended' | 'rejected';

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  defaultCommissionRate?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class AdminCreatePartnerCodeRequest {
  @IsString()
  @Matches(/^[A-Z0-9_-]{4,32}$/)
  code!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  attributionOnly?: boolean;

  @IsOptional()
  @IsString()
  linkedCouponCode?: string;

  @IsOptional()
  @IsString()
  stripePromotionCodeId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  commissionRateOverride?: number;

  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @IsOptional()
  @IsDateString()
  validUntil?: string;
}

export class AdminUpdatePartnerCodeRequest {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  attributionOnly?: boolean;

  @IsOptional()
  @IsString()
  linkedCouponCode?: string;

  @IsOptional()
  @IsString()
  stripePromotionCodeId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  commissionRateOverride?: number;

  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @IsOptional()
  @IsDateString()
  validUntil?: string;
}

export class AdminCreatePartnerTargetRequest {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsIn(['paid_conversions', 'net_revenue_usd'])
  metric!: 'paid_conversions' | 'net_revenue_usd';

  @IsOptional()
  @IsIn(['monthly'])
  period?: 'monthly';

  @IsNumber()
  @Min(0)
  thresholdValue!: number;

  @IsNumber()
  @Min(0)
  bonusAmountUsd!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  commissionUpliftPercent?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  upliftDurationDays?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;
}

export class AdminUpdatePartnerTargetRequest {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  thresholdValue?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  bonusAmountUsd?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  commissionUpliftPercent?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  upliftDurationDays?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;
}

export class AdminCreatePayoutBatchRequest {
  @IsDateString()
  periodStart!: string;

  @IsDateString()
  periodEnd!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  partnerIds?: string[];

  @IsOptional()
  @IsString()
  notes?: string;
}

export class AdminPreviewPayoutBatchRequest extends AdminCreatePayoutBatchRequest {}

export class AdminMarkPayoutBatchPaidRequest {
  @IsOptional()
  @IsString()
  externalReference?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
