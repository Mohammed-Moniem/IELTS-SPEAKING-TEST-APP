import { Logger } from '@lib/logger';
import { getPgPool } from './pgClient';

const log = new Logger(__filename);

export interface StoredDocumentRow {
  id: string;
  data: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

const ensuredTables = new Set<string>();

const assertIdentifier = (value: string): string => {
  if (!/^[a-z][a-z0-9_]*$/.test(value)) {
    throw new Error(`Unsafe SQL identifier: ${value}`);
  }

  return `"${value}"`;
};

const makeIndexName = (table: string, suffix: string): string => {
  const raw = `${table}_${suffix}`;
  return raw.length > 60 ? raw.slice(0, 60) : raw;
};

export const ensureDocumentTable = async (table: string): Promise<void> => {
  if (ensuredTables.has(table)) {
    return;
  }

  const pool = getPgPool();
  const quotedTable = assertIdentifier(table);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${quotedTable} (
      id text PRIMARY KEY,
      data jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT NOW(),
      updated_at timestamptz NOT NULL DEFAULT NOW()
    );
  `);

  const updatedIndexName = assertIdentifier(makeIndexName(table, 'updated_at_idx'));
  await pool.query(`CREATE INDEX IF NOT EXISTS ${updatedIndexName} ON ${quotedTable}(updated_at DESC);`);

  const dataIndexName = assertIdentifier(makeIndexName(table, 'data_gin_idx'));
  await pool.query(`CREATE INDEX IF NOT EXISTS ${dataIndexName} ON ${quotedTable} USING GIN(data);`);

  ensuredTables.add(table);
  log.debug(`Ensured document table ${table}`);
};

export const loadTableRows = async (table: string): Promise<StoredDocumentRow[]> => {
  await ensureDocumentTable(table);

  const pool = getPgPool();
  const quotedTable = assertIdentifier(table);
  const result = await pool.query(`SELECT id, data, created_at, updated_at FROM ${quotedTable}`);

  return result.rows.map(row => ({
    id: row.id,
    data: row.data,
    createdAt: row.created_at?.toISOString?.() || new Date(row.created_at).toISOString(),
    updatedAt: row.updated_at?.toISOString?.() || new Date(row.updated_at).toISOString()
  }));
};

export const upsertRow = async (
  table: string,
  id: string,
  data: Record<string, any>,
  createdAt?: string
): Promise<void> => {
  await ensureDocumentTable(table);

  const pool = getPgPool();
  const quotedTable = assertIdentifier(table);

  await pool.query(
    `
      INSERT INTO ${quotedTable} (id, data, created_at, updated_at)
      VALUES ($1, $2::jsonb, COALESCE($3::timestamptz, NOW()), NOW())
      ON CONFLICT (id)
      DO UPDATE SET data = EXCLUDED.data, updated_at = NOW();
    `,
    [id, JSON.stringify(data), createdAt || null]
  );
};

export const deleteRowsByIds = async (table: string, ids: string[]): Promise<number> => {
  if (!ids.length) {
    return 0;
  }

  await ensureDocumentTable(table);

  const pool = getPgPool();
  const quotedTable = assertIdentifier(table);

  const result = await pool.query(`DELETE FROM ${quotedTable} WHERE id = ANY($1::text[])`, [ids]);
  return result.rowCount || 0;
};

export const clearTable = async (table: string): Promise<void> => {
  await ensureDocumentTable(table);

  const pool = getPgPool();
  const quotedTable = assertIdentifier(table);
  await pool.query(`TRUNCATE TABLE ${quotedTable}`);
};
