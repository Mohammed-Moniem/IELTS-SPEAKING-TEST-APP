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
      log.info('Profile retrieved successfully, about to return:', typeof profile, profile ? 'exists' : 'null');

      // Explicitly serialize to ensure no mongoose artifacts
      const cleanProfile = profile ? JSON.parse(JSON.stringify(profile)) : null;

      return {
        success: true,
        data: cleanProfile
      };
    } catch (error: any) {
      log.error('Error getting own profile:', error);
      log.error('Error stack:', error?.stack);
      log.error('Error name:', error?.name);
      log.error('Error message:', error?.message);
      throw new BadRequestError(error.message || 'Failed to get profile');
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

      // Explicitly serialize to ensure no mongoose artifacts
      const cleanProfile = profile ? JSON.parse(JSON.stringify(profile)) : null;

      return {
        success: true,
        message: 'Profile updated successfully',
        data: cleanProfile
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

      // Explicitly serialize to ensure no mongoose artifacts
      const cleanProfile = profile ? JSON.parse(JSON.stringify(profile)) : null;

      return {
        success: true,
        message: 'Privacy settings updated',
        data: cleanProfile
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
  async generateQRCode(
    @CurrentUser({ required: true }) currentUser: any,
    @Body() body: { purpose?: 'friend' | 'referral' } = {}
  ) {
    try {
      const purpose = body?.purpose === 'referral' ? 'referral' : 'friend';
      const qrCode = await userProfileService.generateQRCode(currentUser.id, purpose);

      return {
        success: true,
        data: { qrCode, purpose }
      };
    } catch (error: any) {
      log.error('Error generating QR code:', error);
      throw new BadRequestError(error.message);
    }
  }

  /**
   * Resolve QR code payload
   * POST /api/profile/qr-code/resolve
   */
  @Post('/qr-code/resolve')
  async resolveQRCode(
    @CurrentUser({ required: true }) currentUser: any,
    @Body() body: { code?: string }
  ) {
    try {
      if (!body?.code) {
        throw new BadRequestError('QR code data is required');
      }

      const result = await userProfileService.resolveQRCodePayload(body.code, currentUser.id);

      return {
        success: true,
        data: result
      };
    } catch (error: any) {
      log.error('Error resolving QR code:', error);
      throw new BadRequestError(error.message);
    }
  }
}
