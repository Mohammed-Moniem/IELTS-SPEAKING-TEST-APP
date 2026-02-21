import { env } from '@env';
import { initializeSupabasePersistence } from '@lib/db/bootstrap';
import { checkSupabaseStorageConnection } from '@lib/db/supabaseClient';
import { Logger } from '@lib/logger';

const connectDB = async () => {
  const log = new Logger(__filename);
  try {
    await initializeSupabasePersistence();
    log.info('Successfully connected to Supabase Postgres');

    if (env.storage.provider === 'supabase') {
      await checkSupabaseStorageConnection();
      log.info('Supabase storage connectivity verified');
    }
  } catch (error: any) {
    log.error('Could not connect to Supabase: ', error);
  }
};

export default connectDB;
