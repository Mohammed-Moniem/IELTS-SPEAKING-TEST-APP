import { Request, Response } from 'express';
import { Get, HttpCode, JsonController, QueryParams, Req, Res, UseBefore } from 'routing-controllers';

import { buildRequestHeaders, ensureResponseHeaders } from '@api/utils/requestContext';
import { AdminSubscriptionsQuery } from '@dto/AdminDto';
import { HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { AuthMiddleware } from '@middlewares/AuthMiddleware';
import { StandardResponse } from '@responses/StandardResponse';
import { AdminAccessService } from '@services/AdminAccessService';
import { AdminService } from '@services/AdminService';

@JsonController('/admin/subscriptions')
@UseBefore(AuthMiddleware)
export class AdminSubscriptionController {
  constructor(
    private readonly adminService: AdminService,
    private readonly adminAccessService: AdminAccessService
  ) {}

  @Get('/')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async listSubscriptions(@QueryParams() query: AdminSubscriptionsQuery, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'admin-subscriptions-list');
    ensureResponseHeaders(res, headers);

    try {
      this.adminAccessService.assertHasRole(req.currentUser, ['superadmin', 'support_agent']);
      const result = await this.adminService.listSubscriptions(query.limit ?? 50, query.offset ?? 0, {
        status: query.status,
        plan: query.plan,
        renewalFrom: query.renewalFrom,
        renewalTo: query.renewalTo
      });
      return StandardResponse.success(res, result, undefined, HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }
}
