import { env } from '@env';
import { Logger } from '@lib/logger';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const log = new Logger(__filename);

let supabaseClient: SupabaseClient | null = null;

export const getSupabaseClient = (): SupabaseClient => {
  if (supabaseClient) {
    return supabaseClient;
  }

  if (!env.db.supabaseUrl) {
    throw new Error('SUPABASE_URL is required');
  }

  if (!env.db.supabaseServiceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
  }

  supabaseClient = createClient(env.db.supabaseUrl, env.db.supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  return supabaseClient;
};

export const checkSupabaseStorageConnection = async (): Promise<void> => {
  const client = getSupabaseClient();
  const { error } = await client.storage.listBuckets();

  if (error) {
    log.error('Supabase storage health check failed', error);
    throw error;
  }
};
