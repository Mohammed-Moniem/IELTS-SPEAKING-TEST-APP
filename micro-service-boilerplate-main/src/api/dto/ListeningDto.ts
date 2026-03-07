import { IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class StartListeningTestRequest {
  @IsOptional()
  @IsIn(['academic', 'general'])
  track?: 'academic' | 'general';
}

export class ListeningAnswerInput {
  @IsString()
  questionId!: string;

  @IsOptional()
  @IsString()
  sectionId?: string;

  // answer can be string, string[], or Record<string,string>
  answer!: string | string[] | Record<string, string>;
}

export class SubmitListeningTestRequest {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ListeningAnswerInput)
  answers!: ListeningAnswerInput[];

  @IsOptional()
  @IsInt()
  @Min(0)
  durationSeconds?: number;
}

export class SaveListeningProgressRequest {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ListeningAnswerInput)
  answers?: ListeningAnswerInput[];

  @IsOptional()
  @IsInt()
  @Min(0)
  durationSeconds?: number;

  @IsOptional()
  @IsString()
  activeSectionId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  activeQuestionIndex?: number;

  @IsOptional()
  @IsArray()
  flaggedQuestionIds?: string[];

  @IsOptional()
  @IsBoolean()
  isPaused?: boolean;
}

export class ListeningHistoryQuery {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number;

  @IsOptional()
  @IsIn(['academic', 'general'])
  track?: 'academic' | 'general';

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
