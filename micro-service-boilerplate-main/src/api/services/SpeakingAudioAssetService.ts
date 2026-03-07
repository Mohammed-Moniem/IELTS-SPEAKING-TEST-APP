import { SpeakingAudioAssetModel } from '@models/SpeakingAudioAssetModel';
import { Service } from 'typedi';

interface QuestionAssetLookupInput {
  voiceProfileId: string;
  part: number;
  topicId: string;
  promptIndex: number;
  text: string;
}

@Service()
export class SpeakingAudioAssetService {
  public buildFixedPhraseCacheKey(voiceProfileId: string, phraseId: string) {
    return `fixed:${voiceProfileId}:${phraseId}`;
  }

  public buildQuestionCacheKey({ voiceProfileId, part, topicId, promptIndex, text }: QuestionAssetLookupInput) {
    return [
      'question',
      voiceProfileId,
      `part${part}`,
      topicId,
      String(promptIndex),
      this.normalizeText(text)
    ].join(':');
  }

  public async getFixedPhraseAsset(voiceProfileId: string, phraseId: string) {
    return SpeakingAudioAssetModel.findOne({
      cacheKey: this.buildFixedPhraseCacheKey(voiceProfileId, phraseId)
    });
  }

  public async getQuestionAsset(input: QuestionAssetLookupInput) {
    return SpeakingAudioAssetModel.findOne({
      cacheKey: this.buildQuestionCacheKey(input)
    });
  }

  public normalizeText(text: string) {
    return text
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }
}
