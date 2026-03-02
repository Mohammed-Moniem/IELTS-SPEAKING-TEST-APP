import { Request, Response } from 'express';
import { Get, HttpCode, JsonController, QueryParams, Req, Res, UseBefore } from 'routing-controllers';

import { buildRequestHeaders, ensureResponseHeaders } from '@api/utils/requestContext';
import { ImprovementPlanQuery, StrengthMapQuery } from '@dto/GrowthDto';
import { HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { AuthMiddleware } from '@middlewares/AuthMiddleware';
import { StandardResponse } from '@responses/StandardResponse';
import { GrowthService } from '@services/GrowthService';

@JsonController('/app/insights')
@UseBefore(AuthMiddleware)
export class AppInsightsController {
  constructor(private readonly growthService: GrowthService) {}

  @Get('/strength-map')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async getStrengthMap(@QueryParams() query: StrengthMapQuery, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'app-insights-strength-map');
    ensureResponseHeaders(res, headers);

    try {
      const data = await this.growthService.getStrengthMap(req.currentUser!.id, query.range || '30d');
      return StandardResponse.success(res, data, undefined, HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Get('/improvement-plan')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async getImprovementPlan(@QueryParams() query: ImprovementPlanQuery, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'app-insights-improvement-plan');
    ensureResponseHeaders(res, headers);

    try {
      const data = await this.growthService.getImprovementPlan(req.currentUser!.id, query.module || 'all');
      return StandardResponse.success(res, data, undefined, HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }
}
