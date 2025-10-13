import { Request, Response } from 'express';
import { Body, Get, HttpCode, JsonController, Param, Post, QueryParam, Req, Res, UseBefore } from 'routing-controllers';

import { buildRequestHeaders, ensureResponseHeaders } from '@api/utils/requestContext';
import { HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { topicGenerationRateLimiter } from '@middlewares/rateLimitMiddleware';
import { StandardResponse } from '@responses/StandardResponse';
import { TopicGenerationService } from '@services/TopicGenerationService';
import { TopicService } from '@services/TopicService';
import { Container } from 'typedi';

@JsonController('/topics')
export class TopicController {
  private topicGenerationService: TopicGenerationService;

  constructor(private readonly topicService: TopicService) {
    this.topicGenerationService = Container.get(TopicGenerationService);
  }

  @Get('/')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async listTopics(@Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'topics-list');
    ensureResponseHeaders(res, headers);

    try {
      const topics = await this.topicService.listTopics(headers);
      const serialized = topics.map(topic => topic.toObject());
      return StandardResponse.success(res, serialized, undefined, HTTP_STATUS_CODES.SUCCESS, headers);
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
    @QueryParam('category') category: 'part1' | 'part2' | 'part3' | undefined,
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

      const result = await this.topicService.getTopicsWithPagination(
        userId,
        Math.min(limit, 50), // Cap at 50
        Math.max(offset, 0), // Ensure non-negative
        excludeCompleted,
        category,
        headers
      );

      return StandardResponse.success(
        res,
        {
          topics: result.topics.map(t => t.toObject()),
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
  public async getRandomTopic(
    @QueryParam('category') category: 'part1' | 'part2' | 'part3',
    @QueryParam('difficulty') difficulty: 'easy' | 'medium' | 'hard' = 'medium',
    @Req() req: Request,
    @Res() res: Response
  ) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'topics-random');
    ensureResponseHeaders(res, headers);

    try {
      // Validate category
      if (!category || !['part1', 'part2', 'part3'].includes(category)) {
        return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: 'Invalid or missing category. Must be part1, part2, or part3'
        });
      }

      // Generate single random topic
      const topic = await this.topicGenerationService.generateRandomTopic(category, difficulty || 'medium');

      return StandardResponse.success(
        res,
        topic,
        'Random topic generated successfully',
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
      return StandardResponse.success(res, topic.toObject(), undefined, HTTP_STATUS_CODES.SUCCESS, headers);
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

  /**
   * Get list of common IELTS topics
   * GET /api/v1/topics/common?category=part1
   */
  @Get('/common')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async getCommonTopics(
    @QueryParam('category') category: 'part1' | 'part2' | 'part3',
    @Req() req: Request,
    @Res() res: Response
  ) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'topics-common');
    ensureResponseHeaders(res, headers);

    try {
      // Validate category
      if (!category || !['part1', 'part2', 'part3'].includes(category)) {
        return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: 'Invalid or missing category. Must be part1, part2, or part3'
        });
      }

      const topics = this.topicGenerationService.getCommonTopics(category);

      return StandardResponse.success(
        res,
        {
          category,
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
}
