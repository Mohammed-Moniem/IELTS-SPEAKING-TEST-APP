import { SectionType } from './config';

/* ------------------------------------------------------------------ */
/*  Content generation types                                          */
/* ------------------------------------------------------------------ */

export interface GeneratedSpeaker {
  label: string;
  gender: 'male' | 'female';
}

export interface GeneratedTranscriptSegment {
  speaker: string;
  text: string;
}

export interface GeneratedAnswerSpec {
  kind: 'single' | 'multi' | 'ordered' | 'map';
  value: string | string[] | Record<string, string>;
  caseSensitive?: boolean;
  maxWords?: number;
}

export interface GeneratedQuestion {
  questionId: string;
  type: string;
  prompt: string;
  instructions?: string;
  groupId?: string;
  options?: string[];
  answerSpec: GeneratedAnswerSpec;
  correctAnswer?: string;
  explanation: string;
}

/** Raw JSON output from GPT-4o */
export interface GeneratedSectionContent {
  title: string;
  topic: string;
  context: string;
  speakers: GeneratedSpeaker[];
  transcriptSegments: GeneratedTranscriptSegment[];
  questions: GeneratedQuestion[];
}

/** Enriched section with voice assignments and fingerprint */
export interface EnrichedSectionContent extends GeneratedSectionContent {
  sectionType: SectionType;
  speakers: Array<GeneratedSpeaker & { voice: string }>;
  fingerprint: string;
  audioDurationSeconds?: number;
}

/* ------------------------------------------------------------------ */
/*  Pipeline state types                                              */
/* ------------------------------------------------------------------ */

export type SectionStatus = 'content_ready' | 'audio_ready' | 'uploaded' | 'registered';
export type TestStatus = 'composed' | 'registered';

export interface SectionState {
  sectionType: SectionType;
  index: number;
  fingerprint: string;
  contentPath: string;
  audioPath?: string;
  audioDurationSeconds?: number;
  uploadedUrl?: string;
  mongoId?: string;
  status: SectionStatus;
}

export interface ComposedTestState {
  sectionKeys: string[];
  testMongoId?: string;
  status: TestStatus;
}

export interface PipelineError {
  timestamp: string;
  step: string;
  message: string;
  sectionKey?: string;
}

export interface PipelineState {
  generatedSections: Record<string, SectionState>;
  composedTests: Record<string, ComposedTestState>;
  lastStep: 'idle' | 'generating' | 'synthesizing' | 'uploading' | 'registering' | 'composing' | 'done';
  errors: PipelineError[];
}
