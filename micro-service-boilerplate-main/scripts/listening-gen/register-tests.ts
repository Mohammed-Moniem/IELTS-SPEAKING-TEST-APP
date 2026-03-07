import fs from 'fs';
import mongoose from 'mongoose';

import { PIPELINE_CONFIG, SECTION_TYPES } from './config';
import {
  loadState,
  saveState,
  getSectionsNeedingStep,
  contentFilePath,
  logError,
} from './state';
import type { EnrichedSectionContent } from './types';

// Models imported via relative path from the app's source
import { ListeningSectionModel } from '../../src/api/models/ListeningSectionModel';
import { ListeningTestModel } from '../../src/api/models/ListeningTestModel';

// ---------------------------------------------------------------------------
// Fisher-Yates shuffle
// ---------------------------------------------------------------------------
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------------------------------------------------------------------------
// Sub-step A: Register individual sections to MongoDB
// ---------------------------------------------------------------------------
export async function registerSections(): Promise<void> {
  const state = loadState();
  state.lastStep = 'registering';
  saveState(state);

  const pendingSections = getSectionsNeedingStep(state, 'uploaded');

  if (pendingSections.length === 0) {
    console.log('  No sections need registration.');
    return;
  }

  console.log(`  ${pendingSections.length} sections to register in MongoDB.`);

  for (const [key, sectionState] of pendingSections) {
    try {
      // Read the content JSON
      const cPath = sectionState.contentPath || contentFilePath(key);
      if (!fs.existsSync(cPath)) {
        logError(state, 'register', `Content file not found for ${key}: ${cPath}`, key);
        continue;
      }

      const content: EnrichedSectionContent = JSON.parse(
        fs.readFileSync(cPath, 'utf-8')
      );

      // Idempotency: check if a section with this fingerprint already exists
      const existing = await ListeningSectionModel.findOne({
        fingerprint: sectionState.fingerprint,
      });

      if (existing) {
        console.log(`    ${key} already registered (${existing._id}), skipping.`);
        sectionState.status = 'registered';
        sectionState.mongoId = existing._id.toString();
        continue;
      }

      // Deduce questionTypes from questions array
      const questionTypes = [...new Set(content.questions.map((q) => q.type))];

      // Build the section document matching ListeningSectionModel schema
      const doc = await ListeningSectionModel.create({
        sectionType: content.sectionType,
        title: content.title,
        topic: content.topic,
        context: content.context,
        speakers: content.speakers.map((s) => ({
          label: s.label,
          voice: s.voice,
          gender: s.gender,
        })),
        transcript: content.transcriptSegments.map((s) => s.text).join('\n\n'),
        transcriptSegments: content.transcriptSegments,
        questions: content.questions.map((q, idx) => ({
          questionId: q.questionId || `${content.sectionType}_q${idx + 1}`,
          sectionId: content.sectionType,
          type: q.type,
          prompt: q.prompt,
          instructions: q.instructions,
          groupId: q.groupId,
          options: q.options || [],
          correctAnswer: q.correctAnswer,
          answerSpec: q.answerSpec,
          explanation: q.explanation || '',
        })),
        questionTypes,
        audioUrl: sectionState.uploadedUrl,
        audioDurationSeconds: sectionState.audioDurationSeconds,
        fingerprint: content.fingerprint,
        source: 'pipeline',
        qualityTier: 'gen_v1',
        active: true,
      });

      sectionState.status = 'registered';
      sectionState.mongoId = doc._id.toString();

      console.log(`    Registered ${key} -> ${doc._id}`);
    } catch (err: any) {
      logError(state, 'register', `Registration failed for ${key}: ${err.message}`, key);
    }
  }

  saveState(state);
}

// ---------------------------------------------------------------------------
// Sub-step B: Compose full tests from registered sections
// ---------------------------------------------------------------------------
export async function composeTests(): Promise<void> {
  const state = loadState();
  state.lastStep = 'composing';
  saveState(state);

  // Group registered section mongoIds by sectionType
  const pools: Record<string, string[]> = {};
  for (const sectionType of SECTION_TYPES) {
    pools[sectionType] = [];
  }

  for (const [_key, sec] of Object.entries(state.generatedSections)) {
    if (sec.status === 'registered' && sec.mongoId) {
      if (pools[sec.sectionType]) {
        pools[sec.sectionType].push(sec.mongoId);
      }
    }
  }

  // Verify we have at least one of each type
  for (const sectionType of SECTION_TYPES) {
    if (pools[sectionType].length === 0) {
      console.log(`  WARNING: No registered sections for ${sectionType}, cannot compose tests.`);
      return;
    }
    console.log(`  Pool ${sectionType}: ${pools[sectionType].length} sections`);
  }

  // Shuffle each pool
  for (const sectionType of SECTION_TYPES) {
    pools[sectionType] = shuffle(pools[sectionType]);
  }

  // Check how many tests are already composed
  const existingTestCount = Object.keys(state.composedTests).length;
  const numTests = PIPELINE_CONFIG.testsToCompose;
  const remaining = numTests - existingTestCount;

  if (remaining <= 0) {
    console.log(`  Already have ${existingTestCount}/${numTests} tests composed.`);
    return;
  }

  console.log(`  Composing ${remaining} tests (${existingTestCount} already done)...`);

  let composed = 0;

  for (let t = existingTestCount; t < numTests; t++) {
    const testKey = `test_${String(t).padStart(4, '0')}`;

    // Skip if already composed
    if (state.composedTests[testKey]) {
      continue;
    }

    try {
      // Pick one section from each type (cycling through the pools)
      const sectionMongoIds: mongoose.Types.ObjectId[] = [];
      const sectionKeys: string[] = [];

      for (const sectionType of SECTION_TYPES) {
        const pool = pools[sectionType];
        const mongoId = pool[t % pool.length];
        sectionMongoIds.push(new mongoose.Types.ObjectId(mongoId));

        // Find the section key that has this mongoId
        const matchedEntry = Object.entries(state.generatedSections).find(
          ([, sec]) => sec.mongoId === mongoId
        );
        if (matchedEntry) {
          sectionKeys.push(matchedEntry[0]);
        }
      }

      // Load the section documents to populate legacy flat fields
      const sectionDocs = await ListeningSectionModel.find({
        _id: { $in: sectionMongoIds },
      });

      // Build legacy flat transcript (concatenation of all sections)
      const transcript = sectionDocs
        .map((doc: any) => {
          const title = doc.title || doc.sectionType;
          const text = doc.transcript || '';
          return `--- ${title} ---\n${text}`;
        })
        .join('\n\n');

      // Build legacy flat questions list
      const questions = sectionDocs.flatMap((doc: any) =>
        (doc.questions || []).map((q: any) => ({
          questionId: q.questionId,
          sectionId: q.sectionId || doc.sectionType,
          type: q.type,
          prompt: q.prompt,
          instructions: q.instructions,
          groupId: q.groupId,
          options: q.options || [],
          correctAnswer: q.correctAnswer || '',
          answerSpec: q.answerSpec,
          explanation: q.explanation || '',
        }))
      );

      const testTitle = `IELTS Listening Practice Test ${t + 1}`;

      const testDoc = await ListeningTestModel.create({
        track: 'academic',
        title: testTitle,
        sectionTitle: testTitle,
        transcript,
        audioUrl: sectionDocs[0]?.audioUrl || '',
        suggestedTimeMinutes: 30,
        questions,
        source: 'pipeline',
        autoPublished: true,
        active: true,
        // v2 fields
        schemaVersion: 'v2',
        qualityTier: 'gen_v1',
        sectionRefs: sectionMongoIds,
        sectionCount: sectionMongoIds.length,
      });

      // Track in state
      state.composedTests[testKey] = {
        sectionKeys,
        testMongoId: testDoc._id.toString(),
        status: 'composed',
      };

      composed++;

      if (composed % 50 === 0) {
        saveState(state);
        console.log(`    Progress: ${composed} tests composed...`);
      }
    } catch (err: any) {
      logError(state, 'compose', `Test composition failed for ${testKey}: ${err.message}`);
    }
  }

  saveState(state);
  console.log(`  Composed ${composed} new tests (${Object.keys(state.composedTests).length} total).`);
}
