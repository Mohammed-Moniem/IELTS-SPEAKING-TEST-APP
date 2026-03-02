import { Request, Response } from 'express';
import { Body, Get, HttpCode, JsonController, Param, Patch, Post, QueryParams, Req, Res, UseBefore } from 'routing-controllers';

import { buildRequestHeaders, ensureResponseHeaders } from '@api/utils/requestContext';
import {
  AdminAdCampaignListQuery,
  AdminCreateAdCampaignRequest,
  AdminCreateAdPackageRequest,
  AdminUpdateAdCampaignStatusRequest
} from '@dto/GrowthDto';
import { HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { AuthMiddleware } from '@middlewares/AuthMiddleware';
import { StandardResponse } from '@responses/StandardResponse';
import { AdminAccessService } from '@services/AdminAccessService';
import { GrowthService } from '@services/GrowthService';

@JsonController('/admin/ads')
@UseBefore(AuthMiddleware)
export class AdminAdsController {
  constructor(
    private readonly growthService: GrowthService,
    private readonly adminAccessService: AdminAccessService
  ) {}

  @Post('/packages')
  @HttpCode(HTTP_STATUS_CODES.CREATED)
  public async createPackage(@Body() body: AdminCreateAdPackageRequest, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'admin-ads-package-create');
    ensureResponseHeaders(res, headers);

    try {
      this.adminAccessService.assertHasRole(req.currentUser, ['superadmin']);
      const data = await this.growthService.createAdPackage(body, req.currentUser!.id);
      await this.adminAccessService.audit({
        actorUserId: req.currentUser!.id,
        action: 'ads-package-create',
        targetType: 'ad-package',
        targetId: data.id,
        details: {
          key: body.key,
          placementType: body.placementType,
          billingType: body.billingType
        }
      });
      return StandardResponse.success(res, data, 'Ad package created', HTTP_STATUS_CODES.CREATED, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Get('/campaigns')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async listCampaigns(@QueryParams() query: AdminAdCampaignListQuery, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'admin-ads-campaign-list');
    ensureResponseHeaders(res, headers);

    try {
      this.adminAccessService.assertHasRole(req.currentUser, ['superadmin']);
      const data = await this.growthService.listAdCampaigns(query);
      return StandardResponse.success(res, data, undefined, HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Post('/campaigns')
  @HttpCode(HTTP_STATUS_CODES.CREATED)
  public async createCampaign(@Body() body: AdminCreateAdCampaignRequest, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'admin-ads-campaign-create');
    ensureResponseHeaders(res, headers);

    try {
      this.adminAccessService.assertHasRole(req.currentUser, ['superadmin']);
      const data = await this.growthService.createAdCampaign(body, req.currentUser!.id);
      await this.adminAccessService.audit({
        actorUserId: req.currentUser!.id,
        action: 'ads-campaign-create',
        targetType: 'ad-campaign',
        targetId: data.campaignId,
        details: {
          packageId: body.packageId,
          advertiserAccountId: body.advertiserAccountId
        }
      });
      return StandardResponse.success(res, data, 'Ad campaign created', HTTP_STATUS_CODES.CREATED, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Patch('/campaigns/:id/status')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async updateCampaignStatus(
    @Param('id') id: string,
    @Body() body: AdminUpdateAdCampaignStatusRequest,
    @Req() req: Request,
    @Res() res: Response
  ) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'admin-ads-campaign-status');
    ensureResponseHeaders(res, headers);

    try {
      this.adminAccessService.assertHasRole(req.currentUser, ['superadmin']);
      const data = await this.growthService.updateAdCampaignStatus(id, body, req.currentUser!.id);
      await this.adminAccessService.audit({
        actorUserId: req.currentUser!.id,
        action: 'ads-campaign-status-update',
        targetType: 'ad-campaign',
        targetId: id,
        details: {
          status: body.status
        }
      });
      return StandardResponse.success(res, data, 'Campaign status updated', HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Get('/analytics')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async getAnalytics(@Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'admin-ads-analytics');
    ensureResponseHeaders(res, headers);

    try {
      this.adminAccessService.assertHasRole(req.currentUser, ['superadmin']);
      const data = await this.growthService.getAdAnalytics();
      return StandardResponse.success(res, data, undefined, HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }
}
