import fs from 'fs';
import path from 'path';
import { PIPELINE_CONFIG } from './config';
import { PipelineState, SectionState, SectionStatus } from './types';

const STATE_FILE = path.join(PIPELINE_CONFIG.stateDir, 'pipeline-state.json');

/* ------------------------------------------------------------------ */
/*  State management                                                  */
/* ------------------------------------------------------------------ */

export function ensureDirectories(): void {
  for (const dir of [PIPELINE_CONFIG.stateDir, PIPELINE_CONFIG.audioOutputDir, PIPELINE_CONFIG.contentOutputDir]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

export function loadState(): PipelineState {
  ensureDirectories();
  if (fs.existsSync(STATE_FILE)) {
    const raw = fs.readFileSync(STATE_FILE, 'utf-8');
    return JSON.parse(raw) as PipelineState;
  }
  return {
    generatedSections: {},
    composedTests: {},
    lastStep: 'idle',
    errors: [],
  };
}

export function saveState(state: PipelineState): void {
  ensureDirectories();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

export function sectionKey(sectionType: string, index: number): string {
  return `${sectionType}_${String(index).padStart(4, '0')}`;
}

export function getSectionsWithStatus(state: PipelineState, status: SectionStatus): [string, SectionState][] {
  return Object.entries(state.generatedSections).filter(([, s]) => s.status === status);
}

export function getSectionsNeedingStep(state: PipelineState, fromStatus: SectionStatus): [string, SectionState][] {
  return Object.entries(state.generatedSections).filter(([, s]) => s.status === fromStatus);
}

export function countSectionsByType(state: PipelineState, sectionType: string): number {
  return Object.values(state.generatedSections).filter(s => s.sectionType === sectionType).length;
}

export function logError(state: PipelineState, step: string, message: string, sectionKey?: string): void {
  state.errors.push({
    timestamp: new Date().toISOString(),
    step,
    message,
    sectionKey,
  });
  saveState(state);
}

export function contentFilePath(key: string): string {
  return path.join(PIPELINE_CONFIG.contentOutputDir, `${key}.json`);
}

export function audioFilePath(key: string): string {
  return path.join(PIPELINE_CONFIG.audioOutputDir, `${key}.mp3`);
}
