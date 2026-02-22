import { Request, Response } from 'express';
import { Body, Get, HttpCode, JsonController, Param, Patch, Req, Res, UseBefore } from 'routing-controllers';

import { buildRequestHeaders, ensureResponseHeaders } from '@api/utils/requestContext';
import { AdminFeatureFlagUpdateRequest } from '@dto/AdminDto';
import { HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { AuthMiddleware } from '@middlewares/AuthMiddleware';
import { StandardResponse } from '@responses/StandardResponse';
import { AdminAccessService } from '@services/AdminAccessService';
import { FeatureFlagService } from '@services/FeatureFlagService';

@JsonController('/admin/feature-flags')
@UseBefore(AuthMiddleware)
export class AdminFeatureFlagController {
  constructor(
    private readonly featureFlagService: FeatureFlagService,
    private readonly adminAccessService: AdminAccessService
  ) {}

  @Get('/')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async listFlags(@Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'admin-feature-flags-list');
    ensureResponseHeaders(res, headers);

    try {
      this.adminAccessService.assertHasRole(req.currentUser, ['superadmin']);
      const flags = await this.featureFlagService.listFlags();
      return StandardResponse.success(res, flags, undefined, HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Patch('/:flagKey')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async patchFlag(
    @Param('flagKey') flagKey: string,
    @Body() body: AdminFeatureFlagUpdateRequest,
    @Req() req: Request,
    @Res() res: Response
  ) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'admin-feature-flag-patch');
    ensureResponseHeaders(res, headers);

    try {
      this.adminAccessService.assertHasRole(req.currentUser, ['superadmin']);
      const flag = await this.featureFlagService.upsertFlag({
        key: flagKey,
        enabled: body.enabled,
        rolloutPercentage: body.rolloutPercentage,
        description: body.description
      });

      return StandardResponse.success(res, flag, 'Feature flag updated', HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }
}
