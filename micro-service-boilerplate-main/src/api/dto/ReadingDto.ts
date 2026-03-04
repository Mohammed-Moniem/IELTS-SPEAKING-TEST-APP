import { IsArray, IsBoolean, IsDateString, IsDefined, IsIn, IsInt, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class StartReadingTestRequest {
  @IsOptional()
  @IsIn(['academic', 'general'])
  track?: 'academic' | 'general';
}

export class ReadingAnswerInput {
  @IsString()
  questionId!: string;

  @IsOptional()
  @IsIn(['p1', 'p2', 'p3'])
  sectionId?: 'p1' | 'p2' | 'p3';

  @IsDefined()
  answer!: string | string[] | Record<string, string>;
}

export class SubmitReadingTestRequest {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReadingAnswerInput)
  answers!: ReadingAnswerInput[];

  @IsOptional()
  @IsInt()
  @Min(0)
  durationSeconds?: number;
}

export class SaveReadingProgressRequest {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReadingAnswerInput)
  answers?: ReadingAnswerInput[];

  @IsOptional()
  @IsInt()
  @Min(0)
  durationSeconds?: number;

  @IsOptional()
  @IsIn(['p1', 'p2', 'p3'])
  activeSectionId?: 'p1' | 'p2' | 'p3';

  @IsOptional()
  @IsInt()
  @Min(0)
  activeQuestionIndex?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  flaggedQuestionIds?: string[];

  @IsOptional()
  @IsBoolean()
  isPaused?: boolean;
}

export class ReadingHistoryQuery {
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
