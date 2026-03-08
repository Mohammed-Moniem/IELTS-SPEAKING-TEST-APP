import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

import { PIPELINE_CONFIG } from './config';
import { getPromptsNeedingStep, loadState, logError, saveState } from './state';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function createSupabaseClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

export async function uploadAllAudio(): Promise<void> {
  const state = loadState();
  state.lastStep = 'uploading';
  saveState(state);

  const pendingPrompts = getPromptsNeedingStep(state, 'audio_ready');
  if (!pendingPrompts.length) {
    console.log('  No speaking prompts need upload.');
    return;
  }

  const supabase = createSupabaseClient();

  for (let index = 0; index < pendingPrompts.length; index += PIPELINE_CONFIG.batchSize) {
    const batch = pendingPrompts.slice(index, index + PIPELINE_CONFIG.batchSize);

    for (const [cacheKey, prompt] of batch) {
      if (!prompt.localAudioPath || !fs.existsSync(prompt.localAudioPath)) {
        logError(state, 'upload', 'Local audio file missing for speaking prompt upload', cacheKey);
        continue;
      }

      try {
        const uploadResult = await supabase.storage.from(PIPELINE_CONFIG.supabaseBucket).upload(
          prompt.storagePath,
          fs.readFileSync(prompt.localAudioPath),
          {
            contentType: prompt.mimeType || 'audio/mpeg',
            upsert: true,
          }
        );

        if (uploadResult.error) {
          throw new Error(uploadResult.error.message);
        }

        prompt.publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${PIPELINE_CONFIG.supabaseBucket}/${prompt.storagePath}`;
        prompt.status = 'uploaded';
      } catch (error: any) {
        logError(state, 'upload', `Speaking audio upload failed: ${error.message}`, cacheKey);
      }
    }

    saveState(state);
  }
}

