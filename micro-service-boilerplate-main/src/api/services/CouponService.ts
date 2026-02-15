/**
 * Coupon Service
 *
 * Payments are currently disabled for this app. We keep the REST surface
 * for mobile compatibility, but all operations are effectively no-ops.
 */

import { env } from '@env';

export class CouponService {
  async validateCoupon(_code: string, _userId: string, _subscriptionTier?: 'premium' | 'pro') {
    return {
      valid: false,
      error: env.payments?.disabled ? 'Billing is disabled' : 'Coupons are not available'
    };
  }

  async applyCoupon(
    _code: string,
    _userId: string,
    _originalAmount: number,
    _subscriptionTier: 'premium' | 'pro',
    _orderId?: string
  ) {
    return {
      success: false,
      error: env.payments?.disabled ? 'Billing is disabled' : 'Coupons are not available',
      discountAmount: 0,
      finalAmount: _originalAmount
    };
  }

  async getUserCouponHistory(_userId: string) {
    return [];
  }
}

export const couponService = new CouponService();

