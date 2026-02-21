import 'dotenv/config';

import { createHash } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { GridFSBucket, MongoClient, ObjectId } from 'mongodb';
import { Pool } from 'pg';

interface CollectionMapping {
  mongoCollection: string;
  pgTable: string;
}

interface PreparedDocumentRow {
  id: string;
  data: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

const MAPPINGS: CollectionMapping[] = [
  { mongoCollection: 'users', pgTable: 'users' },
  { mongoCollection: 'userprofiles', pgTable: 'user_profiles' },
  { mongoCollection: 'userstatuses', pgTable: 'user_statuses' },
  { mongoCollection: 'friendrequests', pgTable: 'friend_requests' },
  { mongoCollection: 'friendships', pgTable: 'friendships' },
  { mongoCollection: 'conversations', pgTable: 'conversations' },
  { mongoCollection: 'chatmessages', pgTable: 'chat_messages' },
  { mongoCollection: 'studygroups', pgTable: 'study_groups' },
  { mongoCollection: 'studygroupinvites', pgTable: 'study_group_invites' },
  { mongoCollection: 'topics', pgTable: 'topics' },
  { mongoCollection: 'practicesessions', pgTable: 'practice_sessions' },
  { mongoCollection: 'testpreferences', pgTable: 'test_preferences' },
  { mongoCollection: 'testsimulations', pgTable: 'test_simulations' },
  { mongoCollection: 'testsessions', pgTable: 'test_sessions' },
  { mongoCollection: 'testevaluations', pgTable: 'test_evaluations' },
  { mongoCollection: 'ieltsquestions', pgTable: 'ielts_questions' },
  { mongoCollection: 'generatedquestions', pgTable: 'generated_questions' },
  { mongoCollection: 'userquestionhistory', pgTable: 'user_question_history' },
  { mongoCollection: 'subscriptions', pgTable: 'subscriptions' },
  { mongoCollection: 'usagerecords', pgTable: 'usage_records' },
  { mongoCollection: 'achievements', pgTable: 'achievements' },
  { mongoCollection: 'userachievements', pgTable: 'user_achievements' },
  { mongoCollection: 'userstats', pgTable: 'user_stats' },
  { mongoCollection: 'referrals', pgTable: 'referrals' },
  { mongoCollection: 'userreferralstats', pgTable: 'user_referral_stats' },
  { mongoCollection: 'coupons', pgTable: 'coupons' },
  { mongoCollection: 'couponusages', pgTable: 'coupon_usages' },
  { mongoCollection: 'pointstransactions', pgTable: 'points_transactions' },
  { mongoCollection: 'discountredemptions', pgTable: 'discount_redemptions' },
  { mongoCollection: 'test_history', pgTable: 'test_history' },
  { mongoCollection: 'audio_recordings', pgTable: 'audio_recordings' }
];

const required = (value: string | undefined, name: string): string => {
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const mongoUrl = required(process.env.MONGO_URL, 'MONGO_URL');
const supabaseDbUrl = required(process.env.SUPABASE_DB_URL, 'SUPABASE_DB_URL');
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const chatBucket = process.env.SUPABASE_STORAGE_CHAT_BUCKET || 'chat-files';
const audioBucket = process.env.SUPABASE_STORAGE_AUDIO_BUCKET || 'audio-recordings';
const batchSize = Math.max(1, Number(process.env.MIGRATION_BATCH_SIZE || 500));

const toSerializable = (value: any): any => {
  if (value === null || value === undefined) return value;
  if (value instanceof ObjectId) return value.toHexString();
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return value.toString('base64');
  if (Array.isArray(value)) return value.map(entry => toSerializable(entry));

  if (value instanceof Map) {
    const result: Record<string, any> = {};
    value.forEach((entryValue, entryKey) => {
      result[entryKey] = toSerializable(entryValue);
    });
    return result;
  }

  if (typeof value === 'object') {
    const result: Record<string, any> = {};
    Object.entries(value).forEach(([key, entry]) => {
      result[key] = toSerializable(entry);
    });
    return result;
  }

  return value;
};

const tableIdentifier = (table: string): string => {
  if (!/^[a-z][a-z0-9_]*$/.test(table)) {
    throw new Error(`Unsafe table identifier: ${table}`);
  }
  return `"${table}"`;
};

const normalizedTimestamp = (value: unknown, fallback: string): string => {
  if (typeof value !== 'string' || !value.trim()) {
    return fallback;
  }

  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return fallback;
  }

  return new Date(parsed).toISOString();
};

const prepareDocument = (doc: Record<string, any>): PreparedDocumentRow => {
  const serialized = toSerializable(doc);
  const now = new Date().toISOString();
  const id = serialized._id || createHash('sha1').update(JSON.stringify(serialized)).digest('hex').slice(0, 24);
  serialized._id = id;

  const createdAt = normalizedTimestamp(serialized.createdAt || serialized.created_at || serialized.uploadDate, now);
  const updatedAt = normalizedTimestamp(serialized.updatedAt || serialized.updated_at, now);

  return {
    id,
    data: serialized,
    createdAt,
    updatedAt
  };
};

const upsertDocumentsBatch = async (
  pool: Pool,
  table: string,
  rows: PreparedDocumentRow[]
): Promise<void> => {
  if (!rows.length) {
    return;
  }

  const quoted = tableIdentifier(table);
  const values: string[] = [];
  const params: any[] = [];

  let index = 1;
  for (const row of rows) {
    values.push(`($${index++}, $${index++}::jsonb, $${index++}::timestamptz, $${index++}::timestamptz)`);
    params.push(row.id, JSON.stringify(row.data), row.createdAt, row.updatedAt);
  }

  await pool.query(
    `
      INSERT INTO ${quoted}(id, data, created_at, updated_at)
      VALUES ${values.join(', ')}
      ON CONFLICT(id)
      DO UPDATE SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at;
    `,
    params
  );
};

const upsertDocument = async (pool: Pool, table: string, id: string, data: Record<string, any>): Promise<void> => {
  const now = new Date().toISOString();
  const createdAt = normalizedTimestamp(data.createdAt || data.created_at || data.uploadDate, now);
  const updatedAt = normalizedTimestamp(data.updatedAt || data.updated_at, now);
  await upsertDocumentsBatch(pool, table, [{ id, data, createdAt, updatedAt }]);
};

const loadGridFsBuffer = async (bucket: GridFSBucket, fileId: ObjectId): Promise<Buffer> => {
  const stream = bucket.openDownloadStream(fileId);
  const chunks: Buffer[] = [];

  await new Promise<void>((resolve, reject) => {
    stream
      .on('data', chunk => chunks.push(Buffer.from(chunk)))
      .on('error', reject)
      .on('end', () => resolve());
  });

  return Buffer.concat(chunks);
};

const migrateCollection = async (
  mongoClient: MongoClient,
  pool: Pool,
  mapping: CollectionMapping
): Promise<{ migrated: number }> => {
  const db = mongoClient.db();
  const collection = db.collection(mapping.mongoCollection);
  const cursor = collection.find({});

  let migrated = 0;
  let pending: PreparedDocumentRow[] = [];

  // Use batches to avoid one-query-per-document migration bottlenecks.
  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    if (!doc) continue;

    pending.push(prepareDocument(doc));

    if (pending.length >= batchSize) {
      // eslint-disable-next-line no-await-in-loop
      await upsertDocumentsBatch(pool, mapping.pgTable, pending);
      migrated += pending.length;
      pending = [];

      if (migrated % (batchSize * 10) === 0) {
        console.log(`${mapping.mongoCollection} -> ${mapping.pgTable}: ${migrated} rows (in progress)`);
      }
    }
  }

  if (pending.length) {
    await upsertDocumentsBatch(pool, mapping.pgTable, pending);
    migrated += pending.length;
  }

  return { migrated };
};

const migrateChatFiles = async (mongoClient: MongoClient, pool: Pool): Promise<number> => {
  if (!supabaseUrl || !supabaseKey) {
    console.log('Skipping GridFS chat file migration (SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY missing)');
    return 0;
  }

  const db = mongoClient.db();
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const bucket = new GridFSBucket(db, { bucketName: 'chat_files' });
  const files = await db.collection('chat_files.files').find({}).toArray();

  let migrated = 0;
  for (const file of files) {
    const fileId = file._id.toString();
    const fileName = file.filename || `chat-${fileId}`;
    const objectPath = `chat-files/migrated/${fileId}/${fileName}`;

    try {
      // eslint-disable-next-line no-await-in-loop
      const buffer = await loadGridFsBuffer(bucket, file._id);
      // eslint-disable-next-line no-await-in-loop
      const { error } = await supabase.storage.from(chatBucket).upload(objectPath, buffer, {
        contentType: file.contentType || 'application/octet-stream',
        upsert: true
      });
      if (error) throw error;

      const migratedDoc = {
        _id: fileId,
        fileName,
        mimeType: file.contentType || 'application/octet-stream',
        fileSize: file.length || buffer.length,
        provider: 'supabase',
        bucket: chatBucket,
        objectPath,
        metadata: toSerializable(file.metadata || {}),
        createdAt: new Date(file.uploadDate || new Date()).toISOString(),
        expiresAt: file.metadata?.expiresAt ? new Date(file.metadata.expiresAt).toISOString() : undefined
      };

      // eslint-disable-next-line no-await-in-loop
      await upsertDocument(pool, 'chat_files', fileId, migratedDoc);
      migrated += 1;
    } catch (error) {
      console.error(`Failed to migrate GridFS chat file ${fileId}:`, error);
    }
  }

  return migrated;
};

const migrateAudioPayloads = async (mongoClient: MongoClient, pool: Pool): Promise<number> => {
  if (!supabaseUrl || !supabaseKey) {
    console.log('Skipping audio binary migration (SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY missing)');
    return 0;
  }

  const db = mongoClient.db();
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const recordings = await db.collection('audio_recordings').find({}).toArray();
  const audioBucketFs = new GridFSBucket(db, { bucketName: process.env.STORAGE_MONGODB_COLLECTION || 'audio_recordings' });

  let migrated = 0;
  for (const recording of recordings) {
    const serialized = toSerializable(recording);
    const id = serialized._id;

    let audioBuffer: Buffer | undefined;
    if (recording.mongoData && Buffer.isBuffer(recording.mongoData)) {
      audioBuffer = recording.mongoData;
    } else if (recording.metadata?.gridFSFileId) {
      try {
        // eslint-disable-next-line no-await-in-loop
        audioBuffer = await loadGridFsBuffer(audioBucketFs, new ObjectId(String(recording.metadata.gridFSFileId)));
      } catch (error) {
        console.error(`Unable to read GridFS audio ${recording.metadata.gridFSFileId}:`, error);
      }
    }

    if (audioBuffer) {
      const objectPath = `audio-recordings/migrated/${serialized.userId || 'unknown'}/${id}/${serialized.fileName || 'audio.bin'}`;
      // eslint-disable-next-line no-await-in-loop
      const { error } = await supabase.storage.from(audioBucket).upload(objectPath, audioBuffer, {
        contentType: serialized.mimeType || 'application/octet-stream',
        upsert: true
      });
      if (error) {
        console.error(`Failed to upload audio ${id}:`, error);
      } else {
        serialized.storageProvider = 'supabase';
        serialized.metadata = {
          ...(serialized.metadata || {}),
          bucket: audioBucket,
          objectPath
        };
        delete serialized.mongoData;
      }
    }

    // eslint-disable-next-line no-await-in-loop
    await upsertDocument(pool, 'audio_recordings', id, serialized);
    migrated += 1;
  }

  return migrated;
};

async function main(): Promise<void> {
  console.log('Starting Mongo -> Supabase migration');

  const mongoClient = await MongoClient.connect(mongoUrl);
  const pool = new Pool({ connectionString: supabaseDbUrl });

  try {
    for (const mapping of MAPPINGS) {
      const result = await migrateCollection(mongoClient, pool, mapping);
      console.log(`${mapping.mongoCollection} -> ${mapping.pgTable}: ${result.migrated} rows`);
    }

    const migratedChatFiles = await migrateChatFiles(mongoClient, pool);
    console.log(`chat_files GridFS payloads migrated: ${migratedChatFiles}`);

    const migratedAudio = await migrateAudioPayloads(mongoClient, pool);
    console.log(`audio payloads migrated: ${migratedAudio}`);

    console.log('Migration completed successfully');
  } finally {
    await mongoClient.close();
    await pool.end();
  }
}

main().catch(error => {
  console.error('Migration failed:', error);
  process.exit(1);
});
