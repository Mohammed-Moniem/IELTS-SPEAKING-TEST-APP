import { SubscriptionPlan } from '@models/UserModel';
import { IsIn, IsOptional, IsString, Matches } from 'class-validator';

export class CreateCheckoutSessionRequest {
  @IsIn(['premium', 'pro', 'team'])
  planType!: SubscriptionPlan;

  @IsOptional()
  @IsIn(['monthly', 'annual'])
  billingCycle?: 'monthly' | 'annual';

  @IsOptional()
  @IsString()
  successUrl?: string;

  @IsOptional()
  @IsString()
  cancelUrl?: string;

  @IsOptional()
  @Matches(/^[A-Za-z0-9_-]{4,32}$/)
  partnerCode?: string;

  @IsOptional()
  @Matches(/^[A-Za-z0-9_-]{3,64}$/)
  couponCode?: string;
}

export class ActivatePlanRequest {
  @IsIn(['free', 'premium', 'pro', 'team'])
  planType!: SubscriptionPlan;
}

export class CreatePortalSessionRequest {
  @IsOptional()
  @IsString()
  returnUrl?: string;
}
