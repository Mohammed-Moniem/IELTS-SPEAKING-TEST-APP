import type { SpeakingAudioAssetKind, SpeakingAudioAssetProvider } from '../../src/api/models/SpeakingAudioAssetModel';

export type SpeakingPromptCategory = 'fixed' | 'part1' | 'part2' | 'part3';
export type SpeakingPromptStatus = 'exported' | 'audio_ready' | 'uploaded' | 'registered';
export type SpeakingPipelineStep = 'idle' | 'exporting' | 'synthesizing' | 'uploading' | 'registering' | 'done';

export interface SpeakingPromptExportEntry {
  id: string;
  kind: Exclude<SpeakingAudioAssetKind, 'dynamic_follow_up'>;
  category: SpeakingPromptCategory;
  part: 0 | 1 | 2 | 3;
  cacheKey: string;
  text: string;
  voiceProfileId: string;
  voiceId: string;
  provider: SpeakingAudioAssetProvider;
  accent: string;
  storagePath: string;
  questionId?: string;
  phraseId?: string;
  topicId?: string;
  topicTitle?: string;
  promptIndex: number;
}

export interface SpeakingPromptState extends SpeakingPromptExportEntry {
  status: SpeakingPromptStatus;
  localAudioPath?: string;
  publicUrl?: string;
  mimeType?: string;
  checksum?: string;
  durationSeconds?: number;
}

export interface SpeakingPipelineError {
  timestamp: string;
  step: string;
  message: string;
  cacheKey?: string;
}

export interface SpeakingPipelineState {
  prompts: Record<string, SpeakingPromptState>;
  lastStep: SpeakingPipelineStep;
  errors: SpeakingPipelineError[];
}

