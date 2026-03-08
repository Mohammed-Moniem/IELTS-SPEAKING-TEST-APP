import path from 'path';

export const PIPELINE_CONFIG = {
  batchSize: Number(process.env.SPEAKING_BATCH_SIZE) || 10,
  limitPerCategory: Number(process.env.SPEAKING_PROMPT_LIMIT_PER_CATEGORY) || 500,
  stateDir: path.join(process.cwd(), '.speaking-gen-state'),
  manifestOutputDir: path.join(process.cwd(), '.speaking-gen-state', 'manifests'),
  audioOutputDir: path.join(process.cwd(), '.speaking-gen-state', 'audio'),
  supabaseBucket: process.env.SUPABASE_SPEAKING_BUCKET || 'speaking-audio',
};

export const SPEAKING_PART_CATEGORIES = ['part1', 'part2', 'part3'] as const;

