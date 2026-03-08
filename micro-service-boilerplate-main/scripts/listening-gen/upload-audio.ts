import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

import { PIPELINE_CONFIG } from './config';
import {
  loadState,
  saveState,
  getSectionsNeedingStep,
  logError,
} from './state';

// ---------------------------------------------------------------------------
// Supabase client
// ---------------------------------------------------------------------------
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function createSupabaseClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const BUCKET = PIPELINE_CONFIG.supabaseBucket;
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 1000;

// ---------------------------------------------------------------------------
// Retry helper with exponential backoff
// ---------------------------------------------------------------------------
async function withRetry<T>(
  fn: () => Promise<T>,
  label: string
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      if (attempt < MAX_RETRIES - 1) {
        const delayMs = BASE_BACKOFF_MS * Math.pow(4, attempt); // 1s, 4s, 16s
        console.log(`    Retry ${attempt + 1}/${MAX_RETRIES} for ${label} in ${delayMs}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError;
}

// ---------------------------------------------------------------------------
// Upload a single section's audio
// ---------------------------------------------------------------------------
async function uploadOne(
  supabase: ReturnType<typeof createSupabaseClient>,
  sectionKey: string,
  sectionType: string,
  fingerprint: string,
  localAudioPath: string
): Promise<string> {
  const fileBuffer = fs.readFileSync(localAudioPath);
  const storagePath = `${sectionType}/${fingerprint}.mp3`;

  await withRetry(
    async () => {
      const result = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, fileBuffer, {
          contentType: 'audio/mpeg',
          upsert: true,
        });

      if (result.error) {
        throw new Error(`Supabase upload error: ${result.error.message}`);
      }

      return result;
    },
    `upload ${sectionKey}`
  );

  // Construct public URL
  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${storagePath}`;
  return publicUrl;
}

// ---------------------------------------------------------------------------
// Main entry: upload all synthesized audio
// ---------------------------------------------------------------------------
export async function uploadAllAudio(): Promise<void> {
  const state = loadState();
  state.lastStep = 'uploading';
  saveState(state);

  const pendingSections = getSectionsNeedingStep(state, 'audio_ready');

  if (pendingSections.length === 0) {
    console.log('  No sections need audio upload.');
    return;
  }

  console.log(`  ${pendingSections.length} sections need audio upload.`);

  const supabase = createSupabaseClient();

  for (let i = 0; i < pendingSections.length; i += PIPELINE_CONFIG.batchSize) {
    const batch = pendingSections.slice(i, i + PIPELINE_CONFIG.batchSize);
    const batchNum = Math.floor(i / PIPELINE_CONFIG.batchSize) + 1;
    const totalBatches = Math.ceil(pendingSections.length / PIPELINE_CONFIG.batchSize);

    console.log(`  Upload batch ${batchNum}/${totalBatches} (${batch.length} sections)...`);

    for (const [key, sectionState] of batch) {
      if (!sectionState.audioPath) {
        logError(state, 'upload', `No audio path for section ${key}`, key);
        continue;
      }

      if (!fs.existsSync(sectionState.audioPath)) {
        logError(state, 'upload', `Audio file not found for ${key}: ${sectionState.audioPath}`, key);
        continue;
      }

      try {
        console.log(`    Uploading ${key}...`);

        const publicUrl = await uploadOne(
          supabase,
          key,
          sectionState.sectionType,
          sectionState.fingerprint,
          sectionState.audioPath
        );

        sectionState.status = 'uploaded';
        sectionState.uploadedUrl = publicUrl;

        console.log(`    Uploaded: ${publicUrl}`);
      } catch (err: any) {
        logError(state, 'upload', `Upload failed for ${key}: ${err.message}`, key);
      }
    }

    saveState(state);
    console.log(`  Upload batch ${batchNum} complete.`);
  }
}
