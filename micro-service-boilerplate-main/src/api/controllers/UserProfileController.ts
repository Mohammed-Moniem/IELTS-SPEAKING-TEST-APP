import { BadRequestError, Body, CurrentUser, Get, JsonController, Param, Post, Put } from 'routing-controllers';
import { Logger } from '../../lib/logger';
import { userProfileService } from '../services/UserProfileService';

const log = new Logger(__filename);

@JsonController('/profile')
export class UserProfileController {
  /**
   * Get own profile
   * GET /api/profile/me
   */
  @Get('/me')
  async getOwnProfile(@CurrentUser({ required: true }) currentUser: any) {
    try {
      const profile = await userProfileService.getProfile(currentUser.id);

      return {
        success: true,
        data: profile
      };
    } catch (error: any) {
      log.error('Error getting own profile:', error);
      throw new BadRequestError(error.message);
    }
  }

  /**
   * Get user profile
   * GET /api/profile/:userId
   */
  @Get('/:userId')
  async getUserProfile(@CurrentUser() currentUser: any, @Param('userId') userId: string) {
    try {
      const profile = await userProfileService.getProfile(userId);

      return {
        success: true,
        data: profile
      };
    } catch (error: any) {
      log.error('Error getting user profile:', error);
      throw new BadRequestError(error.message);
    }
  }

  /**
   * Update own profile
   * PUT /api/profile
   */
  @Put('/')
  async updateProfile(@CurrentUser({ required: true }) currentUser: any, @Body() updates: any) {
    try {
      const profile = await userProfileService.updateProfile(currentUser.id, updates);

      return {
        success: true,
        message: 'Profile updated successfully',
        data: profile
      };
    } catch (error: any) {
      log.error('Error updating profile:', error);
      throw new BadRequestError(error.message);
    }
  }

  /**
   * Update privacy settings
   * PUT /api/profile/settings
   */
  @Put('/settings')
  async updatePrivacySettings(@CurrentUser({ required: true }) currentUser: any, @Body() settings: any) {
    try {
      const profile = await userProfileService.updatePrivacySettings(currentUser.id, settings);

      return {
        success: true,
        message: 'Privacy settings updated',
        data: profile
      };
    } catch (error: any) {
      log.error('Error updating privacy settings:', error);
      throw new BadRequestError(error.message);
    }
  }

  /**
   * Get user statistics
   * GET /api/profile/stats/:userId
   */
  @Get('/stats/:userId')
  async getUserStatistics(@CurrentUser() currentUser: any, @Param('userId') userId: string) {
    try {
      const stats = await userProfileService.getUserStatistics(userId, currentUser?.id);

      return {
        success: true,
        data: stats
      };
    } catch (error: any) {
      log.error('Error getting user statistics:', error);
      throw new BadRequestError(error.message);
    }
  }

  /**
   * Generate QR code
   * POST /api/profile/qr-code
   */
  @Post('/qr-code')
  async generateQRCode(@CurrentUser({ required: true }) currentUser: any) {
    try {
      const qrCode = await userProfileService.generateQRCode(currentUser.id);

      return {
        success: true,
        data: { qrCode }
      };
    } catch (error: any) {
      log.error('Error generating QR code:', error);
      throw new BadRequestError(error.message);
    }
  }
}
