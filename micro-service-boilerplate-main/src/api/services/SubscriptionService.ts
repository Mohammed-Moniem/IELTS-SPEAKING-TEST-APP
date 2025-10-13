import Stripe from 'stripe';
import { Service } from 'typedi';

import { env } from '@env';
import { CSError } from '@errors/CSError';
import { CODES, HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { constructLogMessage } from '@lib/env/helpers';
import { Logger } from '@lib/logger';
import { SubscriptionDocument, SubscriptionModel, SubscriptionStatus } from '@models/SubscriptionModel';
import { SubscriptionPlan, UserModel } from '@models/UserModel';

import { StripeService } from './StripeService';

const PLAN_METADATA: Record<SubscriptionPlan, { label: string; features: string[] }> = {
  free: {
    label: 'Free',
    features: ['3 practice sessions / month', '1 test simulation / month']
  },
  premium: {
    label: 'Premium',
    features: ['Unlimited practice sessions', 'Unlimited test simulations', 'Enhanced AI feedback']
  },
  pro: {
    label: 'Pro',
    features: ['All premium features', 'Priority feedback queue', 'Early access to new topics']
  }
};

type SubscriptionUpdateOptions = {
  stripeSubscriptionId?: string;
  stripeCustomerId?: string;
  status?: SubscriptionStatus;
  subscriptionDate?: Date;
  trialEndsAt?: Date;
  isTrialActive?: boolean;
};

@Service()
export class SubscriptionService {
  private log = new Logger(__filename);

  constructor(private readonly stripeService: StripeService) {}

  private async getOrCreateSubscription(userId: string): Promise<SubscriptionDocument> {
    let subscription = (await SubscriptionModel.findOne({ user: userId })) as SubscriptionDocument | null;
    if (!subscription) {
      subscription = (await SubscriptionModel.create({
        user: userId,
        planType: 'free',
        status: 'active',
        isTrialActive: false
      })) as SubscriptionDocument;
    }
    return subscription;
  }

  public getStripeConfiguration() {
    return {
      enabled: this.stripeService.isConfigured(),
      publishableKey: this.stripeService.getPublishableKey(),
      prices: {
        premium: this.stripeService.getPriceId('premium'),
        pro: this.stripeService.getPriceId('pro')
      }
    };
  }

  public async getCurrentSubscription(userId: string, headers: IRequestHeaders) {
    const logMessage = constructLogMessage(__filename, 'getCurrentSubscription', headers);
    const subscription = await this.getOrCreateSubscription(userId);
    this.log.debug(`${logMessage} :: Returning subscription for user ${userId}`);
    const stripeConfiguration = this.getStripeConfiguration();

    return {
      planType: subscription.planType,
      status: subscription.status,
      isTrialActive: subscription.isTrialActive,
      subscriptionDate: subscription.subscriptionDate,
      trialEndsAt: subscription.trialEndsAt,
      metadata: PLAN_METADATA[subscription.planType],
      stripe: stripeConfiguration
    };
  }

  public async createCheckoutSession(
    userId: string,
    planType: SubscriptionPlan,
    headers: IRequestHeaders,
    urls?: { successUrl?: string; cancelUrl?: string }
  ) {
    const logMessage = constructLogMessage(__filename, 'createCheckoutSession', headers);

    if (planType === 'free') {
      throw new CSError(HTTP_STATUS_CODES.BAD_REQUEST, CODES.InvalidBody, 'Use downgrade endpoint to switch to free');
    }

    if (!this.stripeService.isConfigured()) {
      throw new CSError(
        HTTP_STATUS_CODES.SERVICE_UNAVAILABLE,
        CODES.StripeError,
        'Stripe integration is not configured'
      );
    }

    const subscription = await this.getOrCreateSubscription(userId);
    if (subscription.planType === planType && subscription.status === 'active') {
      throw new CSError(HTTP_STATUS_CODES.CONFLICT, CODES.UserAlreadyExists, 'Already subscribed to this plan');
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      throw new CSError(HTTP_STATUS_CODES.NOT_FOUND, CODES.NotFound, 'User not found');
    }

    const successUrl =
      urls?.successUrl ||
      env.payments?.stripe?.defaultSuccessUrl ||
      `${env.app.schema}://${env.app.host}/payments/success`;
    const cancelUrl =
      urls?.cancelUrl ||
      env.payments?.stripe?.defaultCancelUrl ||
      `${env.app.schema}://${env.app.host}/payments/cancel`;

    const session = await this.stripeService.createCheckoutSession({
      userId,
      planType,
      successUrl,
      cancelUrl,
      customerId: subscription.stripeCustomerId,
      customerEmail: user.email
    });

    this.log.info(`${logMessage} :: Created Stripe checkout session ${session.id} for plan ${planType}`);

    return {
      sessionId: session.id,
      checkoutUrl: session.url,
      publishableKey: this.stripeService.getPublishableKey()
    };
  }

  public async handleStripeWebhook(event: Stripe.Event, headers: IRequestHeaders): Promise<void> {
    const logMessage = constructLogMessage(__filename, 'handleStripeWebhook', headers);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const metadataPlan = session.metadata?.planType as SubscriptionPlan | undefined;
        const stripeSubscriptionId =
          typeof session.subscription === 'string'
            ? session.subscription
            : (session.subscription as Stripe.Subscription | undefined)?.id;
        const stripeCustomerId = this.resolveStripeCustomerId(session.customer);
        const planType = metadataPlan;

        if (!userId || !planType) {
          this.log.warn(`${logMessage} :: Missing userId or planType in checkout session ${session.id}`);
          return;
        }

        await this.activatePlan(userId, planType, headers, {
          stripeSubscriptionId,
          stripeCustomerId,
          status: 'active',
          subscriptionDate: session.created ? new Date(session.created * 1000) : new Date(),
          isTrialActive: false,
          trialEndsAt: undefined
        });
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const planType =
          this.stripeService.mapPriceIdToPlan(subscription.items.data[0]?.price?.id) ||
          (subscription.metadata?.planType as SubscriptionPlan | undefined);
        const userId = subscription.metadata?.userId;
        const currentPeriodStart = (subscription as { current_period_start?: number }).current_period_start;
        const trialEnd = subscription.trial_end;

        if (!userId || !planType) {
          this.log.warn(`${logMessage} :: Unable to map plan or user for Stripe subscription ${subscription.id}`);
          return;
        }

        await this.activatePlan(userId, planType, headers, {
          stripeSubscriptionId: subscription.id,
          stripeCustomerId: this.resolveStripeCustomerId(subscription.customer),
          status: this.mapStripeStatus(subscription.status),
          subscriptionDate: currentPeriodStart ? new Date(currentPeriodStart * 1000) : new Date(),
          trialEndsAt: trialEnd ? new Date(trialEnd * 1000) : undefined,
          isTrialActive: subscription.status === 'trialing'
        });
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.userId;

        if (!userId) {
          this.log.warn(`${logMessage} :: Unable to determine user for canceled subscription ${subscription.id}`);
          return;
        }

        await this.activatePlan(userId, 'free', headers, {
          stripeSubscriptionId: undefined,
          stripeCustomerId: this.resolveStripeCustomerId(subscription.customer),
          status: 'canceled',
          isTrialActive: false,
          trialEndsAt: undefined
        });
        break;
      }
      default:
        this.log.debug(`${logMessage} :: Ignoring unsupported Stripe event ${event.type}`);
        break;
    }
  }

  private resolveStripeCustomerId(
    customer: string | Stripe.Customer | Stripe.DeletedCustomer | null | undefined
  ): string | undefined {
    if (!customer) {
      return undefined;
    }

    if (typeof customer === 'string') {
      return customer;
    }

    return customer.id;
  }

  private mapStripeStatus(status?: Stripe.Subscription.Status | null): SubscriptionStatus {
    switch (status) {
      case 'active':
      case 'trialing':
        return 'active';
      case 'past_due':
        return 'past_due';
      case 'incomplete':
        return 'incomplete';
      default:
        return 'canceled';
    }
  }

  public async activatePlan(
    userId: string,
    planType: SubscriptionPlan,
    headers: IRequestHeaders,
    options: SubscriptionUpdateOptions = {}
  ) {
    const logMessage = constructLogMessage(__filename, 'activatePlan', headers);

    const subscription = await this.getOrCreateSubscription(userId);
    subscription.planType = planType;
    subscription.status = options.status ?? 'active';
    subscription.subscriptionDate = options.subscriptionDate ?? new Date();
    subscription.isTrialActive =
      options.isTrialActive ??
      (planType !== 'free' && Boolean(options.trialEndsAt && options.trialEndsAt > new Date()));
    subscription.trialEndsAt = options.trialEndsAt;

    if (Object.prototype.hasOwnProperty.call(options, 'stripeSubscriptionId')) {
      subscription.stripeSubscriptionId = options.stripeSubscriptionId;
    }

    if (Object.prototype.hasOwnProperty.call(options, 'stripeCustomerId')) {
      subscription.stripeCustomerId = options.stripeCustomerId;
    }

    await subscription.save();

    await UserModel.updateOne({ _id: userId }, { $set: { subscriptionPlan: planType } });

    this.log.info(`${logMessage} :: Activated plan ${planType} for user ${userId}`);
    return subscription;
  }
}
