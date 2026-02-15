import { defaultTopics } from '@api/data/topics';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { constructLogMessage } from '@lib/env/helpers';
import { Logger } from '@lib/logger';
import { getSupabaseAdmin } from '@lib/supabaseClient';
import { Service } from 'typedi';

type TopicRow = {
  id: string;
  slug: string;
  title: string;
  description: string;
  part: number;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  is_premium: boolean;
};

type TopicDto = {
  _id: string;
  slug: string;
  title: string;
  description: string;
  part: number;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  isPremium: boolean;
};

function mapTopic(row: TopicRow): TopicDto {
  return {
    _id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    part: row.part,
    category: row.category,
    difficulty: row.difficulty,
    isPremium: row.is_premium
  };
}

@Service()
export class TopicService {
  private log = new Logger(__filename);

  public async listTopics(headers: IRequestHeaders): Promise<TopicDto[]> {
    const logMessage = constructLogMessage(__filename, 'listTopics', headers);
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('topics')
      .select('id, slug, title, description, part, category, difficulty, is_premium')
      .order('part', { ascending: true })
      .order('difficulty', { ascending: true });

    if (error) {
      this.log.error(`${logMessage} :: Failed to list topics`, { error: error.message });
      return [];
    }

    if (!data || data.length === 0) {
      this.log.info(`${logMessage} :: Seeding default topics into Supabase`);
      const seedPayload = defaultTopics.map(t => ({
        slug: t.slug,
        title: t.title,
        description: t.description,
        part: t.part,
        category: t.category,
        difficulty: t.difficulty,
        is_premium: t.isPremium
      }));
      await supabase.from('topics').upsert(seedPayload, { onConflict: 'slug' });
      const { data: seeded } = await supabase
        .from('topics')
        .select('id, slug, title, description, part, category, difficulty, is_premium')
        .order('part', { ascending: true })
        .order('difficulty', { ascending: true });
      return (seeded || []).map(mapTopic);
    }

    return (data as TopicRow[]).map(mapTopic);
  }

  public async getTopicBySlug(slug: string, headers: IRequestHeaders): Promise<TopicDto | null> {
    const logMessage = constructLogMessage(__filename, 'getTopicBySlug', headers);
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('topics')
      .select('id, slug, title, description, part, category, difficulty, is_premium')
      .eq('slug', slug)
      .maybeSingle();

    if (error || !data) {
      this.log.warn(`${logMessage} :: Topic ${slug} not found`);
      return null;
    }

    return mapTopic(data as TopicRow);
  }

  public async getTopicsWithPagination(
    userId: string,
    limit: number = 10,
    offset: number = 0,
    excludeCompleted: boolean = true,
    category?: 'part1' | 'part2' | 'part3',
    difficulty?: 'beginner' | 'intermediate' | 'advanced',
    q?: string,
    headers?: IRequestHeaders
  ): Promise<{ topics: TopicDto[]; total: number; hasMore: boolean }> {
    const logMessage = constructLogMessage(__filename, 'getTopicsWithPagination', headers);
    const supabase = getSupabaseAdmin();

    let excludedIds: string[] = [];
    if (excludeCompleted) {
      const { data: completed } = await supabase
        .from('practice_sessions')
        .select('topic_id')
        .eq('user_id', userId)
        .eq('status', 'completed');
      excludedIds = (completed || [])
        .map((row: any) => row.topic_id as string | null)
        .filter((id: any): id is string => Boolean(id));
    }

    let query = supabase
      .from('topics')
      .select('id, slug, title, description, part, category, difficulty, is_premium', { count: 'exact' });

    if (excludedIds.length > 0) {
      // PostgREST expects `in.(...)` value list.
      query = query.not('id', 'in', `(${excludedIds.join(',')})`);
    }

    if (category) {
      const partNumber = parseInt(category.replace('part', ''), 10);
      if (!Number.isNaN(partNumber)) {
        query = query.eq('part', partNumber);
      }
    }

    if (difficulty) {
      query = query.eq('difficulty', difficulty);
    }

    const qNormalized = typeof q === 'string' ? q.trim() : '';
    if (qNormalized) {
      // PostgREST `.or()` uses commas to separate conditions; strip commas from input.
      const safe = qNormalized.replace(/%/g, '').replace(/,/g, ' ').slice(0, 80);
      const pattern = `%${safe}%`;
      query = query.or(`title.ilike.${pattern},description.ilike.${pattern}`);
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(Math.max(0, offset), Math.max(0, offset) + Math.min(limit, 50) - 1);

    if (error) {
      this.log.error(`${logMessage} :: Failed to fetch topics`, { error: error.message });
      return { topics: [], total: 0, hasMore: false };
    }

    const total = typeof count === 'number' ? count : (data || []).length;
    const hasMore = total > offset + limit;

    return {
      topics: ((data || []) as TopicRow[]).map(mapTopic),
      total,
      hasMore
    };
  }
}
