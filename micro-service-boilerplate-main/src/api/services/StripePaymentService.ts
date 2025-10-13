import Stripe from 'stripe';
import { Service } from 'typedi';

@Service()
export class StripePaymentService {
  private stripe: Stripe;

  constructor() {
    const apiKey = process.env.STRIPE_SECRET_KEY;
    if (!apiKey) {
      throw new Error('STRIPE_SECRET_KEY environment variable is not set');
    }
    this.stripe = new Stripe(apiKey, {
      apiVersion: '2025-09-30.clover'
    });
  }

  /**
   * Create a Stripe customer
   */
  async createCustomer(email: string, name?: string, metadata?: Record<string, string>): Promise<Stripe.Customer> {
    return await this.stripe.customers.create({
      email,
      name,
      metadata
    });
  }

  /**
   * Create a checkout session for subscription
   */
  async createCheckoutSession(params: {
    customerId?: string;
    priceId: string;
    successUrl: string;
    cancelUrl: string;
    metadata?: Record<string, string>;
    trialPeriodDays?: number;
  }): Promise<Stripe.Checkout.Session> {
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: params.priceId,
          quantity: 1
        }
      ],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: params.metadata
    };

    if (params.customerId) {
      sessionParams.customer = params.customerId;
    }

    if (params.trialPeriodDays) {
      sessionParams.subscription_data = {
        trial_period_days: params.trialPeriodDays
      };
    }

    return await this.stripe.checkout.sessions.create(sessionParams);
  }

  /**
   * Create a billing portal session
   */
  async createPortalSession(customerId: string, returnUrl: string): Promise<Stripe.BillingPortal.Session> {
    return await this.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl
    });
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(subscriptionId: string, immediately: boolean = false): Promise<Stripe.Subscription> {
    if (immediately) {
      return await this.stripe.subscriptions.cancel(subscriptionId);
    } else {
      // Cancel at period end
      return await this.stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true
      });
    }
  }

  /**
   * Resume cancelled subscription
   */
  async resumeSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return await this.stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false
    });
  }

  /**
   * Get subscription details
   */
  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return await this.stripe.subscriptions.retrieve(subscriptionId);
  }

  /**
   * Update subscription (upgrade/downgrade)
   */
  async updateSubscription(subscriptionId: string, newPriceId: string): Promise<Stripe.Subscription> {
    const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);

    return await this.stripe.subscriptions.update(subscriptionId, {
      items: [
        {
          id: subscription.items.data[0].id,
          price: newPriceId
        }
      ],
      proration_behavior: 'create_prorations'
    });
  }

  /**
   * Handle webhook events
   */
  constructWebhookEvent(payload: string | Buffer, signature: string, secret: string): Stripe.Event {
    return this.stripe.webhooks.constructEvent(payload, signature, secret);
  }

  /**
   * Get customer details
   */
  async getCustomer(customerId: string): Promise<Stripe.Customer> {
    return (await this.stripe.customers.retrieve(customerId)) as Stripe.Customer;
  }

  /**
   * List customer subscriptions
   */
  async listCustomerSubscriptions(customerId: string): Promise<Stripe.Subscription[]> {
    const subscriptions = await this.stripe.subscriptions.list({
      customer: customerId
    });

    return subscriptions.data;
  }
}
