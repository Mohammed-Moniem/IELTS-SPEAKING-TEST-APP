import { IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, Max, Min } from 'class-validator';

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
