import { getSupabaseAdmin } from '@lib/supabaseClient';
import { Service } from 'typedi';

export type FavoriteEntity =
  | 'topic'
  | 'ielts_question'
  | 'practice_session'
  | 'test_simulation'
  | 'audio_recording';

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

@Service()
export class FavoritesService {
  async listFavoriteIds(userId: string, entityType: FavoriteEntity): Promise<string[]> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('favorites')
      .select('entity_id')
      .eq('user_id', userId)
      .eq('entity_type', entityType)
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) {
      throw new Error(error.message);
    }

    return (data || [])
      .map((row: any) => String(row.entity_id || '').trim())
      .filter((id: string) => id.length > 0);
  }

  async addFavorite(userId: string, entityType: FavoriteEntity, entityId: string): Promise<void> {
    const id = String(entityId || '').trim();
    if (!isUuid(id)) {
      throw new Error('entityId must be a UUID');
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('favorites')
      .upsert(
        {
          user_id: userId,
          entity_type: entityType,
          entity_id: id
        },
        { onConflict: 'user_id,entity_type,entity_id', ignoreDuplicates: true }
      );

    if (error) {
      throw new Error(error.message);
    }
  }

  async removeFavorite(userId: string, entityType: FavoriteEntity, entityId: string): Promise<void> {
    const id = String(entityId || '').trim();
    if (!isUuid(id)) {
      throw new Error('entityId must be a UUID');
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('favorites')
      .delete()
      .eq('user_id', userId)
      .eq('entity_type', entityType)
      .eq('entity_id', id);

    if (error) {
      throw new Error(error.message);
    }
  }
}

