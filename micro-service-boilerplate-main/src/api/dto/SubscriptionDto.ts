import { SubscriptionPlan } from '@models/UserModel';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class CreateCheckoutSessionRequest {
  @IsIn(['premium', 'pro'])
  planType!: SubscriptionPlan;

  @IsOptional()
  @IsString()
  successUrl?: string;

  @IsOptional()
  @IsString()
  cancelUrl?: string;
}

export class ActivatePlanRequest {
  @IsIn(['free', 'premium', 'pro'])
  planType!: SubscriptionPlan;
}
