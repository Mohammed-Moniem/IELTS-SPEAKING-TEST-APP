import { BadRequestError, CurrentUser, Get, JsonController, Param, QueryParam } from 'routing-controllers';
import { Logger } from '../../lib/logger';
import { AchievementCategory } from '../models/AchievementModel';
import { achievementService } from '../services/AchievementService';

const log = new Logger(__filename);

@JsonController('/achievements')
export class AchievementController {
  /**
   * Get all achievements with user progress
   * GET /api/achievements
   */
  @Get('/')
  async getAllAchievements(
    @CurrentUser({ required: true }) currentUser: any,
    @QueryParam('category') category?: AchievementCategory
  ) {
    try {
      // Handle multiple JWT payload formats (userId, sub, id, _id)
      const userId = currentUser?.userId || currentUser?.sub || currentUser?.id || currentUser?._id;

      if (!userId) {
        log.error('❌ No user ID found in JWT payload', {
          currentUser,
          keys: Object.keys(currentUser || {})
        });
        throw new BadRequestError('User ID not found in authentication token');
      }

      log.info('🔐 User authenticated for achievements', {
        userId,
        category,
        source: currentUser?.userId ? 'userId' : currentUser?.sub ? 'sub' : currentUser?.id ? 'id' : '_id'
      });

      let achievements;

      if (category) {
        achievements = await achievementService.getAchievementsByCategory(category);
      } else {
        achievements = await achievementService.getAllAchievementsWithProgress(userId);
      }

      return {
        success: true,
        data: achievements
      };
    } catch (error: any) {
      log.error('❌ Error getting achievements:', {
        error: error.message,
        stack: error.stack,
        user: currentUser
      });
      throw new BadRequestError(error.message);
    }
  }

  /**
   * Get user's unlocked achievements
   * GET /api/achievements/user/:userId
   */
  @Get('/user/:userId')
  async getUserAchievements(@Param('userId') userId: string) {
    try {
      if (!userId) {
        log.error('❌ No user ID provided in URL parameter');
        throw new BadRequestError('User ID is required');
      }

      log.info('🔍 Fetching achievements for user', { userId });

      const achievements = await achievementService.getUserAchievements(userId);

      return {
        success: true,
        data: achievements
      };
    } catch (error: any) {
      log.error('❌ Error getting user achievements:', {
        error: error.message,
        stack: error.stack,
        userId
      });
      throw new BadRequestError(error.message);
    }
  }

  /**
   * Get user's own achievements
   * GET /api/achievements/me
   */
  @Get('/me')
  async getMyAchievements(@CurrentUser({ required: true }) currentUser: any) {
    try {
      // Handle multiple JWT payload formats (userId, sub, id, _id)
      const userId = currentUser?.userId || currentUser?.sub || currentUser?.id || currentUser?._id;

      if (!userId) {
        log.error('❌ No user ID found in JWT payload for /me endpoint', {
          currentUser,
          keys: Object.keys(currentUser || {}),
          headers: 'Check authorization header'
        });
        throw new BadRequestError('User ID not found in authentication token');
      }

      log.info('🔐 User authenticated for /me achievements', {
        userId,
        source: currentUser?.userId ? 'userId' : currentUser?.sub ? 'sub' : currentUser?.id ? 'id' : '_id'
      });

      const achievements = await achievementService.getUserAchievements(userId);

      return {
        success: true,
        data: achievements
      };
    } catch (error: any) {
      log.error('❌ Error getting my achievements:', {
        error: error.message,
        stack: error.stack,
        user: currentUser
      });
      throw new BadRequestError(error.message);
    }
  }

  /**
   * Get achievements with progress
   * GET /api/achievements/progress
   */
  @Get('/progress')
  async getAchievementProgress(@CurrentUser({ required: true }) currentUser: any) {
    try {
      // Handle multiple JWT payload formats (userId, sub, id, _id)
      const userId = currentUser?.userId || currentUser?.sub || currentUser?.id || currentUser?._id;

      if (!userId) {
        log.error('❌ No user ID found in JWT payload for /progress endpoint', {
          currentUser,
          keys: Object.keys(currentUser || {})
        });
        throw new BadRequestError('User ID not found in authentication token');
      }

      log.info('🔐 User authenticated for achievement progress', {
        userId,
        source: currentUser?.userId ? 'userId' : currentUser?.sub ? 'sub' : currentUser?.id ? 'id' : '_id'
      });

      const achievements = await achievementService.getAllAchievementsWithProgress(userId);

      return {
        success: true,
        data: achievements
      };
    } catch (error: any) {
      log.error('❌ Error getting achievement progress:', {
        error: error.message,
        stack: error.stack,
        user: currentUser
      });
      throw new BadRequestError(error.message);
    }
  }
}
