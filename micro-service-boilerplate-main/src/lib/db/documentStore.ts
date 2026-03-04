import { Logger } from '@lib/logger';
import { getPgPool } from './pgClient';

const log = new Logger(__filename);

export interface StoredDocumentRow {
  id: string;
  data: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface TableQueryOptions {
  filter?: Record<string, any>;
  sort?: Record<string, 1 | -1>;
  skip?: number;
  limit?: number;
  single?: boolean;
}

const ensuredTables = new Set<string>();

const isPlainObject = (value: unknown): value is Record<string, any> => {
  return !!value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date);
};

const isIsoDateLike = (value: string): boolean => {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value);
};

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

const isSafePath = (path: string): boolean => /^[A-Za-z0-9_.]+$/.test(path);

const getPathParts = (path: string): string[] | null => {
  if (!isSafePath(path)) return null;
  const parts = path.split('.').filter(Boolean);
  if (!parts.length) return null;
  if (parts.some(part => !/^[A-Za-z0-9_]+$/.test(part))) return null;
  return parts;
};

const toJsonPathLiteral = (parts: string[]): string => `'{${parts.join(',')}}'`;

type FieldExpression = {
  kind: 'id' | 'createdAt' | 'updatedAt' | 'jsonText';
  parts?: string[];
  sql: string;
};

const getFieldExpression = (field: string): FieldExpression | null => {
  if (field === '_id') return { kind: 'id', sql: 'id' };
  if (field === 'createdAt') return { kind: 'createdAt', sql: 'created_at' };
  if (field === 'updatedAt') return { kind: 'updatedAt', sql: 'updated_at' };

  const parts = getPathParts(field);
  if (!parts) return null;

  const sql = parts.length === 1 ? `data->>'${parts[0]}'` : `data #>> ${toJsonPathLiteral(parts)}`;
  return { kind: 'jsonText', parts, sql };
};

const addParam = (params: any[], value: any): string => {
  params.push(value);
  return `$${params.length}`;
};

const compileScalarComparison = (
  expr: FieldExpression,
  operator: '$gt' | '$gte' | '$lt' | '$lte',
  value: unknown,
  params: any[]
): string | null => {
  const sqlOperator = operator === '$gt' ? '>' : operator === '$gte' ? '>=' : operator === '$lt' ? '<' : '<=';

  if (expr.kind === 'createdAt' || expr.kind === 'updatedAt') {
    const placeholder = addParam(params, value);
    return `${expr.sql} ${sqlOperator} ${placeholder}::timestamptz`;
  }

  if (expr.kind !== 'jsonText') return null;

  if (typeof value === 'number') {
    const placeholder = addParam(params, value);
    return `(NULLIF(${expr.sql}, '')::double precision ${sqlOperator} ${placeholder})`;
  }

  if (typeof value === 'string' && isIsoDateLike(value)) {
    const placeholder = addParam(params, value);
    return `(NULLIF(${expr.sql}, '')::timestamptz ${sqlOperator} ${placeholder}::timestamptz)`;
  }

  if (typeof value === 'string') {
    const placeholder = addParam(params, value);
    return `${expr.sql} ${sqlOperator} ${placeholder}`;
  }

  return null;
};

const compileFieldPredicate = (field: string, rawValue: unknown, params: any[]): string | null => {
  const expr = getFieldExpression(field);
  if (!expr) return null;

  const operatorObject = isPlainObject(rawValue) && Object.keys(rawValue).some(key => key.startsWith('$'));
  if (!operatorObject) {
    if (expr.kind === 'id') {
      const placeholder = addParam(params, `${rawValue ?? ''}`);
      return `${expr.sql} = ${placeholder}`;
    }

    if (expr.kind === 'createdAt' || expr.kind === 'updatedAt') {
      const placeholder = addParam(params, rawValue);
      return `${expr.sql} = ${placeholder}::timestamptz`;
    }

    if (expr.kind === 'jsonText' && expr.parts?.length === 1) {
      const placeholder = addParam(params, JSON.stringify({ [expr.parts[0]]: rawValue }));
      return `data @> ${placeholder}::jsonb`;
    }

    const placeholder = addParam(params, rawValue === null || rawValue === undefined ? null : `${rawValue}`);
    return `${expr.sql} = ${placeholder}`;
  }

  const objectValue = rawValue as Record<string, any>;
  const operatorKeys = Object.keys(objectValue);
  if (!operatorKeys.every(key => key.startsWith('$'))) return null;

  const fragments: string[] = [];

  for (const [operator, value] of Object.entries(objectValue)) {
    switch (operator) {
      case '$exists': {
        const exists = Boolean(value);
        if (expr.kind === 'id') {
          fragments.push(exists ? 'TRUE' : 'FALSE');
          break;
        }
        if (expr.kind === 'createdAt' || expr.kind === 'updatedAt') {
          fragments.push(exists ? `${expr.sql} IS NOT NULL` : `${expr.sql} IS NULL`);
          break;
        }
        if (expr.parts?.length === 1) {
          fragments.push(exists ? `data ? '${expr.parts[0]}'` : `NOT (data ? '${expr.parts[0]}')`);
          break;
        }
        fragments.push(exists ? `data #> ${toJsonPathLiteral(expr.parts || [])} IS NOT NULL` : `data #> ${toJsonPathLiteral(expr.parts || [])} IS NULL`);
        break;
      }
      case '$in':
      case '$nin': {
        if (!Array.isArray(value)) return null;
        const wantsNull = value.some(entry => entry === null || entry === undefined);
        const normalizedValues = value
          .filter(entry => entry !== null && entry !== undefined)
          .map(entry => `${entry}`);

        const isNin = operator === '$nin';

        if (!normalizedValues.length && !wantsNull) {
          fragments.push(isNin ? 'TRUE' : 'FALSE');
          break;
        }

        if (expr.kind === 'id') {
          if (!normalizedValues.length) {
            fragments.push(isNin ? 'TRUE' : 'FALSE');
            break;
          }
          const placeholder = addParam(params, normalizedValues);
          fragments.push(isNin ? `NOT (${expr.sql} = ANY(${placeholder}::text[]))` : `${expr.sql} = ANY(${placeholder}::text[])`);
          break;
        }

        const textExpression = expr.sql;
        const checks: string[] = [];
        if (normalizedValues.length) {
          const placeholder = addParam(params, normalizedValues);
          checks.push(isNin ? `${textExpression} <> ALL(${placeholder}::text[])` : `${textExpression} = ANY(${placeholder}::text[])`);
        }
        if (wantsNull) {
          checks.push(isNin ? `${textExpression} IS NOT NULL` : `${textExpression} IS NULL`);
        }

        fragments.push(checks.length > 1 ? `(${checks.join(isNin ? ' AND ' : ' OR ')})` : checks[0]);
        break;
      }
      case '$ne': {
        if (value === null || value === undefined) {
          fragments.push(`${expr.sql} IS NOT NULL`);
          break;
        }

        if (expr.kind === 'id') {
          const placeholder = addParam(params, `${value}`);
          fragments.push(`${expr.sql} <> ${placeholder}`);
          break;
        }

        if (expr.kind === 'createdAt' || expr.kind === 'updatedAt') {
          const placeholder = addParam(params, value);
          fragments.push(`${expr.sql} <> ${placeholder}::timestamptz`);
          break;
        }

        if (expr.kind === 'jsonText' && expr.parts?.length === 1) {
          const placeholder = addParam(params, JSON.stringify({ [expr.parts[0]]: value }));
          fragments.push(`NOT (data @> ${placeholder}::jsonb)`);
          break;
        }

        const placeholder = addParam(params, `${value}`);
        fragments.push(`${expr.sql} <> ${placeholder}`);
        break;
      }
      case '$gt':
      case '$gte':
      case '$lt':
      case '$lte': {
        const fragment = compileScalarComparison(expr, operator, value, params);
        if (!fragment) return null;
        fragments.push(fragment);
        break;
      }
      default:
        return null;
    }
  }

  if (!fragments.length) return 'TRUE';
  return fragments.length === 1 ? fragments[0] : `(${fragments.join(' AND ')})`;
};

const compileFilterExpression = (filter: unknown, params: any[]): string | null => {
  if (!filter || (isPlainObject(filter) && !Object.keys(filter).length)) {
    return 'TRUE';
  }
  if (!isPlainObject(filter)) return null;

  const fragments: string[] = [];

  for (const [key, rawValue] of Object.entries(filter)) {
    if (key === '$and' || key === '$or') {
      if (!Array.isArray(rawValue) || !rawValue.length) return null;
      const inner = rawValue
        .map(item => compileFilterExpression(item, params))
        .filter((item): item is string => Boolean(item));
      if (inner.length !== rawValue.length) return null;
      fragments.push(inner.length === 1 ? inner[0] : `(${inner.join(key === '$and' ? ' AND ' : ' OR ')})`);
      continue;
    }

    if (key.startsWith('$')) return null;

    const fragment = compileFieldPredicate(key, rawValue, params);
    if (!fragment) return null;
    fragments.push(fragment);
  }

  if (!fragments.length) return 'TRUE';
  return fragments.length === 1 ? fragments[0] : fragments.map(fragment => `(${fragment})`).join(' AND ');
};

const compileSortClause = (sort: Record<string, 1 | -1> | undefined): string | null => {
  if (!sort || !Object.keys(sort).length) return '';

  const orderBy = Object.entries(sort).map(([field, direction]) => {
    if (direction !== 1 && direction !== -1) return null;
    const expression = getFieldExpression(field);
    if (!expression) return null;
    return `${expression.sql} ${direction === -1 ? 'DESC' : 'ASC'}`;
  });

  if (orderBy.some(item => !item)) return null;
  return orderBy.join(', ');
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

  if (table === 'writing_tasks') {
    const trackTaskIdx = assertIdentifier(makeIndexName(table, 'track_task_idx'));
    await pool.query(
      `CREATE INDEX IF NOT EXISTS ${trackTaskIdx}
       ON ${quotedTable} ((data->>'track'), (data->>'taskType'))`
    );

    const activeSourceIdx = assertIdentifier(makeIndexName(table, 'active_source_idx'));
    await pool.query(
      `CREATE INDEX IF NOT EXISTS ${activeSourceIdx}
       ON ${quotedTable} ((COALESCE((data->>'active')::boolean, false)), (COALESCE((data->>'autoPublished')::boolean, false)), (data->>'source'))`
    );
  }

  if (table === 'writing_submissions') {
    const userCreatedIdx = assertIdentifier(makeIndexName(table, 'user_created_idx'));
    await pool.query(
      `CREATE INDEX IF NOT EXISTS ${userCreatedIdx}
       ON ${quotedTable} ((data->>'userId'), created_at DESC)`
    );

    const userTrackTaskIdx = assertIdentifier(makeIndexName(table, 'user_track_task_idx'));
    await pool.query(
      `CREATE INDEX IF NOT EXISTS ${userTrackTaskIdx}
       ON ${quotedTable} ((data->>'userId'), (data->>'track'), (data->>'taskType'), created_at DESC)`
    );
  }

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

export const queryTableRows = async (table: string, options: TableQueryOptions = {}): Promise<StoredDocumentRow[] | null> => {
  await ensureDocumentTable(table);

  const params: any[] = [];
  const whereClause = compileFilterExpression(options.filter || {}, params);
  if (!whereClause) return null;

  const orderClause = compileSortClause(options.sort);
  if (orderClause === null) return null;

  const pool = getPgPool();
  const quotedTable = assertIdentifier(table);

  let query = `SELECT id, data, created_at, updated_at FROM ${quotedTable} WHERE ${whereClause}`;

  if (orderClause && orderClause.length > 0) {
    query += ` ORDER BY ${orderClause}`;
  }

  const limit = options.single ? 1 : options.limit;
  if (typeof limit === 'number' && Number.isFinite(limit) && limit >= 0) {
    query += ` LIMIT ${addParam(params, limit)}`;
  }

  if (typeof options.skip === 'number' && Number.isFinite(options.skip) && options.skip > 0) {
    query += ` OFFSET ${addParam(params, options.skip)}`;
  }

  const result = await pool.query(query, params);
  return result.rows.map(row => ({
    id: row.id,
    data: row.data,
    createdAt: row.created_at?.toISOString?.() || new Date(row.created_at).toISOString(),
    updatedAt: row.updated_at?.toISOString?.() || new Date(row.updated_at).toISOString()
  }));
};

export const countTableRows = async (table: string, filter: Record<string, any> = {}): Promise<number | null> => {
  await ensureDocumentTable(table);

  const params: any[] = [];
  const whereClause = compileFilterExpression(filter, params);
  if (!whereClause) return null;

  const pool = getPgPool();
  const quotedTable = assertIdentifier(table);
  const result = await pool.query(`SELECT COUNT(*)::bigint AS count FROM ${quotedTable} WHERE ${whereClause}`, params);
  return Number(result.rows[0]?.count || 0);
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
