import { Request, Response } from 'express';
import { Body, Get, HttpCode, JsonController, Post, Put, QueryParam, Req, Res, UseBefore } from 'routing-controllers';

import { buildRequestHeaders, ensureResponseHeaders } from '@api/utils/requestContext';
import { ActivatePlanRequest, CreateCheckoutSessionRequest, CreatePortalSessionRequest } from '@dto/SubscriptionDto';
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
        cancelUrl: body.cancelUrl,
        billingCycle: body.billingCycle,
        partnerCode: body.partnerCode,
        couponCode: body.couponCode
      });
      return StandardResponse.success(res, session, 'Checkout session created', HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Post('/portal')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async createPortalSession(@Body() body: CreatePortalSessionRequest, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'subscription-portal');
    ensureResponseHeaders(res, headers);

    if (!req.currentUser) {
      return StandardResponse.unauthorized(res, 'Authentication required', headers);
    }

    try {
      const portalSession = await this.subscriptionService.createPortalSession(req.currentUser.id, headers, body?.returnUrl);
      return StandardResponse.success(res, portalSession, 'Portal session created', HTTP_STATUS_CODES.SUCCESS, headers);
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
      const plans = this.subscriptionService.getPlansCatalog();
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
