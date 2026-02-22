import { IsArray, IsIn, IsInt, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class StartListeningTestRequest {
  @IsOptional()
  @IsIn(['academic', 'general'])
  track?: 'academic' | 'general';
}

export class ListeningAnswerInput {
  @IsString()
  questionId!: string;

  @IsString()
  answer!: string;
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
}
