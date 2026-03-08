import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFile as execFileCb } from 'child_process';
import { promisify } from 'util';

import { AUDIO_CONFIG, PIPELINE_CONFIG } from './config';
import {
  loadState,
  saveState,
  getSectionsNeedingStep,
  audioFilePath,
  logError,
} from './state';
import type { EnrichedSectionContent } from './types';

const execFile = promisify(execFileCb);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate a silence file of given duration using FFmpeg */
async function generateSilence(durationS: number, outPath: string): Promise<void> {
  await execFile('ffmpeg', [
    '-y',
    '-f', 'lavfi',
    '-i', `anullsrc=r=${AUDIO_CONFIG.sampleRate}:cl=mono`,
    '-t', String(durationS),
    '-ar', String(AUDIO_CONFIG.sampleRate),
    '-ac', '1',
    '-c:a', 'libmp3lame',
    '-b:a', AUDIO_CONFIG.bitrate,
    outPath,
  ]);
}

/** Get audio duration in seconds via ffprobe */
async function getAudioDuration(filePath: string): Promise<number> {
  const { stdout } = await execFile('ffprobe', [
    '-v', 'quiet',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    filePath,
  ]);
  return parseFloat(stdout.trim());
}

/** Synthesize a single text segment using edge-tts CLI */
async function synthesizeSegment(
  text: string,
  voice: string,
  outPath: string
): Promise<void> {
  const TEXT_LENGTH_THRESHOLD = 200;

  if (text.length > TEXT_LENGTH_THRESHOLD) {
    const tmpFile = path.join(os.tmpdir(), `edge-tts-input-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`);
    fs.writeFileSync(tmpFile, text, 'utf-8');
    try {
      await execFile('edge-tts', [
        '--voice', voice,
        '--file', tmpFile,
        '--write-media', outPath,
      ]);
    } finally {
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    }
  } else {
    await execFile('edge-tts', [
      '--voice', voice,
      '--text', text,
      '--write-media', outPath,
    ]);
  }
}

// ---------------------------------------------------------------------------
// Main synthesis for a single section
// ---------------------------------------------------------------------------
async function synthesizeSection(
  key: string,
  content: EnrichedSectionContent,
  outputMp3: string
): Promise<number> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'listen-synth-'));
  const segmentFiles: string[] = [];

  try {
    // 1. Generate opening silence (exam instructions pause)
    const startSilencePath = path.join(tmpDir, 'start_silence.mp3');
    await generateSilence(AUDIO_CONFIG.questionBoundaryPause, startSilencePath);
    segmentFiles.push(startSilencePath);

    // 2. Build a speaker -> voice lookup from the enriched content
    const speakerVoiceMap = new Map<string, string>();
    for (const speaker of content.speakers) {
      speakerVoiceMap.set(speaker.label, speaker.voice);
    }
    // Fallback voice (first speaker's voice)
    const fallbackVoice = content.speakers[0]?.voice || 'en-GB-SoniaNeural';

    // 3. Synthesize each transcript segment with inter-segment silence
    let prevSpeaker: string | null = null;

    for (let i = 0; i < content.transcriptSegments.length; i++) {
      const seg = content.transcriptSegments[i];

      // Determine the voice for this segment's speaker
      const segVoice = speakerVoiceMap.get(seg.speaker) || fallbackVoice;

      // Insert silence gap before this segment (except the first)
      if (i > 0) {
        const silenceDuration =
          seg.speaker === prevSpeaker
            ? AUDIO_CONFIG.sameSpeakerPause
            : AUDIO_CONFIG.differentSpeakerPause;

        const silencePath = path.join(tmpDir, `silence_${i}.mp3`);
        await generateSilence(silenceDuration, silencePath);
        segmentFiles.push(silencePath);
      }

      // Synthesize the segment audio
      const segPath = path.join(tmpDir, `segment_${i}.mp3`);
      await synthesizeSegment(seg.text, segVoice, segPath);
      segmentFiles.push(segPath);

      prevSpeaker = seg.speaker || null;
    }

    // 4. Create concat list file for FFmpeg
    const concatListPath = path.join(tmpDir, 'concat.txt');
    const concatContent = segmentFiles
      .map((f) => `file '${f.replace(/'/g, "'\\''")}'`)
      .join('\n');
    fs.writeFileSync(concatListPath, concatContent, 'utf-8');

    // 5. Concatenate all segments
    const rawConcatPath = path.join(tmpDir, 'raw_concat.mp3');
    await execFile('ffmpeg', [
      '-y',
      '-f', 'concat',
      '-safe', '0',
      '-i', concatListPath,
      '-c', 'copy',
      rawConcatPath,
    ]);

    // 6. Normalize loudness and produce final output
    const outputDir = path.dirname(outputMp3);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    await execFile('ffmpeg', [
      '-y',
      '-i', rawConcatPath,
      '-af', `loudnorm=I=${AUDIO_CONFIG.loudnormTarget}:LRA=${AUDIO_CONFIG.loudnormLRA}:TP=${AUDIO_CONFIG.loudnormTP}`,
      '-ar', String(AUDIO_CONFIG.sampleRate),
      '-ac', String(AUDIO_CONFIG.channels),
      '-c:a', 'libmp3lame',
      '-b:a', AUDIO_CONFIG.bitrate,
      outputMp3,
    ]);

    // 7. Get final duration
    const duration = await getAudioDuration(outputMp3);
    return duration;
  } finally {
    // Cleanup temp dir
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Best-effort cleanup
    }
  }
}

// ---------------------------------------------------------------------------
// Main entry: synthesize all pending audio
// ---------------------------------------------------------------------------
export async function synthesizeAllAudio(): Promise<void> {
  const state = loadState();
  state.lastStep = 'synthesizing';
  saveState(state);

  const pendingSections = getSectionsNeedingStep(state, 'content_ready');

  if (pendingSections.length === 0) {
    console.log('  No sections need audio synthesis.');
    return;
  }

  console.log(`  ${pendingSections.length} sections need audio synthesis.`);

  for (let i = 0; i < pendingSections.length; i += PIPELINE_CONFIG.batchSize) {
    const batch = pendingSections.slice(i, i + PIPELINE_CONFIG.batchSize);
    const batchNum = Math.floor(i / PIPELINE_CONFIG.batchSize) + 1;
    const totalBatches = Math.ceil(pendingSections.length / PIPELINE_CONFIG.batchSize);

    console.log(`  Audio batch ${batchNum}/${totalBatches} (${batch.length} sections)...`);

    // Process audio sequentially within batch to avoid overwhelming edge-tts
    for (const [key, sectionState] of batch) {
      if (!sectionState.contentPath) {
        logError(state, 'synthesize', `No content path for section ${key}`, key);
        continue;
      }

      try {
        const contentRaw = fs.readFileSync(sectionState.contentPath, 'utf-8');
        const content: EnrichedSectionContent = JSON.parse(contentRaw);

        const outPath = audioFilePath(key);
        console.log(`    Synthesizing ${key}...`);

        const duration = await synthesizeSection(key, content, outPath);

        sectionState.status = 'audio_ready';
        sectionState.audioPath = outPath;
        sectionState.audioDurationSeconds = duration;
      } catch (err: any) {
        logError(state, 'synthesize', `Audio synthesis failed for ${key}: ${err.message}`, key);
      }
    }

    saveState(state);
    console.log(`  Audio batch ${batchNum} complete.`);
  }
}
