import { Request, Response } from 'express';
import { Body, Get, HttpCode, JsonController, Param, Patch, QueryParams, Req, Res, UseBefore } from 'routing-controllers';

import { buildRequestHeaders, ensureResponseHeaders } from '@api/utils/requestContext';
import { AdminRoleUpdateRequest, AdminUsersQuery } from '@dto/AdminDto';
import { HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { AuthMiddleware } from '@middlewares/AuthMiddleware';
import { StandardResponse } from '@responses/StandardResponse';
import { AdminAccessService } from '@services/AdminAccessService';
import { AdminService } from '@services/AdminService';

@JsonController('/admin/users')
@UseBefore(AuthMiddleware)
export class AdminUserController {
  constructor(
    private readonly adminService: AdminService,
    private readonly adminAccessService: AdminAccessService
  ) {}

  @Get('/')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async listUsers(@QueryParams() query: AdminUsersQuery, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'admin-users-list');
    ensureResponseHeaders(res, headers);

    try {
      this.adminAccessService.assertHasRole(req.currentUser, ['superadmin', 'support_agent']);
      const result = await this.adminService.listUsers(query.limit ?? 50, query.offset ?? 0, {
        query: query.query,
        plan: query.plan,
        status: query.status,
        country: query.country,
        dateFrom: query.from,
        dateTo: query.to,
        flagged: query.flagged === 'true'
      });
      return StandardResponse.success(res, result, undefined, HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Patch('/:userId/roles')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async patchRoles(
    @Param('userId') userId: string,
    @Body() body: AdminRoleUpdateRequest,
    @Req() req: Request,
    @Res() res: Response
  ) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'admin-users-patch-roles');
    ensureResponseHeaders(res, headers);

    try {
      this.adminAccessService.assertHasRole(req.currentUser, ['superadmin']);
      const user = await this.adminService.updateUserRoles(userId, body.roles, req.currentUser!.id);
      return StandardResponse.success(res, user, 'User roles updated', HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }
}
