import { Request, Response } from 'express';
import { Body, Get, HttpCode, JsonController, Patch, Req, Res, UseBefore } from 'routing-controllers';

import { buildRequestHeaders, ensureResponseHeaders } from '@api/utils/requestContext';
import { UpdateProfileRequest } from '@dto/UserDto';
import { HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { AuthMiddleware } from '@middlewares/AuthMiddleware';
import { StandardResponse } from '@responses/StandardResponse';
import { UserService } from '@services/UserService';

@JsonController('/users')
@UseBefore(AuthMiddleware)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('/me')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async getProfile(@Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'user-profile');
    ensureResponseHeaders(res, headers);

    if (!req.currentUser) {
      return StandardResponse.unauthorized(res, 'Authentication required', headers);
    }

    try {
      const profile = await this.userService.getProfile(req.currentUser.id, headers);
      return StandardResponse.success(res, profile, undefined, HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Patch('/me')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async updateProfile(@Body() body: UpdateProfileRequest, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'user-update');
    ensureResponseHeaders(res, headers);

    if (!req.currentUser) {
      return StandardResponse.unauthorized(res, 'Authentication required', headers);
    }

    try {
      const profile = await this.userService.updateProfile(req.currentUser.id, body, headers);
      return StandardResponse.success(res, profile, 'Profile updated', HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }
}
