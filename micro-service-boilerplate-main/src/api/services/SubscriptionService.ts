import { Service } from 'typedi';

import { env } from '@env';
import { CSError } from '@errors/CSError';
import { CODES, HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { constructLogMessage } from '@lib/env/helpers';
import { Logger } from '@lib/logger';
import { getSupabaseAdmin } from '@lib/supabaseClient';

import { StripeService } from './StripeService';

export type SubscriptionPlan = 'free' | 'premium' | 'pro';

const PLAN_METADATA: Record<SubscriptionPlan, { label: string; features: string[] }> = {
  free: {
    label: 'Free',
    features: ['3 practice sessions / month', '1 mock test / month']
  },
  premium: {
    label: 'Premium',
    features: ['Unlimited practice sessions', '10 mock tests / month', 'Enhanced AI feedback']
  },
  pro: {
    label: 'Pro',
    features: ['Unlimited practice sessions', 'Unlimited mock tests', 'Priority feedback queue']
  }
};

type StripeConfiguration = {
  enabled: boolean;
  publishableKey?: string;
  prices: {
    premium?: string;
    pro?: string;
  };
};

@Service()
export class SubscriptionService {
  private log = new Logger(__filename);

  constructor(private readonly stripeService: StripeService) {}

  public getStripeConfiguration(): StripeConfiguration {
    // Payments are intentionally disabled for this app right now.
    if (env.payments?.disabled) {
      return {
        enabled: false,
        prices: {}
      };
    }

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

    const supabase = getSupabaseAdmin();
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('subscription_plan, created_at')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      this.log.error(`${logMessage} :: Failed to fetch profile for subscription`, { error: error.message });
      throw new CSError(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR, CODES.GenericErrorMessage, 'Failed to load subscription');
    }

    const planType = (profile?.subscription_plan as SubscriptionPlan | undefined) || 'free';
    const stripe = this.getStripeConfiguration();

    return {
      planType,
      status: 'active',
      isTrialActive: false,
      subscriptionDate: profile?.created_at || new Date().toISOString(),
      trialEndsAt: undefined,
      metadata: PLAN_METADATA[planType],
      stripe
    };
  }

  public async createCheckoutSession(
    _userId: string,
    _planType: SubscriptionPlan,
    headers: IRequestHeaders
  ): Promise<{ sessionId: string; checkoutUrl?: string | null; publishableKey?: string | null }> {
    const logMessage = constructLogMessage(__filename, 'createCheckoutSession', headers);

    this.log.warn(`${logMessage} :: Billing is disabled; refusing to create Stripe checkout session`);
    throw new CSError(HTTP_STATUS_CODES.SERVICE_UNAVAILABLE, CODES.NotImplemented, 'Billing is disabled');
  }

  public async activatePlan(_userId: string, _planType: SubscriptionPlan, headers: IRequestHeaders) {
    const logMessage = constructLogMessage(__filename, 'activatePlan', headers);
    this.log.warn(`${logMessage} :: Billing is disabled; activatePlan is not supported`);
    throw new CSError(HTTP_STATUS_CODES.SERVICE_UNAVAILABLE, CODES.NotImplemented, 'Billing is disabled');
  }
}
