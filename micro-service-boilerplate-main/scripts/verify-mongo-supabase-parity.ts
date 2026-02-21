import 'dotenv/config';

import { createHash } from 'crypto';
import { MongoClient, ObjectId } from 'mongodb';
import { Pool } from 'pg';

interface CollectionMapping {
  mongoCollection: string;
  pgTable: string;
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
  { mongoCollection: 'audio_recordings', pgTable: 'audio_recordings' },
  { mongoCollection: 'chat_files.files', pgTable: 'chat_files' }
];

const required = (value: string | undefined, name: string): string => {
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const mongoUrl = required(process.env.MONGO_URL, 'MONGO_URL');
const supabaseDbUrl = required(process.env.SUPABASE_DB_URL, 'SUPABASE_DB_URL');
const sampleSize = Number(process.env.PARITY_SAMPLE_SIZE || 25);

const tableIdentifier = (table: string): string => {
  if (!/^[a-z][a-z0-9_]*$/.test(table)) {
    throw new Error(`Unsafe table identifier: ${table}`);
  }
  return `"${table}"`;
};

const normalize = (value: any): any => {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof ObjectId) return value.toHexString();
  if (Buffer.isBuffer(value)) return value.toString('base64');
  if (Array.isArray(value)) return value.map(entry => normalize(entry));

  if (value instanceof Map) {
    const result: Record<string, any> = {};
    value.forEach((entryValue, entryKey) => {
      result[entryKey] = normalize(entryValue);
    });
    return result;
  }

  if (typeof value === 'object') {
    const result: Record<string, any> = {};
    Object.keys(value)
      .sort()
      .forEach(key => {
        result[key] = normalize(value[key]);
      });
    return result;
  }

  return value;
};

const digest = (value: any): string => {
  return createHash('sha256').update(JSON.stringify(normalize(value))).digest('hex');
};

const runRelationshipChecks = async (pool: Pool): Promise<string[]> => {
  const failures: string[] = [];

  const checks = [
    {
      name: 'user_profiles.userId -> users.id',
      sql: `
        select count(*)::int as broken
        from user_profiles p
        where not exists (
          select 1 from users u where u.id = p.data->>'userId'
        );
      `
    },
    {
      name: 'friend_requests sender/receiver -> users.id',
      sql: `
        select count(*)::int as broken
        from friend_requests fr
        where not exists (select 1 from users u where u.id = fr.data->>'senderId')
           or not exists (select 1 from users u where u.id = fr.data->>'receiverId');
      `
    },
    {
      name: 'chat_messages.conversationId -> conversations',
      sql: `
        select count(*)::int as broken
        from chat_messages cm
        where cm.data->>'conversationId' is not null
          and not exists (
            select 1 from conversations c where c.data->>'conversationId' = cm.data->>'conversationId'
          );
      `
    }
  ];

  for (const check of checks) {
    // eslint-disable-next-line no-await-in-loop
    const result = await pool.query(check.sql);
    const broken = Number(result.rows[0]?.broken || 0);
    if (broken > 0) {
      failures.push(`${check.name}: ${broken} broken rows`);
    }
  }

  return failures;
};

async function main(): Promise<void> {
  const mongoClient = await MongoClient.connect(mongoUrl);
  const pool = new Pool({ connectionString: supabaseDbUrl });

  let hasCountMismatch = false;
  let hasSampleMismatch = false;

  try {
    console.log('Running Mongo/Supabase parity verification');

    for (const mapping of MAPPINGS) {
      const [mongoCollectionName, nestedCollection] = mapping.mongoCollection.split('.');
      const mongoDb = mongoClient.db();

      const mongoCollection = nestedCollection
        ? mongoDb.collection(`${mongoCollectionName}.${nestedCollection}`)
        : mongoDb.collection(mongoCollectionName);

      // eslint-disable-next-line no-await-in-loop
      const mongoCount = await mongoCollection.countDocuments({});

      // eslint-disable-next-line no-await-in-loop
      const pgCountResult = await pool.query(`select count(*)::int as count from ${tableIdentifier(mapping.pgTable)}`);
      const pgCount = Number(pgCountResult.rows[0]?.count || 0);

      const countStatus = mongoCount === pgCount ? 'OK' : 'MISMATCH';
      if (countStatus === 'MISMATCH') {
        hasCountMismatch = true;
      }

      console.log(`${mapping.mongoCollection} -> ${mapping.pgTable}: mongo=${mongoCount}, supabase=${pgCount} [${countStatus}]`);

      // Sample hash verification.
      // eslint-disable-next-line no-await-in-loop
      const sampleDocs = await mongoCollection.find({}).limit(sampleSize).toArray();

      for (const mongoDoc of sampleDocs) {
        const normalized = normalize(mongoDoc);
        const id = String(normalized._id);

        // eslint-disable-next-line no-await-in-loop
        const pgRowResult = await pool.query(`select data from ${tableIdentifier(mapping.pgTable)} where id = $1 limit 1`, [id]);
        const pgData = pgRowResult.rows[0]?.data;

        if (!pgData) {
          hasSampleMismatch = true;
          console.log(`  sample missing id=${id}`);
          continue;
        }

        const mongoHash = digest(normalized);
        const pgHash = digest(pgData);

        if (mongoHash !== pgHash) {
          hasSampleMismatch = true;
          console.log(`  sample mismatch id=${id} mongoHash=${mongoHash.slice(0, 10)} pgHash=${pgHash.slice(0, 10)}`);
        }
      }
    }

    const relationshipFailures = await runRelationshipChecks(pool);
    if (relationshipFailures.length) {
      hasSampleMismatch = true;
      console.log('Relationship check failures:');
      relationshipFailures.forEach(entry => console.log(`  - ${entry}`));
    } else {
      console.log('Relationship checks: OK');
    }

    if (hasCountMismatch || hasSampleMismatch) {
      console.log('Parity verification finished with mismatches');
      process.exitCode = 2;
    } else {
      console.log('Parity verification passed');
    }
  } finally {
    await mongoClient.close();
    await pool.end();
  }
}

main().catch(error => {
  console.error('Parity verification failed:', error);
  process.exit(1);
});
