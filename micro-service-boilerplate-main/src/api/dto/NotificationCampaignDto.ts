import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested
} from 'class-validator';

export class NotificationCampaignAudienceDto {
  @IsIn([
    'all_users',
    'all_partner_owners',
    'partner_owners_by_type',
    'partner_owners_by_ids',
    'partner_attributed_users',
    'partner_owners_and_attributed'
  ])
  kind!:
    | 'all_users'
    | 'all_partner_owners'
    | 'partner_owners_by_type'
    | 'partner_owners_by_ids'
    | 'partner_attributed_users'
    | 'partner_owners_and_attributed';

  @IsOptional()
  @IsIn(['influencer', 'institute'])
  partnerType?: 'influencer' | 'institute';

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  partnerIds?: string[];
}

export class CreateNotificationCampaignDto {
  @IsString()
  title!: string;

  @IsString()
  body!: string;

  @IsIn(['system', 'offer'])
  type!: 'system' | 'offer';

  @ValidateNested()
  @Type(() => NotificationCampaignAudienceDto)
  audience!: NotificationCampaignAudienceDto;

  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;

  @IsOptional()
  @IsIn(['immediate', 'scheduled'])
  mode?: 'immediate' | 'scheduled';

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsBoolean()
  fallbackImmediateIfSchedulerUnavailable?: boolean;
}

export class PreflightNotificationCampaignDto extends CreateNotificationCampaignDto {}

export class NotificationCampaignListQuery {
  @IsOptional()
  @IsIn(['draft', 'scheduled', 'processing', 'sent', 'cancelled', 'failed'])
  status?: 'draft' | 'scheduled' | 'processing' | 'sent' | 'cancelled' | 'failed';

  @IsOptional()
  @IsIn(['system', 'offer'])
  type?: 'system' | 'offer';

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
