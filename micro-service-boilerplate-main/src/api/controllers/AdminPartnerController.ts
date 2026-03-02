import { Request, Response } from 'express';
import { Body, Get, HttpCode, JsonController, Param, Patch, Post, QueryParams, Req, Res, UseBefore } from 'routing-controllers';

import { buildRequestHeaders, ensureResponseHeaders } from '@api/utils/requestContext';
import {
  AdminCreatePartnerCodeRequest,
  AdminCreatePartnerRequest,
  AdminCreatePartnerTargetRequest,
  AdminPayoutOperationsViewQuery,
  AdminCreatePayoutBatchRequest,
  AdminMarkPayoutBatchPaidRequest,
  AdminPreviewPayoutBatchRequest,
  AdminUpdatePartnerCodeRequest,
  AdminUpdatePartnerRequest,
  AdminUpdatePartnerTargetRequest,
  PartnerActivityQuery,
  PartnerListQuery
} from '@dto/PartnerDto';
import { HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { AuthMiddleware } from '@middlewares/AuthMiddleware';
import { StandardResponse } from '@responses/StandardResponse';
import { AdminAccessService } from '@services/AdminAccessService';
import { PartnerProgramService } from '@services/PartnerProgramService';

@JsonController('/admin/partners')
@UseBefore(AuthMiddleware)
export class AdminPartnerController {
  constructor(
    private readonly partnerProgramService: PartnerProgramService,
    private readonly adminAccessService: AdminAccessService
  ) {}

  @Get('/')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async listPartners(@QueryParams() query: PartnerListQuery, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'admin-partners-list');
    ensureResponseHeaders(res, headers);

    try {
      this.adminAccessService.assertHasRole(req.currentUser, ['superadmin']);
      const result = await this.partnerProgramService.listPartners(query);
      return StandardResponse.success(res, result, undefined, HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Post('/')
  @HttpCode(HTTP_STATUS_CODES.CREATED)
  public async createPartner(@Body() body: AdminCreatePartnerRequest, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'admin-partners-create');
    ensureResponseHeaders(res, headers);

    try {
      this.adminAccessService.assertHasRole(req.currentUser, ['superadmin']);
      const partner = await this.partnerProgramService.createPartner({
        ...body,
        actorUserId: req.currentUser!.id
      });

      await this.adminAccessService.audit({
        actorUserId: req.currentUser!.id,
        action: 'create-partner',
        targetType: 'partner',
        targetId: partner._id.toString(),
        details: {
          partnerType: body.partnerType,
          ownerUserId: body.ownerUserId,
          activateNow: body.activateNow
        }
      });

      return StandardResponse.created(res, partner, 'Partner created', headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Patch('/:partnerId')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async updatePartner(
    @Param('partnerId') partnerId: string,
    @Body() body: AdminUpdatePartnerRequest,
    @Req() req: Request,
    @Res() res: Response
  ) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'admin-partners-update');
    ensureResponseHeaders(res, headers);

    try {
      this.adminAccessService.assertHasRole(req.currentUser, ['superadmin']);
      const partner = await this.partnerProgramService.updatePartner(partnerId, body);

      await this.adminAccessService.audit({
        actorUserId: req.currentUser!.id,
        action: 'update-partner',
        targetType: 'partner',
        targetId: partnerId,
        details: body as unknown as Record<string, unknown>
      });

      return StandardResponse.success(res, partner, 'Partner updated', HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Get('/:partnerId/codes')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async listPartnerCodes(
    @Param('partnerId') partnerId: string,
    @QueryParams() query: PartnerActivityQuery,
    @Req() req: Request,
    @Res() res: Response
  ) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'admin-partner-codes-list');
    ensureResponseHeaders(res, headers);

    try {
      this.adminAccessService.assertHasRole(req.currentUser, ['superadmin']);
      const result = await this.partnerProgramService.listPartnerCodesForAdmin(partnerId, query.limit, query.offset);
      return StandardResponse.success(res, result, undefined, HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Post('/:partnerId/codes')
  @HttpCode(HTTP_STATUS_CODES.CREATED)
  public async createPartnerCode(
    @Param('partnerId') partnerId: string,
    @Body() body: AdminCreatePartnerCodeRequest,
    @Req() req: Request,
    @Res() res: Response
  ) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'admin-partner-code-create');
    ensureResponseHeaders(res, headers);

    try {
      this.adminAccessService.assertHasRole(req.currentUser, ['superadmin']);
      const code = await this.partnerProgramService.createPartnerCode(partnerId, {
        ...body,
        code: body.code.trim().toUpperCase(),
        validFrom: body.validFrom ? new Date(body.validFrom) : undefined,
        validUntil: body.validUntil ? new Date(body.validUntil) : undefined,
        actorUserId: req.currentUser!.id
      });

      await this.adminAccessService.audit({
        actorUserId: req.currentUser!.id,
        action: 'create-partner-code',
        targetType: 'partner-code',
        targetId: code._id.toString(),
        details: {
          partnerId,
          code: code.code
        }
      });

      return StandardResponse.created(res, code, 'Partner code created', headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Patch('/:partnerId/codes/:codeId')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async updatePartnerCode(
    @Param('partnerId') partnerId: string,
    @Param('codeId') codeId: string,
    @Body() body: AdminUpdatePartnerCodeRequest,
    @Req() req: Request,
    @Res() res: Response
  ) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'admin-partner-code-update');
    ensureResponseHeaders(res, headers);

    try {
      this.adminAccessService.assertHasRole(req.currentUser, ['superadmin']);
      const code = await this.partnerProgramService.updatePartnerCode(partnerId, codeId, {
        ...body,
        validFrom: body.validFrom ? new Date(body.validFrom) : undefined,
        validUntil: body.validUntil ? new Date(body.validUntil) : undefined
      });

      await this.adminAccessService.audit({
        actorUserId: req.currentUser!.id,
        action: 'update-partner-code',
        targetType: 'partner-code',
        targetId: codeId,
        details: body as unknown as Record<string, unknown>
      });

      return StandardResponse.success(res, code, 'Partner code updated', HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Get('/:partnerId/targets')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async listPartnerTargets(
    @Param('partnerId') partnerId: string,
    @QueryParams() query: PartnerActivityQuery,
    @Req() req: Request,
    @Res() res: Response
  ) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'admin-partner-targets-list');
    ensureResponseHeaders(res, headers);

    try {
      this.adminAccessService.assertHasRole(req.currentUser, ['superadmin']);
      const result = await this.partnerProgramService.listPartnerTargetsForAdmin(partnerId, query.limit, query.offset);
      return StandardResponse.success(res, result, undefined, HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Post('/:partnerId/targets')
  @HttpCode(HTTP_STATUS_CODES.CREATED)
  public async createPartnerTarget(
    @Param('partnerId') partnerId: string,
    @Body() body: AdminCreatePartnerTargetRequest,
    @Req() req: Request,
    @Res() res: Response
  ) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'admin-partner-target-create');
    ensureResponseHeaders(res, headers);

    try {
      this.adminAccessService.assertHasRole(req.currentUser, ['superadmin']);
      const target = await this.partnerProgramService.createPartnerTarget(partnerId, {
        ...body,
        startsAt: body.startsAt ? new Date(body.startsAt) : undefined,
        endsAt: body.endsAt ? new Date(body.endsAt) : undefined,
        actorUserId: req.currentUser!.id
      });

      await this.adminAccessService.audit({
        actorUserId: req.currentUser!.id,
        action: 'create-partner-target',
        targetType: 'partner-target',
        targetId: target._id.toString(),
        details: {
          partnerId,
          metric: body.metric,
          thresholdValue: body.thresholdValue,
          bonusAmountUsd: body.bonusAmountUsd
        }
      });

      return StandardResponse.created(res, target, 'Partner target created', headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Patch('/:partnerId/targets/:targetId')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async updatePartnerTarget(
    @Param('partnerId') partnerId: string,
    @Param('targetId') targetId: string,
    @Body() body: AdminUpdatePartnerTargetRequest,
    @Req() req: Request,
    @Res() res: Response
  ) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'admin-partner-target-update');
    ensureResponseHeaders(res, headers);

    try {
      this.adminAccessService.assertHasRole(req.currentUser, ['superadmin']);
      const target = await this.partnerProgramService.updatePartnerTarget(partnerId, targetId, {
        ...body,
        startsAt: body.startsAt ? new Date(body.startsAt) : undefined,
        endsAt: body.endsAt ? new Date(body.endsAt) : undefined
      });

      await this.adminAccessService.audit({
        actorUserId: req.currentUser!.id,
        action: 'update-partner-target',
        targetType: 'partner-target',
        targetId,
        details: body as unknown as Record<string, unknown>
      });

      return StandardResponse.success(res, target, 'Partner target updated', HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Get('/payout-batches')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async listPayoutBatches(
    @QueryParams() query: PartnerActivityQuery,
    @Req() req: Request,
    @Res() res: Response
  ) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'admin-partner-payout-batch-list');
    ensureResponseHeaders(res, headers);

    try {
      this.adminAccessService.assertHasRole(req.currentUser, ['superadmin']);
      const result = await this.partnerProgramService.listPayoutBatches(query.limit, query.offset);
      return StandardResponse.success(res, result, undefined, HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Get('/payout-operations-view')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async getPayoutOperationsView(
    @QueryParams() query: AdminPayoutOperationsViewQuery,
    @Req() req: Request,
    @Res() res: Response
  ) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'admin-partner-payout-operations-view');
    ensureResponseHeaders(res, headers);

    try {
      this.adminAccessService.assertHasRole(req.currentUser, ['superadmin']);
      const result = await this.partnerProgramService.getPayoutOperationsView({
        status: query.status || 'all',
        sort: query.sort || 'amount_desc',
        limit: query.limit ?? 50,
        offset: query.offset ?? 0
      });
      return StandardResponse.success(res, result, undefined, HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Post('/payout-batches')
  @HttpCode(HTTP_STATUS_CODES.CREATED)
  public async createPayoutBatch(
    @Body() body: AdminCreatePayoutBatchRequest,
    @Req() req: Request,
    @Res() res: Response
  ) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'admin-partner-payout-batch-create');
    ensureResponseHeaders(res, headers);

    try {
      this.adminAccessService.assertHasRole(req.currentUser, ['superadmin']);
      const result = await this.partnerProgramService.createPayoutBatch({
        periodStart: new Date(body.periodStart),
        periodEnd: new Date(body.periodEnd),
        partnerIds: body.partnerIds,
        notes: body.notes,
        actorUserId: req.currentUser!.id
      });

      await this.adminAccessService.audit({
        actorUserId: req.currentUser!.id,
        action: 'create-partner-payout-batch',
        targetType: 'partner-payout-batch',
        targetId: result.batch._id.toString(),
        details: {
          periodStart: body.periodStart,
          periodEnd: body.periodEnd,
          partnerCount: result.partnerCount,
          totals: result.totals
        }
      });

      return StandardResponse.created(res, result, 'Partner payout batch created', headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Post('/payout-batches/preview')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async previewPayoutBatch(
    @Body() body: AdminPreviewPayoutBatchRequest,
    @Req() req: Request,
    @Res() res: Response
  ) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'admin-partner-payout-batch-preview');
    ensureResponseHeaders(res, headers);

    try {
      this.adminAccessService.assertHasRole(req.currentUser, ['superadmin']);
      const result = await this.partnerProgramService.previewPayoutBatch({
        periodStart: new Date(body.periodStart),
        periodEnd: new Date(body.periodEnd),
        partnerIds: body.partnerIds,
        notes: body.notes
      });
      return StandardResponse.success(res, result, undefined, HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Get('/payout-batches/:batchId')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async getPayoutBatchDetail(@Param('batchId') batchId: string, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'admin-partner-payout-batch-detail');
    ensureResponseHeaders(res, headers);

    try {
      this.adminAccessService.assertHasRole(req.currentUser, ['superadmin']);
      const result = await this.partnerProgramService.getPayoutBatchDetail(batchId);
      return StandardResponse.success(res, result, undefined, HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Post('/payout-batches/:batchId/mark-paid')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async markPayoutBatchPaid(
    @Param('batchId') batchId: string,
    @Body() body: AdminMarkPayoutBatchPaidRequest,
    @Req() req: Request,
    @Res() res: Response
  ) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'admin-partner-payout-batch-paid');
    ensureResponseHeaders(res, headers);

    try {
      this.adminAccessService.assertHasRole(req.currentUser, ['superadmin']);
      const batch = await this.partnerProgramService.markPayoutBatchPaid(batchId, {
        externalReference: body.externalReference,
        notes: body.notes,
        actorUserId: req.currentUser!.id
      });

      await this.adminAccessService.audit({
        actorUserId: req.currentUser!.id,
        action: 'mark-partner-payout-batch-paid',
        targetType: 'partner-payout-batch',
        targetId: batchId,
        details: {
          externalReference: body.externalReference
        }
      });

      return StandardResponse.success(res, batch, 'Partner payout batch marked paid', HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }
}
