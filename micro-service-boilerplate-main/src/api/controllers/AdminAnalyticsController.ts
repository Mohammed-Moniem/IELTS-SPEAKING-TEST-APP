import { Request, Response } from 'express';
import { Get, HttpCode, JsonController, Req, Res, UseBefore } from 'routing-controllers';

import { buildRequestHeaders, ensureResponseHeaders } from '@api/utils/requestContext';
import { HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { AuthMiddleware } from '@middlewares/AuthMiddleware';
import { StandardResponse } from '@responses/StandardResponse';
import { AdminAccessService } from '@services/AdminAccessService';
import { AdminService } from '@services/AdminService';

@JsonController('/admin/analytics')
@UseBefore(AuthMiddleware)
export class AdminAnalyticsController {
  constructor(
    private readonly adminService: AdminService,
    private readonly adminAccessService: AdminAccessService
  ) {}

  @Get('/')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async getSummary(@Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'admin-analytics-summary');
    ensureResponseHeaders(res, headers);

    try {
      this.adminAccessService.assertHasRole(req.currentUser, ['superadmin', 'content_manager', 'support_agent']);
      const summary = await this.adminService.getAnalyticsSummary();
      return StandardResponse.success(res, summary, undefined, HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }
}
