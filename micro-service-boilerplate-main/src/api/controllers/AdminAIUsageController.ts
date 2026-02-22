import { Request, Response } from 'express';
import { Get, HttpCode, JsonController, QueryParam, Req, Res, UseBefore } from 'routing-controllers';

import { buildRequestHeaders, ensureResponseHeaders } from '@api/utils/requestContext';
import { HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { AuthMiddleware } from '@middlewares/AuthMiddleware';
import { StandardResponse } from '@responses/StandardResponse';
import { AdminAccessService } from '@services/AdminAccessService';
import { AdminService } from '@services/AdminService';

@JsonController('/admin/ai-usage')
@UseBefore(AuthMiddleware)
export class AdminAIUsageController {
  constructor(
    private readonly adminService: AdminService,
    private readonly adminAccessService: AdminAccessService
  ) {}

  @Get('/')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async getAIUsage(
    @QueryParam('limit') limit: number = 100,
    @Req() req: Request,
    @Res() res: Response
  ) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'admin-ai-usage');
    ensureResponseHeaders(res, headers);

    try {
      this.adminAccessService.assertHasRole(req.currentUser, ['superadmin']);
      const result = await this.adminService.getAIUsageSummary(Math.min(Math.max(limit || 100, 1), 500));
      return StandardResponse.success(res, result, undefined, HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }
}
