import { BadRequestError, CurrentUser, Get, JsonController, Post, QueryParam } from 'routing-controllers';
import { Logger } from '../../lib/logger';
import { LeaderboardMetric, LeaderboardPeriod, leaderboardService } from '../services/LeaderboardService';

const log = new Logger(__filename);

@JsonController('/leaderboard')
export class LeaderboardController {
  /**
   * Get leaderboard
   * GET /api/leaderboard
   */
  @Get('/')
  async getLeaderboard(
    @CurrentUser() currentUser: any,
    @QueryParam('period') period?: LeaderboardPeriod,
    @QueryParam('metric') metric?: LeaderboardMetric,
    @QueryParam('limit') limit?: number
  ) {
    try {
      const leaderboard = await leaderboardService.getLeaderboard(
        period || 'all-time',
        metric || 'score',
        limit || 100,
        currentUser?.id
      );

      return {
        success: true,
        data: leaderboard
      };
    } catch (error: any) {
      log.error('Error getting leaderboard:', error);
      throw new BadRequestError(error.message);
    }
  }

  /**
   * Get friends leaderboard
   * GET /api/leaderboard/friends
   */
  @Get('/friends')
  async getFriendsLeaderboard(
    @CurrentUser({ required: true }) currentUser: any,
    @QueryParam('period') period?: LeaderboardPeriod,
    @QueryParam('metric') metric?: LeaderboardMetric
  ) {
    try {
      const leaderboard = await leaderboardService.getFriendsLeaderboard(
        currentUser.id,
        period || 'all-time',
        metric || 'score'
      );

      return {
        success: true,
        data: leaderboard
      };
    } catch (error: any) {
      log.error('Error getting friends leaderboard:', error);
      throw new BadRequestError(error.message);
    }
  }

  /**
   * Get user's position
   * GET /api/leaderboard/position
   */
  @Get('/position')
  async getUserPosition(
    @CurrentUser({ required: true }) currentUser: any,
    @QueryParam('period') period?: LeaderboardPeriod,
    @QueryParam('metric') metric?: LeaderboardMetric
  ) {
    try {
      const position = await leaderboardService.getUserPosition(
        currentUser.id,
        period || 'all-time',
        metric || 'score'
      );

      return {
        success: true,
        data: position
      };
    } catch (error: any) {
      log.error('Error getting user position:', error);
      throw new BadRequestError(error.message);
    }
  }

  /**
   * Opt in to leaderboard
   * POST /api/leaderboard/opt-in
   */
  @Post('/opt-in')
  async optIn(@CurrentUser({ required: true }) currentUser: any) {
    try {
      await leaderboardService.optInToLeaderboard(currentUser.id);

      return {
        success: true,
        message: 'Successfully opted in to leaderboard'
      };
    } catch (error: any) {
      log.error('Error opting in to leaderboard:', error);
      throw new BadRequestError(error.message);
    }
  }

  /**
   * Opt out from leaderboard
   * POST /api/leaderboard/opt-out
   */
  @Post('/opt-out')
  async optOut(@CurrentUser({ required: true }) currentUser: any) {
    try {
      await leaderboardService.optOutFromLeaderboard(currentUser.id);

      return {
        success: true,
        message: 'Successfully opted out from leaderboard'
      };
    } catch (error: any) {
      log.error('Error opting out from leaderboard:', error);
      throw new BadRequestError(error.message);
    }
  }
}
