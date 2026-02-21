import { env } from '@env';
import {
  RegisterDeviceDto,
  BroadcastNotificationDto,
  UnregisterDeviceDto,
  UpdateNotificationSettingsDto
} from '@dto/NotificationDto';
import { HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { AuthMiddleware } from '@middlewares/AuthMiddleware';
import { StandardResponse } from '@responses/StandardResponse';
import { NotificationService } from '@services/NotificationService';
import { buildRequestHeaders, ensureResponseHeaders } from '@api/utils/requestContext';
import { Request, Response } from 'express';
import { Body, Delete, Get, HttpCode, JsonController, Post, Put, Req, Res, UseBefore } from 'routing-controllers';

@JsonController('/notifications')
@UseBefore(AuthMiddleware)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get('/preferences')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async getPreferences(@Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'notifications-get-preferences');
    ensureResponseHeaders(res, headers);

    if (!req.currentUser) {
      return StandardResponse.unauthorized(res, 'Authentication required', headers);
    }

    try {
      const settings = await this.notificationService.getNotificationSettings(req.currentUser.id);
      return StandardResponse.success(res, settings, undefined, HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Put('/preferences')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async updatePreferences(
    @Body() body: UpdateNotificationSettingsDto,
    @Req() req: Request,
    @Res() res: Response
  ) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'notifications-update-preferences');
    ensureResponseHeaders(res, headers);

    if (!req.currentUser) {
      return StandardResponse.unauthorized(res, 'Authentication required', headers);
    }

    try {
      const updated = await this.notificationService.updateNotificationSettings(req.currentUser.id, body);
      return StandardResponse.success(
        res,
        updated,
        'Notification preferences saved',
        HTTP_STATUS_CODES.SUCCESS,
        headers
      );
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Post('/device')
  @HttpCode(HTTP_STATUS_CODES.ACCEPTED)
  public async registerDevice(@Body() body: RegisterDeviceDto, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'notifications-register-device');
    ensureResponseHeaders(res, headers);

    if (!req.currentUser) {
      return StandardResponse.unauthorized(res, 'Authentication required', headers);
    }

    try {
      await this.notificationService.registerDeviceToken(req.currentUser.id, body.token);
      return StandardResponse.success(
        res,
        undefined,
        'Device registered for notifications',
        HTTP_STATUS_CODES.ACCEPTED,
        headers
      );
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Delete('/device')
  @HttpCode(HTTP_STATUS_CODES.ACCEPTED)
  public async unregisterDevice(@Body() body: UnregisterDeviceDto, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'notifications-unregister-device');
    ensureResponseHeaders(res, headers);

    if (!req.currentUser) {
      return StandardResponse.unauthorized(res, 'Authentication required', headers);
    }

    try {
      await this.notificationService.removeDeviceToken(req.currentUser.id, body.token);
      return StandardResponse.success(res, undefined, 'Device removed', HTTP_STATUS_CODES.ACCEPTED, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Post('/broadcast')
  @HttpCode(HTTP_STATUS_CODES.ACCEPTED)
  public async broadcast(@Body() body: BroadcastNotificationDto, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'notifications-broadcast');
    ensureResponseHeaders(res, headers);

    if (!req.currentUser) {
      return StandardResponse.unauthorized(res, 'Authentication required', headers);
    }

    const allowedEmails = env.push.broadcastAllowedEmails || [];
    if (!allowedEmails.includes(req.currentUser.email)) {
      return StandardResponse.forbidden(res, 'You do not have permission to send broadcasts', headers);
    }

    try {
      await this.notificationService.notifySystemMessage({
        userIds: body.userIds,
        title: body.title,
        body: body.body,
        type: body.type,
        data: body.data
      });
      return StandardResponse.success(res, undefined, 'Broadcast queued', HTTP_STATUS_CODES.ACCEPTED, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }
}
