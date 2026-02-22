import { IsArray, IsIn, IsInt, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class StartReadingTestRequest {
  @IsOptional()
  @IsIn(['academic', 'general'])
  track?: 'academic' | 'general';
}

export class ReadingAnswerInput {
  @IsString()
  questionId!: string;

  @IsString()
  answer!: string;
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
}
