import dotenv from 'dotenv';
import path from 'path';

import { exportSpeakingPrompts } from './export-prompts';
import { synthesizeAllAudio } from './synthesize-audio';
import { uploadAllAudio } from './upload-audio';
import { registerAssets } from './register-assets';
import { loadState } from './state';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

type StepName = 'export' | 'synthesize' | 'upload' | 'register';

interface ParsedArgs {
  fromStep: StepName | null;
  limit?: number;
  voiceProfileId?: string;
}

function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2);
  let fromStep: StepName | null = null;
  let limit: number | undefined;
  let voiceProfileId: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--from' && args[index + 1]) {
      fromStep = args[index + 1] as StepName;
      index += 1;
    } else if (arg === '--limit' && args[index + 1]) {
      limit = Number.parseInt(args[index + 1], 10);
      index += 1;
    } else if (arg === '--voice-profile' && args[index + 1]) {
      voiceProfileId = args[index + 1];
      index += 1;
    }
  }

  return { fromStep, limit, voiceProfileId };
}

async function main(): Promise<void> {
  const { fromStep, limit, voiceProfileId } = parseArgs();
  const steps: Array<{ name: StepName; run: () => Promise<void> }> = [
    {
      name: 'export',
      run: () => exportSpeakingPrompts({ limitPerCategory: limit, voiceProfileId }).then(() => undefined),
    },
    {
      name: 'synthesize',
      run: () => synthesizeAllAudio(limit),
    },
    {
      name: 'upload',
      run: () => uploadAllAudio(),
    },
    {
      name: 'register',
      run: () => registerAssets(),
    },
  ];

  const startIndex = fromStep ? Math.max(steps.findIndex(step => step.name === fromStep), 0) : 0;

  for (const step of steps.slice(startIndex)) {
    console.log(`\n--- Speaking pipeline step: ${step.name} ---`);
    await step.run();
  }

  const finalState = loadState();
  console.log('\nSpeaking pipeline complete.');
  console.log(`Prompts tracked: ${Object.keys(finalState.prompts).length}`);
  console.log(`Errors logged: ${finalState.errors.length}`);
}

main().catch(error => {
  console.error('Fatal speaking pipeline error:', error);
  process.exit(1);
});

