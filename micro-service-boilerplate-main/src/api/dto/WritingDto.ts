import { IsIn, IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class GenerateWritingTaskRequest {
  @IsOptional()
  @IsIn(['academic', 'general'])
  track?: 'academic' | 'general';

  @IsOptional()
  @IsIn(['task1', 'task2'])
  taskType?: 'task1' | 'task2';
}

export class SubmitWritingRequest {
  @IsString()
  taskId!: string;

  @IsString()
  @MinLength(1)
  responseText!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  durationSeconds?: number;
}

export class WritingHistoryQuery {
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
