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
  AdminSubscriptionPlanUpdateRequest,
  AdminSubscriptionRefundNoteRequest,
  AdminSubscriptionsQuery,
  AdminSubscriptionStatusUpdateRequest
} from '@dto/AdminDto';
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
        query: query.query,
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

  @Patch('/:subscriptionId/status')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async patchSubscriptionStatus(
    @Param('subscriptionId') subscriptionId: string,
    @Body() body: AdminSubscriptionStatusUpdateRequest,
    @Req() req: Request,
    @Res() res: Response
  ) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'admin-subscriptions-patch-status');
    ensureResponseHeaders(res, headers);

    try {
      this.adminAccessService.assertHasRole(req.currentUser, ['superadmin']);
      const result = await this.adminService.updateSubscriptionStatus(subscriptionId, body.status, req.currentUser!.id);
      return StandardResponse.success(res, result, 'Subscription status updated', HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Patch('/:subscriptionId/plan')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async patchSubscriptionPlan(
    @Param('subscriptionId') subscriptionId: string,
    @Body() body: AdminSubscriptionPlanUpdateRequest,
    @Req() req: Request,
    @Res() res: Response
  ) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'admin-subscriptions-patch-plan');
    ensureResponseHeaders(res, headers);

    try {
      this.adminAccessService.assertHasRole(req.currentUser, ['superadmin']);
      const result = await this.adminService.updateSubscriptionPlan(subscriptionId, body.planType, req.currentUser!.id);
      return StandardResponse.success(res, result, 'Subscription plan updated', HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Post('/:subscriptionId/refund-note')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async postRefundNote(
    @Param('subscriptionId') subscriptionId: string,
    @Body() body: AdminSubscriptionRefundNoteRequest,
    @Req() req: Request,
    @Res() res: Response
  ) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'admin-subscriptions-refund-note');
    ensureResponseHeaders(res, headers);

    try {
      this.adminAccessService.assertHasRole(req.currentUser, ['superadmin']);
      const result = await this.adminService.logSubscriptionRefundNote(subscriptionId, body.note, req.currentUser!.id);
      return StandardResponse.success(res, result, 'Refund note logged', HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }
}
