import { BadRequestError, Body, CurrentUser, Get, JsonController, Post } from 'routing-controllers';
import { Logger } from '../../lib/logger';
import { couponService } from '../services/CouponService';

const log = new Logger(__filename);

@JsonController('/coupons')
export class CouponController {
  /**
   * Validate coupon
   * POST /api/coupons/validate
   */
  @Post('/validate')
  async validateCoupon(
    @CurrentUser({ required: true }) currentUser: any,
    @Body() body: { code: string; subscriptionTier?: 'premium' | 'pro' }
  ) {
    try {
      const validation = await couponService.validateCoupon(body.code, currentUser.id, body.subscriptionTier);

      return {
        success: validation.valid,
        data: validation
      };
    } catch (error: any) {
      log.error('Error validating coupon:', error);
      throw new BadRequestError(error.message);
    }
  }

  /**
   * Apply coupon
   * POST /api/coupons/apply
   */
  @Post('/apply')
  async applyCoupon(
    @CurrentUser({ required: true }) currentUser: any,
    @Body()
    body: {
      code: string;
      originalAmount: number;
      subscriptionTier: 'premium' | 'pro';
      orderId?: string;
    }
  ) {
    try {
      const result = await couponService.applyCoupon(
        body.code,
        currentUser.id,
        body.originalAmount,
        body.subscriptionTier,
        body.orderId
      );

      return {
        success: result.success,
        message: result.success ? 'Coupon applied successfully' : result.error,
        data: result.success
          ? {
              discountAmount: result.discountAmount,
              finalAmount: result.finalAmount
            }
          : null
      };
    } catch (error: any) {
      log.error('Error applying coupon:', error);
      throw new BadRequestError(error.message);
    }
  }

  /**
   * Get user's coupon history
   * GET /api/coupons/history
   */
  @Get('/history')
  async getCouponHistory(@CurrentUser({ required: true }) currentUser: any) {
    try {
      const history = await couponService.getUserCouponHistory(currentUser.id);

      return {
        success: true,
        data: history
      };
    } catch (error: any) {
      log.error('Error getting coupon history:', error);
      throw new BadRequestError(error.message);
    }
  }
}
