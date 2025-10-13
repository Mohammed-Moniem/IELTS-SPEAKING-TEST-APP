import { IsDateString, IsOptional, IsString, Matches } from 'class-validator';

export class UpsertPreferencesRequest {
  @IsOptional()
  @IsDateString()
  testDate?: string;

  @IsOptional()
  @Matches(/^(6\.0|6\.5|7\.0|7\.5|8\.0|8\.5|9\.0)$/)
  targetBand?: string;

  @IsOptional()
  @IsString()
  timeFrame?: string;
}
