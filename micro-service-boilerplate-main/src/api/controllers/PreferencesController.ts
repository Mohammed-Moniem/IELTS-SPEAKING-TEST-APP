import { Request, Response } from 'express';
import { Body, Get, HttpCode, JsonController, Put, Req, Res, UseBefore } from 'routing-controllers';

import { buildRequestHeaders, ensureResponseHeaders } from '@api/utils/requestContext';
import { UpsertPreferencesRequest } from '@dto/PreferencesDto';
import { HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { AuthMiddleware } from '@middlewares/AuthMiddleware';
import { StandardResponse } from '@responses/StandardResponse';
import { PreferencesService } from '@services/PreferencesService';

@JsonController('/preferences')
@UseBefore(AuthMiddleware)
export class PreferencesController {
  constructor(private readonly preferencesService: PreferencesService) {}

  @Get('/')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async getPreferences(@Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'preferences-get');
    ensureResponseHeaders(res, headers);

    if (!req.currentUser) {
      return StandardResponse.unauthorized(res, 'Authentication required', headers);
    }

    try {
      const preferences = await this.preferencesService.getPreferences(req.currentUser.id, headers);
      return StandardResponse.success(res, preferences, undefined, HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Put('/')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async upsertPreferences(@Body() body: UpsertPreferencesRequest, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'preferences-upsert');
    ensureResponseHeaders(res, headers);

    if (!req.currentUser) {
      return StandardResponse.unauthorized(res, 'Authentication required', headers);
    }

    try {
      const preferences = await this.preferencesService.upsertPreferences(req.currentUser.id, body, headers);
      return StandardResponse.success(res, preferences, 'Preferences saved', HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }
}
