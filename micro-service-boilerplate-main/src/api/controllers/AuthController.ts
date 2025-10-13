import { Request, Response } from 'express';
import { Body, HttpCode, JsonController, Post, Req, Res } from 'routing-controllers';

import { buildRequestHeaders, ensureResponseHeaders } from '@api/utils/requestContext';
import { LoginRequest, LogoutRequest, RefreshTokenRequest, RegisterRequest } from '@dto/AuthDto';
import { HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { StandardResponse } from '@responses/StandardResponse';
import { AuthService } from '@services/AuthService';

@JsonController('/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('/register')
  @HttpCode(HTTP_STATUS_CODES.CREATED)
  public async register(@Body() body: RegisterRequest, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'auth-register');
    ensureResponseHeaders(res, headers);

    try {
      const result = await this.authService.register(body, headers);
      return StandardResponse.created(res, result, 'Registration successful', headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Post('/login')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async login(@Body() body: LoginRequest, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'auth-login');
    ensureResponseHeaders(res, headers);

    try {
      const result = await this.authService.login(body, headers);
      return StandardResponse.success(res, result, 'Login successful', HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Post('/refresh')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async refresh(@Body() body: RefreshTokenRequest, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'auth-refresh');
    ensureResponseHeaders(res, headers);

    try {
      const result = await this.authService.refreshTokens(body, headers);
      return StandardResponse.success(res, result, 'Tokens refreshed', HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Post('/logout')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async logout(@Body() body: LogoutRequest, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'auth-logout');
    ensureResponseHeaders(res, headers);

    try {
      await this.authService.logout(body.refreshToken, headers);
      return StandardResponse.success(res, undefined, 'Logged out', HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }
}
