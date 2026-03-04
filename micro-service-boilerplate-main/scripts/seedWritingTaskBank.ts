import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';
import { Client } from 'pg';

type WritingTrack = 'academic' | 'general';
type WritingTaskType = 'task1' | 'task2';

type Segment = {
  track: WritingTrack;
  taskType: WritingTaskType;
};

type TaskSeed = {
  title: string;
  prompt: string;
  instructions: string[];
  suggestedTimeMinutes: number;
  minimumWords: number;
  tags: string[];
};

dotenv.config({ path: path.join(process.cwd(), '.env') });

const TARGET_PER_SEGMENT = Number.parseInt(process.env.WRITING_BANK_TARGET || '6000', 10);
const BATCH_SIZE = Number.parseInt(process.env.WRITING_BANK_BATCH || '2000', 10);
const DRY_RUN = process.env.WRITING_BANK_DRY_RUN === '1';
const DATABASE_URL = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || '';

const SEGMENTS: Segment[] = [
  { track: 'academic', taskType: 'task1' },
  { track: 'academic', taskType: 'task2' },
  { track: 'general', taskType: 'task1' },
  { track: 'general', taskType: 'task2' }
];

const ACADEMIC_TOPICS = [
  'urban transport',
  'public health spending',
  'renewable energy adoption',
  'housing affordability',
  'digital learning outcomes',
  'student mobility',
  'food consumption habits',
  'employment by sector',
  'waste management',
  'household internet access',
  'library usage patterns',
  'sports participation',
  'commuting behavior',
  'air quality levels',
  'tourism growth',
  'population age structure',
  'household expenditure',
  'water consumption trends',
  'electric vehicle adoption',
  'public safety indicators'
];

const GENERAL_TOPICS = [
  'community events',
  'local services',
  'workplace communication',
  'housing and accommodation',
  'study schedules',
  'public facilities',
  'health appointments',
  'travel arrangements',
  'volunteering',
  'small business support',
  'transport disruptions',
  'course registration',
  'sports membership',
  'library resources',
  'family and childcare',
  'technology use',
  'shopping and deliveries',
  'environmental projects',
  'neighborhood planning',
  'cultural programs'
];

const LETTER_PURPOSES = [
  'a formal complaint',
  'a request for support',
  'an application inquiry',
  'a service feedback letter',
  'a scheduling request',
  'an update on a local issue'
];

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October'];
const CHART_TYPES = ['line graph', 'bar chart', 'table', 'pie chart', 'mixed chart', 'process diagram', 'map comparison'];
const ESSAY_STYLES = ['opinion', 'discussion', 'problem-solution', 'advantages-disadvantages', 'two-part question'];
const REGIONS = ['Europe', 'Asia', 'North America', 'South America', 'Africa', 'Oceania'];
const INSTRUCTION_POOL_TASK1 = [
  'Write at least 150 words.',
  'Include a clear overview of the most important features.',
  'Make direct comparisons and avoid listing every number.',
  'Use accurate data references and trend language.'
];
const INSTRUCTION_POOL_TASK2 = [
  'Write at least 250 words.',
  'Present a clear position and keep it consistent.',
  'Develop each body paragraph with specific reasoning.',
  'Use cohesive devices and varied sentence structures.'
];

const log = {
  info: (message: string) => console.log(`[seed:writing-bank] ${message}`),
  warn: (message: string) => console.warn(`[seed:writing-bank] ${message}`),
  error: (message: string) => console.error(`[seed:writing-bank] ${message}`)
};

const normalizeText = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');

const toFingerprint = (track: WritingTrack, taskType: WritingTaskType, title: string, prompt: string) =>
  `${track}|${taskType}|${normalizeText(title)}|${normalizeText(prompt)}`;

const toPositiveInt = (value: number, fallback: number) =>
  Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;

const buildAcademicTask1 = (index: number): TaskSeed => {
  const chartType = CHART_TYPES[index % CHART_TYPES.length];
  const topic = ACADEMIC_TOPICS[index % ACADEMIC_TOPICS.length];
  const regionA = REGIONS[index % REGIONS.length];
  const regionB = REGIONS[(index + 2) % REGIONS.length];
  const startYear = 1985 + (index % 35);
  const endYear = startYear + 6 + (Math.floor(index / 17) % 16);
  const sampleSize = 500 + (index % 4500);
  const title = `Academic Task 1 ${chartType} - ${topic} (${regionA} vs ${regionB})`;
  const prompt = `The ${chartType} illustrates ${topic} in ${regionA} and ${regionB} between ${startYear} and ${endYear}, based on a dataset of ${sampleSize} observations. Summarize the information by selecting and reporting the main features, and make comparisons where relevant.`;
  const instructionShift = index % 2;
  return {
    title,
    prompt,
    instructions: [
      INSTRUCTION_POOL_TASK1[0],
      INSTRUCTION_POOL_TASK1[1 + instructionShift],
      INSTRUCTION_POOL_TASK1[3 - instructionShift]
    ],
    suggestedTimeMinutes: 20,
    minimumWords: 150,
    tags: ['writing', 'academic', 'task1', chartType.replace(/\s+/g, '-'), topic.replace(/\s+/g, '-')]
  };
};

const buildGeneralTask1 = (index: number): TaskSeed => {
  const topic = GENERAL_TOPICS[index % GENERAL_TOPICS.length];
  const purpose = LETTER_PURPOSES[index % LETTER_PURPOSES.length];
  const tone = index % 3 === 0 ? 'formal' : index % 3 === 1 ? 'semi-formal' : 'informal';
  const referenceCode = `${10000 + (index % 90000)}`;
  const day = 1 + (index % 28);
  const month = MONTH_NAMES[index % MONTH_NAMES.length];
  const title = `General Task 1 ${tone} letter - ${topic}`;
  const prompt = `You are writing ${purpose} about ${topic}. The issue occurred on ${month} ${day}, and your reference number is ${referenceCode}. Write a letter and in your letter: describe the situation clearly, explain the impact on you or others, and request or propose a practical solution.`;
  return {
    title,
    prompt,
    instructions: [
      INSTRUCTION_POOL_TASK1[0],
      'Address all bullet points with clear paragraphing.',
      `Use an appropriate ${tone} tone throughout.`
    ],
    suggestedTimeMinutes: 20,
    minimumWords: 150,
    tags: ['writing', 'general', 'task1', 'letter', tone, topic.replace(/\s+/g, '-')]
  };
};

const buildAcademicTask2 = (index: number): TaskSeed => {
  const style = ESSAY_STYLES[index % ESSAY_STYLES.length];
  const topicA = ACADEMIC_TOPICS[index % ACADEMIC_TOPICS.length];
  const topicB = ACADEMIC_TOPICS[(index + 7) % ACADEMIC_TOPICS.length];
  const cohortYear = 1990 + (index % 35);
  const sampleSize = 800 + (index % 5200);
  const cityCount = 3 + (index % 12);
  const title = `Academic Task 2 ${style} essay - ${topicA}`;
  const prompt = `Universities and policymakers are debating ${topicA} and ${topicB}. A study launched in ${cohortYear} covering ${cityCount} major cities and ${sampleSize} respondents has intensified this debate. To what extent do you agree or disagree with this view? Support your position with relevant examples and clear reasoning.`;
  const instructionOffset = index % 2;
  return {
    title,
    prompt,
    instructions: [
      INSTRUCTION_POOL_TASK2[0],
      INSTRUCTION_POOL_TASK2[1 + instructionOffset],
      INSTRUCTION_POOL_TASK2[3 - instructionOffset]
    ],
    suggestedTimeMinutes: 40,
    minimumWords: 250,
    tags: ['writing', 'academic', 'task2', style.replace(/\s+/g, '-'), topicA.replace(/\s+/g, '-')]
  };
};

const buildGeneralTask2 = (index: number): TaskSeed => {
  const style = ESSAY_STYLES[(index + 2) % ESSAY_STYLES.length];
  const topicA = GENERAL_TOPICS[index % GENERAL_TOPICS.length];
  const topicB = GENERAL_TOPICS[(index + 5) % GENERAL_TOPICS.length];
  const sampleSize = 700 + (index % 4600);
  const regionCount = 2 + (index % 8);
  const caseRef = `G${100000 + index}`;
  const title = `General Task 2 ${style} essay - ${topicA}`;
  const prompt = `People have different opinions about ${topicA} compared with ${topicB}. A recent community survey of ${sampleSize} residents across ${regionCount} regions (reference ${caseRef}) highlights this divide. Discuss both views and give your own opinion with practical examples from everyday life.`;
  return {
    title,
    prompt,
    instructions: [
      INSTRUCTION_POOL_TASK2[0],
      'Explain both sides before your final conclusion.',
      'Use everyday examples and a clear opinion statement.'
    ],
    suggestedTimeMinutes: 40,
    minimumWords: 250,
    tags: ['writing', 'general', 'task2', style.replace(/\s+/g, '-'), topicA.replace(/\s+/g, '-')]
  };
};

const buildSeedTask = (segment: Segment, index: number): TaskSeed => {
  if (segment.track === 'academic' && segment.taskType === 'task1') return buildAcademicTask1(index);
  if (segment.track === 'general' && segment.taskType === 'task1') return buildGeneralTask1(index);
  if (segment.track === 'academic' && segment.taskType === 'task2') return buildAcademicTask2(index);
  return buildGeneralTask2(index);
};

const ensureWritingTaskTable = async (client: Client) => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS "writing_tasks" (
      id text PRIMARY KEY,
      data jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT NOW(),
      updated_at timestamptz NOT NULL DEFAULT NOW()
    );
  `);
};

const deactivateInvalidTasks = async (client: Client) => {
  const updateSql = `
    UPDATE "writing_tasks"
    SET data = jsonb_set(data, '{active}', 'false'::jsonb, true), updated_at = NOW()
    WHERE COALESCE(data->>'title', '') = ''
       OR COALESCE(data->>'prompt', '') = '';
  `;
  const result = await client.query(updateSql);
  if ((result.rowCount || 0) > 0) {
    log.info(`Deactivated ${result.rowCount} invalid writing tasks (missing title/prompt).`);
  }
};

const loadExistingFingerprints = async (client: Client, segment: Segment): Promise<Set<string>> => {
  const sql = `
    SELECT data->>'title' AS title, data->>'prompt' AS prompt
    FROM "writing_tasks"
    WHERE data->>'track' = $1
      AND data->>'taskType' = $2
      AND COALESCE(data->>'source', '') = 'bank'
      AND COALESCE((data->>'active')::boolean, false) = true
      AND COALESCE((data->>'autoPublished')::boolean, false) = true
      AND COALESCE(data->>'title', '') <> ''
      AND COALESCE(data->>'prompt', '') <> '';
  `;
  const result = await client.query(sql, [segment.track, segment.taskType]);
  const set = new Set<string>();
  result.rows.forEach(row => {
    set.add(toFingerprint(segment.track, segment.taskType, row.title || '', row.prompt || ''));
  });
  return set;
};

const insertBatch = async (
  client: Client,
  rows: Array<{ id: string; data: Record<string, unknown>; createdAt: string; updatedAt: string }>
) => {
  const ids = rows.map(row => row.id);
  const payloads = rows.map(row => JSON.stringify(row.data));
  const createdAt = rows.map(row => row.createdAt);
  const updatedAt = rows.map(row => row.updatedAt);

  const sql = `
    INSERT INTO "writing_tasks" (id, data, created_at, updated_at)
    SELECT item_id, item_data::jsonb, item_created, item_updated
    FROM UNNEST($1::text[], $2::text[], $3::timestamptz[], $4::timestamptz[]) AS x(item_id, item_data, item_created, item_updated);
  `;
  await client.query(sql, [ids, payloads, createdAt, updatedAt]);
};

const seedSegment = async (client: Client, segment: Segment, targetPerSegment: number, batchSize: number) => {
  const existingFingerprints = await loadExistingFingerprints(client, segment);
  const already = existingFingerprints.size;
  const missing = Math.max(0, targetPerSegment - already);
  log.info(
    `${segment.track}/${segment.taskType}: existing=${already}, target=${targetPerSegment}, missing=${missing}`
  );
  if (missing === 0) return { inserted: 0, skipped: 0 };

  const rows: Array<{ id: string; data: Record<string, unknown>; createdAt: string; updatedAt: string }> = [];
  let candidateIndex = already;
  let safety = 0;
  const maxSafety = missing * 300;
  while (rows.length < missing && safety < maxSafety) {
    const seed = buildSeedTask(segment, candidateIndex);
    const fingerprint = toFingerprint(segment.track, segment.taskType, seed.title, seed.prompt);
    if (!existingFingerprints.has(fingerprint)) {
      existingFingerprints.add(fingerprint);
      const now = new Date().toISOString();
      rows.push({
        id: crypto.randomUUID(),
        data: {
          track: segment.track,
          taskType: segment.taskType,
          title: seed.title,
          prompt: seed.prompt,
          instructions: seed.instructions,
          suggestedTimeMinutes: seed.suggestedTimeMinutes,
          minimumWords: seed.minimumWords,
          tags: seed.tags,
          source: 'bank',
          autoPublished: true,
          active: true,
          createdAt: now,
          updatedAt: now
        },
        createdAt: now,
        updatedAt: now
      });
    }
    candidateIndex += 1;
    safety += 1;
  }

  if (rows.length < missing) {
    log.warn(
      `${segment.track}/${segment.taskType}: generated ${rows.length}/${missing}. Consider extending topic arrays for more variety.`
    );
  }

  if (DRY_RUN) {
    log.info(`${segment.track}/${segment.taskType}: dry run, would insert ${rows.length}`);
    return { inserted: 0, skipped: missing - rows.length };
  }

  let inserted = 0;
  for (let index = 0; index < rows.length; index += batchSize) {
    const chunk = rows.slice(index, index + batchSize);
    await insertBatch(client, chunk);
    inserted += chunk.length;
    log.info(`${segment.track}/${segment.taskType}: inserted ${inserted}/${rows.length}`);
  }

  return { inserted, skipped: missing - rows.length };
};

const printFinalCounts = async (client: Client) => {
  const sql = `
    SELECT data->>'track' AS track, data->>'taskType' AS task_type, COUNT(*)::int AS count
    FROM "writing_tasks"
    WHERE COALESCE(data->>'source', '') = 'bank'
      AND COALESCE((data->>'active')::boolean, false) = true
      AND COALESCE((data->>'autoPublished')::boolean, false) = true
      AND COALESCE(data->>'title', '') <> ''
      AND COALESCE(data->>'prompt', '') <> ''
    GROUP BY 1, 2
    ORDER BY 1, 2;
  `;
  const result = await client.query(sql);
  result.rows.forEach(row => {
    log.info(`final-count ${row.track}/${row.task_type} = ${row.count}`);
  });
};

const main = async () => {
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL or SUPABASE_DB_URL is required.');
  }

  const target = toPositiveInt(TARGET_PER_SEGMENT, 6000);
  const batch = toPositiveInt(BATCH_SIZE, 2000);
  log.info(`Starting writing task bank seeding: target=${target}/segment, batch=${batch}, dryRun=${DRY_RUN}`);

  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await ensureWritingTaskTable(client);
    await deactivateInvalidTasks(client);

    let totalInserted = 0;
    let totalSkipped = 0;
    for (const segment of SEGMENTS) {
      const result = await seedSegment(client, segment, target, batch);
      totalInserted += result.inserted;
      totalSkipped += result.skipped;
    }
    await printFinalCounts(client);
    log.info(`Completed. Inserted=${totalInserted}, skipped=${totalSkipped}`);
  } finally {
    await client.end();
  }
};

main()
  .then(() => process.exit(0))
  .catch(error => {
    log.error(`Failed: ${error instanceof Error ? error.stack || error.message : String(error)}`);
    process.exit(1);
  });
