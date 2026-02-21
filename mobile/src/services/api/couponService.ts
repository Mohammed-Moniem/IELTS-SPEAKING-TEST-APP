import { apiClient } from "../../api/client";

export interface Coupon {
  _id: string;
  code: string;
  type: "PERCENTAGE" | "FIXED_AMOUNT" | "TRIAL_EXTENSION" | "FREE_SESSIONS";
  value: number;
  validFrom: string;
  validUntil: string;
  usage: {
    maxUses?: number;
    currentUses: number;
    maxUsesPerUser?: number;
  };
  restrictions: {
    minPurchaseAmount?: number;
    maxDiscountAmount?: number;
    onePerUser: boolean;
    applicableSubscriptions?: string[];
  };
  isActive: boolean;
  isInfluencerCode: boolean;
}

export interface CouponValidation {
  isValid: boolean;
  coupon?: Coupon;
  discount?: number;
  finalAmount?: number;
  error?: string;
}

export interface CouponUsageHistory {
  _id: string;
  couponId: {
    code: string;
    type: string;
    value: number;
  };
  discountAmount: number;
  subscriptionTier?: string;
  createdAt: string;
}

class CouponService {
  /**
   * Validate a coupon code
   */
  async validateCoupon(
    code: string,
    originalAmount: number,
    subscriptionTier?: string
  ): Promise<CouponValidation> {
    const response = await apiClient.post(`/coupons/validate`, {
      code,
      originalAmount,
      subscriptionTier,
    });
    return response.data.data;
  }

  /**
   * Apply a coupon
   */
  async applyCoupon(
    code: string,
    originalAmount: number,
    subscriptionTier: string,
    orderId: string
  ): Promise<{
    discount: number;
    finalAmount: number;
    coupon: Coupon;
  }> {
    const response = await apiClient.post(`/coupons/apply`, {
      code,
      originalAmount,
      subscriptionTier,
      orderId,
    });
    return response.data.data;
  }

  /**
   * Get coupon usage history
   */
  async getCouponHistory(): Promise<CouponUsageHistory[]> {
    const response = await apiClient.get(`/coupons/history`);
    return response.data.data;
  }
}

export default new CouponService();
