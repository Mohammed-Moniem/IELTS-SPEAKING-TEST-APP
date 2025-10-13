import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested
} from 'class-validator';

export class TestPartInput {
  @IsNumber()
  @Min(1)
  @Max(3)
  part!: number;

  @IsString()
  question!: string;

  @IsOptional()
  @IsString()
  response?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(3600)
  timeSpent?: number;
}

export class CompleteTestSimulationRequest {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => TestPartInput)
  parts!: TestPartInput[];
}

export class TestSimulationParam {
  @IsMongoId()
  simulationId!: string;
}

export class TestSimulationQuery {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  offset?: number;
}
