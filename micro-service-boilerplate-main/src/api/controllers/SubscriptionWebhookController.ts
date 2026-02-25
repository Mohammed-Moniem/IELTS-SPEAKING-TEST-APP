import { Request, Response } from 'express';
import { HttpCode, JsonController, Post, Req, Res } from 'routing-controllers';

import { buildRequestHeaders, ensureResponseHeaders } from '@api/utils/requestContext';
import { HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { Logger } from '@lib/logger';
import { StripeService } from '@services/StripeService';
import { SubscriptionService } from '@services/SubscriptionService';

@JsonController('/subscription')
export class SubscriptionWebhookController {
  private readonly log = new Logger(__filename);

  constructor(
    private readonly stripeService: StripeService,
    private readonly subscriptionService: SubscriptionService
  ) {}

  @Post('/webhook')
  @HttpCode(HTTP_STATUS_CODES.SUCCESS)
  public async handleWebhook(@Req() req: Request, @Res() res: Response) {
    const headers = buildRequestHeaders(req, 'subscription-webhook');
    ensureResponseHeaders(res, headers);

    try {
      const signature = req.headers['stripe-signature'];
      const payloadBuffer =
        req.rawBody ||
        Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {}));
      const event = this.stripeService.constructEvent(payloadBuffer, signature);
      await this.subscriptionService.handleStripeWebhook(event, headers);

      return res.status(HTTP_STATUS_CODES.SUCCESS).json({ received: true });
    } catch (error) {
      this.log.error('Stripe webhook processing failed', { error });
      return res
        .status(HTTP_STATUS_CODES.BAD_REQUEST)
        .json({ error: error instanceof Error ? error.message : 'Webhook processing failed' });
    }
  }
}
