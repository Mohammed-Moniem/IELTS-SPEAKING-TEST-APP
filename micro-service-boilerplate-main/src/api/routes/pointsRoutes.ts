import { verifyAccessToken } from '@lib/auth/token';
import { Response, Router } from 'express';
import { Logger } from '../../lib/logger';
import { DiscountTier } from '../models/DiscountRedemptionModel';
import { PointsService } from '../services/PointsService';

const log = new Logger(__filename);
const router = Router();

// Auth middleware for points routes
const authenticateUser = async (req: any, res: Response, next: Function): Promise<any> => {
  try {
    const authorization = req.header('Authorization');
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No authorization token provided'
      });
    }

    const token = authorization.substring(7);
    const decoded = await verifyAccessToken(token);

    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }

    req.user = decoded;
    return next();
  } catch (error) {
    log.error('Auth middleware error:', error);
    return res.status(401).json({
      success: false,
      message: 'Authentication failed'
    });
  }
};

/**
 * @route   GET /api/points/summary
 * @desc    Get user's point balance and discount tier info
 * @access  Private
 */
router.get('/summary', authenticateUser, async (req: any, res: Response) => {
  try {
    const userId = req.user.userId || req.user.sub || req.user.id;

    const summary = await PointsService.getPointsSummary(userId);

    res.json({
      success: true,
      data: summary
    });
  } catch (error: any) {
    log.error('Error getting points summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get points summary',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/points/transactions
 * @desc    Get recent point transactions
 * @access  Private
 */
router.get('/transactions', authenticateUser, async (req: any, res: Response) => {
  try {
    const userId = req.user.userId || req.user.sub || req.user.id;
    const limit = parseInt(req.query.limit as string) || 20;

    const transactions = await PointsService.getRecentTransactions(userId, limit);

    res.json({
      success: true,
      data: transactions
    });
  } catch (error: any) {
    log.error('Error getting transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get transactions',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/points/redeem
 * @desc    Redeem points for discount coupon
 * @access  Private
 */
router.post('/redeem', authenticateUser, async (req: any, res: Response) => {
  try {
    const userId = req.user.userId || req.user.sub || req.user.id;
    const { discountTier } = req.body;

    if (!discountTier || !Object.values(DiscountTier).includes(discountTier)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid discount tier'
      });
    }

    const result = await PointsService.redeemForDiscount(userId, discountTier);

    return res.json({
      success: true,
      message: 'Discount redeemed successfully',
      data: {
        couponCode: result.redemption.couponCode,
        discountPercentage: result.redemption.discountPercentage,
        pointsRedeemed: result.redemption.pointsRedeemed,
        billingPeriod: result.redemption.billingPeriod,
        expiresAt: result.redemption.expiresAt
      }
    });
  } catch (error: any) {
    log.error('Error redeeming discount:', error);

    // Handle specific error cases
    if (error.message.includes('Insufficient')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('already have an active')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to redeem discount',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/points/balance
 * @desc    Get user's current point balance (simplified endpoint)
 * @access  Private
 */
router.get('/balance', authenticateUser, async (req: any, res: Response) => {
  try {
    const userId = req.user.userId || req.user.sub || req.user.id;

    const balance = await PointsService.getBalance(userId);

    res.json({
      success: true,
      data: { balance }
    });
  } catch (error: any) {
    log.error('Error getting balance:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get balance',
      error: error.message
    });
  }
});

export default router;
