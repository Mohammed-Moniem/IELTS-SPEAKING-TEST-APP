import { Body, CurrentUser, Get, JsonController, Post, QueryParam } from 'routing-controllers';
import { Service } from 'typedi';
import { Logger } from '../../lib/logger';
import { env } from '@env';
import { DiscountTier } from '@api/constants/points';
import { PointsService } from '../services/PointsService';

@Service()
@JsonController('/points')
export class PointsController {
  private log = new Logger(__filename);

  /**
   * Get user's point balance and discount tier info
   */
  @Get('/summary')
  async getPointsSummary(@CurrentUser({ required: true }) currentUser: any) {
    try {
      const userId = currentUser?.id;

      if (!userId) {
        this.log.error('No userId found in currentUser', {
          currentUser: JSON.stringify(currentUser),
          source: 'getPointsSummary'
        });
        throw new Error('User ID not found');
      }

      const summary = await PointsService.getPointsSummary(userId);

      return {
        success: true,
        data: summary
      };
    } catch (error: any) {
      this.log.error('Error getting points summary:', error);
      throw error;
    }
  }

  /**
   * Get recent point transactions
   */
  @Get('/transactions')
  async getTransactions(@CurrentUser({ required: true }) currentUser: any, @QueryParam('limit') limit?: number) {
    try {
      const userId = currentUser?.id;

      if (!userId) {
        this.log.error('No userId found in currentUser', {
          currentUser: JSON.stringify(currentUser),
          source: 'getTransactions'
        });
        throw new Error('User ID not found');
      }

      const transactions = await PointsService.getRecentTransactions(userId, limit || 20);

      return {
        success: true,
        data: transactions
      };
    } catch (error: any) {
      this.log.error('Error getting transactions:', error);
      throw error;
    }
  }

  /**
   * Redeem points for discount coupon
   */
  @Post('/redeem')
  async redeemDiscount(
    @CurrentUser({ required: true }) currentUser: any,
    @Body() body: { discountTier: DiscountTier }
  ) {
    try {
      const userId = currentUser?.id;

      if (!userId) {
        this.log.error('No userId found in currentUser', {
          currentUser: JSON.stringify(currentUser),
          source: 'redeemDiscount'
        });
        throw new Error('User ID not found');
      }

      const { discountTier } = body;

      if (!discountTier || !Object.values(DiscountTier).includes(discountTier)) {
        return {
          success: false,
          message: 'Invalid discount tier'
        };
      }

      if (env.payments?.disabled) {
        return {
          success: false,
          message: 'Billing is disabled'
        };
      }

      const result = await PointsService.redeemForDiscount(userId, discountTier);

      return {
        success: true,
        message: 'Discount redeemed successfully',
        data: {
          couponCode: result.redemption.couponCode,
          discountPercentage: result.redemption.discountPercentage,
          pointsRedeemed: result.redemption.pointsRedeemed,
          billingPeriod: result.redemption.billingPeriod,
          expiresAt: result.redemption.expiresAt
        }
      };
    } catch (error: any) {
      this.log.error('Error redeeming discount:', error);

      // Return user-friendly error messages
      if (error.message.includes('Insufficient') || error.message.includes('already have an active')) {
        return {
          success: false,
          message: error.message
        };
      }

      throw error;
    }
  }

  /**
   * Get user's current point balance (simplified endpoint)
   */
  @Get('/balance')
  async getBalance(@CurrentUser({ required: true }) currentUser: any) {
    try {
      const userId = currentUser?.id;

      if (!userId) {
        this.log.error('No userId found in currentUser', {
          currentUser: JSON.stringify(currentUser),
          source: 'getBalance'
        });
        throw new Error('User ID not found');
      }

      const balance = await PointsService.getBalance(userId);

      return {
        success: true,
        data: { balance }
      };
    } catch (error: any) {
      this.log.error('Error getting balance:', error);
      throw error;
    }
  }
}
