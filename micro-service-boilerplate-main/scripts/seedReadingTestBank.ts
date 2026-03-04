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
const QUALITY_TIER = 'exam_v2';

const TOPICS = {
  academic: [
    'public art and civic identity',
    'urban heat adaptation',
    'circular manufacturing governance',
    'AI in diagnostic medicine',
    'coastal flood planning',
    'apprenticeship reform outcomes',
    'sustainable aviation fuels',
    'water reuse systems',
    'university admissions transparency',
    'food waste supply chains'
  ],
  general: [
    'community volunteer networks',
    'workplace wellbeing programmes',
    'regional tourism operations',
    'local bus service reliability',
    'household energy advice services',
    'neighbourhood safety partnerships',
    'public library digital services',
    'small business mentoring',
    'housing repair coordination',
    'adult evening learning courses'
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
      AND COALESCE(data->>'qualityTier', 'legacy') = $2
      AND COALESCE(data->>'schemaVersion', 'v1') = 'v2';
  `,
    [track, QUALITY_TIER]
  );
  const set = new Set<string>();
  for (const row of result.rows) {
    if (row.title) {
      set.add(hash(`${track}|${row.title}|${row.schema_version || 'v2'}`));
    }
  }
  return set;
};

const makeQuestion = (
  track: ReadingTrack,
  sectionId: SectionId,
  questionNumber: number,
  topic: string,
  headingOptions: string[],
  institutions: string[]
): ReadingQuestion => {
  const type = QUESTION_TYPES[(questionNumber - 1) % QUESTION_TYPES.length];
  const paragraphNumber = ((questionNumber - 1) % 6) + 1;
  const base = {
    questionId: `${sectionId}_q${questionNumber}`,
    sectionId,
    type,
    prompt: `Q${questionNumber}. Answer this ${type.replace(/_/g, ' ')} item using evidence from the passage on ${topic}.`,
    explanation: 'Use exact evidence from the passage and eliminate distractors before finalizing.'
  } as ReadingQuestion;

  switch (type) {
    case 'multiple_choice_single':
      return {
        ...base,
        prompt: `According to paragraph ${paragraphNumber}, what best explains the main implementation challenge?`,
        options: [
          'Weak cross-team coordination delayed reliable delivery.',
          'Immediate funding increases solved all planning risk.',
          'Public reporting was removed to accelerate rollout.',
          'Local monitoring became unnecessary after launch.'
        ],
        answerSpec: { kind: 'single', value: 'Weak cross-team coordination delayed reliable delivery.' },
        correctAnswer: 'Weak cross-team coordination delayed reliable delivery.'
      };
    case 'multiple_choice_multiple':
      return {
        ...base,
        prompt: 'Choose THREE improvements that the passage links to stronger outcomes.',
        options: [
          'Shared reporting standards across institutions',
          'Routine review cycles with named owners',
          'Removing all local partners from delivery',
          'Escalating anomalies quickly instead of deferring',
          'Relying on publicity without process changes'
        ],
        answerSpec: {
          kind: 'multi',
          value: [
            'Shared reporting standards across institutions',
            'Routine review cycles with named owners',
            'Escalating anomalies quickly instead of deferring'
          ]
        },
        correctAnswer:
          'Shared reporting standards across institutions|Routine review cycles with named owners|Escalating anomalies quickly instead of deferring'
      };
    case 'true_false_not_given':
      return {
        ...base,
        prompt: `The writer claims that short pilot data alone is enough for long-term policy decisions in paragraph ${paragraphNumber}.`,
        options: ['True', 'False', 'Not Given'],
        answerSpec: { kind: 'single', value: 'False' },
        correctAnswer: 'False'
      };
    case 'yes_no_not_given':
      return {
        ...base,
        prompt: 'Does the writer agree that baseline measurement can be skipped during implementation?',
        options: ['Yes', 'No', 'Not Given'],
        answerSpec: { kind: 'single', value: 'No' },
        correctAnswer: 'No'
      };
    case 'matching_headings':
      return {
        ...base,
        prompt: `Choose the best heading for paragraph ${paragraphNumber}.`,
        instructions: 'Select one heading only.',
        options: headingOptions.map((heading, index) => `${['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii'][index]}. ${heading}`),
        answerSpec: { kind: 'single', value: `${['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii'][paragraphNumber - 1]}. ${headingOptions[paragraphNumber - 1]}` },
        correctAnswer: `${['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii'][paragraphNumber - 1]}. ${headingOptions[paragraphNumber - 1]}`
      };
    case 'matching_information':
    case 'matching_features':
      return {
        ...base,
        prompt: `Which institution is linked to the evidence discussed in paragraph ${paragraphNumber}?`,
        options: institutions.map((item, index) => `${String.fromCharCode(65 + index)}. ${item}`),
        answerSpec: { kind: 'single', value: `${String.fromCharCode(65 + (paragraphNumber % institutions.length))}. ${institutions[paragraphNumber % institutions.length]}` },
        correctAnswer: `${String.fromCharCode(65 + (paragraphNumber % institutions.length))}. ${institutions[paragraphNumber % institutions.length]}`
      };
    case 'matching_sentence_endings':
      return {
        ...base,
        prompt: 'Choose the sentence ending that matches the writer’s argument.',
        options: [
          'A. when baseline evidence is measured consistently.',
          'B. because all local variation is removed.',
          'C. if reporting can be audited across institutions.',
          'D. after reviewers validate root-cause checks.',
          'E. while trade-offs are hidden from stakeholders.',
          'F. once escalation pathways are made explicit.'
        ],
        answerSpec: { kind: 'single', value: 'D. after reviewers validate root-cause checks.' },
        correctAnswer: 'D. after reviewers validate root-cause checks.'
      };
    case 'sentence_completion':
    case 'summary_completion':
    case 'note_table_flow_completion':
    case 'diagram_label_completion':
      return {
        ...base,
        answerSpec: { kind: 'single', value: 'shared metrics', maxWords: 3, caseSensitive: false },
        correctAnswer: 'shared metrics'
      };
    case 'short_answer':
    default:
      return {
        ...base,
        answerSpec: { kind: 'single', value: track === 'academic' ? 'review cadence' : 'clear handover', maxWords: 3 },
        correctAnswer: track === 'academic' ? 'review cadence' : 'clear handover'
      };
  }
};

const makeSection = (
  track: ReadingTrack,
  sectionId: SectionId,
  sectionIndex: number,
  globalStartQuestion: number,
  count: number,
  topic: string,
  testIndex: number
): ReadingSection => {
  const baseline = 12 + ((testIndex + sectionIndex) % 18);
  const improved = baseline + 8 + ((testIndex * 3 + sectionIndex) % 13);
  const signalWindow = 24 + ((testIndex * 5 + sectionIndex) % 36);
  const headingOptions = [
    'How the initial implementation problem is framed',
    'Evidence from comparative programme reviews',
    'The role of shared reporting definitions',
    'Why weak baselines can mislead evaluation',
    'Escalation and early anomaly control',
    'Conditions required for durable outcomes',
    'When headline metrics hide process weakness',
    'Governance choices that affect long-term reliability'
  ];
  const institutions = [
    'Policy Evaluation Office',
    'Programme Quality Unit',
    'Local Delivery Board',
    'Audit and Standards Council',
    'Operations Coordination Forum'
  ];

  const opening =
    track === 'academic'
      ? `Recent policy analysis on ${topic} shows that public debate often focuses on ambition while operational evidence focuses on execution discipline.`
      : `Service reviews on ${topic} show that residents value consistency and follow-through more than one-off campaign announcements.`;

  const passageText = [
    `${opening} Comparative studies found that outcomes diverged when agencies launched similar initiatives without shared baseline metrics and escalation rules. Programmes with clear accountability chains were more likely to convert strategic goals into repeatable delivery routines.`,
    `A multi-site evaluation recorded improvement from around ${baseline}% baseline reliability to nearly ${improved}% after teams introduced standardised reporting templates, fixed weekly review cadence, and explicit ownership for unresolved actions. Researchers cautioned that technology upgrades alone did not explain gains; governance quality remained the strongest predictor.`,
    `Cross-agency coordination improved once institutions used common definitions for completion, delay, and risk classification. Before this alignment, managers compared non-equivalent indicators and misread performance trends. After alignment, planning meetings shifted from debate about terminology to decisions on corrective action and sequencing.`,
    `Methodological controls were essential because short pilot windows could overstate impact. Reviewers highlighted that weak baselines and seasonal demand swings frequently distorted early reporting. Stronger studies used matched comparisons and tracked whether improvements persisted once novelty effects faded.`,
    `Sites that enforced anomaly investigation within ${signalWindow} hours reduced repeated failures and improved forecast confidence. Teams documented root-cause evidence before closing incidents, which prevented unresolved issues from returning as larger disruptions in later cycles.`,
    `The concluding analysis argues that ${topic} should be treated as a systems capability. Durable improvement depends on transparent measurement, disciplined follow-through, and incentives tied to verified reliability rather than optimistic narrative reporting.`
  ].join('\n\n');

  const questions = Array.from({ length: count }, (_, offset) => makeQuestion(track, sectionId, globalStartQuestion + offset, topic, headingOptions, institutions));

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
    makeSection(track, 'p1', 0, 1, 13, topic, index),
    makeSection(track, 'p2', 1, 14, 13, topic, index),
    makeSection(track, 'p3', 2, 27, 14, topic, index)
  ];
  const flattened = sections.flatMap(section => section.questions);

  return {
    track,
    title,
    schemaVersion: 'v2',
    qualityTier: QUALITY_TIER,
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
