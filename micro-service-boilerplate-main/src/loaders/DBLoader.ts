import { Logger } from '@lib/logger';
import { getSupabaseAdmin } from '@lib/supabaseClient';

const connectDB = async () => {
  const log = new Logger(__filename);
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('topics').select('id').limit(1);
    if (error) {
      throw error;
    }
    log.info('✅ Connected to Supabase (Postgres + Storage)');
  } catch (error: any) {
    log.error('❌ Could not connect to Supabase', { error: error?.message || error });
    throw error;
  }
};

export default connectDB;

