import { IsIn, IsNumber, IsOptional, IsString } from 'class-validator';

export class StartFullExamRequest {
  @IsOptional()
  @IsIn(['academic', 'general'])
  track?: 'academic' | 'general';
}

export class SubmitFullExamSectionRequest {
  @IsIn(['speaking', 'writing', 'reading', 'listening'])
  module!: 'speaking' | 'writing' | 'reading' | 'listening';

  @IsString()
  attemptId!: string;

  @IsOptional()
  @IsNumber()
  score?: number;
}

export class CompleteFullExamRequest {}
