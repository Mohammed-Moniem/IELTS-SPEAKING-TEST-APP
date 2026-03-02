import Stripe from 'stripe';
import { Service } from 'typedi';

import { env } from '@env';
import { CSError } from '@errors/CSError';
import { CODES, HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { Logger } from '@lib/logger';
import { SubscriptionPlan } from '@models/UserModel';

export type BillingCycle = 'monthly' | 'annual';

interface CheckoutSessionParams {
  userId: string;
  planType: SubscriptionPlan;
  billingCycle?: BillingCycle;
  successUrl: string;
  cancelUrl: string;
  customerId?: string;
  customerEmail?: string;
  idempotencyKey?: string;
  promotionCodeId?: string;
  couponCode?: string;
  partnerAttribution?: {
    partnerId: string;
    partnerCodeId: string;
    partnerCode: string;
  };
}

interface BillingPortalSessionParams {
  customerId: string;
  returnUrl: string;
}

interface ExternalCheckoutSessionParams {
  mode: 'subscription' | 'payment';
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  customerId?: string;
  customerEmail?: string;
  allowPromotionCodes?: boolean;
  promotionCodeId?: string;
  idempotencyKey?: string;
  metadata?: Record<string, string>;
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

  public getMode(): 'disabled' | 'test' | 'live' | 'unknown' {
    const secret = env.payments?.stripe?.secretKey;
    if (!secret) {
      return 'disabled';
    }

    if (secret.startsWith('sk_test_') || secret.startsWith('rk_test_')) {
      return 'test';
    }

    if (secret.startsWith('sk_live_') || secret.startsWith('rk_live_')) {
      return 'live';
    }

    return 'unknown';
  }

  public getPublishableKey(): string | undefined {
    return env.payments?.stripe?.publishableKey;
  }

  public getPriceId(plan: SubscriptionPlan, billingCycle: BillingCycle = 'monthly'): string | undefined {
    const configuredPrices = env.payments?.stripe?.priceIds?.[plan];
    if (!configuredPrices) {
      return undefined;
    }

    if (typeof configuredPrices === 'string') {
      return billingCycle === 'monthly' ? configuredPrices : undefined;
    }

    return configuredPrices[billingCycle];
  }

  public mapPriceIdToPlan(priceId?: string | null): SubscriptionPlan | undefined {
    if (!priceId) {
      return undefined;
    }

    const prices = env.payments?.stripe?.priceIds || {};
    return (Object.keys(prices) as SubscriptionPlan[]).find(plan => {
      const planPrices = prices[plan];
      if (!planPrices) {
        return false;
      }

      if (typeof planPrices === 'string') {
        return planPrices === priceId;
      }

      return planPrices.monthly === priceId || planPrices.annual === priceId;
    });
  }

  public async createCheckoutSession(params: CheckoutSessionParams): Promise<Stripe.Checkout.Session> {
    if (!this.stripeClient || !this.isConfigured()) {
      throw new CSError(
        HTTP_STATUS_CODES.SERVICE_UNAVAILABLE,
        CODES.StripeError,
        'Stripe integration is not configured'
      );
    }

    const billingCycle = params.billingCycle || 'monthly';
    const priceId = this.getPriceId(params.planType, billingCycle);
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
        planType: params.planType,
        billingCycle,
        ...(params.couponCode ? { couponCode: params.couponCode } : {}),
        ...(params.partnerAttribution
          ? {
              partnerId: params.partnerAttribution.partnerId,
              partnerCodeId: params.partnerAttribution.partnerCodeId,
              partnerCode: params.partnerAttribution.partnerCode
            }
          : {})
      },
      subscription_data: {
        metadata: {
          userId: params.userId,
          planType: params.planType,
          billingCycle,
          ...(params.couponCode ? { couponCode: params.couponCode } : {}),
          ...(params.partnerAttribution
            ? {
                partnerId: params.partnerAttribution.partnerId,
                partnerCodeId: params.partnerAttribution.partnerCodeId,
                partnerCode: params.partnerAttribution.partnerCode
              }
            : {})
        }
      },
      allow_promotion_codes: true,
      client_reference_id: params.userId
    };

    if (params.promotionCodeId) {
      payload.discounts = [{ promotion_code: params.promotionCodeId }];
    }

    if (params.customerId) {
      payload.customer = params.customerId;
    } else if (params.customerEmail) {
      payload.customer_email = params.customerEmail;
    }

    const session = await this.stripeClient.checkout.sessions.create(payload, {
      idempotencyKey: params.idempotencyKey
    });
    this.log.info(
      `Stripe checkout session created for user ${params.userId}, plan ${params.planType}, cycle ${billingCycle}`
    );
    return session;
  }

  public async createBillingPortalSession(params: BillingPortalSessionParams): Promise<Stripe.BillingPortal.Session> {
    if (!this.stripeClient || !this.isConfigured()) {
      throw new CSError(
        HTTP_STATUS_CODES.SERVICE_UNAVAILABLE,
        CODES.StripeError,
        'Stripe integration is not configured'
      );
    }

    return this.stripeClient.billingPortal.sessions.create({
      customer: params.customerId,
      return_url: params.returnUrl
    });
  }

  public async createExternalCheckoutSession(
    params: ExternalCheckoutSessionParams
  ): Promise<Stripe.Checkout.Session> {
    if (!this.stripeClient || !this.isConfigured()) {
      throw new CSError(
        HTTP_STATUS_CODES.SERVICE_UNAVAILABLE,
        CODES.StripeError,
        'Stripe integration is not configured'
      );
    }

    const payload: Stripe.Checkout.SessionCreateParams = {
      mode: params.mode,
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      line_items: [
        {
          price: params.priceId,
          quantity: 1
        }
      ],
      metadata: params.metadata || {},
      allow_promotion_codes: params.allowPromotionCodes ?? false
    };

    if (params.promotionCodeId) {
      payload.discounts = [{ promotion_code: params.promotionCodeId }];
    }

    if (params.customerId) {
      payload.customer = params.customerId;
    } else if (params.customerEmail) {
      payload.customer_email = params.customerEmail;
    }

    return this.stripeClient.checkout.sessions.create(payload, {
      idempotencyKey: params.idempotencyKey
    });
  }

  public async findPromotionCodeIdByCode(code: string): Promise<string | undefined> {
    if (!this.stripeClient || !this.isConfigured()) {
      return undefined;
    }

    const normalizedCode = code.trim();
    if (!normalizedCode) {
      return undefined;
    }

    const promotionCodes = await this.stripeClient.promotionCodes.list({
      code: normalizedCode,
      active: true,
      limit: 1
    });

    return promotionCodes.data[0]?.id;
  }

  public async getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    if (!this.stripeClient || !this.isConfigured()) {
      throw new CSError(
        HTTP_STATUS_CODES.SERVICE_UNAVAILABLE,
        CODES.StripeError,
        'Stripe integration is not configured'
      );
    }

    return this.stripeClient.subscriptions.retrieve(subscriptionId);
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
