import dotenv from 'dotenv';
import path from 'path';
import mongoose from 'mongoose';

import { loadState } from './state';
import { generateAllSections } from './generate-content';
import { synthesizeAllAudio } from './synthesize-audio';
import { uploadAllAudio } from './upload-audio';
import { registerSections, composeTests } from './register-tests';

// ---------------------------------------------------------------------------
// Load environment variables from project root .env
// ---------------------------------------------------------------------------
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// ---------------------------------------------------------------------------
// Step definitions
// ---------------------------------------------------------------------------
type StepName = 'generate' | 'synthesize' | 'upload' | 'register' | 'compose';

interface PipelineStep {
  name: StepName;
  label: string;
  run: () => Promise<void>;
  needsMongo: boolean;
}

const STEPS: PipelineStep[] = [
  {
    name: 'generate',
    label: 'Generate content via OpenAI',
    run: generateAllSections,
    needsMongo: false,
  },
  {
    name: 'synthesize',
    label: 'Synthesize audio via edge-tts + FFmpeg',
    run: synthesizeAllAudio,
    needsMongo: false,
  },
  {
    name: 'upload',
    label: 'Upload audio to Supabase Storage',
    run: uploadAllAudio,
    needsMongo: false,
  },
  {
    name: 'register',
    label: 'Register sections in MongoDB',
    run: registerSections,
    needsMongo: true,
  },
  {
    name: 'compose',
    label: 'Compose full listening tests',
    run: composeTests,
    needsMongo: true,
  },
];

// ---------------------------------------------------------------------------
// CLI arg parsing
// ---------------------------------------------------------------------------
function parseArgs(): { fromStep: StepName | null } {
  const args = process.argv.slice(2);
  let fromStep: StepName | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--from' && args[i + 1]) {
      fromStep = args[i + 1] as StepName;
      i++;
    }
  }

  return { fromStep };
}

// ---------------------------------------------------------------------------
// MongoDB connection helpers
// ---------------------------------------------------------------------------
async function connectMongo(): Promise<void> {
  const mongoUrl = process.env.MONGO_URL || process.env.MONGODB_URL;
  if (!mongoUrl) {
    throw new Error('MONGO_URL (or MONGODB_URL) environment variable is not set');
  }
  await mongoose.connect(mongoUrl);
  console.log('  Connected to MongoDB.');
}

async function disconnectMongo(): Promise<void> {
  await mongoose.disconnect();
  console.log('  Disconnected from MongoDB.');
}

// ---------------------------------------------------------------------------
// Main pipeline
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  const { fromStep } = parseArgs();

  console.log('========================================');
  console.log('  IELTS Listening Test Pipeline');
  console.log('========================================\n');

  // Determine which steps to run
  let startIndex = 0;
  if (fromStep) {
    const idx = STEPS.findIndex((s) => s.name === fromStep);
    if (idx === -1) {
      console.error(
        `Unknown step: "${fromStep}". Valid steps: ${STEPS.map((s) => s.name).join(', ')}`
      );
      process.exit(1);
    }
    startIndex = idx;
    console.log(`Resuming from step: ${fromStep}\n`);
  }

  const stepsToRun = STEPS.slice(startIndex);

  let mongoConnected = false;

  const stepErrors: Array<{ step: string; error: string }> = [];

  for (const step of stepsToRun) {
    console.log(`\n--- Step: ${step.label} ---`);
    const startTime = Date.now();

    try {
      // Connect to MongoDB if this step needs it and we haven't yet
      if (step.needsMongo && !mongoConnected) {
        await connectMongo();
        mongoConnected = true;
      }

      await step.run();

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`  Completed in ${elapsed}s`);
    } catch (err: any) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.error(`  FAILED after ${elapsed}s: ${err.message}`);
      stepErrors.push({ step: step.name, error: err.message });

      // State is auto-saved by individual steps; continue to next step
      continue;
    }
  }

  // Disconnect MongoDB if we connected
  if (mongoConnected) {
    await disconnectMongo();
  }

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  console.log('\n========================================');
  console.log('  Pipeline Summary');
  console.log('========================================');

  try {
    const finalState = loadState();

    const totalSections = Object.keys(finalState.generatedSections).length;
    const byStatus: Record<string, number> = {};
    for (const sec of Object.values(finalState.generatedSections)) {
      byStatus[sec.status] = (byStatus[sec.status] || 0) + 1;
    }

    console.log(`  Total sections: ${totalSections}`);
    for (const [status, count] of Object.entries(byStatus)) {
      console.log(`    ${status}: ${count}`);
    }

    const totalTests = Object.keys(finalState.composedTests).length;
    console.log(`  Total tests composed: ${totalTests}`);
    console.log(`  Total errors logged: ${finalState.errors?.length || 0}`);
  } catch {
    console.log('  (Could not load final state)');
  }

  if (stepErrors.length > 0) {
    console.log(`\n  Step failures (${stepErrors.length}):`);
    for (const { step, error } of stepErrors) {
      console.log(`    - ${step}: ${error}`);
    }
  }

  console.log('\n  Done.');
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
main().catch((err) => {
  console.error('Fatal pipeline error:', err);
  process.exit(1);
});
