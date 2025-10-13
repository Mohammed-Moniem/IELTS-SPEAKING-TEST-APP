import { Request, Response } from 'express';
import { Body, Get, HttpCode, JsonController, Post, Put, QueryParam, Req, Res, UseBefore } from 'routing-controllers';

import { buildRequestHeaders, ensureResponseHeaders } from '@api/utils/requestContext';
import { ActivatePlanRequest, CreateCheckoutSessionRequest } from '@dto/SubscriptionDto';
import { HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { AuthMiddleware } from '@middlewares/AuthMiddleware';
import { SubscriptionPlan } from '@models/UserModel';
import { StandardResponse } from '@responses/StandardResponse';
import { SubscriptionService } from '@services/SubscriptionService';
import { UsageService } from '@services/UsageService';

@JsonController('/subscription')
@UseBefore(AuthMiddleware)
export class SubscriptionController {
  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly usageService: UsageService
  ) {}

  @Get('/current')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async getCurrent(@Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'subscription-current');
    ensureResponseHeaders(res, headers);

    if (!req.currentUser) {
      return StandardResponse.unauthorized(res, 'Authentication required', headers);
    }

    try {
      const subscription = await this.subscriptionService.getCurrentSubscription(req.currentUser.id, headers);
      return StandardResponse.success(res, subscription, undefined, HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Post('/checkout')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async createCheckoutSession(
    @Body() body: CreateCheckoutSessionRequest,
    @Req() req: Request,
    @Res() res: Response
  ) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'subscription-checkout');
    ensureResponseHeaders(res, headers);

    if (!req.currentUser) {
      return StandardResponse.unauthorized(res, 'Authentication required', headers);
    }

    try {
      const session = await this.subscriptionService.createCheckoutSession(req.currentUser.id, body.planType, headers, {
        successUrl: body.successUrl,
        cancelUrl: body.cancelUrl
      });
      return StandardResponse.success(res, session, 'Checkout session created', HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Get('/config')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async getStripeConfig(@Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'subscription-config');
    ensureResponseHeaders(res, headers);

    if (!req.currentUser) {
      return StandardResponse.unauthorized(res, 'Authentication required', headers);
    }

    try {
      const config = this.subscriptionService.getStripeConfiguration();
      return StandardResponse.success(res, config, undefined, HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Put('/activate')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async activatePlan(@Body() body: ActivatePlanRequest, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'subscription-activate');
    ensureResponseHeaders(res, headers);

    if (!req.currentUser) {
      return StandardResponse.unauthorized(res, 'Authentication required', headers);
    }

    try {
      const subscription = await this.subscriptionService.activatePlan(req.currentUser.id, body.planType, headers);
      return StandardResponse.success(res, subscription, 'Plan activated', HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Get('/plans')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async getPlans(@Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'subscription-plans');
    ensureResponseHeaders(res, headers);

    if (!req.currentUser) {
      return StandardResponse.unauthorized(res, 'Authentication required', headers);
    }

    try {
      const plans = [
        {
          tier: 'free',
          name: 'Free',
          price: 0,
          priceId: '',
          features: [
            '3 practice sessions per month',
            '1 simulation test per month',
            'Basic AI feedback',
            'Limited recording storage'
          ],
          limits: {
            practiceSessionsPerMonth: 3,
            simulationSessionsPerMonth: 1
          }
        },
        {
          tier: 'premium',
          name: 'Premium',
          price: 9.99,
          priceId: 'price_premium',
          features: [
            'Unlimited practice sessions',
            '10 simulation tests per month',
            'Advanced AI feedback',
            'Unlimited recording storage',
            'Progress analytics'
          ],
          limits: {
            practiceSessionsPerMonth: -1,
            simulationSessionsPerMonth: 10
          }
        },
        {
          tier: 'pro',
          name: 'Pro',
          price: 19.99,
          priceId: 'price_pro',
          features: [
            'Everything in Premium',
            'Unlimited simulation tests',
            'Priority AI processing',
            'Detailed performance reports',
            'Personalized improvement plans'
          ],
          limits: {
            practiceSessionsPerMonth: -1,
            simulationSessionsPerMonth: -1
          }
        }
      ];
      return StandardResponse.success(res, { plans }, undefined, HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Get('/check-limit')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async checkLimit(@QueryParam('sessionType') sessionType: string, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'subscription-check-limit');
    ensureResponseHeaders(res, headers);

    if (!req.currentUser) {
      return StandardResponse.unauthorized(res, 'Authentication required', headers);
    }

    try {
      const plan = (req.currentUser.plan as SubscriptionPlan) || 'free';
      const usage = await this.usageService.getUsageSummary(req.currentUser.id, plan, headers);
      const type = sessionType === 'simulation' ? 'test' : 'practice';

      const used = type === 'test' ? usage.testCount : usage.practiceCount;
      const limit = type === 'test' ? usage.testLimit : usage.practiceLimit;
      const remaining = Math.max(0, limit - used);
      const allowed = remaining > 0;

      const result = {
        allowed,
        remaining,
        used,
        limit,
        tier: usage.plan,
        reason: allowed ? undefined : `You have reached your ${type} session limit for this billing period`,
        resetDate: usage.lastReset
      };

      return StandardResponse.success(res, result, undefined, HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }
}
