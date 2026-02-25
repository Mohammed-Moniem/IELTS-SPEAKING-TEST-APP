'use client';

import { useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/components/auth/AuthProvider';
import { apiRequest, ApiError } from '@/lib/api/client';
import {
  BillingCycle,
  StripeConfiguration,
  SubscriptionPlan,
  SubscriptionPlanCatalogEntry,
  SubscriptionPlanCatalogResponse,
  UsageSummary
} from '@/lib/types';

type CurrentSubscription = {
  planType: SubscriptionPlan;
  status: string;
  metadata?: {
    label: string;
    headline: string;
    description: string;
    features: string[];
  };
  stripe?: StripeConfiguration;
};

type CheckoutSessionResponse = {
  sessionId: string;
  checkoutUrl: string;
  billingCycle: BillingCycle;
};

type PortalSessionResponse = {
  portalUrl: string;
};

export default function BillingPage() {
  const { refreshAppConfig } = useAuth();
  const [plans, setPlans] = useState<SubscriptionPlanCatalogEntry[]>([]);
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [currentSubscription, setCurrentSubscription] = useState<CurrentSubscription | null>(null);
  const [stripeConfig, setStripeConfig] = useState<StripeConfiguration | null>(null);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [checkoutCouponCode, setCheckoutCouponCode] = useState('');
  const [checkoutPartnerCode, setCheckoutPartnerCode] = useState('');
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [openingPortal, setOpeningPortal] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const checkoutState = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    return params.get('checkout');
  }, []);

  const loadBilling = async () => {
    setError('');
    try {
      const [planPayload, usageSummary, subscription, stripe] = await Promise.all([
        apiRequest<SubscriptionPlanCatalogResponse>('/subscription/plans'),
        apiRequest<UsageSummary>('/usage/summary'),
        apiRequest<CurrentSubscription>('/subscription/current'),
        apiRequest<StripeConfiguration>('/subscription/config')
      ]);

      setPlans(planPayload.plans || []);
      setSummary(usageSummary);
      setCurrentSubscription(subscription);
      setStripeConfig(stripe);
    } catch (err: any) {
      setError(err?.message || 'Unable to load billing data');
    }
  };

  const startCheckout = async (planType: SubscriptionPlan, cycle: BillingCycle) => {
    if (planType === 'free') return;

    setError('');
    setSuccess('');
    setLoadingPlan(`${planType}:${cycle}`);
    try {
      const origin = window.location.origin;
      const payload = await apiRequest<CheckoutSessionResponse>('/subscription/checkout', {
        method: 'POST',
        body: JSON.stringify({
          planType,
          billingCycle: cycle,
          successUrl: `${origin}/app/billing?checkout=success&plan=${planType}`,
          cancelUrl: `${origin}/app/billing?checkout=cancel&plan=${planType}`,
          couponCode: checkoutCouponCode.trim() ? checkoutCouponCode.trim().toUpperCase() : undefined,
          partnerCode: checkoutPartnerCode.trim() ? checkoutPartnerCode.trim().toUpperCase() : undefined
        })
      });

      if (!payload.checkoutUrl) {
        throw new Error('Checkout URL was not returned by the server.');
      }

      window.location.href = payload.checkoutUrl;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to start checkout flow.';
      setError(message);
    } finally {
      setLoadingPlan(null);
    }
  };

  const openBillingPortal = async () => {
    setError('');
    setSuccess('');
    setOpeningPortal(true);
    try {
      const origin = window.location.origin;
      const payload = await apiRequest<PortalSessionResponse>('/subscription/portal', {
        method: 'POST',
        body: JSON.stringify({
          returnUrl: `${origin}/app/billing`
        })
      });

      if (!payload.portalUrl) {
        throw new Error('Billing portal URL was not returned.');
      }

      window.location.href = payload.portalUrl;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Unable to open billing portal.';
      setError(message);
    } finally {
      setOpeningPortal(false);
    }
  };

  const formatLimit = (value: number) => (value < 0 ? 'Unlimited' : value.toString());

  useEffect(() => {
    void loadBilling();
  }, []);

  useEffect(() => {
    if (!checkoutState) return;

    if (checkoutState === 'success') {
      setSuccess('Checkout completed. Subscription state is refreshing.');
      void (async () => {
        await loadBilling();
        await refreshAppConfig();
      })();
    }

    if (checkoutState === 'cancel') {
      setError('Checkout was cancelled. No billing changes were applied.');
    }
  }, [checkoutState, refreshAppConfig]);

  return (
    <section className="section-wrap">
      <div className="panel hero-panel stack">
        <span className="tag">Billing + entitlement</span>
        <h1>Stripe checkout and package management</h1>
        <p className="subtitle">
          Full local test-mode flow with checkout return handling, customer portal access, and entitlement refresh.
        </p>
        <div>
          <span className="tag">Stripe: {stripeConfig?.enabled ? 'Connected' : 'Not configured'}</span>
          {stripeConfig?.enabled ? <span className="tag">Mode: {stripeConfig.mode}</span> : null}
          {currentSubscription ? <span className="tag">Current: {currentSubscription.planType}</span> : null}
        </div>
      </div>

      {summary ? (
        <div className="panel stack">
          <h3>Current usage</h3>
          <p>
            <span className="tag">Plan: {summary.plan}</span>
            <span className="tag">Practice: {summary.practiceCount}/{summary.practiceLimit}</span>
            <span className="tag">Tests: {summary.testCount}/{summary.testLimit}</span>
            <span className="tag">Billing status: {currentSubscription?.status || '-'}</span>
          </p>
          <p className="small">
            Writing {summary.writingCount}/{summary.writingLimit} | Reading {summary.readingCount}/{summary.readingLimit} |
            Listening {summary.listeningCount}/{summary.listeningLimit}
          </p>
          <p className="small">
            Stripe mode: {stripeConfig?.mode || 'unknown'} | Portal: {stripeConfig?.portalEnabled ? 'Available' : 'Unavailable'}
          </p>
          {stripeConfig?.portalEnabled ? (
            <div className="cta-row">
              <button className="btn btn-secondary" onClick={() => void openBillingPortal()} disabled={openingPortal}>
                {openingPortal ? 'Opening portal...' : 'Manage billing'}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="panel stack">
        <h3>Choose billing cycle</h3>
        <div className="cta-row">
          <button
            className={billingCycle === 'monthly' ? 'btn btn-primary' : 'btn btn-secondary'}
            onClick={() => setBillingCycle('monthly')}
          >
            Monthly
          </button>
          <button
            className={billingCycle === 'annual' ? 'btn btn-primary' : 'btn btn-secondary'}
            onClick={() => setBillingCycle('annual')}
          >
            Annual
          </button>
        </div>
      </div>

      <div className="panel stack">
        <h3>Optional checkout codes</h3>
        <div className="grid-2">
          <label className="stack">
            <span>Coupon code</span>
            <input
              className="input"
              value={checkoutCouponCode}
              onChange={event => setCheckoutCouponCode(event.target.value.toUpperCase())}
              placeholder="SAVE20"
            />
          </label>
          <label className="stack">
            <span>Partner code</span>
            <input
              className="input"
              value={checkoutPartnerCode}
              onChange={event => setCheckoutPartnerCode(event.target.value.toUpperCase())}
              placeholder="INSTITUTE01"
            />
          </label>
        </div>
      </div>

      <div className="grid-3">
        {plans.map(plan => {
          const isCurrentPlan = currentSubscription?.planType === plan.tier;
          const isPaidPlan = plan.tier !== 'free';
          const selectedPrice = billingCycle === 'annual' ? plan.pricing.annual || plan.pricing.monthly : plan.pricing.monthly;
          const cycleHasPriceId = isPaidPlan
            ? billingCycle === 'annual'
              ? Boolean(plan.pricing.annual?.priceId)
              : Boolean(plan.pricing.monthly.priceId)
            : true;
          const selectedPriceLabel =
            billingCycle === 'annual' && plan.pricing.annual
              ? `$${plan.pricing.annual.amount}/year`
              : `$${selectedPrice.amount}/month`;
          const cardLoadingKey = `${plan.tier}:${billingCycle}`;
          const isDisabled =
            !!loadingPlan ||
            (isPaidPlan && (!stripeConfig?.enabled || !cycleHasPriceId || (isCurrentPlan && currentSubscription?.status === 'active')));

          return (
            <article key={plan.tier} className="panel stack">
              <div>
                <h3>{plan.name}</h3>
                <p className="small">{plan.headline}</p>
              </div>
              <p className="kpi">{selectedPriceLabel}</p>
              <p className="small">{plan.description}</p>
              {plan.recommended ? <span className="tag">Recommended</span> : null}
              {billingCycle === 'annual' && plan.pricing.annual ? (
                <span className="tag">Save {plan.pricing.annual.savingsPercent}%</span>
              ) : null}
              {isCurrentPlan ? <span className="tag">Current plan</span> : null}
              <ul>
                {plan.features.map(feature => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
              <p className="small">
                Limits: Speaking {formatLimit(plan.limits.practiceSessionsPerMonth)} practice /{' '}
                {formatLimit(plan.limits.simulationSessionsPerMonth)} simulations, Writing{' '}
                {formatLimit(plan.limits.writingSubmissionsPerMonth)}, Reading {formatLimit(plan.limits.readingAttemptsPerMonth)},
                Listening {formatLimit(plan.limits.listeningAttemptsPerMonth)}
              </p>
              {isPaidPlan ? (
                <button
                  className="btn btn-primary"
                  onClick={() => void startCheckout(plan.tier, billingCycle)}
                  disabled={isDisabled}
                >
                  {loadingPlan === cardLoadingKey
                    ? 'Redirecting...'
                    : isCurrentPlan && currentSubscription?.status === 'active'
                      ? 'Current plan'
                      : !stripeConfig?.enabled
                        ? 'Stripe unavailable'
                        : !cycleHasPriceId
                          ? 'Cycle unavailable'
                          : `Choose ${plan.name}`}
                </button>
              ) : null}
            </article>
          );
        })}
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}
      {success ? <div className="alert alert-success">{success}</div> : null}
    </section>
  );
}
