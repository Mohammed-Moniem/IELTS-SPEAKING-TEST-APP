import { Types } from '@lib/db/mongooseCompat';
import { Logger } from '../../lib/logger';
import { Coupon, CouponType, CouponUsage, ICoupon, ICouponUsage } from '../models/CouponModel';

const log = new Logger(__filename);

export class CouponService {
  /**
   * Validate a coupon code
   */
  async validateCoupon(
    code: string,
    userId: string,
    subscriptionTier?: 'premium' | 'pro'
  ): Promise<{
    valid: boolean;
    coupon?: ICoupon;
    error?: string;
    discountAmount?: number;
  }> {
    const coupon = await Coupon.findOne({
      code: code.toUpperCase(),
      isActive: true
    });

    if (!coupon) {
      return { valid: false, error: 'Invalid coupon code' };
    }

    // Check if coupon is expired
    const now = new Date();
    if (now < coupon.validFrom || now > coupon.validUntil) {
      return { valid: false, error: 'Coupon has expired' };
    }

    // Check usage limits
    if (coupon.usage.maxUses && coupon.usage.currentUses >= coupon.usage.maxUses) {
      return { valid: false, error: 'Coupon usage limit reached' };
    }

    // Check per-user usage limit
    if (coupon.restrictions.onePerUser) {
      const existingUsage = await CouponUsage.findOne({
        couponId: coupon._id,
        userId: new Types.ObjectId(userId)
      });

      if (existingUsage) {
        return { valid: false, error: 'You have already used this coupon' };
      }
    } else if (coupon.usage.maxUsesPerUser) {
      const userUsageCount = await CouponUsage.countDocuments({
        couponId: coupon._id,
        userId: new Types.ObjectId(userId)
      });

      if (userUsageCount >= coupon.usage.maxUsesPerUser) {
        return { valid: false, error: 'Coupon usage limit reached for your account' };
      }
    }

    // Check subscription tier restrictions
    if (subscriptionTier && coupon.restrictions.applicableSubscriptions) {
      if (!coupon.restrictions.applicableSubscriptions.includes(subscriptionTier)) {
        return { valid: false, error: 'Coupon not applicable to this subscription tier' };
      }
    }

    return { valid: true, coupon };
  }

  /**
   * Calculate discount amount
   */
  calculateDiscount(coupon: ICoupon, originalAmount: number): { discountAmount: number; finalAmount: number } {
    let discountAmount = 0;

    switch (coupon.type) {
      case CouponType.PERCENTAGE:
        discountAmount = (originalAmount * coupon.value) / 100;

        // Apply max discount cap if set
        if (coupon.restrictions.maxDiscountAmount) {
          discountAmount = Math.min(discountAmount, coupon.restrictions.maxDiscountAmount);
        }
        break;

      case CouponType.FIXED_AMOUNT:
        discountAmount = Math.min(coupon.value, originalAmount);
        break;

      case CouponType.TRIAL_EXTENSION:
        // Trial extension doesn't affect monetary amount
        discountAmount = 0;
        break;

      case CouponType.FREE_SESSIONS:
        // Free sessions don't affect monetary amount
        discountAmount = 0;
        break;

      default:
        break;
    }

    // Check minimum purchase requirement
    if (coupon.restrictions.minPurchaseAmount && originalAmount < coupon.restrictions.minPurchaseAmount) {
      throw new Error(`Minimum purchase amount of $${coupon.restrictions.minPurchaseAmount} required`);
    }

    const finalAmount = Math.max(0, originalAmount - discountAmount);

    return {
      discountAmount: Math.round(discountAmount * 100) / 100,
      finalAmount: Math.round(finalAmount * 100) / 100
    };
  }

  /**
   * Apply coupon to a purchase
   */
  async applyCoupon(
    code: string,
    userId: string,
    originalAmount: number,
    subscriptionTier: 'premium' | 'pro',
    orderId?: string
  ): Promise<{
    success: boolean;
    discountAmount: number;
    finalAmount: number;
    couponUsage?: ICouponUsage;
    error?: string;
  }> {
    // Validate coupon
    const validation = await this.validateCoupon(code, userId, subscriptionTier);

    if (!validation.valid || !validation.coupon) {
      return {
        success: false,
        discountAmount: 0,
        finalAmount: originalAmount,
        error: validation.error
      };
    }

    const coupon = validation.coupon;

    // Calculate discount
    const { discountAmount, finalAmount } = this.calculateDiscount(coupon, originalAmount);

    // Calculate commission for influencer codes
    let commissionEarned = 0;
    if (coupon.isInfluencerCode && coupon.influencerCommissionRate) {
      commissionEarned = (finalAmount * coupon.influencerCommissionRate) / 100;
    }

    // Create usage record
    const usage = new CouponUsage({
      couponId: coupon._id,
      userId: new Types.ObjectId(userId),
      orderId,
      discountAmount,
      subscriptionTier,
      metadata: {
        originalAmount,
        finalAmount,
        commissionEarned
      }
    });

    await usage.save();

    // Update coupon usage count
    coupon.usage.currentUses += 1;
    await coupon.save();

    log.info(`Coupon applied: ${code} for user ${userId}. Discount: $${discountAmount}`);

    return {
      success: true,
      discountAmount,
      finalAmount,
      couponUsage: usage
    };
  }

  /**
   * Get user's coupon usage history
   */
  async getUserCouponHistory(userId: string, limit: number = 20): Promise<ICouponUsage[]> {
    return await CouponUsage.find({
      userId: new Types.ObjectId(userId)
    })
      .populate('couponId')
      .sort({ usedAt: -1 })
      .limit(limit);
  }

  /**
   * Get coupon by code (admin)
   */
  async getCouponByCode(code: string): Promise<ICoupon | null> {
    return await Coupon.findOne({ code: code.toUpperCase() });
  }

  /**
   * Create new coupon (admin)
   */
  async createCoupon(couponData: Partial<ICoupon>): Promise<ICoupon> {
    const coupon = new Coupon({
      ...couponData,
      code: couponData.code?.toUpperCase()
    });

    await coupon.save();
    log.info(`New coupon created: ${coupon.code}`);
    return coupon;
  }

  /**
   * Update coupon (admin)
   */
  async updateCoupon(code: string, updates: Partial<ICoupon>): Promise<ICoupon | null> {
    const coupon = await Coupon.findOne({ code: code.toUpperCase() });

    if (!coupon) {
      return null;
    }

    Object.assign(coupon, updates);
    await coupon.save();

    log.info(`Coupon updated: ${code}`);
    return coupon;
  }

  /**
   * Deactivate coupon (admin)
   */
  async deactivateCoupon(code: string): Promise<boolean> {
    const result = await Coupon.updateOne({ code: code.toUpperCase() }, { isActive: false });

    return result.modifiedCount > 0;
  }

  /**
   * Get influencer statistics (admin/influencer dashboard)
   */
  async getInfluencerStats(influencerId: string): Promise<{
    totalUses: number;
    totalRevenue: number;
    totalCommission: number;
    recentUsages: ICouponUsage[];
  }> {
    const coupons = await Coupon.find({
      influencerId: new Types.ObjectId(influencerId),
      isInfluencerCode: true
    });

    const couponIds = coupons.map(c => c._id);

    const usages = await CouponUsage.find({
      couponId: { $in: couponIds }
    }).sort({ usedAt: -1 });

    const totalUses = usages.length;
    const totalRevenue = usages.reduce((sum, u) => sum + (u.metadata?.finalAmount || 0), 0);
    const totalCommission = usages.reduce((sum, u) => sum + (u.metadata?.commissionEarned || 0), 0);
    const recentUsages = usages.slice(0, 10);

    return {
      totalUses,
      totalRevenue,
      totalCommission,
      recentUsages
    };
  }

  /**
   * List all coupons (admin)
   */
  async listCoupons(filters?: { isActive?: boolean; isInfluencerCode?: boolean }): Promise<ICoupon[]> {
    const query: any = {};

    if (filters?.isActive !== undefined) {
      query.isActive = filters.isActive;
    }

    if (filters?.isInfluencerCode !== undefined) {
      query.isInfluencerCode = filters.isInfluencerCode;
    }

    return await Coupon.find(query).sort({ createdAt: -1 });
  }

  /**
   * Get coupon usage statistics (admin)
   */
  async getCouponStats(code: string): Promise<{
    coupon: ICoupon;
    totalUses: number;
    totalDiscount: number;
    recentUsages: ICouponUsage[];
  } | null> {
    const coupon = await Coupon.findOne({ code: code.toUpperCase() });

    if (!coupon) {
      return null;
    }

    const usages = await CouponUsage.find({ couponId: coupon._id })
      .populate('userId', 'name email')
      .sort({ usedAt: -1 });

    const totalUses = usages.length;
    const totalDiscount = usages.reduce((sum, u) => sum + u.discountAmount, 0);
    const recentUsages = usages.slice(0, 10);

    return {
      coupon,
      totalUses,
      totalDiscount,
      recentUsages
    };
  }
}

export const couponService = new CouponService();
