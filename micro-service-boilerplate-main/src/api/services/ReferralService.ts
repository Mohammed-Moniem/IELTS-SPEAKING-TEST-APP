import { Types } from 'mongoose';
import { Logger } from '../../lib/logger';
import { IReferral, IUserReferralStats, Referral, UserReferralStats } from '../models/ReferralModel';
import { encryptionService } from './EncryptionService';

const log = new Logger(__filename);

export class ReferralService {
  private readonly MAX_REFERRALS_PER_DAY = 5;
  private readonly PRACTICE_REWARD_PER_REFERRAL = 1;
  private readonly SIMULATION_REWARD_THRESHOLD = 2; // Need 2+ referrals to get simulation

  /**
   * Generate or get user's referral code
   */
  async getUserReferralCode(userId: string): Promise<string> {
    let stats = await UserReferralStats.findOne({ userId: new Types.ObjectId(userId) });

    if (!stats) {
      // Generate unique referral code
      const referralCode = await this.generateUniqueReferralCode();

      stats = new UserReferralStats({
        userId: new Types.ObjectId(userId),
        referralCode
      });

      await stats.save();
      log.info(`Referral code generated for user ${userId}: ${referralCode}`);
    }

    return stats.referralCode;
  }

  /**
   * Redeem a referral code (called during registration)
   */
  async redeemReferralCode(
    referralCode: string,
    newUserId: string,
    email: string
  ): Promise<{ practiceReward: number; simulationReward: number }> {
    // Find the referrer
    const referrerStats = await UserReferralStats.findOne({ referralCode });

    if (!referrerStats) {
      throw new Error('Invalid referral code');
    }

    const referrerId = referrerStats.userId.toString();

    // Check if user is trying to refer themselves
    if (referrerId === newUserId) {
      throw new Error('Cannot use your own referral code');
    }

    // Check daily limit
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (referrerStats.lastReferralDate) {
      const lastReferralDate = new Date(referrerStats.lastReferralDate);
      lastReferralDate.setHours(0, 0, 0, 0);

      if (lastReferralDate.getTime() !== today.getTime()) {
        // Reset daily count if it's a new day
        referrerStats.todayReferrals = 0;
      }
    }

    if (referrerStats.todayReferrals >= this.MAX_REFERRALS_PER_DAY) {
      throw new Error('Daily referral limit reached');
    }

    // Check if this email was already referred
    const existingReferral = await Referral.findOne({
      referrerId: referrerStats.userId,
      email: email.toLowerCase()
    });

    if (existingReferral && existingReferral.status === 'completed') {
      throw new Error('This email has already been referred');
    }

    // Create or update referral record
    let referral: IReferral;
    if (existingReferral) {
      existingReferral.referredUserId = new Types.ObjectId(newUserId);
      existingReferral.status = 'completed';
      existingReferral.metadata = {
        registeredAt: new Date()
      };
      referral = await existingReferral.save();
    } else {
      referral = new Referral({
        referrerId: referrerStats.userId,
        referredUserId: new Types.ObjectId(newUserId),
        referralCode,
        email: email.toLowerCase(),
        status: 'completed',
        metadata: {
          registeredAt: new Date()
        }
      });
      await referral.save();
    }

    // Calculate rewards
    const practiceReward = this.PRACTICE_REWARD_PER_REFERRAL;
    const simulationReward = referrerStats.todayReferrals + 1 >= this.SIMULATION_REWARD_THRESHOLD ? 1 : 0;

    // Update referral stats
    referrerStats.totalReferrals += 1;
    referrerStats.successfulReferrals += 1;
    referrerStats.todayReferrals += 1;
    referrerStats.lastReferralDate = new Date();
    referrerStats.totalPracticeSessionsEarned += practiceReward;
    referrerStats.totalSimulationSessionsEarned += simulationReward;
    referrerStats.lifetimeEarnings.practices += practiceReward;
    referrerStats.lifetimeEarnings.simulations += simulationReward;

    await referrerStats.save();

    // Grant rewards to referrer
    referral.rewards = {
      practiceSessionsGranted: practiceReward,
      simulationSessionsGranted: simulationReward,
      grantedAt: new Date()
    };
    await referral.save();

    await this.grantRewards(referrerId, practiceReward, simulationReward);

    log.info(
      `Referral completed: ${referralCode} -> ${newUserId}. Rewards: ${practiceReward} practices, ${simulationReward} simulations`
    );

    return {
      practiceReward,
      simulationReward
    };
  }

  /**
   * Get user's referral statistics
   */
  async getReferralStats(userId: string): Promise<IUserReferralStats | null> {
    return await UserReferralStats.findOne({ userId: new Types.ObjectId(userId) });
  }

  /**
   * Get referral history
   */
  async getReferralHistory(userId: string, limit: number = 50): Promise<IReferral[]> {
    const stats = await UserReferralStats.findOne({ userId: new Types.ObjectId(userId) });

    if (!stats) {
      return [];
    }

    return await Referral.find({
      referrerId: stats.userId
    })
      .populate('referredUserId', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit);
  }

  /**
   * Check if user can make more referrals today
   */
  async canReferToday(userId: string): Promise<{ canRefer: boolean; remaining: number }> {
    const stats = await UserReferralStats.findOne({ userId: new Types.ObjectId(userId) });

    if (!stats) {
      return { canRefer: true, remaining: this.MAX_REFERRALS_PER_DAY };
    }

    // Check if it's a new day
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (stats.lastReferralDate) {
      const lastReferralDate = new Date(stats.lastReferralDate);
      lastReferralDate.setHours(0, 0, 0, 0);

      if (lastReferralDate.getTime() !== today.getTime()) {
        // New day, reset count
        return { canRefer: true, remaining: this.MAX_REFERRALS_PER_DAY };
      }
    }

    const remaining = this.MAX_REFERRALS_PER_DAY - stats.todayReferrals;
    return {
      canRefer: remaining > 0,
      remaining: Math.max(0, remaining)
    };
  }

  /**
   * Create a referral link
   */
  async createReferralLink(userId: string, baseUrl: string = 'https://app.ielts-practice.com'): Promise<string> {
    const referralCode = await this.getUserReferralCode(userId);
    return `${baseUrl}/register?ref=${referralCode}`;
  }

  /**
   * Get leaderboard of top referrers
   */
  async getReferralLeaderboard(limit: number = 10): Promise<any[]> {
    const topReferrers = await UserReferralStats.find()
      .sort({ successfulReferrals: -1 })
      .limit(limit)
      .populate('userId', 'name email');

    return topReferrers.map((stats, index) => ({
      rank: index + 1,
      userId: stats.userId,
      referralCode: stats.referralCode,
      totalReferrals: stats.successfulReferrals,
      totalEarnings: {
        practices: stats.lifetimeEarnings.practices,
        simulations: stats.lifetimeEarnings.simulations
      }
    }));
  }

  /**
   * Generate a unique referral code
   */
  private async generateUniqueReferralCode(): Promise<string> {
    let code: string;
    let exists = true;
    let attempts = 0;
    const maxAttempts = 10;

    while (exists && attempts < maxAttempts) {
      code = encryptionService.generateReferralCode();
      const existingCode = await UserReferralStats.findOne({ referralCode: code });
      exists = !!existingCode;
      attempts++;
    }

    if (exists) {
      throw new Error('Failed to generate unique referral code');
    }

    return code!;
  }

  /**
   * Grant rewards to user (update their usage limits)
   * This will be handled by the controller/middleware when checking usage limits
   */
  private async grantRewards(userId: string, practiceReward: number, simulationReward: number): Promise<void> {
    // Log the reward grant
    // The actual implementation will be in the usage tracking system
    // where it checks bonus sessions before applying regular limits

    log.info(`Rewards granted to user ${userId}: +${practiceReward} practices, +${simulationReward} simulations`);

    // TODO: Integrate with UsageRecordModel or similar system
    // to track bonus sessions that can be used on top of regular limits
  }

  /**
   * Track referral click (optional analytics)
   */
  async trackReferralClick(referralCode: string): Promise<void> {
    const stats = await UserReferralStats.findOne({ referralCode });

    if (stats) {
      // You could add click tracking here if needed
      log.info(`Referral code clicked: ${referralCode}`);
    }
  }

  /**
   * Send referral invitation (create pending referral)
   */
  async sendReferralInvitation(userId: string, email: string): Promise<IReferral> {
    const referralCode = await this.getUserReferralCode(userId);

    // Check daily limit
    const { canRefer } = await this.canReferToday(userId);
    if (!canRefer) {
      throw new Error('Daily referral limit reached');
    }

    // Check if already referred
    const existing = await Referral.findOne({
      referrerId: new Types.ObjectId(userId),
      email: email.toLowerCase()
    });

    if (existing) {
      throw new Error('This email has already been invited');
    }

    // Create pending referral
    const referral = new Referral({
      referrerId: new Types.ObjectId(userId),
      referralCode,
      email: email.toLowerCase(),
      status: 'pending'
    });

    await referral.save();

    // Update stats
    const stats = await UserReferralStats.findOne({ userId: new Types.ObjectId(userId) });
    if (stats) {
      stats.totalReferrals += 1;
      stats.pendingReferrals += 1;
      await stats.save();
    }

    log.info(`Referral invitation sent: ${email} by ${userId}`);
    return referral;
  }
}

export const referralService = new ReferralService();
