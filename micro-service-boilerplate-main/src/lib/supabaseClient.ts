import { env } from '@env';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

function requireEnv(name: string, value: string | undefined): string {
  if (!value || !value.trim()) {
    throw new Error(`${name} is required`);
  }
  return value.trim();
}

let adminClient: SupabaseClient | null = null;
let anonClient: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (adminClient) return adminClient;

  const url = requireEnv('SUPABASE_URL', env.supabase.url);
  const key = requireEnv('SUPABASE_SERVICE_ROLE_KEY', env.supabase.serviceRoleKey);

  adminClient = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  return adminClient;
}

export function getSupabaseAnon(): SupabaseClient {
  if (anonClient) return anonClient;

  const url = requireEnv('SUPABASE_URL', env.supabase.url);
  const key = requireEnv('SUPABASE_ANON_KEY', env.supabase.anonKey);

  anonClient = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  return anonClient;
}

