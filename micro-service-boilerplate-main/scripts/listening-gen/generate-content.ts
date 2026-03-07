import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';

import { PIPELINE_CONFIG, SECTION_TYPES, SECTION_VOICE_POOLS, SECTION_TOPICS, SectionType } from './config';
import {
  loadState,
  saveState,
  sectionKey,
  contentFilePath,
  countSectionsByType,
  logError,
} from './state';
import type { EnrichedSectionContent, GeneratedSectionContent } from './types';

import { SYSTEM_PROMPT as S1_SYSTEM, buildUserPrompt as buildS1Prompt } from './prompts/section1-dialogue';
import { SYSTEM_PROMPT as S2_SYSTEM, buildUserPrompt as buildS2Prompt } from './prompts/section2-monologue';
import { SYSTEM_PROMPT as S3_SYSTEM, buildUserPrompt as buildS3Prompt } from './prompts/section3-discussion';
import { SYSTEM_PROMPT as S4_SYSTEM, buildUserPrompt as buildS4Prompt } from './prompts/section4-lecture';

// ---------------------------------------------------------------------------
// Anthropic client (lazy init so dotenv.config() in run-pipeline runs first)
// ---------------------------------------------------------------------------
let _anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!_anthropic) {
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _anthropic;
}

// ---------------------------------------------------------------------------
// Prompt mapping by section type
// ---------------------------------------------------------------------------
const SECTION_PROMPTS: Record<string, { system: string; buildUser: (topic: string, used: string[]) => string }> = {
  s1: { system: S1_SYSTEM, buildUser: buildS1Prompt },
  s2: { system: S2_SYSTEM, buildUser: buildS2Prompt },
  s3: { system: S3_SYSTEM, buildUser: buildS3Prompt },
  s4: { system: S4_SYSTEM, buildUser: buildS4Prompt },
};

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------
const VALID_QUESTION_TYPES = new Set([
  'multiple_choice',
  'multiple_choice_single',
  'multiple_choice_multiple',
  'true_false_not_given',
  'yes_no_not_given',
  'matching_headings',
  'matching_information',
  'matching_features',
  'matching_sentence_endings',
  'sentence_completion',
  'summary_completion',
  'note_table_flow_completion',
  'diagram_label_completion',
  'short_answer',
]);

function validateGenerated(data: GeneratedSectionContent): string[] {
  const errors: string[] = [];

  if (!data.questions || data.questions.length !== 10) {
    errors.push(`Expected exactly 10 questions, got ${data.questions?.length ?? 0}`);
  }

  if (data.questions) {
    for (let i = 0; i < data.questions.length; i++) {
      const q = data.questions[i];
      if (!VALID_QUESTION_TYPES.has(q.type)) {
        errors.push(`Question ${i + 1}: invalid type "${q.type}"`);
      }
      if (!q.correctAnswer && !q.answerSpec?.value) {
        errors.push(`Question ${i + 1}: missing correctAnswer or answerSpec.value`);
      }
    }
  }

  if (!data.transcriptSegments || data.transcriptSegments.length === 0) {
    errors.push('Missing transcriptSegments');
  }

  if (!data.title || data.title.trim().length === 0) {
    errors.push('Missing title');
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Fingerprint
// ---------------------------------------------------------------------------
function computeFingerprint(sectionType: string, topic: string, index: number): string {
  const raw = `${sectionType}::${topic}::${index}`;
  return crypto.createHash('sha1').update(raw).digest('hex').slice(0, 16);
}

// Track used topics per section type for prompt diversity
const usedTopicsMap: Record<string, string[]> = { s1: [], s2: [], s3: [], s4: [] };

// ---------------------------------------------------------------------------
// Single section generation
// ---------------------------------------------------------------------------
async function generateOneSection(
  sectionType: SectionType,
  topic: string,
  index: number,
  state: ReturnType<typeof loadState>
): Promise<EnrichedSectionContent | null> {
  const promptConfig = SECTION_PROMPTS[sectionType];
  if (!promptConfig) {
    logError(state, 'generate', `No prompt builder for section type: ${sectionType}`);
    return null;
  }

  const usedTopics = usedTopicsMap[sectionType] || [];
  const userPrompt = promptConfig.buildUser(topic, usedTopics);

  try {
    const response = await getAnthropic().messages.create({
      model: PIPELINE_CONFIG.claudeModel,
      max_tokens: 16384,
      system: promptConfig.system,
      messages: [
        { role: 'user', content: userPrompt },
      ],
    });

    // Extract text from response
    const textBlock = response.content.find((b) => b.type === 'text');
    const raw = textBlock?.text;
    if (!raw) {
      logError(state, 'generate', `Empty response for ${sectionType} #${index}`, sectionKey(sectionType, index));
      return null;
    }

    // Claude may wrap JSON in markdown code fences — strip them
    const jsonStr = raw.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
    const parsed: GeneratedSectionContent = JSON.parse(jsonStr);

    // Validate
    const validationErrors = validateGenerated(parsed);
    if (validationErrors.length > 0) {
      logError(
        state,
        'generate',
        `Validation failed for ${sectionType} #${index}: ${validationErrors.join('; ')}`,
        sectionKey(sectionType, index)
      );
      return null;
    }

    // Assign voice from pool (round-robin)
    const voicePool = SECTION_VOICE_POOLS[sectionType];
    const assignedVoice = voicePool[index % voicePool.length];

    // Compute fingerprint
    const fp = computeFingerprint(sectionType, topic, index);

    // Map speakers with voice assignments
    const speakersWithVoice = parsed.speakers.map((speaker, sIdx) => {
      const voiceInfo = assignedVoice.speakers[sIdx % assignedVoice.speakers.length];
      return {
        ...speaker,
        voice: voiceInfo.voice,
      };
    });

    // Track used topic
    usedTopicsMap[sectionType] = [...usedTopics, topic];

    const enriched: EnrichedSectionContent = {
      ...parsed,
      sectionType,
      speakers: speakersWithVoice,
      fingerprint: fp,
    };

    return enriched;
  } catch (err: any) {
    logError(state, 'generate', `Anthropic error for ${sectionType} #${index}: ${err.message}`, sectionKey(sectionType, index));
    return null;
  }
}

// ---------------------------------------------------------------------------
// Generate a batch of sections
// ---------------------------------------------------------------------------
async function generateBatch(
  tasks: Array<{ sectionType: SectionType; topic: string; index: number }>,
  state: ReturnType<typeof loadState>
): Promise<EnrichedSectionContent[]> {
  const results = await Promise.allSettled(
    tasks.map((t) => generateOneSection(t.sectionType, t.topic, t.index, state))
  );

  const sections: EnrichedSectionContent[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      sections.push(result.value);
    }
  }
  return sections;
}

// ---------------------------------------------------------------------------
// Main entry: generate all sections
// ---------------------------------------------------------------------------
export async function generateAllSections(): Promise<void> {
  const state = loadState();
  state.lastStep = 'generating';
  saveState(state);

  // Build the work queue: for each section type, figure out how many more we need
  const tasks: Array<{ sectionType: SectionType; topic: string; index: number }> = [];

  for (const sectionType of SECTION_TYPES) {
    const existing = countSectionsByType(state, sectionType);
    const needed = PIPELINE_CONFIG.sectionsPerType - existing;

    if (needed <= 0) {
      console.log(`  [${sectionType}] Already have ${existing}/${PIPELINE_CONFIG.sectionsPerType} sections, skipping.`);
      continue;
    }

    console.log(`  [${sectionType}] Need ${needed} more sections (have ${existing}).`);

    const topics = SECTION_TOPICS[sectionType];

    for (let i = 0; i < needed; i++) {
      const topic = topics[(existing + i) % topics.length];
      tasks.push({ sectionType, topic, index: existing + i });
    }
  }

  if (tasks.length === 0) {
    console.log('  All sections already generated.');
    return;
  }

  console.log(`  Total generation tasks: ${tasks.length}`);

  // Process in batches
  for (let batchStart = 0; batchStart < tasks.length; batchStart += PIPELINE_CONFIG.batchSize) {
    const batch = tasks.slice(batchStart, batchStart + PIPELINE_CONFIG.batchSize);
    const batchNum = Math.floor(batchStart / PIPELINE_CONFIG.batchSize) + 1;
    const totalBatches = Math.ceil(tasks.length / PIPELINE_CONFIG.batchSize);

    console.log(`  Batch ${batchNum}/${totalBatches} (${batch.length} sections)...`);

    const sections = await generateBatch(batch, state);

    // Write each section to disk and update state
    for (const section of sections) {
      const key = sectionKey(section.sectionType, Object.keys(state.generatedSections).length);
      const filePath = contentFilePath(key);
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(filePath, JSON.stringify(section, null, 2), 'utf-8');

      state.generatedSections[key] = {
        sectionType: section.sectionType,
        index: Object.values(state.generatedSections).filter(s => s.sectionType === section.sectionType).length,
        fingerprint: section.fingerprint,
        contentPath: filePath,
        status: 'content_ready',
      };
    }

    saveState(state);
    console.log(`  Batch ${batchNum} complete: ${sections.length} sections written.`);
  }
}
