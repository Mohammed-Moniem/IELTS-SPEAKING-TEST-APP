import { Request, Response } from 'express';
import { Get, HttpCode, JsonController, Req, Res, UseBefore } from 'routing-controllers';

import { buildRequestHeaders, ensureResponseHeaders } from '@api/utils/requestContext';
import { HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { AuthMiddleware } from '@middlewares/AuthMiddleware';
import { SubscriptionPlan } from '@models/UserModel';
import { StandardResponse } from '@responses/StandardResponse';
import { UsageService } from '@services/UsageService';

@JsonController('/usage')
@UseBefore(AuthMiddleware)
export class UsageController {
  constructor(private readonly usageService: UsageService) {}

  @Get('/summary')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async getSummary(@Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'usage-summary');
    ensureResponseHeaders(res, headers);

    if (!req.currentUser) {
      return StandardResponse.unauthorized(res, 'Authentication required', headers);
    }

    try {
      const plan = (req.currentUser.plan as SubscriptionPlan) || 'free';
      const summary = await this.usageService.getUsageSummary(req.currentUser.id, plan, headers);
      return StandardResponse.success(res, summary, undefined, HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Get('/history')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async getHistory(@Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'usage-history');
    ensureResponseHeaders(res, headers);

    if (!req.currentUser) {
      return StandardResponse.unauthorized(res, 'Authentication required', headers);
    }

    try {
      const history = await this.usageService.getUsageHistory(req.currentUser.id, headers);
      return StandardResponse.success(res, history, undefined, HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }
}
