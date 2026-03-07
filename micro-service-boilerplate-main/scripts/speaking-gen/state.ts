import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';

import { PIPELINE_CONFIG } from './config';
import { SpeakingPipelineState, SpeakingPromptExportEntry, SpeakingPromptState, SpeakingPromptStatus } from './types';

const STATE_FILE = path.join(PIPELINE_CONFIG.stateDir, 'pipeline-state.json');
const MANIFEST_FILE = path.join(PIPELINE_CONFIG.manifestOutputDir, 'prompt-manifest.json');

export function ensureDirectories(): void {
  for (const dir of [PIPELINE_CONFIG.stateDir, PIPELINE_CONFIG.manifestOutputDir, PIPELINE_CONFIG.audioOutputDir]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

export function loadState(): SpeakingPipelineState {
  ensureDirectories();

  if (fs.existsSync(STATE_FILE)) {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8')) as SpeakingPipelineState;
  }

  return {
    prompts: {},
    lastStep: 'idle',
    errors: [],
  };
}

export function saveState(state: SpeakingPipelineState): void {
  ensureDirectories();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
}

export function saveManifest(entries: SpeakingPromptExportEntry[]): void {
  ensureDirectories();
  fs.writeFileSync(MANIFEST_FILE, JSON.stringify(entries, null, 2), 'utf-8');
}

export function getPromptsNeedingStep(
  state: SpeakingPipelineState,
  status: SpeakingPromptStatus
): [string, SpeakingPromptState][] {
  return Object.entries(state.prompts).filter(([, prompt]) => prompt.status === status);
}

export function audioFilePath(cacheKey: string): string {
  const fileName = `${createHash('sha1').update(cacheKey).digest('hex')}.mp3`;
  return path.join(PIPELINE_CONFIG.audioOutputDir, fileName);
}

export function logError(
  state: SpeakingPipelineState,
  step: string,
  message: string,
  cacheKey?: string
): void {
  state.errors.push({
    timestamp: new Date().toISOString(),
    step,
    message,
    cacheKey,
  });
  saveState(state);
}

