import { Request, Response } from 'express';
import { Body, Get, HttpCode, JsonController, Post, Req, Res, UseBefore } from 'routing-controllers';

import { buildRequestHeaders, ensureResponseHeaders } from '@api/utils/requestContext';
import { AdvertiserCheckoutSessionRequest } from '@dto/GrowthDto';
import { HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { AuthMiddleware } from '@middlewares/AuthMiddleware';
import { StandardResponse } from '@responses/StandardResponse';
import { GrowthService } from '@services/GrowthService';

@JsonController('/advertisers')
@UseBefore(AuthMiddleware)
export class AdvertiserController {
  constructor(private readonly growthService: GrowthService) {}

  @Post('/checkout-session')
  @HttpCode(HTTP_STATUS_CODES.CREATED)
  public async createCheckoutSession(@Body() body: AdvertiserCheckoutSessionRequest, @Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'advertiser-checkout-session');
    ensureResponseHeaders(res, headers);

    try {
      const data = await this.growthService.createAdvertiserCheckoutSession(req.currentUser!.id, body);
      return StandardResponse.success(res, data, 'Checkout session created', HTTP_STATUS_CODES.CREATED, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }

  @Get('/subscription')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async getSubscription(@Req() req: Request, @Res() res: Response) {
    const headers: IRequestHeaders = buildRequestHeaders(req, 'advertiser-subscription');
    ensureResponseHeaders(res, headers);

    try {
      const data = await this.growthService.getAdvertiserSubscription(req.currentUser!.id);
      return StandardResponse.success(res, data, undefined, HTTP_STATUS_CODES.SUCCESS, headers);
    } catch (error) {
      return StandardResponse.error(res, error as Error, headers);
    }
  }
}
