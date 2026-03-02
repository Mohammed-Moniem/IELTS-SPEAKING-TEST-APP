import { Request, Response } from 'express';
import { Get, HttpCode, JsonController, QueryParams, Req, Res, UseBefore } from 'routing-controllers';

import { buildRequestHeaders, ensureResponseHeaders } from '@api/utils/requestContext';
import { LearnerProgressViewQuery } from '@dto/AppViewDto';
import { HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { AuthMiddleware } from '@middlewares/AuthMiddleware';
import { SubscriptionPlan } from '@models/UserModel';
import { StandardResponse } from '@responses/StandardResponse';
import { FeatureFlagService } from '@services/FeatureFlagService';
import { PartnerProgramService } from '@services/PartnerProgramService';
import { UsageService } from '@services/UsageService';
import { WebViewService } from '@services/WebViewService';

@JsonController('/app')
@UseBefore(AuthMiddleware)
export class AppConfigController {
  constructor(
    private readonly usageService: UsageService,
    private readonly featureFlagService: FeatureFlagService,
    private readonly partnerProgramService: PartnerProgramService,
    private readonly webViewService: WebViewService
  ) {}

  @Get('/config')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async getConfig(@Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'app-config');
    ensureResponseHeaders(res, headers);

    if (!req.currentUser) {
      return StandardResponse.unauthorized(res, 'Authentication required', headers);
    }

    try {
      const plan = (req.currentUser.plan as SubscriptionPlan) || 'free';
      const [usageSummary, flags, partnerPortal] = await Promise.all([
        this.usageService.getUsageSummary(req.currentUser.id, plan, headers),
        this.featureFlagService.listFlags(),
        this.partnerProgramService.getPartnerPortalStatus(req.currentUser.id)
      ]);

      const enabledFeatureFlags = flags.filter(flag => flag.enabled).map(flag => flag.key);

      const featureFlags = flags.reduce(
        (acc, flag) => {
          acc[flag.key] = {
            enabled: flag.enabled,
            rolloutPercentage: flag.rolloutPercentage
          };
          return acc;
        },
        {} as Record<string, { enabled: boolean; rolloutPercentage: number }>
      );

      return StandardResponse.success(
        res,
        {
          roles: req.currentUser.roles || [],
          subscriptionPlan: plan,
          usageSummary,
          enabledFeatureFlags,
          featureFlags,
          partnerPortal: {
            isPartner: partnerPortal.isPartner,
            status: partnerPortal.status,
            partnerType: partnerPortal.partnerType,
            dashboardUrl: partnerPortal.dashboardUrl,
            registrationUrl: partnerPortal.registrationUrl
          }
        },
        undefined,
        HTTP_STATUS_CODES.SUCCESS,
        headers
      );
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Get('/dashboard-view')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async getDashboardView(@Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'app-dashboard-view');
    ensureResponseHeaders(res, headers);

    if (!req.currentUser) {
      return StandardResponse.unauthorized(res, 'Authentication required', headers);
    }

    try {
      const plan = (req.currentUser.plan as SubscriptionPlan) || 'free';
      const payload = await this.webViewService.getLearnerDashboardView(req.currentUser.id, plan, headers);
      return StandardResponse.success(res, payload, undefined, HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Get('/progress-view')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async getProgressView(@QueryParams() query: LearnerProgressViewQuery, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'app-progress-view');
    ensureResponseHeaders(res, headers);

    if (!req.currentUser) {
      return StandardResponse.unauthorized(res, 'Authentication required', headers);
    }

    try {
      const payload = await this.webViewService.getLearnerProgressView(
        req.currentUser.id,
        query.range || '30d',
        query.module || 'all'
      );
      return StandardResponse.success(res, payload, undefined, HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }
}
