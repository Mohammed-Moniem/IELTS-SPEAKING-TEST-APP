import { Request, Response } from 'express';
import { Body, Get, HttpCode, JsonController, Post, Req, Res, UseBefore } from 'routing-controllers';

import { buildRequestHeaders, ensureResponseHeaders } from '@api/utils/requestContext';
import { SeoRefreshQueueRequest } from '@dto/GrowthDto';
import { HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { AuthMiddleware } from '@middlewares/AuthMiddleware';
import { StandardResponse } from '@responses/StandardResponse';
import { AdminAccessService } from '@services/AdminAccessService';
import { GrowthService } from '@services/GrowthService';

@JsonController('/admin/seo')
@UseBefore(AuthMiddleware)
export class AdminSeoController {
  constructor(
    private readonly growthService: GrowthService,
    private readonly adminAccessService: AdminAccessService
  ) {}

  @Get('/content-health')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async getContentHealth(@Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'admin-seo-content-health');
    ensureResponseHeaders(res, headers);

    try {
      this.adminAccessService.assertHasRole(req.currentUser, ['superadmin', 'content_manager']);
      const data = await this.growthService.getSeoContentHealth();
      return StandardResponse.success(res, data, undefined, HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Post('/refresh-queue')
  @HttpCode(HTTP_STATUS_CODES.CREATED)
  public async refreshQueue(@Body() body: SeoRefreshQueueRequest, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'admin-seo-refresh-queue');
    ensureResponseHeaders(res, headers);

    try {
      this.adminAccessService.assertHasRole(req.currentUser, ['superadmin', 'content_manager']);
      const data = await this.growthService.enqueueSeoRefreshQueue(body, req.currentUser!.id);
      await this.adminAccessService.audit({
        actorUserId: req.currentUser!.id,
        action: 'seo-refresh-queue',
        targetType: 'blog-job',
        details: {
          cluster: body.cluster,
          limit: body.limit,
          queued: data.queued,
          skipped: data.skipped
        }
      });
      return StandardResponse.success(res, data, 'SEO refresh queue updated', HTTP_STATUS_CODES.CREATED, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }
}
