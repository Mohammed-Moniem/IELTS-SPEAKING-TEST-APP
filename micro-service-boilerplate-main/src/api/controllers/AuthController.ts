import { Request, Response } from 'express';
import { Body, Delete, Get, HttpCode, JsonController, Post, QueryParam, Req, Res } from 'routing-controllers';

import { buildRequestHeaders, ensureResponseHeaders } from '@api/utils/requestContext';
import {
  ForgotPasswordRequest,
  LoginRequest,
  LogoutRequest,
  RefreshTokenRequest,
  RegisterRequest,
  ResetPasswordRequest,
  SendVerificationRequest,
  VerifyEmailRequest
} from '@dto/AuthDto';
import { HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { StandardResponse } from '@responses/StandardResponse';
import { AuthService } from '@services/AuthService';
import { env } from '@env';

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

  @Post('/forgot-password')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async forgotPassword(@Body() body: ForgotPasswordRequest, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'auth-forgot-password');
    ensureResponseHeaders(res, headers);

    try {
      await this.authService.forgotPassword(body.email, headers);
      const deliveryStatus = this.authService.getEmailDeliveryStatus();
      // Always return success to prevent email enumeration
      return StandardResponse.success(
        res,
        env.isDevelopment || env.isTest ? { emailDelivery: deliveryStatus } : {},
        'If an account exists for that email, a reset link has been sent.',
        HTTP_STATUS_CODES.SUCCESS,
        headers
      );
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Post('/reset-password')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async resetPassword(@Body() body: ResetPasswordRequest, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'auth-reset-password');
    ensureResponseHeaders(res, headers);

    try {
      await this.authService.resetPassword(body.token, body.password, headers);
      return StandardResponse.success(
        res,
        undefined,
        'Password has been reset successfully.',
        HTTP_STATUS_CODES.SUCCESS,
        headers
      );
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Post('/verify-email')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async verifyEmail(@Body() body: VerifyEmailRequest, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'auth-verify-email');
    ensureResponseHeaders(res, headers);

    try {
      await this.authService.verifyEmail(body.token, headers);
      return StandardResponse.success(
        res,
        undefined,
        'Email verified successfully.',
        HTTP_STATUS_CODES.SUCCESS,
        headers
      );
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Post('/send-verification')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async sendVerification(@Body() body: SendVerificationRequest, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'auth-send-verification');
    ensureResponseHeaders(res, headers);

    try {
      // Find user by email to get userId
      const { userRepository } = await import('@lib/db/repositories');
      const user = await userRepository.findByEmail(body.email);
      if (user) {
        await this.authService.sendVerificationEmail(user._id.toString(), headers);
      }
      const deliveryStatus = this.authService.getEmailDeliveryStatus();
      // Always return success to prevent email enumeration
      return StandardResponse.success(
        res,
        env.isDevelopment || env.isTest ? { emailDelivery: deliveryStatus } : {},
        'If your email is registered, a verification link has been sent.',
        HTTP_STATUS_CODES.SUCCESS,
        headers
      );
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Get('/dev-email-outbox')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async getDevEmailOutbox(
    @Req() req: Request,
    @Res() res: Response,
    @QueryParam('to') to?: string,
    @QueryParam('limit') limit?: string
  ) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'auth-dev-email-outbox');
    ensureResponseHeaders(res, headers);

    if (!env.isDevelopment && !env.isTest) {
      return StandardResponse.notFound(res, 'Route', headers);
    }

    const parsedLimit = Number(limit);
    const safeLimit = Number.isFinite(parsedLimit) ? Math.max(1, Math.min(100, parsedLimit)) : 25;

    const messages = this.authService.listDevEmailOutbox(to, safeLimit);

    return StandardResponse.success(
      res,
      {
        total: messages.length,
        messages
      },
      'Developer email outbox fetched.',
      HTTP_STATUS_CODES.SUCCESS,
      headers
    );
  }

  @Delete('/dev-email-outbox')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async clearDevEmailOutbox(@Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'auth-clear-dev-email-outbox');
    ensureResponseHeaders(res, headers);

    if (!env.isDevelopment && !env.isTest) {
      return StandardResponse.notFound(res, 'Route', headers);
    }

    this.authService.clearDevEmailOutbox();

    return StandardResponse.success(
      res,
      { cleared: true },
      'Developer email outbox cleared.',
      HTTP_STATUS_CODES.SUCCESS,
      headers
    );
  }
}
