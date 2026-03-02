import { Request, Response } from 'express';
import { Get, HttpCode, JsonController, QueryParams, Req, Res, UseBefore } from 'routing-controllers';

import { buildRequestHeaders, ensureResponseHeaders } from '@api/utils/requestContext';
import { AdminAnalyticsExportQuery, AdminAnalyticsViewQuery, AdminOverviewViewQuery } from '@dto/AdminDto';
import { HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { AuthMiddleware } from '@middlewares/AuthMiddleware';
import { StandardResponse } from '@responses/StandardResponse';
import { AdminAccessService } from '@services/AdminAccessService';
import { WebViewService } from '@services/WebViewService';

@JsonController('/admin')
@UseBefore(AuthMiddleware)
export class AdminViewController {
  constructor(
    private readonly webViewService: WebViewService,
    private readonly adminAccessService: AdminAccessService
  ) {}

  @Get('/overview-view')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async getOverviewView(@QueryParams() query: AdminOverviewViewQuery, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'admin-overview-view');
    ensureResponseHeaders(res, headers);

    try {
      this.adminAccessService.assertHasRole(req.currentUser, ['superadmin', 'support_agent', 'content_manager']);
      const payload = await this.webViewService.getAdminOverviewView(query.window || '1h');
      return StandardResponse.success(res, payload, undefined, HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Get('/analytics-view')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async getAnalyticsView(@QueryParams() query: AdminAnalyticsViewQuery, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'admin-analytics-view');
    ensureResponseHeaders(res, headers);

    try {
      this.adminAccessService.assertHasRole(req.currentUser, ['superadmin', 'content_manager']);
      const payload = await this.webViewService.getAdminAnalyticsView(query.range || '30d');
      return StandardResponse.success(res, payload, undefined, HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Get('/analytics-view/export')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async exportAnalytics(@QueryParams() query: AdminAnalyticsExportQuery, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'admin-analytics-view-export');
    ensureResponseHeaders(res, headers);

    try {
      this.adminAccessService.assertHasRole(req.currentUser, ['superadmin', 'content_manager']);
      const format = query.format || 'json';
      const exportPack = await this.webViewService.exportAdminAnalyticsPack(query.range || '30d', format);

      res.setHeader('Content-Type', exportPack.contentType);
      res.setHeader('Content-Disposition', `attachment; filename=\"${exportPack.filename}\"`);
      return res.status(HTTP_STATUS_CODES.SUCCESS).send(exportPack.body);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }
}
