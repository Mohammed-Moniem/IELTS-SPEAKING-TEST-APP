import { Request, Response } from 'express';
import {
  Body,
  Get,
  HttpCode,
  JsonController,
  Param,
  Patch,
  Post,
  QueryParams,
  Req,
  Res,
  UseBefore
} from 'routing-controllers';

import { buildRequestHeaders, ensureResponseHeaders } from '@api/utils/requestContext';
import {
  CreateNotificationCampaignDto,
  NotificationCampaignListQuery,
  PreflightNotificationCampaignDto
} from '@dto/NotificationCampaignDto';
import { HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { AuthMiddleware } from '@middlewares/AuthMiddleware';
import { StandardResponse } from '@responses/StandardResponse';
import { AdminAccessService } from '@services/AdminAccessService';
import { NotificationCampaignService } from '@services/NotificationCampaignService';

@JsonController('/admin/notifications/campaigns')
@UseBefore(AuthMiddleware)
export class AdminNotificationCampaignController {
  constructor(
    private readonly campaignService: NotificationCampaignService,
    private readonly adminAccessService: AdminAccessService
  ) {}

  @Post('/')
  @HttpCode(HTTP_STATUS_CODES.CREATED)
  public async createCampaign(@Body() body: CreateNotificationCampaignDto, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'admin-notification-campaign-create');
    ensureResponseHeaders(res, headers);

    try {
      this.adminAccessService.assertHasRole(req.currentUser, ['superadmin']);
      const data = await this.campaignService.createCampaign(body, req.currentUser!.id);
      return StandardResponse.success(res, data, 'Campaign created', HTTP_STATUS_CODES.CREATED, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Post('/preflight')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async preflightCampaign(
    @Body() body: PreflightNotificationCampaignDto,
    @Req() req: Request,
    @Res() res: Response
  ) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'admin-notification-campaign-preflight');
    ensureResponseHeaders(res, headers);

    try {
      this.adminAccessService.assertHasRole(req.currentUser, ['superadmin']);
      const data = await this.campaignService.preflightCampaign(body);
      return StandardResponse.success(res, data, undefined, HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Get('/')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async listCampaigns(@QueryParams() query: NotificationCampaignListQuery, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'admin-notification-campaign-list');
    ensureResponseHeaders(res, headers);

    try {
      this.adminAccessService.assertHasRole(req.currentUser, ['superadmin']);
      const data = await this.campaignService.listCampaigns(query.limit ?? 50, query.offset ?? 0, {
        status: query.status,
        type: query.type
      });
      return StandardResponse.success(res, data, undefined, HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Get('/:campaignId')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async getCampaign(@Param('campaignId') campaignId: string, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'admin-notification-campaign-get');
    ensureResponseHeaders(res, headers);

    try {
      this.adminAccessService.assertHasRole(req.currentUser, ['superadmin']);
      const data = await this.campaignService.getCampaign(campaignId);
      return StandardResponse.success(res, data, undefined, HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Patch('/:campaignId/cancel')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async cancelCampaign(@Param('campaignId') campaignId: string, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'admin-notification-campaign-cancel');
    ensureResponseHeaders(res, headers);

    try {
      this.adminAccessService.assertHasRole(req.currentUser, ['superadmin']);
      const data = await this.campaignService.cancelCampaign(campaignId, req.currentUser!.id);
      return StandardResponse.success(res, data, 'Campaign cancelled', HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Post('/:campaignId/send-now')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async sendNow(@Param('campaignId') campaignId: string, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'admin-notification-campaign-send-now');
    ensureResponseHeaders(res, headers);

    try {
      this.adminAccessService.assertHasRole(req.currentUser, ['superadmin']);
      const data = await this.campaignService.sendNow(campaignId, req.currentUser!.id);
      return StandardResponse.success(res, data, 'Campaign sent', HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }
}
