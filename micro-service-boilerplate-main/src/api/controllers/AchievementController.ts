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
      let achievements;

      if (category) {
        achievements = await achievementService.getAchievementsByCategory(category);
      } else {
        achievements = await achievementService.getAllAchievementsWithProgress(currentUser.id);
      }

      return {
        success: true,
        data: achievements
      };
    } catch (error: any) {
      log.error('Error getting achievements:', error);
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
      const achievements = await achievementService.getUserAchievements(userId);

      return {
        success: true,
        data: achievements
      };
    } catch (error: any) {
      log.error('Error getting user achievements:', error);
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
      const achievements = await achievementService.getUserAchievements(currentUser.id);

      return {
        success: true,
        data: achievements
      };
    } catch (error: any) {
      log.error('Error getting my achievements:', error);
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
      const achievements = await achievementService.getAllAchievementsWithProgress(currentUser.id);

      return {
        success: true,
        data: achievements
      };
    } catch (error: any) {
      log.error('Error getting achievement progress:', error);
      throw new BadRequestError(error.message);
    }
  }
}
