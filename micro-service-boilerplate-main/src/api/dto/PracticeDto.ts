import { IsMongoId, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class StartPracticeRequest {
  @IsString()
  topicId!: string;
}

export class CompletePracticeSessionRequest {
  @IsOptional()
  @IsString()
  userResponse?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1800)
  timeSpent?: number;
}

export class PracticeHistoryQuery {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  offset?: number;

  @IsOptional()
  @IsString()
  topicId?: string;
}

export class PracticeSessionParam {
  @IsMongoId()
  sessionId!: string;
}
