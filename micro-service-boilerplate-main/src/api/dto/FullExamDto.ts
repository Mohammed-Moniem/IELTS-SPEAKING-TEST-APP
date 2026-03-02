import { IsIn, IsInt, IsNumber, IsObject, IsOptional, IsString, Max, Min } from 'class-validator';

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

export class FullExamRuntimeMutationRequest {
  @IsOptional()
  @IsIn(['speaking', 'writing', 'reading', 'listening'])
  currentModule?: 'speaking' | 'writing' | 'reading' | 'listening';

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  currentQuestionIndex?: number;

  @IsOptional()
  @IsObject()
  remainingSecondsByModule?: Partial<Record<'speaking' | 'writing' | 'reading' | 'listening', number>>;

  @IsOptional()
  @IsString()
  resumeToken?: string;
}
