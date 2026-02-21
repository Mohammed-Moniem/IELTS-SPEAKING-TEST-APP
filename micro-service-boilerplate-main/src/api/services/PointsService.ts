import { Types } from '@lib/db/mongooseCompat';
import { Logger } from '../../lib/logger';
import { UserStats } from '../models/AchievementModel';
import { DISCOUNT_TIERS, DiscountRedemption, DiscountTier, POINTS_REWARDS } from '../models/DiscountRedemptionModel';
import { IPointsTransaction, PointsTransaction, PointsTransactionType } from '../models/PointsTransactionModel';

const log = new Logger(__filename);

export class PointsService {
  /**
   * Get user's current point balance
   */
  static async getBalance(userId: Types.ObjectId | string): Promise<number> {
    const userIdObj = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;

    const stats = await UserStats.findOne({ userId: userIdObj });
    if (!stats) {
      return 0;
    }

    // Balance = totalPoints - redeemedPoints
    return Math.max(0, stats.totalPoints - stats.redeemedPoints);
  }

  /**
   * Grant points to a user
   */
  static async grantPoints(
    userId: Types.ObjectId | string,
    amount: number,
    type: PointsTransactionType,
    reason: string,
    metadata?: Record<string, any>
  ): Promise<IPointsTransaction> {
    const userIdObj = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;

    if (amount <= 0) {
      throw new Error('Amount must be positive');
    }

    // Get or create user stats
    let stats = await UserStats.findOne({ userId: userIdObj });
    if (!stats) {
      stats = await UserStats.create({
        userId: userIdObj,
        totalPoints: 0,
        redeemedPoints: 0,
        totalPracticeSessions: 0,
        totalSimulations: 0,
        averageScore: 0,
        highestScore: 0,
        currentStreak: 0,
        longestStreak: 0,
        totalAchievements: 0,
        achievementPoints: 0,
        weeklyScore: 0,
        monthlyScore: 0,
        weeklyPractices: 0,
        monthlyPractices: 0,
        leaderboardOptIn: true,
        profileVisibility: 'public'
      });
    }

    // Update total points
    stats.totalPoints += amount;
    stats.lastPointsUpdate = new Date();
    await stats.save();

    // Calculate current balance
    const balance = stats.totalPoints - stats.redeemedPoints;

    // Create transaction record
    const transaction = await PointsTransaction.create({
      userId: userIdObj,
      type,
      amount,
      balance,
      reason,
      metadata: metadata || {}
    });

    log.info(`Granted ${amount} points to user ${userIdObj}`, {
      type,
      reason,
      newBalance: balance
    });

    return transaction;
  }

  /**
   * Deduct points from a user (for redemptions)
   */
  static async deductPoints(
    userId: Types.ObjectId | string,
    amount: number,
    type: PointsTransactionType,
    reason: string,
    metadata?: Record<string, any>
  ): Promise<IPointsTransaction> {
    const userIdObj = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;

    if (amount <= 0) {
      throw new Error('Amount must be positive');
    }

    const stats = await UserStats.findOne({ userId: userIdObj });
    if (!stats) {
      throw new Error('User stats not found');
    }

    const currentBalance = stats.totalPoints - stats.redeemedPoints;
    if (currentBalance < amount) {
      throw new Error(`Insufficient balance. Current: ${currentBalance}, Required: ${amount}`);
    }

    // Update redeemed points
    stats.redeemedPoints += amount;
    stats.lastPointsUpdate = new Date();
    await stats.save();

    // Calculate new balance
    const balance = stats.totalPoints - stats.redeemedPoints;

    // Create transaction record (negative amount for deduction)
    const transaction = await PointsTransaction.create({
      userId: userIdObj,
      type,
      amount: -amount, // Negative to indicate deduction
      balance,
      reason,
      metadata: metadata || {}
    });

    log.info(`Deducted ${amount} points from user ${userIdObj}`, {
      type,
      reason,
      newBalance: balance
    });

    return transaction;
  }

  /**
   * Get user's point summary including discount tier info
   */
  static async getPointsSummary(userId: Types.ObjectId | string): Promise<{
    balance: number;
    totalEarned: number;
    totalRedeemed: number;
    currentTier: { tier: DiscountTier; percentage: number; pointsRequired: number } | null;
    nextTier: { tier: DiscountTier; percentage: number; pointsRequired: number; pointsNeeded: number } | null;
    canRedeem: boolean;
    activeDiscounts: any[];
  }> {
    const userIdObj = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;

    const stats = await UserStats.findOne({ userId: userIdObj });
    const balance = stats ? stats.totalPoints - stats.redeemedPoints : 0;
    const totalEarned = stats?.totalPoints || 0;
    const totalRedeemed = stats?.redeemedPoints || 0;

    // Find current tier
    let currentTier = null;
    for (const tier of [...DISCOUNT_TIERS].reverse()) {
      if (balance >= tier.pointsRequired) {
        currentTier = {
          tier: tier.tier,
          percentage: tier.percentage,
          pointsRequired: tier.pointsRequired
        };
        break;
      }
    }

    // Find next tier
    let nextTier = null;
    for (const tier of DISCOUNT_TIERS) {
      if (balance < tier.pointsRequired) {
        nextTier = {
          tier: tier.tier,
          percentage: tier.percentage,
          pointsRequired: tier.pointsRequired,
          pointsNeeded: tier.pointsRequired - balance
        };
        break;
      }
    }

    // Check if user can redeem (has points and hasn't redeemed this billing period)
    const now = new Date();
    const billingPeriodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const billingPeriodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const activeRedemptions = await DiscountRedemption.find({
      userId: userIdObj,
      status: { $in: ['pending', 'active', 'used'] },
      'billingPeriod.start': { $lte: billingPeriodEnd },
      'billingPeriod.end': { $gte: billingPeriodStart }
    });

    const canRedeem = balance >= 1000 && activeRedemptions.length === 0;

    return {
      balance,
      totalEarned,
      totalRedeemed,
      currentTier,
      nextTier,
      canRedeem,
      activeDiscounts: activeRedemptions
    };
  }

  /**
   * Get recent point transactions
   */
  static async getRecentTransactions(
    userId: Types.ObjectId | string,
    limit: number = 20
  ): Promise<IPointsTransaction[]> {
    const userIdObj = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;

    return await PointsTransaction.find({ userId: userIdObj }).sort({ createdAt: -1 }).limit(limit).lean();
  }

  /**
   * Redeem points for discount
   */
  static async redeemForDiscount(
    userId: Types.ObjectId | string,
    discountTier: DiscountTier
  ): Promise<{ redemption: any; transaction: IPointsTransaction }> {
    const userIdObj = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;

    // Find tier config
    const tierConfig = DISCOUNT_TIERS.find(t => t.tier === discountTier);
    if (!tierConfig) {
      throw new Error('Invalid discount tier');
    }

    // Check balance
    const balance = await this.getBalance(userIdObj);
    if (balance < tierConfig.pointsRequired) {
      throw new Error(`Insufficient points. Required: ${tierConfig.pointsRequired}, Current: ${balance}`);
    }

    // Check if user already has active redemption for current billing period
    const now = new Date();
    const billingPeriodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const billingPeriodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const existingRedemption = await DiscountRedemption.findOne({
      userId: userIdObj,
      status: { $in: ['pending', 'active', 'used'] },
      'billingPeriod.start': { $lte: billingPeriodEnd },
      'billingPeriod.end': { $gte: billingPeriodStart }
    });

    if (existingRedemption) {
      throw new Error('You already have an active discount for this billing period');
    }

    // Generate coupon code
    const couponCode = `POINTS${tierConfig.percentage}-${userIdObj.toString().slice(-6).toUpperCase()}-${Date.now().toString().slice(-6)}`;

    // Create redemption record
    const redemption = await DiscountRedemption.create({
      userId: userIdObj,
      pointsRedeemed: tierConfig.pointsRequired,
      discountTier,
      discountPercentage: tierConfig.percentage,
      couponCode,
      billingPeriod: {
        start: billingPeriodStart,
        end: billingPeriodEnd
      },
      status: 'pending',
      expiresAt: new Date(billingPeriodEnd.getTime() + 30 * 24 * 60 * 60 * 1000) // 30 days after period end
    });

    // Deduct points
    const transaction = await this.deductPoints(
      userIdObj,
      tierConfig.pointsRequired,
      PointsTransactionType.DISCOUNT_REDEMPTION,
      `Redeemed ${tierConfig.percentage}% discount for billing period ${billingPeriodStart.toISOString().slice(0, 7)}`,
      {
        redemptionId: redemption._id,
        discountTier,
        couponCode
      }
    );

    log.info(`User ${userIdObj} redeemed ${tierConfig.pointsRequired} points for ${tierConfig.percentage}% discount`, {
      couponCode,
      billingPeriod: `${billingPeriodStart.toISOString().slice(0, 7)}`
    });

    return { redemption, transaction };
  }

  /**
   * Grant practice completion points
   */
  static async grantPracticePoints(
    userId: Types.ObjectId | string,
    sessionId: Types.ObjectId | string,
    options: {
      scoreImprovement?: number;
      isStreakActive?: boolean;
      streakDays?: number;
    }
  ): Promise<{ points: number; breakdown: Record<string, number>; transactions: IPointsTransaction[] }> {
    const userIdObj = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
    const sessionIdObj = typeof sessionId === 'string' ? new Types.ObjectId(sessionId) : sessionId;

    const transactions: IPointsTransaction[] = [];
    const breakdown: Record<string, number> = {};

    // Base practice completion points
    const basePoints = POINTS_REWARDS.PRACTICE_COMPLETION;
    breakdown['Practice Completion'] = basePoints;

    const baseTx = await this.grantPoints(
      userIdObj,
      basePoints,
      PointsTransactionType.PRACTICE_COMPLETION,
      'Completed practice session',
      { sessionId: sessionIdObj }
    );
    transactions.push(baseTx);

    // Score improvement bonus
    if (options.scoreImprovement && options.scoreImprovement > 0) {
      const improvementPoints = POINTS_REWARDS.PRACTICE_IMPROVEMENT_BONUS;
      breakdown['Score Improvement'] = improvementPoints;

      const improvementTx = await this.grantPoints(
        userIdObj,
        improvementPoints,
        PointsTransactionType.PRACTICE_IMPROVEMENT,
        `Score improved by ${options.scoreImprovement.toFixed(1)}`,
        { sessionId: sessionIdObj, scoreImprovement: options.scoreImprovement }
      );
      transactions.push(improvementTx);
    }

    // Streak bonus
    if (options.isStreakActive && options.streakDays) {
      const streakPoints = POINTS_REWARDS.PRACTICE_STREAK_BONUS;
      breakdown[`${options.streakDays}-Day Streak`] = streakPoints;

      const streakTx = await this.grantPoints(
        userIdObj,
        streakPoints,
        PointsTransactionType.PRACTICE_STREAK_BONUS,
        `${options.streakDays}-day practice streak`,
        { sessionId: sessionIdObj, streakDays: options.streakDays }
      );
      transactions.push(streakTx);
    }

    const totalPoints = Object.values(breakdown).reduce((sum, val) => sum + val, 0);

    return { points: totalPoints, breakdown, transactions };
  }

  /**
   * Grant test completion points
   */
  static async grantTestPoints(
    userId: Types.ObjectId | string,
    testId: Types.ObjectId | string,
    options: {
      scoreImprovement?: number;
    }
  ): Promise<{ points: number; breakdown: Record<string, number>; transactions: IPointsTransaction[] }> {
    const userIdObj = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
    const testIdObj = typeof testId === 'string' ? new Types.ObjectId(testId) : testId;

    const transactions: IPointsTransaction[] = [];
    const breakdown: Record<string, number> = {};

    // Base test completion points
    const basePoints = POINTS_REWARDS.TEST_COMPLETION;
    breakdown['Test Completion'] = basePoints;

    const baseTx = await this.grantPoints(
      userIdObj,
      basePoints,
      PointsTransactionType.TEST_COMPLETION,
      'Completed full IELTS test simulation',
      { testId: testIdObj }
    );
    transactions.push(baseTx);

    // Score improvement bonus
    if (options.scoreImprovement && options.scoreImprovement > 0) {
      const improvementPoints = POINTS_REWARDS.TEST_IMPROVEMENT_BONUS;
      breakdown['Test Score Improvement'] = improvementPoints;

      const improvementTx = await this.grantPoints(
        userIdObj,
        improvementPoints,
        PointsTransactionType.TEST_IMPROVEMENT,
        `Test score improved by ${options.scoreImprovement.toFixed(1)}`,
        { testId: testIdObj, scoreImprovement: options.scoreImprovement }
      );
      transactions.push(improvementTx);
    }

    const totalPoints = Object.values(breakdown).reduce((sum, val) => sum + val, 0);

    return { points: totalPoints, breakdown, transactions };
  }

  /**
   * Grant referral rewards
   */
  static async grantReferralRewards(
    referrerId: Types.ObjectId | string,
    refereeId: Types.ObjectId | string,
    referralCode: string
  ): Promise<{ referrerPoints: number; refereePoints: number; transactions: IPointsTransaction[] }> {
    const referrerIdObj = typeof referrerId === 'string' ? new Types.ObjectId(referrerId) : referrerId;
    const refereeIdObj = typeof refereeId === 'string' ? new Types.ObjectId(refereeId) : refereeId;

    const transactions: IPointsTransaction[] = [];

    // Grant points to referrer
    const referrerTx = await this.grantPoints(
      referrerIdObj,
      POINTS_REWARDS.REFERRAL_REFERRER,
      PointsTransactionType.REFERRAL_REWARD,
      'Friend completed their first session via your referral',
      { referralCode, refereeId: refereeIdObj }
    );
    transactions.push(referrerTx);

    // Grant points to referee
    const refereeTx = await this.grantPoints(
      refereeIdObj,
      POINTS_REWARDS.REFERRAL_REFEREE,
      PointsTransactionType.REFERRAL_BONUS,
      'Welcome bonus for joining via referral',
      { referralCode, referrerId: referrerIdObj }
    );
    transactions.push(refereeTx);

    log.info(`Referral rewards granted`, {
      referrerId: referrerIdObj,
      refereeId: refereeIdObj,
      referralCode,
      referrerPoints: POINTS_REWARDS.REFERRAL_REFERRER,
      refereePoints: POINTS_REWARDS.REFERRAL_REFEREE
    });

    return {
      referrerPoints: POINTS_REWARDS.REFERRAL_REFERRER,
      refereePoints: POINTS_REWARDS.REFERRAL_REFEREE,
      transactions
    };
  }

  /**
   * Grant achievement points
   */
  static async grantAchievementPoints(
    userId: Types.ObjectId | string,
    achievementKey: string,
    achievementPoints: number,
    isMilestone: boolean = false
  ): Promise<{ points: number; transactions: IPointsTransaction[] }> {
    const userIdObj = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;

    const transactions: IPointsTransaction[] = [];
    let totalPoints = achievementPoints;

    // Base achievement points
    const baseTx = await this.grantPoints(
      userIdObj,
      achievementPoints,
      PointsTransactionType.ACHIEVEMENT_UNLOCK,
      `Unlocked achievement: ${achievementKey}`,
      { achievementKey, basePoints: achievementPoints }
    );
    transactions.push(baseTx);

    // Milestone bonus
    if (isMilestone) {
      const milestoneBonus = POINTS_REWARDS.ACHIEVEMENT_MILESTONE_BONUS;
      totalPoints += milestoneBonus;

      const milestoneTx = await this.grantPoints(
        userIdObj,
        milestoneBonus,
        PointsTransactionType.ACHIEVEMENT_MILESTONE,
        `Milestone achievement bonus: ${achievementKey}`,
        { achievementKey, milestoneBonus }
      );
      transactions.push(milestoneTx);
    }

    return { points: totalPoints, transactions };
  }
}
