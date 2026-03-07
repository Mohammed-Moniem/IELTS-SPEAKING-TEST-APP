import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { getPgPool } from '@lib/db/pgClient';
import { constructLogMessage } from '@lib/env/helpers';
import { Logger } from '@lib/logger';
import {
  IELTSQuestionCategory,
  IELTSQuestionDifficulty,
  IELTSQuestionDocument,
  IELTSQuestionModel
} from '@models/IELTSQuestionModel';
import { UserQuestionHistoryModel } from '@models/UserQuestionHistoryModel';
import { Service } from 'typedi';
import { Types } from '@lib/db/mongooseCompat';

interface QuestionSelectionOptions {
  ensureUniqueTopics?: boolean;
  excludeIds?: Set<string>;
  userId?: string;
}

interface FullTestSelection {
  part1: IELTSQuestionDocument[];
  part2: IELTSQuestionDocument | null;
  part3: IELTSQuestionDocument[];
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

const DIFFICULTY_PRIORITY: Record<IELTSQuestionDifficulty, IELTSQuestionDifficulty[]> = {
  easy: ['easy', 'medium', 'hard'],
  medium: ['medium', 'easy', 'hard'],
  hard: ['hard', 'medium', 'easy']
};

const shuffle = <T>(items: T[]): T[] => {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
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
    const excludedQuestionIds = new Set<string>(await this.getUserRecentQuestions(userId, 30));

    const part1 = await this.selectQuestions('part1', targetDifficulty, 4, {
      ensureUniqueTopics: true,
      excludeIds: excludedQuestionIds
    });
    part1.forEach(doc => excludedQuestionIds.add(doc._id.toString()));

    const part2Docs = await this.selectQuestions('part2', targetDifficulty, 1, {
      excludeIds: excludedQuestionIds
    });
    part2Docs.forEach(doc => excludedQuestionIds.add(doc._id.toString()));

    const part3 = await this.selectQuestions('part3', targetDifficulty, 3, {
      ensureUniqueTopics: true,
      excludeIds: excludedQuestionIds
    });

    const part2 = part2Docs[0] ?? null;

    if (part1.length < 4 || !part2 || part3.length < 3) {
      this.log.warn(
        `${logMessage} :: Question bank missing data (p1=${part1.length}, p2=${part2 ? 1 : 0}, p3=${part3.length})`
      );
      return null;
    }

    const usedIds = new Set<string>([...part1, ...part3].map(doc => doc._id.toString()));
    usedIds.add(part2._id.toString());
    await this.markQuestionsUsed(Array.from(usedIds));

    this.log.info(`${logMessage} :: Served full test from question bank for user ${userId}`);
    return { part1, part2, part3 };
  }

  public async getRandomTopicFromBank(
    category: IELTSQuestionCategory,
    difficulty: IELTSQuestionDifficulty,
    userId?: string,
    headers?: IRequestHeaders
  ): Promise<QuestionTopicPayload | null> {
    const logMessage = constructLogMessage(__filename, 'getRandomTopicFromBank', headers);

    const poolSize = category === 'part2' ? 3 : 8;
    const candidates = await this.selectQuestions(category, difficulty, poolSize, {
      ensureUniqueTopics: category !== 'part2',
      userId
    });

    if (!candidates.length) {
      this.log.warn(`${logMessage} :: No available questions in bank`, { category, difficulty });
      return null;
    }

    const selected = candidates[Math.floor(Math.random() * candidates.length)];
    await this.markQuestionsUsed([selected._id.toString()]);

    // Track user question history
    if (userId && selected._id) {
      await this.trackUserQuestion(userId, new Types.ObjectId(selected._id.toString()));
    }

    this.log.info(`${logMessage} :: Served random question from bank`, {
      questionId: selected._id,
      category,
      difficulty,
      userId
    });

    return this.mapQuestionToPayload(selected);
  }

  private async selectQuestions(
    category: IELTSQuestionCategory,
    difficulty: IELTSQuestionDifficulty,
    count: number,
    options: QuestionSelectionOptions = {}
  ): Promise<IELTSQuestionDocument[]> {
    const ensureUniqueTopics = options.ensureUniqueTopics ?? false;
    const excluded = new Set<string>(options.excludeIds ? Array.from(options.excludeIds) : []);
    const selected: IELTSQuestionDocument[] = [];
    const usedTopics = new Set<string>();

    // Get user's recently used question IDs if userId provided
    if (options.userId) {
      const recentQuestionIds = await this.getUserRecentQuestions(options.userId, 30);
      recentQuestionIds.forEach(id => excluded.add(id));
    }

    for (const diff of DIFFICULTY_PRIORITY[difficulty]) {
      if (selected.length >= count) {
        break;
      }

      const matchQuery: Record<string, unknown> = {
        category,
        active: true
      };

      if (diff) {
        matchQuery.difficulty = diff;
      }

      if (excluded.size) {
        matchQuery._id = { $nin: Array.from(excluded) };
      }

      const sampleSize = Math.max(count * 6, 20);
      const batch = (await IELTSQuestionModel.find(matchQuery)
        .sort({ timesUsed: 1, lastUsedAt: 1 })
        .limit(Math.min(sampleSize * 5, 1000))
        .lean()) as IELTSQuestionDocument[];

      if (!batch.length) {
        continue;
      }

      for (const doc of shuffle(batch)) {
        if (selected.length >= count) {
          break;
        }

        const docId = doc._id.toString();
        if (excluded.has(docId)) {
          continue;
        }

        if (ensureUniqueTopics && doc.topic && usedTopics.has(doc.topic)) {
          continue;
        }

        selected.push(doc);
        excluded.add(docId);

        if (ensureUniqueTopics && doc.topic) {
          usedTopics.add(doc.topic);
        }
      }
    }

    if (selected.length < count) {
      const fallbackMatchQuery: Record<string, unknown> = {
        category,
        active: true,
        _id: { $nin: Array.from(excluded) }
      };

      const fallbackBatch = (await IELTSQuestionModel.find(fallbackMatchQuery)
        .sort({ timesUsed: 1, lastUsedAt: 1 })
        .limit(500)
        .lean()) as IELTSQuestionDocument[];

      for (const doc of shuffle(fallbackBatch)) {
        if (selected.length >= count) {
          break;
        }

        const docId = doc._id.toString();
        if (excluded.has(docId)) {
          continue;
        }

        selected.push(doc);
        excluded.add(docId);
      }
    }

    return selected;
  }

  /**
   * Get user's recently used question IDs
   */
  private async getUserRecentQuestions(userId: string, days: number): Promise<string[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const history = await UserQuestionHistoryModel.find({
      userId,
      usedAt: { $gte: cutoffDate }
    }).select('questionId').lean();

    return history.map(h => h.questionId.toString());
  }

  /**
   * Track that a user has seen a question
   */
  private async trackUserQuestion(userId: string, questionId: Types.ObjectId, testId?: Types.ObjectId): Promise<void> {
    try {
      await UserQuestionHistoryModel.create({
        userId,
        questionId,
        usedAt: new Date(),
        testId,
        testType: testId ? 'full-test' : 'practice'
      });
    } catch (error) {
      this.log.error('Failed to track user question:', error);
      // Don't throw - this is not critical
    }
  }

  private async markQuestionsUsed(questionIds: string[]): Promise<void> {
    if (!questionIds.length) {
      return;
    }

    const now = new Date();
    const pool = getPgPool();

    await pool.query(
      `
        UPDATE "ielts_questions"
        SET
          data = jsonb_set(
            jsonb_set(
              data,
              '{timesUsed}',
              to_jsonb(
                CASE
                  WHEN COALESCE(data->>'timesUsed', '') ~ '^[0-9]+$' THEN ((data->>'timesUsed')::int + 1)
                  ELSE 1
                END
              ),
              true
            ),
            '{lastUsedAt}',
            to_jsonb($1::text),
            true
          ),
          updated_at = $1::timestamptz
        WHERE id = ANY($2::text[])
      `,
      [now.toISOString(), questionIds]
    );
  }

  private mapQuestionToPayload(doc: IELTSQuestionDocument): QuestionTopicPayload {
    const baseKeywords = (doc.keywords || []).filter(Boolean);
    const fallbackKeywords = baseKeywords.length
      ? baseKeywords
      : (doc.relatedTopics || []).filter(Boolean);
    const keywords = fallbackKeywords.length ? fallbackKeywords : doc.topic ? [doc.topic] : [];

    const payload: QuestionTopicPayload = {
      questionId: doc._id.toString(),
      question: doc.question,
      category: doc.category,
      difficulty: doc.difficulty,
      keywords
    };

    if (doc.followUpQuestions && doc.followUpQuestions.length) {
      payload.followUpQuestions = doc.followUpQuestions;
    }

    if (doc.category === 'part2') {
      const mainTopic = doc.cueCard?.mainTopic?.trim() || doc.question;
      const bulletPoints =
        doc.cueCard?.bulletPoints && doc.cueCard.bulletPoints.length
          ? doc.cueCard.bulletPoints
          : this.buildFallbackCueCardBulletPoints(mainTopic);

      payload.cueCard = {
        mainTopic,
        bulletPoints,
        preparationTime: doc.cueCard?.preparationTime ?? 60,
        timeToSpeak: doc.cueCard?.timeToSpeak ?? 120
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
