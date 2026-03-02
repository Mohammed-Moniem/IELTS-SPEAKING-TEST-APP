import { Request, Response } from 'express';
import { Body, Get, HttpCode, JsonController, Post, QueryParams, Req, Res, UseBefore } from 'routing-controllers';

import { buildRequestHeaders, ensureResponseHeaders } from '@api/utils/requestContext';
import { PartnerActivityQuery, PartnerApplicationRequest } from '@dto/PartnerDto';
import { HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { AuthMiddleware } from '@middlewares/AuthMiddleware';
import { StandardResponse } from '@responses/StandardResponse';
import { PartnerProgramService } from '@services/PartnerProgramService';

@JsonController('/partners')
@UseBefore(AuthMiddleware)
export class PartnerController {
  constructor(private readonly partnerProgramService: PartnerProgramService) {}

  @Post('/applications')
  @HttpCode(HTTP_STATUS_CODES.CREATED)
  public async submitApplication(@Body() body: PartnerApplicationRequest, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'partners-applications-create');
    ensureResponseHeaders(res, headers);

    if (!req.currentUser) {
      return StandardResponse.unauthorized(res, 'Authentication required', headers);
    }

    try {
      const result = await this.partnerProgramService.submitApplication(req.currentUser.id, body);
      return StandardResponse.created(res, result, 'Partner application submitted', headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Get('/me')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async getMe(@Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'partners-me');
    ensureResponseHeaders(res, headers);

    if (!req.currentUser) {
      return StandardResponse.unauthorized(res, 'Authentication required', headers);
    }

    try {
      const result = await this.partnerProgramService.getPartnerSelf(req.currentUser.id);
      return StandardResponse.success(res, result, undefined, HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Get('/dashboard')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async getDashboard(@Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'partners-dashboard');
    ensureResponseHeaders(res, headers);

    if (!req.currentUser) {
      return StandardResponse.unauthorized(res, 'Authentication required', headers);
    }

    try {
      const result = await this.partnerProgramService.getPartnerDashboard(req.currentUser.id);
      return StandardResponse.success(res, result, undefined, HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Get('/codes')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async getCodes(@QueryParams() query: PartnerActivityQuery, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'partners-codes');
    ensureResponseHeaders(res, headers);

    if (!req.currentUser) {
      return StandardResponse.unauthorized(res, 'Authentication required', headers);
    }

    try {
      const result = await this.partnerProgramService.listPartnerCodes(req.currentUser.id, query.limit, query.offset);
      return StandardResponse.success(res, result, undefined, HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Get('/conversions')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async getConversions(@QueryParams() query: PartnerActivityQuery, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'partners-conversions');
    ensureResponseHeaders(res, headers);

    if (!req.currentUser) {
      return StandardResponse.unauthorized(res, 'Authentication required', headers);
    }

    try {
      const result = await this.partnerProgramService.listPartnerConversions(req.currentUser.id, query.limit, query.offset);
      return StandardResponse.success(res, result, undefined, HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Get('/targets')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async getTargets(@Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'partners-targets');
    ensureResponseHeaders(res, headers);

    if (!req.currentUser) {
      return StandardResponse.unauthorized(res, 'Authentication required', headers);
    }

    try {
      const result = await this.partnerProgramService.listPartnerTargets(req.currentUser.id);
      return StandardResponse.success(res, result, undefined, HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Get('/payouts')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async getPayouts(@QueryParams() query: PartnerActivityQuery, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'partners-payouts');
    ensureResponseHeaders(res, headers);

    if (!req.currentUser) {
      return StandardResponse.unauthorized(res, 'Authentication required', headers);
    }

    try {
      const result = await this.partnerProgramService.listPartnerPayouts(req.currentUser.id, query.limit, query.offset);
      return StandardResponse.success(res, result, undefined, HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }
}
