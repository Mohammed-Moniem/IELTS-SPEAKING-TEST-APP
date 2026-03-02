import { IsIn, IsOptional } from 'class-validator';

export class LearnerProgressViewQuery {
  @IsOptional()
  @IsIn(['7d', '30d', '90d'])
  range?: '7d' | '30d' | '90d';

  @IsOptional()
  @IsIn(['all', 'speaking', 'writing', 'reading', 'listening'])
  module?: 'all' | 'speaking' | 'writing' | 'reading' | 'listening';
}
