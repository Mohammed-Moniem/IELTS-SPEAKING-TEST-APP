import { Request, Response } from 'express';
import { Body, Get, HttpCode, JsonController, Param, Post, QueryParam, Req, Res, UseBefore } from 'routing-controllers';

import { buildRequestHeaders, ensureResponseHeaders } from '@api/utils/requestContext';
import { HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { topicGenerationRateLimiter } from '@middlewares/rateLimitMiddleware';
import { AuthMiddleware } from '@middlewares/AuthMiddleware';
import { StandardResponse } from '@responses/StandardResponse';
import { IELTSQuestionService } from '@services/IELTSQuestionService';
import { TopicGenerationService } from '@services/TopicGenerationService';
import { TopicService } from '@services/TopicService';
import { Container } from 'typedi';

@JsonController('/topics')
export class TopicController {
  private topicGenerationService: TopicGenerationService;
  private questionBankService: IELTSQuestionService;

  constructor(private readonly topicService: TopicService) {
    this.topicGenerationService = Container.get(TopicGenerationService);
    this.questionBankService = Container.get(IELTSQuestionService);
  }

  private parseCategory(raw?: string): 'part1' | 'part2' | 'part3' | undefined {
    const value = (raw || '').trim();
    if (!value) return undefined;
    if (value === 'part1' || value === 'part2' || value === 'part3') return value;
    return undefined;
  }

  private parseDifficulty(raw?: string): 'easy' | 'medium' | 'hard' {
    const value = (raw || '').trim();
    if (value === 'easy' || value === 'medium' || value === 'hard') return value;
    return 'medium';
  }

  private parseTopicDifficulty(raw?: string): 'beginner' | 'intermediate' | 'advanced' | undefined {
    const value = (raw || '').trim();
    if (!value) return undefined;
    if (value === 'beginner' || value === 'intermediate' || value === 'advanced') return value;
    return undefined;
  }

  @Get('/')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async listTopics(@Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'topics-list');
    ensureResponseHeaders(res, headers);

    try {
      const topics = await this.topicService.listTopics(headers);
      return StandardResponse.success(res, topics, undefined, HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  /**
   * Get topics with pagination (for infinite scroll)
   * GET /api/v1/topics/practice?limit=10&offset=0&excludeCompleted=true&category=part1
   */
  @Get('/practice')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async getPracticeTopics(
    @QueryParam('limit') limit: number = 10,
    @QueryParam('offset') offset: number = 0,
    @QueryParam('excludeCompleted') excludeCompleted: boolean = true,
    @QueryParam('category') category?: string,
    @QueryParam('difficulty') difficulty?: string,
    @QueryParam('q') q?: string,
    @Req() req: Request,
    @Res() res: Response
  ) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'topics-practice');
    ensureResponseHeaders(res, headers);

    try {
      // Get user ID from request (assuming authentication middleware sets this)
      const userId = (req as any).currentUser?.id;
      if (!userId) {
        return res.status(HTTP_STATUS_CODES.UNAUTHORIZED).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const parsedCategory = this.parseCategory(category);
      if (category && !parsedCategory) {
        return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: 'Invalid category. Must be part1, part2, or part3'
        });
      }

      const parsedDifficulty = this.parseTopicDifficulty(difficulty);
      if (difficulty && !parsedDifficulty) {
        return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: 'Invalid difficulty. Must be beginner, intermediate, or advanced'
        });
      }

      const result = await this.topicService.getTopicsWithPagination(
        userId,
        Math.min(limit, 50), // Cap at 50
        Math.max(offset, 0), // Ensure non-negative
        excludeCompleted,
        parsedCategory,
        parsedDifficulty,
        q,
        headers
      );

      return StandardResponse.success(
        res,
        {
          topics: result.topics,
          total: result.total,
          hasMore: result.hasMore,
          limit,
          offset
        },
        undefined,
        HTTP_STATUS_CODES.SUCCESS,
        headers
      );
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  /**
   * Get a single random topic
   * GET /api/v1/topics/get-random?category=part1&difficulty=medium
   * Note: Using /get-random instead of /random to avoid conflicts with /:slug route
  */
  @Get('/get-random')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  @UseBefore(AuthMiddleware)
  public async getRandomTopic(
    @QueryParam('category') category?: string,
    @QueryParam('difficulty') difficulty: string = 'medium',
    @Req() req: Request,
    @Res() res: Response
  ) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'topics-random');
    ensureResponseHeaders(res, headers);

    try {
      // Validate category
      const parsedCategory = this.parseCategory(category);
      if (!parsedCategory) {
        return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: 'Invalid or missing category. Must be part1, part2, or part3'
        });
      }

      const userId = (req as any).currentUser?.id;
      const parsedDifficulty = this.parseDifficulty(difficulty);

      // Try pulling from question bank first for authentic content
      const bankTopic = await this.questionBankService.getRandomTopicFromBank(
        parsedCategory,
        parsedDifficulty,
        userId,
        headers
      );

      if (bankTopic) {
        return StandardResponse.success(
          res,
          bankTopic,
          'Random topic retrieved from question bank',
          HTTP_STATUS_CODES.SUCCESS,
          headers
        );
      }

      // Fall back to AI generation if bank has no data
      const generatedTopic = await this.topicGenerationService.generateRandomTopic(parsedCategory, parsedDifficulty);

      return StandardResponse.success(
        res,
        generatedTopic,
        'Random topic generated successfully',
        HTTP_STATUS_CODES.SUCCESS,
        headers
      );
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  /**
   * Get list of common IELTS topics
   * GET /api/v1/topics/common?category=part1
   *
   * NOTE: This must be registered before `/:slug` so it doesn't get treated as a slug.
   */
  @Get('/common')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async getCommonTopics(
    @QueryParam('category') category?: string,
    @Req() req: Request,
    @Res() res: Response
  ) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'topics-common');
    ensureResponseHeaders(res, headers);

    try {
      // Validate category
      const parsedCategory = this.parseCategory(category);
      if (!parsedCategory) {
        return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: 'Invalid or missing category. Must be part1, part2, or part3'
        });
      }

      const topics = this.topicGenerationService.getCommonTopics(parsedCategory);

      return StandardResponse.success(
        res,
        {
          category: parsedCategory,
          topics,
          count: topics.length
        },
        'Common topics retrieved successfully',
        HTTP_STATUS_CODES.SUCCESS,
        headers
      );
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Get('/:slug')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async getTopic(@Param('slug') slug: string, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'topics-detail');
    ensureResponseHeaders(res, headers);

    try {
      const topic = await this.topicService.getTopicBySlug(slug, headers);
      if (!topic) {
        return StandardResponse.notFound(res, 'Topic', headers);
      }
      return StandardResponse.success(res, topic, undefined, HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  /**
   * Generate new topics using AI
   * POST /api/v1/topics/generate
   * Body: { count?: number, difficulty?: 'beginner' | 'intermediate' | 'advanced', part?: 1 | 2 | 3 }
   */
  @Post('/generate')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  @UseBefore(topicGenerationRateLimiter)
  public async generateTopics(@Body() body: any, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'topics-generate');
    ensureResponseHeaders(res, headers);

    try {
      const { count = 5, difficulty, part } = body;

      // Map frontend difficulty to backend format
      const backendDifficulty = difficulty === 'beginner' ? 'easy' : difficulty === 'advanced' ? 'hard' : 'medium';

      // Map part number to category
      const category = part ? (`part${part}` as 'part1' | 'part2' | 'part3') : undefined;

      // If no category specified, distribute evenly across all parts
      const generatedTopics = [];

      if (category) {
        const topics = await this.topicGenerationService.generateTopics({
          category,
          count,
          difficulty: backendDifficulty,
          excludeKeywords: []
        });
        generatedTopics.push(...topics);
      } else {
        // Distribute topics across all three parts
        const partsCount = Math.ceil(count / 3);

        for (const part of ['part1', 'part2', 'part3'] as const) {
          const topics = await this.topicGenerationService.generateTopics({
            category: part,
            count: partsCount,
            difficulty: backendDifficulty,
            excludeKeywords: []
          });
          generatedTopics.push(...topics);
        }
      }

      // Only return the requested count
      const finalTopics = generatedTopics.slice(0, count);

      return StandardResponse.success(
        res,
        {
          topics: finalTopics,
          generated: finalTopics.length
        },
        'Topics generated successfully',
        HTTP_STATUS_CODES.SUCCESS,
        headers
      );
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }
}
