export type SpeakingTtsProvider = 'openai' | 'elevenlabs' | 'edge-tts';
export type SpeakingSessionTurnType = 'examiner' | 'candidate' | 'system';
export type SpeakingSessionSegmentKind =
  | 'fixed_phrase'
  | 'seed_prompt'
  | 'cue_card'
  | 'transition'
  | 'dynamic_follow_up';

export interface SpeakingExaminerProfileDto {
  id: string;
  label: string;
  accent: string;
  provider: SpeakingTtsProvider;
  voiceId: string;
  autoAssigned: boolean;
}

export interface SpeakingAudioAssetRefDto {
  audioAssetId: string;
  audioUrl: string;
  cacheKey?: string;
  provider: SpeakingTtsProvider;
  durationSeconds?: number;
}

export interface SpeakingSessionSegmentDto extends SpeakingAudioAssetRefDto {
  segmentId: string;
  part: number;
  phase: string;
  kind: SpeakingSessionSegmentKind;
  turnType: SpeakingSessionTurnType;
  canAutoAdvance: boolean;
  phraseId?: string;
  promptIndex?: number;
  text: string;
}

export interface SpeakingSessionPackageDto {
  version: number;
  preparedAt: Date;
  examinerProfile: SpeakingExaminerProfileDto;
  segments: SpeakingSessionSegmentDto[];
}
