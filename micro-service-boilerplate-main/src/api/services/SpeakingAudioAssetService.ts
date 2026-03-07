import { SpeakingAudioAssetModel } from '@models/SpeakingAudioAssetModel';
import { uploadToSupabaseStorage } from '@lib/db/supabaseStorage';
import { Service } from 'typedi';

import { env } from '../../env';

interface QuestionAssetLookupInput {
  voiceProfileId: string;
  part: number;
  topicId: string;
  promptIndex: number;
  text: string;
}

interface DynamicFollowUpAssetInput {
  voiceProfileId: string;
  provider: 'openai' | 'elevenlabs' | 'edge-tts';
  text: string;
  audioBuffer: Buffer;
  mimeType?: string;
  durationSeconds?: number;
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

  public buildDynamicFollowUpCacheKey(voiceProfileId: string, text: string) {
    return ['dynamic-follow-up', voiceProfileId, this.normalizeText(text)].join(':');
  }

  public async getDynamicFollowUpAsset(voiceProfileId: string, text: string) {
    return SpeakingAudioAssetModel.findOne({
      cacheKey: this.buildDynamicFollowUpCacheKey(voiceProfileId, text)
    });
  }

  public async cacheDynamicFollowUpAsset(input: DynamicFollowUpAssetInput) {
    const cacheKey = this.buildDynamicFollowUpCacheKey(input.voiceProfileId, input.text);
    const storagePath = `speaking/follow-ups/${input.voiceProfileId}/${this.normalizeText(input.text)}.mp3`;
    const upload = await uploadToSupabaseStorage(
      env.storage.supabase.audioBucket,
      storagePath,
      input.audioBuffer,
      input.mimeType || 'audio/mpeg'
    );

    return SpeakingAudioAssetModel.findOneAndUpdate(
      { cacheKey },
      {
        $set: {
          kind: 'dynamic_follow_up',
          cacheKey,
          text: input.text,
          voiceProfileId: input.voiceProfileId,
          provider: input.provider,
          storagePath,
          publicUrl: upload.signedUrl,
          mimeType: input.mimeType || 'audio/mpeg',
          durationSeconds: input.durationSeconds,
          status: 'ready',
          lastUsedAt: new Date()
        }
      },
      {
        new: true,
        upsert: true
      }
    );
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
