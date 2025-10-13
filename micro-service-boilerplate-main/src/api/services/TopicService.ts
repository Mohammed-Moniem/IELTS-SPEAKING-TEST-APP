import { defaultTopics } from '@api/data/topics';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { constructLogMessage } from '@lib/env/helpers';
import { Logger } from '@lib/logger';
import { PracticeSessionModel } from '@models/PracticeSessionModel';
import { TopicDocument, TopicModel } from '@models/TopicModel';
import { Container, Service } from 'typedi';
import { TopicGenerationService } from './TopicGenerationService';

@Service()
export class TopicService {
  private log = new Logger(__filename);
  private topicGenerationService: TopicGenerationService;

  constructor() {
    this.topicGenerationService = Container.get(TopicGenerationService);
  }

  public async listTopics(headers: IRequestHeaders): Promise<TopicDocument[]> {
    const logMessage = constructLogMessage(__filename, 'listTopics', headers);

    let topics = (await TopicModel.find({}).sort({ part: 1, difficulty: 1 })) as TopicDocument[];
    if (!topics.length) {
      this.log.info(`${logMessage} :: Seeding default topics`);
      await TopicModel.insertMany(defaultTopics, { ordered: false }).catch(error => {
        this.log.warn(`${logMessage} :: Topic seeding encountered issues`, { error: error.message });
      });
      topics = (await TopicModel.find({}).sort({ part: 1, difficulty: 1 })) as TopicDocument[];
    }

    return topics;
  }

  public async getTopicBySlug(slug: string, headers: IRequestHeaders): Promise<TopicDocument | null> {
    const logMessage = constructLogMessage(__filename, 'getTopicBySlug', headers);
    const topic = await TopicModel.findOne({ slug });
    if (!topic) {
      this.log.warn(`${logMessage} :: Topic ${slug} not found`);
    }
    return topic as TopicDocument | null;
  }

  /**
   * Get topics with pagination and exclude completed ones
   */
  public async getTopicsWithPagination(
    userId: string,
    limit: number = 10,
    offset: number = 0,
    excludeCompleted: boolean = true,
    category?: 'part1' | 'part2' | 'part3',
    headers?: IRequestHeaders
  ): Promise<{ topics: TopicDocument[]; total: number; hasMore: boolean }> {
    const logMessage = constructLogMessage(__filename, 'getTopicsWithPagination', headers);

    // Get completed topic slugs for this user if we need to exclude them
    let excludedTopicSlugs: string[] = [];
    if (excludeCompleted) {
      const completedSessions = await PracticeSessionModel.find({
        user: userId,
        status: 'completed'
      }).select('topicId');
      excludedTopicSlugs = completedSessions.map((session: any) => session.topicId).filter(Boolean) as string[];
    }

    // Build query
    const query: any = {};
    if (excludedTopicSlugs.length > 0) {
      query.slug = { $nin: excludedTopicSlugs };
    }
    if (category) {
      // Map category to part number
      const partNumber = parseInt(category.replace('part', ''));
      query.part = partNumber;
    }

    // Get total count
    const total = await TopicModel.countDocuments(query);

    // If we don't have enough unpracticed topics for the user, generate more
    if (total < 10 && excludeCompleted) {
      const needed = 10 - total;
      this.log.info(`${logMessage} :: User has only ${total} unpracticed topics, generating ${needed} more`);

      // Generate topics across all parts to provide variety
      const partsCount = Math.ceil(needed / 3);
      for (const part of ['part1', 'part2', 'part3'] as const) {
        await this.generateAndSaveTopics(part, partsCount, headers);
      }

      // Recalculate total after generation
      const newTotal = await TopicModel.countDocuments(query);
      this.log.info(`${logMessage} :: After generation, user now has ${newTotal} unpracticed topics`);
    }

    // Fetch topics with pagination
    const topics = (await TopicModel.find(query).sort({ createdAt: -1 }).skip(offset).limit(limit)) as TopicDocument[];

    const hasMore = total > offset + limit;

    return {
      topics,
      total,
      hasMore
    };
  }

  /**
   * Generate and save new topics to database
   */
  private async generateAndSaveTopics(
    category: 'part1' | 'part2' | 'part3',
    count: number = 10,
    headers?: IRequestHeaders
  ): Promise<any[]> {
    const logMessage = constructLogMessage(__filename, 'generateAndSaveTopics', headers);

    try {
      // Generate topics using AI
      const generatedTopics = await this.topicGenerationService.generateTopics({
        category,
        count,
        difficulty: 'medium'
      });

      // Transform AI-generated topics to match database schema
      const topicsToSave = generatedTopics.map((topic: any) => {
        // Convert part category to number
        const partNumber = category === 'part1' ? 1 : category === 'part2' ? 2 : 3;

        // Convert difficulty
        const difficultyMap: any = {
          easy: 'beginner',
          medium: 'intermediate',
          hard: 'advanced'
        };
        const difficulty = difficultyMap[topic.difficulty] || 'intermediate';

        // Generate slug from question
        const slug = this.generateSlug(topic.question);

        // Determine if premium (Part 3 = advanced topics are premium)
        const isPremium = partNumber === 3 || difficulty === 'advanced';

        return {
          slug,
          title: topic.question.substring(0, 100), // First 100 chars as title
          description: topic.question, // Full question as description
          part: partNumber,
          category: topic.keywords?.[0] || 'general', // Use first keyword as category
          difficulty,
          isPremium
        };
      });

      // Save to database
      const savedTopics = await TopicModel.insertMany(topicsToSave);
      this.log.info(`${logMessage} :: Generated and saved ${savedTopics.length} new topics for ${category}`);

      return savedTopics;
    } catch (error) {
      this.log.error(`${logMessage} :: Failed to generate topics`, { error });
      return [];
    }
  }

  /**
   * Generate a URL-friendly slug from text
   */
  private generateSlug(text: string): string {
    return (
      text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
        .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
        .substring(0, 50) + // Limit length
      '-' +
      Date.now()
    ); // Add timestamp for uniqueness
  }
}
