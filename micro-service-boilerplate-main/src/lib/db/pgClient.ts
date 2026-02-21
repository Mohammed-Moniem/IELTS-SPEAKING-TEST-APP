import { env } from '@env';
import { Logger } from '@lib/logger';
import { Pool } from 'pg';

const log = new Logger(__filename);

let pgPool: Pool | null = null;

export const getPgPool = (): Pool => {
  if (pgPool) {
    return pgPool;
  }

  if (!env.db.supabaseDbUrl) {
    throw new Error('SUPABASE_DB_URL is required to initialize database pool');
  }

  pgPool = new Pool({
    connectionString: env.db.supabaseDbUrl,
    max: 20,
    idleTimeoutMillis: 30_000
  });

  pgPool.on('error', error => {
    log.error('Unexpected PostgreSQL pool error', error);
  });

  return pgPool;
};

export const checkPgConnection = async (): Promise<void> => {
  const pool = getPgPool();
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
  } finally {
    client.release();
  }
};
