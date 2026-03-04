import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';
import { Client } from 'pg';

type ReadingTrack = 'academic' | 'general';
type SectionId = 'p1' | 'p2' | 'p3';

type ReadingQuestion = {
  questionId: string;
  sectionId: SectionId;
  groupId?: string;
  type:
    | 'multiple_choice_single'
    | 'multiple_choice_multiple'
    | 'true_false_not_given'
    | 'yes_no_not_given'
    | 'matching_headings'
    | 'matching_information'
    | 'matching_features'
    | 'matching_sentence_endings'
    | 'sentence_completion'
    | 'summary_completion'
    | 'note_table_flow_completion'
    | 'diagram_label_completion'
    | 'short_answer';
  prompt: string;
  instructions?: string;
  options?: string[];
  answerSpec: {
    kind: 'single' | 'multi' | 'ordered' | 'map';
    value: string | string[] | Record<string, string>;
    caseSensitive?: boolean;
    maxWords?: number;
  };
  correctAnswer?: string;
  explanation?: string;
};

type ReadingSection = {
  sectionId: SectionId;
  title: string;
  passageText: string;
  suggestedMinutes: number;
  questions: ReadingQuestion[];
};

dotenv.config({ path: path.join(process.cwd(), '.env') });

const DATABASE_URL = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || '';
const TARGET_PER_TRACK = Number.parseInt(process.env.READING_BANK_TARGET_PER_TRACK || '6000', 10);
const BATCH_SIZE = Number.parseInt(process.env.READING_BANK_BATCH || '1000', 10);
const DRY_RUN = ['1', 'true', 'yes', 'on'].includes((process.env.READING_BANK_DRY_RUN || '').trim().toLowerCase());
const TRACKS: ReadingTrack[] = ['academic', 'general'];

const TOPICS = {
  academic: [
    'urban migration dynamics',
    'renewable energy policy',
    'public transport modernization',
    'higher education reform',
    'marine ecosystem resilience',
    'workforce automation trends',
    'air quality regulation',
    'water conservation systems',
    'digital literacy outcomes',
    'public health prevention models'
  ],
  general: [
    'community volunteering programs',
    'local transport updates',
    'adult learning opportunities',
    'home energy efficiency',
    'public library expansion',
    'workplace wellbeing campaigns',
    'neighborhood safety planning',
    'family health initiatives',
    'small business support',
    'regional tourism growth'
  ]
} as const;

const QUESTION_TYPES: ReadingQuestion['type'][] = [
  'matching_headings',
  'multiple_choice_single',
  'true_false_not_given',
  'summary_completion',
  'short_answer',
  'matching_information',
  'yes_no_not_given',
  'matching_features',
  'sentence_completion',
  'multiple_choice_multiple',
  'matching_sentence_endings',
  'note_table_flow_completion',
  'diagram_label_completion'
];

const hash = (value: string) => crypto.createHash('sha1').update(value).digest('hex');
const toId = () => crypto.randomBytes(12).toString('hex');

const ensureTable = async (client: Client) => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS "reading_tests" (
      id text PRIMARY KEY,
      data jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT NOW(),
      updated_at timestamptz NOT NULL DEFAULT NOW()
    );
  `);
};

const loadExistingFingerprints = async (client: Client, track: ReadingTrack) => {
  const result = await client.query(
    `
    SELECT data->>'title' AS title, data->>'schemaVersion' AS schema_version
    FROM reading_tests
    WHERE data->>'track' = $1
      AND COALESCE(data->>'active', 'false') = 'true'
      AND COALESCE(data->>'autoPublished', 'false') = 'true'
      AND COALESCE(data->>'schemaVersion', 'v1') = 'v2';
  `,
    [track]
  );
  const set = new Set<string>();
  for (const row of result.rows) {
    if (row.title) {
      set.add(hash(`${track}|${row.title}|${row.schema_version || 'v2'}`));
    }
  }
  return set;
};

const makeQuestion = (track: ReadingTrack, sectionId: SectionId, questionNumber: number, topic: string): ReadingQuestion => {
  const type = QUESTION_TYPES[(questionNumber - 1) % QUESTION_TYPES.length];
  const prompt = `Q${questionNumber}. Based on the passage, answer the ${type.replace(/_/g, ' ')} item about ${topic}.`;
  const base: ReadingQuestion = {
    questionId: `${sectionId}_q${questionNumber}`,
    sectionId,
    type,
    prompt,
    explanation: 'Use exact evidence from the passage and eliminate distractors before finalizing.'
  } as ReadingQuestion;

  switch (type) {
    case 'multiple_choice_single':
      return {
        ...base,
        options: ['A', 'B', 'C', 'D'],
        answerSpec: { kind: 'single', value: 'A' },
        correctAnswer: 'A'
      };
    case 'multiple_choice_multiple':
      return {
        ...base,
        options: ['A', 'B', 'C', 'D', 'E'],
        answerSpec: { kind: 'multi', value: ['A', 'C'] },
        correctAnswer: 'A|C'
      };
    case 'true_false_not_given':
      return {
        ...base,
        options: ['True', 'False', 'Not Given'],
        answerSpec: { kind: 'single', value: 'Not Given' },
        correctAnswer: 'Not Given'
      };
    case 'yes_no_not_given':
      return {
        ...base,
        options: ['Yes', 'No', 'Not Given'],
        answerSpec: { kind: 'single', value: 'No' },
        correctAnswer: 'No'
      };
    case 'matching_headings':
      return {
        ...base,
        options: ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii'],
        answerSpec: { kind: 'single', value: 'iii' },
        correctAnswer: 'iii'
      };
    case 'matching_information':
    case 'matching_features':
      return {
        ...base,
        options: ['A', 'B', 'C', 'D', 'E'],
        answerSpec: { kind: 'single', value: 'B' },
        correctAnswer: 'B'
      };
    case 'matching_sentence_endings':
      return {
        ...base,
        options: ['A', 'B', 'C', 'D', 'E', 'F'],
        answerSpec: { kind: 'single', value: 'D' },
        correctAnswer: 'D'
      };
    case 'sentence_completion':
    case 'summary_completion':
    case 'note_table_flow_completion':
    case 'diagram_label_completion':
      return {
        ...base,
        answerSpec: { kind: 'single', value: 'sample answer', maxWords: 3, caseSensitive: false },
        correctAnswer: 'sample answer'
      };
    case 'short_answer':
    default:
      return {
        ...base,
        answerSpec: { kind: 'single', value: track === 'academic' ? 'evidence-based policy' : 'community support', maxWords: 3 },
        correctAnswer: track === 'academic' ? 'evidence-based policy' : 'community support'
      };
  }
};

const makeSection = (track: ReadingTrack, sectionId: SectionId, sectionIndex: number, globalStartQuestion: number, count: number, topic: string): ReadingSection => {
  const difficultyLabel = sectionIndex === 2 ? 'advanced analytical complexity' : sectionIndex === 1 ? 'intermediate synthesis' : 'core comprehension';
  const passageText = [
    `${topic} has become a central issue in recent IELTS-aligned source materials.`,
    `This passage (${sectionId.toUpperCase()}) focuses on ${difficultyLabel} and asks candidates to identify main claims, supporting evidence, and implied assumptions.`,
    'Readers should distinguish between explicit statements, inferred meaning, and distractor language that partially matches the text but changes scope.',
    'High-scoring strategies include keyword mapping, paragraph function tracking, and disciplined evidence checks before committing to an answer.'
  ].join('\n\n');

  const questions = Array.from({ length: count }, (_, offset) =>
    makeQuestion(track, sectionId, globalStartQuestion + offset, topic)
  );

  return {
    sectionId,
    title: `Passage ${sectionIndex + 1}`,
    passageText,
    suggestedMinutes: 20,
    questions
  };
};

const makeTestPayload = (track: ReadingTrack, index: number) => {
  const topic = TOPICS[track][index % TOPICS[track].length];
  const variant = (index % 97) + 1;
  const title = `${track.toUpperCase()} Reading Test ${String(index + 1).padStart(4, '0')} - ${topic} (${variant})`;

  const sections: ReadingSection[] = [
    makeSection(track, 'p1', 0, 1, 13, topic),
    makeSection(track, 'p2', 1, 14, 13, topic),
    makeSection(track, 'p3', 2, 27, 14, topic)
  ];
  const flattened = sections.flatMap(section => section.questions);

  return {
    track,
    title,
    schemaVersion: 'v2',
    sectionCount: 3,
    sections,
    passageTitle: sections[0].title,
    passageText: sections[0].passageText,
    suggestedTimeMinutes: 60,
    questions: flattened,
    source: 'bank',
    autoPublished: true,
    active: true
  };
};

const insertBatch = async (client: Client, rows: Array<{ id: string; data: Record<string, unknown>; createdAt: string; updatedAt: string }>) => {
  const ids = rows.map(row => row.id);
  const payloads = rows.map(row => JSON.stringify(row.data));
  const createdAt = rows.map(row => row.createdAt);
  const updatedAt = rows.map(row => row.updatedAt);
  await client.query(
    `
      INSERT INTO reading_tests (id, data, created_at, updated_at)
      SELECT item_id, item_data::jsonb, item_created, item_updated
      FROM UNNEST($1::text[], $2::text[], $3::timestamptz[], $4::timestamptz[])
        AS source(item_id, item_data, item_created, item_updated)
      ON CONFLICT (id) DO NOTHING;
    `,
    [ids, payloads, createdAt, updatedAt]
  );
};

const seedTrack = async (client: Client, track: ReadingTrack) => {
  const existing = await loadExistingFingerprints(client, track);
  const needed = Math.max(0, TARGET_PER_TRACK - existing.size);
  console.log(`[seed:reading-bank] ${track} existing=${existing.size}, target=${TARGET_PER_TRACK}, needed=${needed}`);
  if (needed === 0) return;

  let produced = 0;
  let pointer = 0;
  let buffer: Array<{ id: string; data: Record<string, unknown>; createdAt: string; updatedAt: string }> = [];

  while (produced < needed) {
    const payload = makeTestPayload(track, pointer);
    pointer += 1;
    const fp = hash(`${track}|${payload.title}|v2`);
    if (existing.has(fp)) continue;
    existing.add(fp);
    produced += 1;
    const now = new Date().toISOString();
    buffer.push({
      id: toId(),
      data: payload,
      createdAt: now,
      updatedAt: now
    });
    if (buffer.length >= BATCH_SIZE || produced === needed) {
      if (!DRY_RUN) {
        await insertBatch(client, buffer);
      }
      console.log(`[seed:reading-bank] ${track} inserted ${Math.min(produced, needed)}/${needed}`);
      buffer = [];
    }
  }
};

const main = async () => {
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL or SUPABASE_DB_URL is required.');
  }
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    await ensureTable(client);
    for (const track of TRACKS) {
      await seedTrack(client, track);
    }
    console.log(`[seed:reading-bank] done (dryRun=${DRY_RUN})`);
  } finally {
    await client.end();
  }
};

main().catch(error => {
  console.error('[seed:reading-bank] failed', error);
  process.exit(1);
});
