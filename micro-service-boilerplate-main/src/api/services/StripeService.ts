import Stripe from 'stripe';
import { Service } from 'typedi';

import { env } from '@env';
import { CSError } from '@errors/CSError';
import { CODES, HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { Logger } from '@lib/logger';
import { SubscriptionPlan } from '@models/UserModel';

interface CheckoutSessionParams {
  userId: string;
  planType: SubscriptionPlan;
  successUrl: string;
  cancelUrl: string;
  customerId?: string;
  customerEmail?: string;
}

@Service()
export class StripeService {
  private readonly log = new Logger(__filename);
  private stripeClient?: Stripe;

  constructor() {
    if (env.payments?.stripe?.secretKey) {
      this.stripeClient = new Stripe(env.payments.stripe.secretKey);
    } else {
      this.log.warn('Stripe secret key not configured. Payment features are disabled.');
    }
  }

  public isConfigured(): boolean {
    return Boolean(this.stripeClient && env.payments?.stripe?.secretKey);
  }

  public getPublishableKey(): string | undefined {
    return env.payments?.stripe?.publishableKey;
  }

  public getPriceId(plan: SubscriptionPlan): string | undefined {
    return env.payments?.stripe?.priceIds?.[plan];
  }

  public mapPriceIdToPlan(priceId?: string | null): SubscriptionPlan | undefined {
    if (!priceId) {
      return undefined;
    }

    const prices = env.payments?.stripe?.priceIds || {};
    return (Object.keys(prices) as SubscriptionPlan[]).find(plan => prices[plan] === priceId);
  }

  public async createCheckoutSession(params: CheckoutSessionParams): Promise<Stripe.Checkout.Session> {
    if (!this.stripeClient || !this.isConfigured()) {
      throw new CSError(
        HTTP_STATUS_CODES.SERVICE_UNAVAILABLE,
        CODES.StripeError,
        'Stripe integration is not configured'
      );
    }

    const priceId = this.getPriceId(params.planType);
    if (!priceId) {
      throw new CSError(
        HTTP_STATUS_CODES.BAD_REQUEST,
        CODES.InvalidBody,
        'Selected plan is not available for checkout'
      );
    }

    const payload: Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      line_items: [
        {
          price: priceId,
          quantity: 1
        }
      ],
      metadata: {
        userId: params.userId,
        planType: params.planType
      },
      subscription_data: {
        metadata: {
          userId: params.userId,
          planType: params.planType
        }
      },
      allow_promotion_codes: true,
      client_reference_id: params.userId
    };

    if (params.customerId) {
      payload.customer = params.customerId;
    } else if (params.customerEmail) {
      payload.customer_email = params.customerEmail;
    }

    const session = await this.stripeClient.checkout.sessions.create(payload);
    this.log.info(`Stripe checkout session created for user ${params.userId} and plan ${params.planType}`);
    return session;
  }

  public constructEvent(payload: Buffer | undefined, signature: string | string[] | undefined): Stripe.Event {
    if (!this.stripeClient || !this.isConfigured()) {
      throw new CSError(
        HTTP_STATUS_CODES.SERVICE_UNAVAILABLE,
        CODES.StripeError,
        'Stripe integration is not configured'
      );
    }

    if (!payload) {
      throw new CSError(HTTP_STATUS_CODES.BAD_REQUEST, CODES.InvalidBody, 'Missing webhook payload');
    }

    if (!signature) {
      throw new CSError(HTTP_STATUS_CODES.BAD_REQUEST, CODES.InvalidBody, 'Missing Stripe signature header');
    }

    const webhookSecret = env.payments?.stripe?.webhookSecret;
    if (!webhookSecret) {
      throw new CSError(
        HTTP_STATUS_CODES.SERVICE_UNAVAILABLE,
        CODES.StripeError,
        'Stripe webhook secret is not configured'
      );
    }

    try {
      return this.stripeClient.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (error: any) {
      this.log.error('Failed to verify Stripe webhook signature', { error });
      throw new CSError(HTTP_STATUS_CODES.BAD_REQUEST, CODES.InvalidBody, 'Invalid Stripe signature');
    }
  }
}
