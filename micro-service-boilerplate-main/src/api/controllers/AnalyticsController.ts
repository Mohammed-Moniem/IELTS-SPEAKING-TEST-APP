/**
 * Analytics Controller
 * Provides endpoints for progress tracking and performance analytics
 */

import { Body, Delete, Get, JsonController, Param, Post, QueryParam, Req } from 'routing-controllers';
import { Service } from 'typedi';
import { Logger } from '../../lib/logger';
import { TestType } from '../models/TestHistory';
import { AnalyticsService } from '../services/AnalyticsService';

@Service()
@JsonController('/analytics')
export class AnalyticsController {
  private log = new Logger(__filename);

  constructor(private analyticsService: AnalyticsService) {}

  private getCurrentUserId(req: any): string | undefined {
    return req?.currentUser?.id;
  }

  private assertSameUser(req: any, userId: string): { success: false; error: string } | undefined {
    const currentUserId = this.getCurrentUserId(req);
    if (!currentUserId) {
      return { success: false, error: 'Authentication required' };
    }
    if (currentUserId !== userId) {
      return { success: false, error: 'Forbidden' };
    }
    return undefined;
  }

  /**
   * Save test result to history
   * POST /api/v1/analytics/test
   */
  @Post('/test')
  async saveTestResult(@Req() req: any, @Body() body: any): Promise<any> {
    try {
      this.log.info('📊 Save test result request');

      const currentUserId = this.getCurrentUserId(req);
      if (!currentUserId) {
        return {
          success: false,
          error: 'Authentication required'
        };
      }

      const {
        sessionId,
        testType,
        topic,
        testPart,
        durationSeconds,
        overallBand,
        criteria,
        corrections,
        suggestions,
        audioRecordingId
      } = body;

      if (!sessionId || !topic || !overallBand || !criteria) {
        return {
          success: false,
          error: 'Missing required fields: sessionId, topic, overallBand, criteria'
        };
      }

      const testHistory = await this.analyticsService.saveTestResult({
        userId: currentUserId,
        sessionId,
        testType: testType || TestType.PRACTICE,
        topic,
        testPart,
        durationSeconds: durationSeconds || 0,
        completedAt: new Date(),
        overallBand,
        criteria,
        corrections,
        suggestions,
        audioRecordingId
      });

      return {
        success: true,
        data: {
          testId: testHistory._id,
          overallBand: testHistory.overallBand,
          createdAt: testHistory.createdAt
        }
      };
    } catch (error: any) {
      this.log.error('❌ Save test result error:', error);
      return {
        success: false,
        error: error.message || 'Failed to save test result'
      };
    }
  }

  /**
   * Get comprehensive progress statistics
   * GET /api/v1/analytics/progress/:userId
   */
  @Get('/progress/:userId')
  async getProgressStats(
    @Req() req: any,
    @Param('userId') userId: string,
    @QueryParam('daysBack') daysBack?: number,
    @QueryParam('includeTests') includeTests?: number
  ): Promise<any> {
    try {
      const accessError = this.assertSameUser(req, userId);
      if (accessError) {
        return accessError;
      }

      this.log.info(`📈 Get progress stats for user: ${userId}`);

      const stats = await this.analyticsService.getProgressStats(userId, {
        daysBack: daysBack ? parseInt(daysBack.toString()) : undefined,
        includeTests: includeTests ? parseInt(includeTests.toString()) : 10
      });

      return {
        success: true,
        data: stats
      };
    } catch (error: any) {
      this.log.error('❌ Get progress stats error:', error);
      return {
        success: false,
        error: error.message || 'Failed to get progress stats'
      };
    }
  }

  /**
   * Get band distribution
   * GET /api/v1/analytics/band-distribution/:userId
   */
  @Get('/band-distribution/:userId')
  async getBandDistribution(@Req() req: any, @Param('userId') userId: string): Promise<any> {
    try {
      const accessError = this.assertSameUser(req, userId);
      if (accessError) {
        return accessError;
      }

      this.log.info(`📊 Get band distribution for user: ${userId}`);

      const distribution = await this.analyticsService.getBandDistribution(userId);

      return {
        success: true,
        data: {
          distribution
        }
      };
    } catch (error: any) {
      this.log.error('❌ Get band distribution error:', error);
      return {
        success: false,
        error: error.message || 'Failed to get band distribution'
      };
    }
  }

  /**
   * Get topic performance
   * GET /api/v1/analytics/topics/:userId
   */
  @Get('/topics/:userId')
  async getTopicPerformance(
    @Req() req: any,
    @Param('userId') userId: string,
    @QueryParam('limit') limit?: number
  ): Promise<any> {
    try {
      const accessError = this.assertSameUser(req, userId);
      if (accessError) {
        return accessError;
      }

      this.log.info(`📚 Get topic performance for user: ${userId}`);

      const topics = await this.analyticsService.getTopicPerformance(userId, limit ? parseInt(limit.toString()) : 10);

      return {
        success: true,
        data: {
          topics
        }
      };
    } catch (error: any) {
      this.log.error('❌ Get topic performance error:', error);
      return {
        success: false,
        error: error.message || 'Failed to get topic performance'
      };
    }
  }

  /**
   * Compare criteria performance
   * GET /api/v1/analytics/criteria-comparison/:userId
   */
  @Get('/criteria-comparison/:userId')
  async compareCriteria(
    @Req() req: any,
    @Param('userId') userId: string,
    @QueryParam('daysBack') daysBack?: number
  ): Promise<any> {
    try {
      const accessError = this.assertSameUser(req, userId);
      if (accessError) {
        return accessError;
      }

      this.log.info(`🔄 Compare criteria for user: ${userId}`);

      const comparison = await this.analyticsService.compareCriteriaPerformance(
        userId,
        daysBack ? parseInt(daysBack.toString()) : 30
      );

      return {
        success: true,
        data: {
          comparison
        }
      };
    } catch (error: any) {
      this.log.error('❌ Compare criteria error:', error);
      return {
        success: false,
        error: error.message || 'Failed to compare criteria'
      };
    }
  }

  /**
   * Get test history with pagination
   * GET /api/v1/analytics/history/:userId
   */
  @Get('/history/:userId')
  async getTestHistory(
    @Req() req: any,
    @Param('userId') userId: string,
    @QueryParam('limit') limit?: number,
    @QueryParam('skip') skip?: number,
    @QueryParam('testType') testType?: TestType
  ): Promise<any> {
    try {
      const accessError = this.assertSameUser(req, userId);
      if (accessError) {
        return accessError;
      }

      this.log.info(`📜 Get test history for user: ${userId}`);

      const result = await this.analyticsService.getTestHistory(userId, {
        limit: limit ? parseInt(limit.toString()) : 20,
        skip: skip ? parseInt(skip.toString()) : 0,
        testType
      });

      return {
        success: true,
        data: {
          tests: result.tests,
          total: result.total,
          limit: limit || 20,
          skip: skip || 0
        }
      };
    } catch (error: any) {
      this.log.error('❌ Get test history error:', error);
      return {
        success: false,
        error: error.message || 'Failed to get test history'
      };
    }
  }

  /**
   * Get single test details
   * GET /api/v1/analytics/test/:testId
   */
  @Get('/test/:testId')
  async getTestDetails(@Req() req: any, @Param('testId') testId: string): Promise<any> {
    try {
      this.log.info(`📄 Get test details: ${testId}`);

      const currentUserId = this.getCurrentUserId(req);
      if (!currentUserId) {
        return {
          success: false,
          error: 'Authentication required'
        };
      }

      const test = await this.analyticsService.getTestDetails(currentUserId, testId);

      if (!test) {
        return {
          success: false,
          error: 'Test not found'
        };
      }

      return {
        success: true,
        data: test
      };
    } catch (error: any) {
      this.log.error('❌ Get test details error:', error);
      return {
        success: false,
        error: error.message || 'Failed to get test details'
      };
    }
  }

  /**
   * Delete test from history
   * DELETE /api/v1/analytics/test/:testId
   */
  @Delete('/test/:testId')
  async deleteTest(@Req() req: any, @Param('testId') testId: string): Promise<any> {
    try {
      this.log.info(`🗑️  Delete test: ${testId}`);

      const currentUserId = this.getCurrentUserId(req);
      if (!currentUserId) {
        return {
          success: false,
          error: 'Authentication required'
        };
      }

      const deleted = await this.analyticsService.deleteTest(currentUserId, testId);
      if (!deleted) {
        return {
          success: false,
          error: 'Test not found'
        };
      }

      return {
        success: true,
        message: 'Test deleted successfully'
      };
    } catch (error: any) {
      this.log.error('❌ Delete test error:', error);
      return {
        success: false,
        error: error.message || 'Failed to delete test'
      };
    }
  }
}
