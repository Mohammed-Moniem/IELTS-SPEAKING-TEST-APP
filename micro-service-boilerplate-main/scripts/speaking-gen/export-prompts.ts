import type { ExaminerPhrase } from '../../src/api/services/ExaminerPhraseService';
import { ExaminerPhraseService } from '../../src/api/services/ExaminerPhraseService';
import type { SpeakingExaminerProfile } from '../../src/api/services/SpeakingExaminerProfileService';
import { SpeakingExaminerProfileService } from '../../src/api/services/SpeakingExaminerProfileService';
import { SpeakingAudioAssetService } from '../../src/api/services/SpeakingAudioAssetService';
import type { IIELTSCueCard, IIELTSQuestion, IELTSQuestionCategory } from '../../src/api/models/IELTSQuestionModel';

import { PIPELINE_CONFIG, SPEAKING_PART_CATEGORIES } from './config';
import { loadState, saveManifest, saveState } from './state';
import { SpeakingPromptExportEntry } from './types';

type ExportableQuestion = Pick<IIELTSQuestion, 'category' | 'topic' | 'question' | 'cueCard'> & {
  _id?: string | { toString(): string };
};

interface BuildSpeakingPromptManifestOptions {
  voiceProfiles: SpeakingExaminerProfile[];
  fixedPhrases: ExaminerPhrase[];
  bankQuestions: ExportableQuestion[];
  assetService?: SpeakingAudioAssetService;
}

interface ExportSpeakingPromptsOptions {
  limitPerCategory?: number;
  voiceProfileId?: string;
}

const normalizeSegment = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

const resolveQuestionId = (question: ExportableQuestion, fallbackIndex: number): string =>
  typeof question._id === 'string'
    ? question._id
    : question._id?.toString?.() || `prompt-${fallbackIndex}`;

const toPartNumber = (category: IELTSQuestionCategory): 1 | 2 | 3 =>
  Number(category.replace('part', '')) as 1 | 2 | 3;

const toPhraseKind = (phraseId: string): 'fixed_phrase' | 'transition' =>
  phraseId.includes('transition') ? 'transition' : 'fixed_phrase';

const toStoragePath = (voiceProfileId: string, category: IELTSQuestionCategory, topicId: string, questionId: string): string => {
  if (category === 'part2') {
    return `questions/${voiceProfileId}/part2/${topicId}/${questionId}.mp3`;
  }
  return `questions/${voiceProfileId}/${category}/${topicId}/${questionId}.mp3`;
};

export function composeCueCardNarrationText(question: ExportableQuestion): string {
  const cueCard = question.cueCard || ({} as IIELTSCueCard);
  const mainPrompt = question.question.trim();
  const bulletPoints = cueCard.bulletPoints?.filter(Boolean) || [];

  if (!bulletPoints.length) {
    return mainPrompt;
  }

  return [
    mainPrompt,
    'You should say:',
    ...bulletPoints.map(point => `- ${point}`),
  ].join('\n');
}

export function buildSpeakingPromptManifest(
  options: BuildSpeakingPromptManifestOptions
): SpeakingPromptExportEntry[] {
  const assetService = options.assetService || new SpeakingAudioAssetService();
  const entries: SpeakingPromptExportEntry[] = [];

  options.voiceProfiles.forEach(voiceProfile => {
    options.fixedPhrases.forEach((phrase, phraseIndex) => {
      entries.push({
        id: `${voiceProfile.id}:${phrase.id}`,
        kind: toPhraseKind(phrase.id),
        category: 'fixed',
        part: 0,
        cacheKey: `fixed:${voiceProfile.id}:${phrase.id}`,
        text: phrase.text,
        voiceProfileId: voiceProfile.id,
        voiceId: voiceProfile.voiceId,
        provider: voiceProfile.provider,
        accent: voiceProfile.accent,
        storagePath: `fixed/${voiceProfile.id}/${phrase.id}.mp3`,
        phraseId: phrase.id,
        promptIndex: phraseIndex,
      });
    });

    options.bankQuestions.forEach((question, questionIndex) => {
      const part = toPartNumber(question.category);
      const questionId = resolveQuestionId(question, questionIndex);
      const topicId = normalizeSegment(question.topic || 'general-topic');
      const promptText = question.category === 'part2'
        ? composeCueCardNarrationText(question)
        : question.question.trim();

      entries.push({
        id: `${voiceProfile.id}:${questionId}`,
        kind: question.category === 'part2' ? 'cue_card' : 'bank_question',
        category: question.category,
        part,
        cacheKey: assetService.buildQuestionCacheKey({
          voiceProfileId: voiceProfile.id,
          part,
          topicId,
          promptIndex: 0,
          text: promptText,
        }),
        text: promptText,
        voiceProfileId: voiceProfile.id,
        voiceId: voiceProfile.voiceId,
        provider: voiceProfile.provider,
        accent: voiceProfile.accent,
        storagePath: toStoragePath(voiceProfile.id, question.category, topicId, questionId),
        questionId,
        topicId,
        topicTitle: question.topic,
        promptIndex: 0,
      });
    });
  });

  return entries;
}

async function loadQuestionBankPrompts(limitPerCategory: number): Promise<ExportableQuestion[]> {
  const { IELTSQuestionModel } = await import('../../src/api/models/IELTSQuestionModel');

  const questionSets = await Promise.all(
    SPEAKING_PART_CATEGORIES.map(category =>
      IELTSQuestionModel.find({
        category,
        active: true,
      })
        .sort({ verified: -1, timesUsed: 1, lastUsedAt: 1 })
        .limit(limitPerCategory)
        .lean()
    )
  );

  return questionSets.flat() as ExportableQuestion[];
}

export async function exportSpeakingPrompts(
  options: ExportSpeakingPromptsOptions = {}
): Promise<SpeakingPromptExportEntry[]> {
  const phraseService = new ExaminerPhraseService();
  const profileService = new SpeakingExaminerProfileService();
  const assetService = new SpeakingAudioAssetService();

  const voiceProfiles = options.voiceProfileId
    ? [profileService.resolveProfile(options.voiceProfileId)]
    : profileService.listProfiles();

  const bankQuestions = await loadQuestionBankPrompts(options.limitPerCategory || PIPELINE_CONFIG.limitPerCategory);
  const manifest = buildSpeakingPromptManifest({
    voiceProfiles,
    fixedPhrases: phraseService.listCacheablePhrases(),
    bankQuestions,
    assetService,
  });

  const state = loadState();
  state.lastStep = 'exporting';
  state.prompts = {};

  manifest.forEach(entry => {
    state.prompts[entry.cacheKey] = {
      ...entry,
      status: 'exported',
    };
  });

  saveManifest(manifest);
  saveState(state);

  return manifest;
}

