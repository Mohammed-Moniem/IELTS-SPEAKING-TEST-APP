import { Logger } from '@lib/logger';
import { ensureDocumentTable } from './documentStore';
import { checkPgConnection } from './pgClient';
import { EXTRA_TABLES, MODEL_TABLE_MAP } from './tableMappings';

const log = new Logger(__filename);

export const initializeSupabasePersistence = async (): Promise<void> => {
  await checkPgConnection();

  const tableNames = new Set<string>([...Object.values(MODEL_TABLE_MAP), ...Object.values(EXTRA_TABLES)]);

  for (const tableName of tableNames) {
    // eslint-disable-next-line no-await-in-loop
    await ensureDocumentTable(tableName);
  }

  log.info(`Supabase persistence initialized (${tableNames.size} tables ensured)`);
};
