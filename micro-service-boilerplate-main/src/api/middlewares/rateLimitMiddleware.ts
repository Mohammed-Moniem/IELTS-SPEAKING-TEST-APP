import { Request } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

const toIpKey = (req: Request) => ipKeyGenerator(req.ip || req.socket?.remoteAddress || '0.0.0.0');

// General API rate limit - 100 requests per 15 minutes
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: Request) => {
    // Skip rate limiting for premium users
    return (req as any).currentUser?.subscriptionPlan === 'premium';
  }
});

// Strict rate limit for AI-powered endpoints - 30 requests per hour
export const aiRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30,
  message: 'AI request limit exceeded. Please upgrade your plan for higher limits.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: Request) => {
    // Premium users get higher limits (100 per hour)
    const plan = (req as any).currentUser?.subscriptionPlan;
    return plan === 'premium' || plan === 'pro';
  },
  keyGenerator: (req: Request) => {
    // Rate limit per user, not per IP
    return (req as any).currentUser?.id || toIpKey(req);
  }
});

// Per-user rate limiting for practice/simulation starts - 10 per minute
export const sessionStartRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: (req: Request) => {
    const plan = (req as any).currentUser?.subscriptionPlan || 'free';
    return plan === 'premium' ? 20 : 10;
  },
  message: 'Too many session starts. Please wait a moment before trying again.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    return (req as any).currentUser?.id || toIpKey(req);
  }
});

// Topic generation rate limit - 50 per hour for free users (increased for development)
export const topicGenerationRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: (req: Request) => {
    const plan = (req as any).currentUser?.subscriptionPlan || 'free';
    // Increased limits for better development/testing experience
    return plan === 'premium' || plan === 'pro' ? 200 : 50;
  },
  message: 'Topic generation limit reached. Please upgrade for more topics.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    return (req as any).currentUser?.id || toIpKey(req);
  }
});
