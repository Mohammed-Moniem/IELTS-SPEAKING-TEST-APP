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

  /**
   * Save test result to history
   * POST /api/v1/analytics/test
   */
  @Post('/test')
  async saveTestResult(@Body() body: any): Promise<any> {
    try {
      this.log.info('📊 Save test result request');

      const {
        userId,
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

      if (!userId || !sessionId || !topic || !overallBand || !criteria) {
        return {
          success: false,
          error: 'Missing required fields: userId, sessionId, topic, overallBand, criteria'
        };
      }

      const testHistory = await this.analyticsService.saveTestResult({
        userId,
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
    @Param('userId') userId: string,
    @QueryParam('daysBack') daysBack?: number,
    @QueryParam('includeTests') includeTests?: number
  ): Promise<any> {
    try {
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
  async getBandDistribution(@Param('userId') userId: string): Promise<any> {
    try {
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
  async getTopicPerformance(@Param('userId') userId: string, @QueryParam('limit') limit?: number): Promise<any> {
    try {
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
  async compareCriteria(@Param('userId') userId: string, @QueryParam('daysBack') daysBack?: number): Promise<any> {
    try {
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
    @Param('userId') userId: string,
    @QueryParam('limit') limit?: number,
    @QueryParam('skip') skip?: number,
    @QueryParam('testType') testType?: TestType
  ): Promise<any> {
    try {
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
  async getTestDetails(@Param('testId') testId: string): Promise<any> {
    try {
      this.log.info(`📄 Get test details: ${testId}`);

      const test = await this.analyticsService.getTestDetails(testId);

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
  async deleteTest(@Param('testId') testId: string, @Req() req: any): Promise<any> {
    try {
      this.log.info(`🗑️  Delete test: ${testId}`);

      const test = await this.analyticsService.getTestDetails(testId);
      if (!test) {
        return {
          success: false,
          error: 'Test not found'
        };
      }

      const requesterId = req.currentUser?.id;
      const roles = new Set<string>(req.currentUser?.roles || []);
      const isPrivileged = roles.has('superadmin') || roles.has('support_agent');
      if (!isPrivileged && test.userId !== requesterId) {
        return {
          success: false,
          error: 'Forbidden'
        };
      }

      await this.analyticsService.deleteTest(testId);

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
