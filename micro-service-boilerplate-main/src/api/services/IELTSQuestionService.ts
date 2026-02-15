import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { constructLogMessage } from '@lib/env/helpers';
import { Logger } from '@lib/logger';
import { getSupabaseAdmin } from '@lib/supabaseClient';
import { Service } from 'typedi';

export type IELTSQuestionCategory = 'part1' | 'part2' | 'part3';
export type IELTSQuestionDifficulty = 'easy' | 'medium' | 'hard';

interface QuestionSelectionOptions {
  ensureUniqueTopics?: boolean;
  excludeIds?: Set<string>;
}

interface FullTestSelection {
  part1: IELTSQuestionRow[];
  part2: IELTSQuestionRow | null;
  part3: IELTSQuestionRow[];
}

export interface QuestionTopicPayload {
  questionId: string;
  question: string;
  category: IELTSQuestionCategory;
  difficulty: IELTSQuestionDifficulty;
  keywords: string[];
  followUpQuestions?: string[];
  cueCard?: {
    mainTopic: string;
    bulletPoints: string[];
    preparationTime: number;
    timeToSpeak: number;
  };
}

type IELTSQuestionRow = {
  id: string;
  category: IELTSQuestionCategory;
  difficulty: IELTSQuestionDifficulty;
  question: string;
  follow_up_questions: string[];
  cue_card: any | null;
  related_topics: string[];
  keywords: string[];
  topic: string;
  times_used: number;
  last_used_at: string | null;
  active: boolean;
};

const DIFFICULTY_PRIORITY: Record<IELTSQuestionDifficulty, IELTSQuestionDifficulty[]> = {
  easy: ['easy', 'medium', 'hard'],
  medium: ['medium', 'easy', 'hard'],
  hard: ['hard', 'medium', 'easy']
};

const shuffle = <T>(items: T[]): T[] => {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

@Service()
export class IELTSQuestionService {
  private log = new Logger(__filename);

  public async buildFullTestFromBank(
    userId: string,
    difficulty: 'beginner' | 'intermediate' | 'advanced',
    headers?: IRequestHeaders
  ): Promise<FullTestSelection | null> {
    const logMessage = constructLogMessage(__filename, 'buildFullTestFromBank', headers);
    const targetDifficulty = this.mapDifficulty(difficulty);

    const part1 = await this.selectQuestions('part1', targetDifficulty, 4, { ensureUniqueTopics: true });
    const part2Docs = await this.selectQuestions('part2', targetDifficulty, 1);
    const part3 = await this.selectQuestions('part3', targetDifficulty, 3, { ensureUniqueTopics: true });

    const part2 = part2Docs[0] ?? null;

    if (part1.length < 4 || !part2 || part3.length < 3) {
      this.log.warn(
        `${logMessage} :: Question bank missing data (p1=${part1.length}, p2=${part2 ? 1 : 0}, p3=${part3.length})`
      );
      return null;
    }

    await this.markQuestionsUsed([...part1, part2, ...part3]);

    this.log.info(`${logMessage} :: Served full test from question bank for user ${userId}`);
    return { part1, part2, part3 };
  }

  public async getRandomTopicFromBank(
    category: IELTSQuestionCategory,
    difficulty: IELTSQuestionDifficulty,
    _userId?: string,
    headers?: IRequestHeaders
  ): Promise<QuestionTopicPayload | null> {
    const logMessage = constructLogMessage(__filename, 'getRandomTopicFromBank', headers);

    const poolSize = category === 'part2' ? 3 : 8;
    const candidates = await this.selectQuestions(category, difficulty, poolSize, {
      ensureUniqueTopics: category !== 'part2'
    });

    if (!candidates.length) {
      this.log.warn(`${logMessage} :: No available questions in bank`, { category, difficulty });
      return null;
    }

    const selected = candidates[Math.floor(Math.random() * candidates.length)];
    await this.markQuestionsUsed([selected]);

    this.log.info(`${logMessage} :: Served random question from bank`, {
      questionId: selected.id,
      category,
      difficulty
    });

    return this.mapQuestionToPayload(selected);
  }

  private async selectQuestions(
    category: IELTSQuestionCategory,
    difficulty: IELTSQuestionDifficulty,
    count: number,
    options: QuestionSelectionOptions = {}
  ): Promise<IELTSQuestionRow[]> {
    const ensureUniqueTopics = options.ensureUniqueTopics ?? false;
    const excluded = new Set<string>(options.excludeIds ? Array.from(options.excludeIds) : []);

    const supabase = getSupabaseAdmin();
    const selected: IELTSQuestionRow[] = [];
    const usedTopics = new Set<string>();

    for (const diff of DIFFICULTY_PRIORITY[difficulty]) {
      if (selected.length >= count) break;

      // Fetch a pool of least-used questions for the requested category/difficulty.
      const poolSize = Math.max(count * 6, 20);
      const { data, error } = await supabase
        .from('ielts_questions')
        .select(
          'id, category, difficulty, question, follow_up_questions, cue_card, related_topics, keywords, topic, times_used, last_used_at, active'
        )
        .eq('category', category)
        .eq('active', true)
        .eq('difficulty', diff)
        .order('times_used', { ascending: true })
        .order('last_used_at', { ascending: true, nullsFirst: true })
        .limit(poolSize);

      if (error || !data?.length) {
        continue;
      }

      const batch = shuffle(data as unknown as IELTSQuestionRow[]);
      for (const row of batch) {
        if (selected.length >= count) break;
        if (!row?.id) continue;
        if (excluded.has(row.id)) continue;
        if (ensureUniqueTopics && row.topic && usedTopics.has(row.topic)) continue;

        selected.push(row);
        excluded.add(row.id);
        if (ensureUniqueTopics && row.topic) {
          usedTopics.add(row.topic);
        }
      }
    }

    if (selected.length < count) {
      // Fallback: pull from any difficulty.
      const remaining = count - selected.length;
      const poolSize = Math.max(remaining * 8, 30);
      const { data } = await supabase
        .from('ielts_questions')
        .select(
          'id, category, difficulty, question, follow_up_questions, cue_card, related_topics, keywords, topic, times_used, last_used_at, active'
        )
        .eq('category', category)
        .eq('active', true)
        .order('times_used', { ascending: true })
        .order('last_used_at', { ascending: true, nullsFirst: true })
        .limit(poolSize);

      const batch = shuffle((data as unknown as IELTSQuestionRow[]) || []);
      for (const row of batch) {
        if (selected.length >= count) break;
        if (!row?.id) continue;
        if (excluded.has(row.id)) continue;
        if (ensureUniqueTopics && row.topic && usedTopics.has(row.topic)) continue;

        selected.push(row);
        excluded.add(row.id);
        if (ensureUniqueTopics && row.topic) {
          usedTopics.add(row.topic);
        }
      }
    }

    return selected.slice(0, count);
  }

  private async markQuestionsUsed(rows: IELTSQuestionRow[]): Promise<void> {
    if (!rows.length) return;

    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();

    // Supabase/PostgREST doesn't support atomic increments in the query builder, so we update
    // each row using the value we already have in memory (small N; max ~8 per request).
    await Promise.all(
      rows
        .filter(row => row?.id)
        .map(row =>
          supabase
            .from('ielts_questions')
            .update({
              times_used: Number(row.times_used || 0) + 1,
              last_used_at: now
            })
            .eq('id', row.id)
        )
    );
  }

  private mapQuestionToPayload(row: IELTSQuestionRow): QuestionTopicPayload {
    const baseKeywords = Array.isArray(row.keywords) ? row.keywords.filter(Boolean) : [];
    const fallbackKeywords = baseKeywords.length
      ? baseKeywords
      : Array.isArray(row.related_topics)
        ? row.related_topics.filter(Boolean)
        : [];
    const keywords = fallbackKeywords.length ? fallbackKeywords : row.topic ? [row.topic] : [];

    const payload: QuestionTopicPayload = {
      questionId: row.id,
      question: row.question,
      category: row.category,
      difficulty: row.difficulty,
      keywords
    };

    if (Array.isArray(row.follow_up_questions) && row.follow_up_questions.length) {
      payload.followUpQuestions = row.follow_up_questions;
    }

    if (row.category === 'part2') {
      const cueCard = (row.cue_card || {}) as any;
      const mainTopic = (cueCard?.mainTopic || cueCard?.main_topic || '').trim() || row.question;
      const bulletPoints = Array.isArray(cueCard?.bulletPoints)
        ? cueCard.bulletPoints
        : Array.isArray(cueCard?.bullet_points)
          ? cueCard.bullet_points
          : this.buildFallbackCueCardBulletPoints(mainTopic);

      payload.cueCard = {
        mainTopic,
        bulletPoints: bulletPoints.length ? bulletPoints : this.buildFallbackCueCardBulletPoints(mainTopic),
        preparationTime: Number(cueCard?.preparationTime ?? cueCard?.preparation_time ?? 60),
        timeToSpeak: Number(cueCard?.timeToSpeak ?? cueCard?.time_to_speak ?? 120)
      };
    }

    return payload;
  }

  private buildFallbackCueCardBulletPoints(mainPrompt: string): string[] {
    const prompt = mainPrompt.trim().replace(/\.$/, '');
    return [
      prompt.toLowerCase().startsWith('describe') ? 'What it is about' : 'What happened',
      'When it happened',
      'Who was involved',
      'Why it is significant to you'
    ];
  }

  private mapDifficulty(difficulty: 'beginner' | 'intermediate' | 'advanced'): IELTSQuestionDifficulty {
    switch (difficulty) {
      case 'beginner':
        return 'easy';
      case 'advanced':
        return 'hard';
      default:
        return 'medium';
    }
  }
}

