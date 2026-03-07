'use client';

import { useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/components/auth/AuthProvider';
import { apiRequest, ApiError } from '@/lib/api/client';
import { PageHeader, SectionCard, StatusBadge } from '@/components/ui/v2';
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
    <div className="space-y-6">
      {/* ── Page header ── */}
      <PageHeader
        title="Subscription & Billing"
        subtitle="Manage your plan, track your study usage, and keep your practice on schedule."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone="brand">Plan overview</StatusBadge>
            {stripeConfig?.enabled ? <StatusBadge tone="success">Billing available</StatusBadge> : <StatusBadge tone="neutral">Billing unavailable</StatusBadge>}
            {currentSubscription ? <StatusBadge tone="neutral">Your plan: {currentSubscription.planType}</StatusBadge> : null}
          </div>
        }
      />

      {summary ? (
        <SectionCard title="Current Usage">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-violet-100 dark:bg-violet-500/20 px-2.5 py-0.5 text-xs font-semibold text-violet-700 dark:text-violet-300">Plan: {summary.plan}</span>
              <span className="rounded-full bg-gray-100 dark:bg-gray-800 px-2.5 py-0.5 text-xs font-semibold text-gray-600 dark:text-gray-400">Practice: {summary.practiceCount}/{summary.practiceLimit}</span>
              <span className="rounded-full bg-gray-100 dark:bg-gray-800 px-2.5 py-0.5 text-xs font-semibold text-gray-600 dark:text-gray-400">Tests: {summary.testCount}/{summary.testLimit}</span>
              <span className="rounded-full bg-gray-100 dark:bg-gray-800 px-2.5 py-0.5 text-xs font-semibold text-gray-600 dark:text-gray-400">Billing status: {currentSubscription?.status || '-'}</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Writing {summary.writingCount}/{summary.writingLimit} | Reading {summary.readingCount}/{summary.readingLimit} |
              Listening {summary.listeningCount}/{summary.listeningLimit}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {stripeConfig?.portalEnabled
                ? 'You can update payment details and manage renewals from the billing portal.'
                : 'Billing portal access is not available right now.'}
            </p>
            {stripeConfig?.portalEnabled ? (
              <div className="mt-2">
                <button className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50" onClick={() => void openBillingPortal()} disabled={openingPortal}>
                  {openingPortal ? 'Opening portal...' : 'Manage Billing'}
                </button>
              </div>
            ) : null}
          </div>
        </SectionCard>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SectionCard title="Choose Billing Cycle">
          <div className="flex gap-2">
            <button className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${billingCycle === 'monthly' ? 'bg-violet-600 text-white shadow-md' : 'border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`} onClick={() => setBillingCycle('monthly')}>Monthly</button>
            <button className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${billingCycle === 'annual' ? 'bg-violet-600 text-white shadow-md' : 'border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`} onClick={() => setBillingCycle('annual')}>Annual</button>
          </div>
        </SectionCard>

        <SectionCard title="Optional Checkout Codes">
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Coupon code</span>
              <input className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500/40" value={checkoutCouponCode} onChange={event => setCheckoutCouponCode(event.target.value.toUpperCase())} placeholder="SAVE20" />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Partner code</span>
              <input className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500/40" value={checkoutPartnerCode} onChange={event => setCheckoutPartnerCode(event.target.value.toUpperCase())} placeholder="INSTITUTE01" />
            </label>
          </div>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            <SectionCard key={plan.tier} className={`flex h-full flex-col transform transition-all duration-300 hover:-translate-y-1 [&>div:last-child]:flex [&>div:last-child]:h-full [&>div:last-child]:flex-1 [&>div:last-child]:flex-col ${plan.recommended ? 'relative border-2 border-violet-400/50 shadow-violet-500/10 shadow-xl' : 'border-gray-200/80 shadow-sm'}`}>
              <div className="flex-1 space-y-4">
                {plan.recommended ? (
                  <div className="absolute -top-3 inset-x-0 flex justify-center">
                    <span className="rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white shadow-md">
                      Most Popular
                    </span>
                  </div>
                ) : null}
                <div>
                  <h3 className="text-xl font-extrabold text-gray-900 dark:text-white">{plan.name}</h3>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{plan.headline}</p>
                </div>
                <div className="pt-2 pb-4">
                  <p className="flex items-baseline gap-1 text-gray-900 dark:text-white">
                    <span className="text-4xl font-black tracking-tight">{selectedPriceLabel.split('/')[0]}</span>
                    <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">/{selectedPriceLabel.split('/')[1]}</span>
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 min-h-10">{plan.description}</p>
                </div>
                <div className="flex flex-wrap gap-1.5 pb-2">
                  {billingCycle === 'annual' && plan.pricing.annual ? <StatusBadge tone="success">Save {plan.pricing.annual.savingsPercent}%</StatusBadge> : null}
                  {isCurrentPlan ? <StatusBadge tone="info">Current plan</StatusBadge> : null}
                </div>
                <ul className="space-y-3">
                  {plan.features.map(feature => (
                    <li key={feature} className="flex items-start gap-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                      <span className="material-symbols-outlined text-[18px] text-emerald-500 shrink-0">check_circle</span>
                      <span className="leading-snug">{feature}</span>
                    </li>
                  ))}
                </ul>
                <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
                  <p className="text-[11px] font-medium leading-relaxed text-gray-400 dark:text-gray-500">
                    <span className="font-bold text-gray-500 dark:text-gray-400">Limits:</span> Speaking {formatLimit(plan.limits.practiceSessionsPerMonth)} /{' '}
                    {formatLimit(plan.limits.simulationSessionsPerMonth)} sims, Writing{' '}
                    {formatLimit(plan.limits.writingSubmissionsPerMonth)}, Reading {formatLimit(plan.limits.readingAttemptsPerMonth)},
                    Listening {formatLimit(plan.limits.listeningAttemptsPerMonth)}
                  </p>
                </div>
              </div>
              <div className="pt-6 mt-auto">
                {isPaidPlan ? (
                  <button
                    className={`w-full rounded-xl px-5 py-3 text-sm font-bold shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed ${plan.recommended
                        ? 'bg-violet-600 text-white hover:bg-violet-700 shadow-violet-500/25'
                        : 'bg-gray-900 text-white hover:bg-black dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100'
                      }`}
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
                ) : (
                  <div className="w-full text-center py-3 text-sm font-bold text-gray-400 dark:text-gray-500">
                    Included with signup
                  </div>
                )}
              </div>
            </SectionCard>
          );
        })}
      </div>

      {error ? <div className="rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-400">{error}</div> : null}
      {success ? <div className="rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">{success}</div> : null}
    </div>
  );
}
