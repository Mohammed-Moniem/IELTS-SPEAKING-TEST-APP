import { SpeakingAudioAssetModel } from '../../src/api/models/SpeakingAudioAssetModel';

import { getPromptsNeedingStep, loadState, logError, saveState } from './state';

export async function registerAssets(): Promise<void> {
  const state = loadState();
  state.lastStep = 'registering';
  saveState(state);

  const pendingPrompts = getPromptsNeedingStep(state, 'uploaded');
  if (!pendingPrompts.length) {
    console.log('  No speaking prompts need registration.');
    return;
  }

  for (const [cacheKey, prompt] of pendingPrompts) {
    try {
      const existing = await SpeakingAudioAssetModel.findOne({ cacheKey });

      if (existing) {
        existing.kind = prompt.kind;
        existing.text = prompt.text;
        existing.voiceProfileId = prompt.voiceProfileId;
        existing.provider = prompt.provider;
        existing.storagePath = prompt.storagePath;
        existing.publicUrl = prompt.publicUrl;
        existing.mimeType = prompt.mimeType;
        existing.durationSeconds = prompt.durationSeconds;
        existing.checksum = prompt.checksum;
        existing.status = 'ready';
        await existing.save();
      } else {
        await SpeakingAudioAssetModel.create({
          kind: prompt.kind,
          cacheKey,
          text: prompt.text,
          voiceProfileId: prompt.voiceProfileId,
          provider: prompt.provider,
          storagePath: prompt.storagePath,
          publicUrl: prompt.publicUrl,
          mimeType: prompt.mimeType,
          durationSeconds: prompt.durationSeconds,
          checksum: prompt.checksum,
          status: 'ready',
        });
      }

      prompt.status = 'registered';
    } catch (error: any) {
      logError(state, 'register', `Speaking asset registration failed: ${error.message}`, cacheKey);
    }
  }

  saveState(state);
}

