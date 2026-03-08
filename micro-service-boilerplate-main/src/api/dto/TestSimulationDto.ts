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
import { SpeakingSessionPackageDto } from './SpeakingSessionPackageDto';

export type TestSimulationRuntimeState =
  | 'preflight'
  | 'intro-examiner'
  | 'intro-candidate-turn'
  | 'part1-examiner'
  | 'part1-candidate-turn'
  | 'part1-processing'
  | 'part1-transition'
  | 'part2-intro'
  | 'part2-prep'
  | 'part2-examiner-launch'
  | 'part2-candidate-turn'
  | 'part2-cutoff'
  | 'part2-transition'
  | 'part3-intro'
  | 'part3-examiner'
  | 'part3-candidate-turn'
  | 'part3-processing'
  | 'evaluation'
  | 'completed'
  | 'paused-retryable'
  | 'failed-terminal';

export type TestSimulationRuntimeSegmentKind = 'cached_phrase' | 'dynamic_prompt';

export interface TestSimulationRuntimeSegmentDto {
  kind: TestSimulationRuntimeSegmentKind;
  phraseId?: string;
  text?: string;
}

export interface TestSimulationConversationMessageDto {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface TestSimulationTurnRecordDto {
  part: number;
  prompt: string;
  transcript?: string;
  durationSeconds?: number;
}

export interface TestSimulationRuntimeDto {
  state: TestSimulationRuntimeState;
  currentPart: number;
  currentTurnIndex: number;
  retryCount: number;
  retryBudgetRemaining?: number;
  introStep?: 'welcome' | 'id_check' | 'part1_begin';
  seedQuestionIndex?: number;
  followUpCount?: number;
  partFollowUpCount?: number;
  previousState?: TestSimulationRuntimeState;
  lastError?: string;
  failedStep?: string;
  conversationHistory?: TestSimulationConversationMessageDto[];
  turnHistory?: TestSimulationTurnRecordDto[];
  currentSegment: TestSimulationRuntimeSegmentDto;
}

export interface TestSimulationTelemetryDto {
  packageBuildDurationMs: number;
  baseAudioAssetHits: number;
  baseAudioAssetMisses: number;
  followUpCacheHits: number;
  followUpCacheMisses: number;
  examinerProfileId: string;
}

export interface TestSimulationSessionResponseDto {
  simulationId: string;
  status?: string;
  parts?: unknown[];
  runtime: TestSimulationRuntimeDto;
  currentPart?: unknown;
  sessionPackage?: SpeakingSessionPackageDto;
  telemetry?: TestSimulationTelemetryDto;
}

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

export class RuntimeAnswerRequest {
  @IsString()
  transcript!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(3600)
  durationSeconds?: number;
}
