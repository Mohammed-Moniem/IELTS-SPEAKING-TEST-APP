import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { API_BASE_URL } from "../../config";

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

const getAuthToken = async (): Promise<string | null> => {
  return await AsyncStorage.getItem("authToken");
};

const getAuthHeaders = async () => {
  const token = await getAuthToken();
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
};

class CouponService {
  /**
   * Validate a coupon code
   */
  async validateCoupon(
    code: string,
    originalAmount: number,
    subscriptionTier?: string
  ): Promise<CouponValidation> {
    const headers = await getAuthHeaders();
    const response = await axios.post(
      `${API_BASE_URL}/coupons/validate`,
      { code, originalAmount, subscriptionTier },
      { headers }
    );
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
    const headers = await getAuthHeaders();
    const response = await axios.post(
      `${API_BASE_URL}/coupons/apply`,
      { code, originalAmount, subscriptionTier, orderId },
      { headers }
    );
    return response.data.data;
  }

  /**
   * Get coupon usage history
   */
  async getCouponHistory(): Promise<CouponUsageHistory[]> {
    const headers = await getAuthHeaders();
    const response = await axios.get(`${API_BASE_URL}/coupons/history`, {
      headers,
    });
    return response.data.data;
  }
}

export default new CouponService();
