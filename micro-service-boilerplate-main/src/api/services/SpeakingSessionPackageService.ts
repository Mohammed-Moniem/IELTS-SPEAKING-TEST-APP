import { SpeakingSessionPackageDto, SpeakingSessionSegmentDto } from '@dto/SpeakingSessionPackageDto';
import { ExaminerPhrase, ExaminerPhraseId, ExaminerPhraseService } from '@services/ExaminerPhraseService';
import { SpeakingAudioAssetService } from '@services/SpeakingAudioAssetService';
import { SpeakingExaminerProfile, SpeakingExaminerProfileService } from '@services/SpeakingExaminerProfileService';
import { Service } from 'typedi';

import { env } from '../../env';

export interface SpeakingSessionPackagePartDefinition {
  part: number;
  topicId: string;
  topicTitle: string;
  question: string;
  timeLimit: number;
  tips: string[];
}

const FIXED_PHRASE_PART: Record<ExaminerPhraseId, number> = {
  welcome_intro: 0,
  id_check: 0,
  part1_begin: 0,
  part1_transition: 1,
  part2_intro: 2,
  part2_begin_speaking: 2,
  part2_transition: 2,
  part3_intro: 3,
  test_complete: 3
};

const FIXED_PHRASE_PHASE: Record<ExaminerPhraseId, string> = {
  welcome_intro: 'check-in',
  id_check: 'check-in',
  part1_begin: 'part1-intro',
  part1_transition: 'part1-transition',
  part2_intro: 'part2-intro',
  part2_begin_speaking: 'part2-launch',
  part2_transition: 'part2-transition',
  part3_intro: 'part3-intro',
  test_complete: 'evaluation'
};

const FIXED_PHRASE_KIND: Record<ExaminerPhraseId, SpeakingSessionSegmentDto['kind']> = {
  welcome_intro: 'fixed_phrase',
  id_check: 'fixed_phrase',
  part1_begin: 'fixed_phrase',
  part1_transition: 'transition',
  part2_intro: 'cue_card',
  part2_begin_speaking: 'fixed_phrase',
  part2_transition: 'transition',
  part3_intro: 'fixed_phrase',
  test_complete: 'fixed_phrase'
};

@Service()
export class SpeakingSessionPackageService {
  constructor(
    private readonly examinerPhraseService: ExaminerPhraseService = new ExaminerPhraseService(),
    private readonly examinerProfileService: SpeakingExaminerProfileService = new SpeakingExaminerProfileService(),
    private readonly audioAssetService: SpeakingAudioAssetService = new SpeakingAudioAssetService()
  ) {}

  public async buildSessionPackage(
    parts: SpeakingSessionPackagePartDefinition[]
  ): Promise<SpeakingSessionPackageDto> {
    const examinerProfile = this.examinerProfileService.resolveProfile();
    const segments: SpeakingSessionSegmentDto[] = [];

    for (const phrase of this.examinerPhraseService.listCacheablePhrases()) {
      segments.push(await this.buildFixedPhraseSegment(examinerProfile, phrase));
    }

    for (const part of parts) {
      const partSegments = await this.buildPartSegments(examinerProfile, part);
      segments.push(...partSegments);
    }

    return {
      version: 1,
      preparedAt: new Date(),
      examinerProfile,
      segments
    };
  }

  private async buildFixedPhraseSegment(
    examinerProfile: SpeakingExaminerProfile,
    phrase: ExaminerPhrase
  ): Promise<SpeakingSessionSegmentDto> {
    const cacheKey = this.audioAssetService.buildFixedPhraseCacheKey(examinerProfile.id, phrase.id);
    const asset = await this.audioAssetService.getFixedPhraseAsset(examinerProfile.id, phrase.id);
    const storagePath = `fixed/${examinerProfile.id}/${phrase.id}.mp3`;

    return {
      segmentId: `fixed:${phrase.id}`,
      part: FIXED_PHRASE_PART[phrase.id],
      phase: FIXED_PHRASE_PHASE[phrase.id],
      kind: FIXED_PHRASE_KIND[phrase.id],
      turnType: 'examiner',
      canAutoAdvance: true,
      phraseId: phrase.id,
      text: phrase.text,
      audioAssetId: this.resolveAudioAssetId(asset, cacheKey),
      audioUrl: asset?.publicUrl || this.buildFallbackAudioUrl(storagePath),
      cacheKey,
      provider: asset?.provider || examinerProfile.provider,
      durationSeconds: asset?.durationSeconds
    };
  }

  private async buildPartSegments(
    examinerProfile: SpeakingExaminerProfile,
    part: SpeakingSessionPackagePartDefinition
  ): Promise<SpeakingSessionSegmentDto[]> {
    if (part.part === 2) {
      return [await this.buildCueCardSegment(examinerProfile, part)];
    }

    if (part.part !== 1 && part.part !== 3) {
      return [];
    }

    const prompts = this.extractSeedPrompts(part.question).slice(0, this.getSeedPromptCap(part.part));
    const segments: SpeakingSessionSegmentDto[] = [];

    for (const [promptIndex, text] of prompts.entries()) {
      segments.push(await this.buildSeedPromptSegment(examinerProfile, part, text, promptIndex));
    }

    return segments;
  }

  private async buildCueCardSegment(
    examinerProfile: SpeakingExaminerProfile,
    part: SpeakingSessionPackagePartDefinition
  ): Promise<SpeakingSessionSegmentDto> {
    const normalizedTopicId = this.normalizeTopicId(part.topicId || part.topicTitle || 'part2-topic');
    const cacheKey = this.audioAssetService.buildQuestionCacheKey({
      voiceProfileId: examinerProfile.id,
      part: 2,
      topicId: normalizedTopicId,
      promptIndex: 0,
      text: part.question
    });
    const asset = await this.audioAssetService.getQuestionAsset({
      voiceProfileId: examinerProfile.id,
      part: 2,
      topicId: normalizedTopicId,
      promptIndex: 0,
      text: part.question
    });
    const storagePath = `questions/${examinerProfile.id}/part2/${normalizedTopicId}/cue-card.mp3`;

    return {
      segmentId: `part2:${normalizedTopicId}:cue-card`,
      part: 2,
      phase: 'cue-card',
      kind: 'cue_card',
      turnType: 'examiner',
      canAutoAdvance: true,
      promptIndex: 0,
      text: part.question,
      audioAssetId: this.resolveAudioAssetId(asset, cacheKey),
      audioUrl: asset?.publicUrl || this.buildFallbackAudioUrl(storagePath),
      cacheKey,
      provider: asset?.provider || examinerProfile.provider,
      durationSeconds: asset?.durationSeconds
    };
  }

  private async buildSeedPromptSegment(
    examinerProfile: SpeakingExaminerProfile,
    part: SpeakingSessionPackagePartDefinition,
    text: string,
    promptIndex: number
  ): Promise<SpeakingSessionSegmentDto> {
    const normalizedTopicId = this.normalizeTopicId(part.topicId || part.topicTitle || `part${part.part}-topic`);
    const assetLookup = {
      voiceProfileId: examinerProfile.id,
      part: part.part,
      topicId: normalizedTopicId,
      promptIndex,
      text
    } as const;
    const cacheKey = this.audioAssetService.buildQuestionCacheKey(assetLookup);
    const asset = await this.audioAssetService.getQuestionAsset(assetLookup);
    const storagePath = `questions/${examinerProfile.id}/part${part.part}/${normalizedTopicId}/question-${promptIndex}.mp3`;

    return {
      segmentId: `part${part.part}:${normalizedTopicId}:question-${promptIndex}`,
      part: part.part,
      phase: 'question-seed',
      kind: 'seed_prompt',
      turnType: 'examiner',
      canAutoAdvance: true,
      promptIndex,
      text,
      audioAssetId: this.resolveAudioAssetId(asset, cacheKey),
      audioUrl: asset?.publicUrl || this.buildFallbackAudioUrl(storagePath),
      cacheKey,
      provider: asset?.provider || examinerProfile.provider,
      durationSeconds: asset?.durationSeconds
    };
  }

  private extractSeedPrompts(questionText: string) {
    return questionText
      .split('\n')
      .map(item => item.trim())
      .filter(item => item.length > 0 && !item.startsWith('•') && item.toLowerCase() !== 'you should say:');
  }

  private getSeedPromptCap(part: 1 | 3) {
    return part === 1 ? 4 : 3;
  }

  private normalizeTopicId(topicId: string) {
    return this.audioAssetService.normalizeText(topicId || 'general-topic');
  }

  private buildFallbackAudioUrl(storagePath: string) {
    const baseUrl = env.speaking.audioBaseUrl.replace(/\/+$/, '');
    const normalizedPath = storagePath.replace(/^\/+/, '');
    return `${baseUrl}/${normalizedPath}`;
  }

  private resolveAudioAssetId(
    asset: { _id?: string | { toString(): string } } | null,
    cacheKey: string
  ) {
    if (!asset?._id) {
      return cacheKey;
    }

    return typeof asset._id === 'string' ? asset._id : asset._id.toString();
  }
}
