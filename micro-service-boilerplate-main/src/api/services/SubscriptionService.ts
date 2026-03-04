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

import { PartnerProgramService } from './PartnerProgramService';
import { BillingCycle, StripeService } from './StripeService';

type PlanMetadata = {
  label: string;
  headline: string;
  description: string;
  features: string[];
};

type PlanCatalogEntry = {
  tier: SubscriptionPlan;
  name: string;
  headline: string;
  description: string;
  audience: string;
  recommended?: boolean;
  features: string[];
  pricing: {
    currency: 'USD';
    monthly: {
      amount: number;
      priceId?: string;
    };
    annual?: {
      amount: number;
      priceId?: string;
      savingsPercent: number;
    };
  };
  limits: {
    practiceSessionsPerMonth: number;
    simulationSessionsPerMonth: number;
    writingSubmissionsPerMonth: number;
    readingAttemptsPerMonth: number;
    listeningAttemptsPerMonth: number;
  };
};

const PLAN_METADATA: Record<SubscriptionPlan, PlanMetadata> = {
  free: {
    label: 'Free',
    headline: 'Build your IELTS baseline',
    description: 'Start with structured practice and progress tracking before upgrading.',
    features: [
      '3 practice sessions / week (12 per month baseline)',
      '1 speaking simulation / month',
      '2 writing submissions / month',
      '2 reading and 2 listening attempts / month'
    ]
  },
  starter: {
    label: 'Starter',
    headline: 'Affordable foundation with guided feedback',
    description: 'Bridge plan for price-sensitive learners with basic AI feedback and essential practice coverage.',
    features: [
      'Basic AI feedback across all IELTS modules',
      'Structured daily practice without advanced analytics',
      'Core progress tracking for consistency'
    ]
  },
  premium: {
    label: 'Premium',
    headline: 'Consistent learner momentum',
    description: 'Full AI evaluation across all modules with deeper analytics and progress insights.',
    features: [
      'Full AI evaluation for speaking, writing, reading, and listening',
      'Detailed rubric feedback and targeted weaknesses',
      'Progress tracking and cross-module history'
    ]
  },
  pro: {
    label: 'Pro',
    headline: 'Advanced acceleration with personalized strategy',
    description: 'Advanced analytics, priority AI scoring, custom study plans, and score prediction for exam sprints.',
    features: [
      'Everything in Premium with priority scoring throughput',
      'Advanced analytics and full mock readiness',
      'Custom study plans and score prediction',
      'Band Score Improvement Guarantee included'
    ]
  },
  team: {
    label: 'Team',
    headline: 'Small cohorts and coaching teams',
    description: 'Coach dashboard and student management for mentor-led cohorts and institutions.',
    features: [
      'Everything in Pro with shared throughput',
      'Coach dashboard and student management',
      'Group analytics and operational support'
    ]
  }
};

const PLAN_PRICE_BOOK: Record<Exclude<SubscriptionPlan, 'free'>, { monthly: number; annual: number }> = {
  starter: { monthly: 9, annual: 90 },
  premium: { monthly: 24, annual: 240 },
  pro: { monthly: 49, annual: 490 },
  team: { monthly: 99, annual: 990 }
};

const PLAN_AUDIENCE: Record<SubscriptionPlan, string> = {
  free: 'New learners evaluating the platform',
  starter: 'Price-sensitive learners needing guided daily prep',
  premium: 'Daily independent IELTS learners',
  pro: 'High-frequency learners targeting faster band gains',
  team: 'Coaches, institutions, and study cohorts'
};

const PLAN_LIMITS: PlanCatalogEntry['limits'] = {
  practiceSessionsPerMonth: 12,
  simulationSessionsPerMonth: 1,
  writingSubmissionsPerMonth: 2,
  readingAttemptsPerMonth: 2,
  listeningAttemptsPerMonth: 2
};

const PAID_PLAN_LIMITS: PlanCatalogEntry['limits'] = {
  practiceSessionsPerMonth: -1,
  simulationSessionsPerMonth: -1,
  writingSubmissionsPerMonth: -1,
  readingAttemptsPerMonth: -1,
  listeningAttemptsPerMonth: -1
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

  constructor(
    private readonly stripeService: StripeService,
    private readonly partnerProgramService: PartnerProgramService
  ) {}

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
    const enabled = this.stripeService.isConfigured();
    const mode = this.stripeService.getMode();
    const priceMatrix = {
      starter: {
        monthly: this.stripeService.getPriceId('starter', 'monthly'),
        annual: this.stripeService.getPriceId('starter', 'annual')
      },
      premium: {
        monthly: this.stripeService.getPriceId('premium', 'monthly'),
        annual: this.stripeService.getPriceId('premium', 'annual')
      },
      pro: {
        monthly: this.stripeService.getPriceId('pro', 'monthly'),
        annual: this.stripeService.getPriceId('pro', 'annual')
      },
      team: {
        monthly: this.stripeService.getPriceId('team', 'monthly'),
        annual: this.stripeService.getPriceId('team', 'annual')
      }
    };

    return {
      enabled,
      mode,
      publishableKey: this.stripeService.getPublishableKey(),
      portalEnabled: enabled && mode !== 'disabled',
      billingPortalReturnUrl: env.payments?.stripe?.billingPortalReturnUrl,
      prices: {
        starter: priceMatrix.starter.monthly,
        premium: priceMatrix.premium.monthly,
        pro: priceMatrix.pro.monthly,
        team: priceMatrix.team.monthly
      },
      priceMatrix,
      plans: this.getPlansCatalog().map(plan => ({
        tier: plan.tier,
        name: plan.name,
        price: plan.pricing.monthly.amount,
        currency: plan.pricing.currency.toLowerCase(),
        description: plan.description,
        features: plan.features,
        limits: {
          practice: plan.limits.practiceSessionsPerMonth,
          simulation: plan.limits.simulationSessionsPerMonth
        }
      }))
    };
  }

  public getPlansCatalog(): PlanCatalogEntry[] {
    return (Object.keys(PLAN_METADATA) as SubscriptionPlan[]).map(planType => {
      const metadata = PLAN_METADATA[planType];
      const isFree = planType === 'free';

      if (isFree) {
        return {
          tier: planType,
          name: metadata.label,
          headline: metadata.headline,
          description: metadata.description,
          audience: PLAN_AUDIENCE[planType],
          features: metadata.features,
          pricing: {
            currency: 'USD',
            monthly: {
              amount: 0
            }
          },
          limits: PLAN_LIMITS
        };
      }

      const priceBook = PLAN_PRICE_BOOK[planType];
      const annualSavingsPercent = Math.max(0, Math.round((1 - priceBook.annual / (priceBook.monthly * 12)) * 100));

      return {
        tier: planType,
        name: metadata.label,
        headline: metadata.headline,
        description: metadata.description,
        audience: PLAN_AUDIENCE[planType],
        recommended: planType === 'pro',
        features: metadata.features,
        pricing: {
          currency: 'USD',
          monthly: {
            amount: priceBook.monthly,
            priceId: this.stripeService.getPriceId(planType, 'monthly')
          },
          annual: {
            amount: priceBook.annual,
            priceId: this.stripeService.getPriceId(planType, 'annual'),
            savingsPercent: annualSavingsPercent
          }
        },
        limits: PAID_PLAN_LIMITS
      };
    });
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
    options?: {
      successUrl?: string;
      cancelUrl?: string;
      billingCycle?: BillingCycle;
      partnerCode?: string;
      couponCode?: string;
    }
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

    const billingCycle = options?.billingCycle || 'monthly';
    const successUrl =
      options?.successUrl ||
      env.payments?.stripe?.defaultSuccessUrl ||
      `${env.app.schema}://${env.app.host}/payments/success`;
    const cancelUrl =
      options?.cancelUrl ||
      env.payments?.stripe?.defaultCancelUrl ||
      `${env.app.schema}://${env.app.host}/payments/cancel`;
    const idempotencyKey = `checkout:${userId}:${planType}:${billingCycle}:${headers.urc}`;

    const partnerProgramEnabled = await this.partnerProgramService.isEnabled();
    let attributionContext: Awaited<ReturnType<typeof this.partnerProgramService.getLatestAttributionForUser>> | null = null;

    if (partnerProgramEnabled) {
      if (options?.partnerCode) {
        attributionContext = await this.partnerProgramService.recordAttributionTouch({
          code: options.partnerCode,
          source: 'checkout',
          userId,
          email: user.email,
          strict: true
        });
      } else {
        attributionContext = await this.partnerProgramService.getLatestAttributionForUser(userId);
      }
    } else if (options?.partnerCode) {
      throw new CSError(HTTP_STATUS_CODES.BAD_REQUEST, CODES.InvalidBody, 'Partner program is not available yet');
    }

    const promotionCodeId = partnerProgramEnabled
      ? await this.partnerProgramService.resolvePromotionCodeIdForCheckout(this.stripeService, {
          partnerCodeDoc: attributionContext?.partnerCode || undefined,
          couponCode: options?.couponCode
        })
      : options?.couponCode
        ? await this.stripeService.findPromotionCodeIdByCode(options.couponCode.trim().toUpperCase())
        : undefined;

    const session = await this.stripeService.createCheckoutSession({
      userId,
      planType,
      billingCycle,
      successUrl,
      cancelUrl,
      customerId: subscription.stripeCustomerId,
      customerEmail: user.email,
      idempotencyKey,
      promotionCodeId,
      couponCode: options?.couponCode?.trim().toUpperCase(),
      partnerAttribution: attributionContext
        ? {
            partnerId: attributionContext.partner._id.toString(),
            partnerCodeId: attributionContext.partnerCode._id.toString(),
            partnerCode: attributionContext.partnerCode.code
          }
        : undefined
    });

    this.log.info(`${logMessage} :: Created Stripe checkout session ${session.id} for plan ${planType}/${billingCycle}`);

    return {
      sessionId: session.id,
      checkoutUrl: session.url,
      publishableKey: this.stripeService.getPublishableKey(),
      billingCycle
    };
  }

  public async createPortalSession(userId: string, headers: IRequestHeaders, returnUrl?: string) {
    const logMessage = constructLogMessage(__filename, 'createPortalSession', headers);

    if (!this.stripeService.isConfigured()) {
      throw new CSError(
        HTTP_STATUS_CODES.SERVICE_UNAVAILABLE,
        CODES.StripeError,
        'Stripe integration is not configured'
      );
    }

    const subscription = await this.getOrCreateSubscription(userId);
    if (!subscription.stripeCustomerId) {
      throw new CSError(
        HTTP_STATUS_CODES.BAD_REQUEST,
        CODES.InvalidBody,
        'No Stripe customer is linked to this account yet'
      );
    }

    const resolvedReturnUrl =
      returnUrl || env.payments?.stripe?.billingPortalReturnUrl || `${env.app.schema}://${env.app.host}/app/billing`;

    const portalSession = await this.stripeService.createBillingPortalSession({
      customerId: subscription.stripeCustomerId,
      returnUrl: resolvedReturnUrl
    });

    this.log.info(`${logMessage} :: Created Stripe billing portal session for user ${userId}`);

    return {
      portalUrl: portalSession.url
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
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.billing_reason !== 'subscription_create') {
          this.log.debug(`${logMessage} :: Ignoring invoice.paid event ${invoice.id} with reason ${invoice.billing_reason}`);
          break;
        }

        if (!(await this.partnerProgramService.isEnabled())) {
          break;
        }

        try {
          const rawInvoice = invoice as unknown as { subscription?: string | { id?: string } };
          const subscriptionId =
            typeof rawInvoice.subscription === 'string' ? rawInvoice.subscription : rawInvoice.subscription?.id;

          let metadata: {
            userId?: string;
            partnerId?: string;
            partnerCodeId?: string;
            partnerCode?: string;
          } = {
            userId: invoice.metadata?.userId,
            partnerId: invoice.metadata?.partnerId,
            partnerCodeId: invoice.metadata?.partnerCodeId,
            partnerCode: invoice.metadata?.partnerCode
          };

          if (subscriptionId) {
            const stripeSubscription = await this.stripeService.getSubscription(subscriptionId);
            metadata = {
              userId: stripeSubscription.metadata?.userId || metadata.userId,
              partnerId: stripeSubscription.metadata?.partnerId || metadata.partnerId,
              partnerCodeId: stripeSubscription.metadata?.partnerCodeId || metadata.partnerCodeId,
              partnerCode: stripeSubscription.metadata?.partnerCode || metadata.partnerCode
            };
          }

          await this.partnerProgramService.recordConversionFromInvoice({
            eventId: event.id,
            eventType: event.type,
            invoice,
            metadata
          });
        } catch (error) {
          this.log.error(`${logMessage} :: Failed to process partner conversion from invoice.paid`, { error });
        }
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
