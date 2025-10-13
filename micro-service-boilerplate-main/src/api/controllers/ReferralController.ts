import { BadRequestError, CurrentUser, Get, JsonController, QueryParam } from 'routing-controllers';
import { Logger } from '../../lib/logger';
import { referralService } from '../services/ReferralService';

const log = new Logger(__filename);

@JsonController('/referrals')
export class ReferralController {
  /**
   * Get user's referral code
   * GET /api/referrals/code
   */
  @Get('/code')
  async getReferralCode(@CurrentUser({ required: true }) currentUser: any) {
    try {
      const code = await referralService.getUserReferralCode(currentUser.id);
      const { canRefer, remaining } = await referralService.canReferToday(currentUser.id);
      const link = await referralService.createReferralLink(currentUser.id);

      return {
        success: true,
        data: {
          code,
          link,
          canReferToday: canRefer,
          remainingToday: remaining
        }
      };
    } catch (error: any) {
      log.error('Error getting referral code:', error);
      throw new BadRequestError(error.message);
    }
  }

  /**
   * Get referral statistics
   * GET /api/referrals/stats
   */
  @Get('/stats')
  async getReferralStats(@CurrentUser({ required: true }) currentUser: any) {
    try {
      const stats = await referralService.getReferralStats(currentUser.id);

      return {
        success: true,
        data: stats
      };
    } catch (error: any) {
      log.error('Error getting referral stats:', error);
      throw new BadRequestError(error.message);
    }
  }

  /**
   * Get referral history
   * GET /api/referrals/history
   */
  @Get('/history')
  async getReferralHistory(@CurrentUser({ required: true }) currentUser: any, @QueryParam('limit') limit?: number) {
    try {
      const history = await referralService.getReferralHistory(currentUser.id, limit || 50);

      return {
        success: true,
        data: history
      };
    } catch (error: any) {
      log.error('Error getting referral history:', error);
      throw new BadRequestError(error.message);
    }
  }

  /**
   * Get referral leaderboard
   * GET /api/referrals/leaderboard
   */
  @Get('/leaderboard')
  async getReferralLeaderboard(@QueryParam('limit') limit?: number) {
    try {
      const leaderboard = await referralService.getReferralLeaderboard(limit || 10);

      return {
        success: true,
        data: leaderboard
      };
    } catch (error: any) {
      log.error('Error getting referral leaderboard:', error);
      throw new BadRequestError(error.message);
    }
  }
}
