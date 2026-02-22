import { Request, Response } from 'express';
import { Body, Get, HttpCode, JsonController, Param, Patch, Post, QueryParams, Req, Res, UseBefore } from 'routing-controllers';

import { buildRequestHeaders, ensureResponseHeaders } from '@api/utils/requestContext';
import { AdminContentMutationRequest, AdminPaginationQuery } from '@dto/AdminDto';
import { HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { AuthMiddleware } from '@middlewares/AuthMiddleware';
import { StandardResponse } from '@responses/StandardResponse';
import { AdminAccessService } from '@services/AdminAccessService';
import { AdminService } from '@services/AdminService';

@JsonController('/admin/content')
@UseBefore(AuthMiddleware)
export class AdminContentController {
  constructor(
    private readonly adminService: AdminService,
    private readonly adminAccessService: AdminAccessService
  ) {}

  @Get('/:module')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async listContent(
    @Param('module') module: 'writing' | 'reading' | 'listening',
    @QueryParams() query: AdminPaginationQuery,
    @Req() req: Request,
    @Res() res: Response
  ) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'admin-content-list');
    ensureResponseHeaders(res, headers);

    try {
      this.adminAccessService.assertHasRole(req.currentUser, ['superadmin', 'content_manager']);
      const result = await this.adminService.listContent(module, query.limit ?? 50, query.offset ?? 0);
      return StandardResponse.success(res, result, undefined, HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Post('/')
  @HttpCode(HTTP_STATUS_CODES.CREATED)
  public async createContent(@Body() body: AdminContentMutationRequest, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'admin-content-create');
    ensureResponseHeaders(res, headers);

    try {
      this.adminAccessService.assertHasRole(req.currentUser, ['superadmin', 'content_manager']);
      const result = await this.adminService.createContent(body.module, body.payload, req.currentUser!.id);
      return StandardResponse.created(res, result, 'Content created', headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Patch('/:module/:targetId')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async patchContent(
    @Param('module') module: 'writing' | 'reading' | 'listening',
    @Param('targetId') targetId: string,
    @Body() body: AdminContentMutationRequest,
    @Req() req: Request,
    @Res() res: Response
  ) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'admin-content-patch');
    ensureResponseHeaders(res, headers);

    try {
      this.adminAccessService.assertHasRole(req.currentUser, ['superadmin', 'content_manager']);
      const result = await this.adminService.updateContent(module, targetId, body.payload, req.currentUser!.id);
      return StandardResponse.success(res, result, 'Content updated', HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }
}
