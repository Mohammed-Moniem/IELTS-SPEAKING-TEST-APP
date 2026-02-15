import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { constructLogMessage } from '@lib/env/helpers';
import { Logger } from '@lib/logger';
import { getSupabaseAdmin } from '@lib/supabaseClient';
import { Service } from 'typedi';

interface PreferencesPayload {
  testDate?: string;
  targetBand?: string;
  timeFrame?: string;
}

type PreferencesRow = {
  user_id: string;
  test_date: string | null;
  target_band: string | null;
  time_frame: string | null;
  created_at: string;
  updated_at: string;
};

@Service()
export class PreferencesService {
  private log = new Logger(__filename);

  public async getPreferences(userId: string, headers: IRequestHeaders) {
    const logMessage = constructLogMessage(__filename, 'getPreferences', headers);
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('preferences')
      .select('user_id, test_date, target_band, time_frame, created_at, updated_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data) {
      this.log.debug(`${logMessage} :: No preferences found for user ${userId}`);
      return null;
    }

    const row = data as PreferencesRow;
    return {
      _id: row.user_id,
      user: row.user_id,
      testDate: row.test_date || undefined,
      targetBand: row.target_band || undefined,
      timeFrame: row.time_frame || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  public async upsertPreferences(userId: string, payload: PreferencesPayload, headers: IRequestHeaders) {
    const logMessage = constructLogMessage(__filename, 'upsertPreferences', headers);
    const supabase = getSupabaseAdmin();

    const upsertPayload: Record<string, any> = { user_id: userId };
    if (payload.testDate) upsertPayload.test_date = payload.testDate;
    if (payload.targetBand) upsertPayload.target_band = payload.targetBand;
    if (payload.timeFrame) upsertPayload.time_frame = payload.timeFrame;

    const { data, error } = await supabase
      .from('preferences')
      .upsert(upsertPayload, { onConflict: 'user_id' })
      .select('user_id, test_date, target_band, time_frame, created_at, updated_at')
      .single();

    if (error || !data) {
      throw error || new Error('Failed to upsert preferences');
    }

    const row = data as PreferencesRow;
    this.log.info(`${logMessage} :: Upserted preferences for user ${userId}`);
    return {
      _id: row.user_id,
      user: row.user_id,
      testDate: row.test_date || undefined,
      targetBand: row.target_band || undefined,
      timeFrame: row.time_frame || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

