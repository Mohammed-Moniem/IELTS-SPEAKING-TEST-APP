import { createHash } from 'crypto';
import fs from 'fs';
import { execFile as execFileCb } from 'child_process';
import { promisify } from 'util';

import OpenAI from 'openai';

import { env } from '../../src/env';

import { PIPELINE_CONFIG } from './config';
import { audioFilePath, getPromptsNeedingStep, loadState, logError, saveState } from './state';

const execFile = promisify(execFileCb);

async function getAudioDuration(filePath: string): Promise<number | undefined> {
  try {
    const { stdout } = await execFile('ffprobe', [
      '-v',
      'quiet',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      filePath,
    ]);
    const duration = Number.parseFloat(stdout.trim());
    return Number.isFinite(duration) ? duration : undefined;
  } catch {
    return undefined;
  }
}

export async function synthesizeAllAudio(limit?: number): Promise<void> {
  const state = loadState();
  state.lastStep = 'synthesizing';
  saveState(state);

  const pendingPrompts = getPromptsNeedingStep(state, 'exported').slice(
    0,
    limit || Number.MAX_SAFE_INTEGER
  );

  if (!pendingPrompts.length) {
    console.log('  No speaking prompts need synthesis.');
    return;
  }

  if (!env.openai.apiKey) {
    throw new Error('OPENAI_API_KEY is required for speaking audio synthesis');
  }

  const client = new OpenAI({ apiKey: env.openai.apiKey });

  for (let index = 0; index < pendingPrompts.length; index += PIPELINE_CONFIG.batchSize) {
    const batch = pendingPrompts.slice(index, index + PIPELINE_CONFIG.batchSize);

    for (const [cacheKey, prompt] of batch) {
      try {
        const response = await client.audio.speech.create({
          model: env.openai.ttsModel || 'gpt-4o-mini-tts',
          voice: prompt.voiceId as any,
          input: prompt.text,
          response_format: 'mp3' as any,
        });

        const buffer = Buffer.from(await response.arrayBuffer());
        const outPath = audioFilePath(cacheKey);
        fs.writeFileSync(outPath, buffer);

        prompt.localAudioPath = outPath;
        prompt.mimeType = 'audio/mpeg';
        prompt.checksum = createHash('sha1').update(buffer).digest('hex');
        prompt.durationSeconds = await getAudioDuration(outPath);
        prompt.status = 'audio_ready';
      } catch (error: any) {
        logError(state, 'synthesize', `Speaking audio synthesis failed: ${error.message}`, cacheKey);
      }
    }

    saveState(state);
  }
}

