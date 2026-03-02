'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

import { ApiError, webApi } from '@/lib/api/client';
import { useAuth } from '@/components/auth/AuthProvider';
import { type FieldErrors, validateAdvertiserCampaign, isValid } from '@/lib/validation';
import {
  PageHeader,
  SectionCard,
  MetricCard,
  StatusBadge,
  SegmentedTabs,
  EmptyState,
  ErrorState,
  SkeletonSet
} from '@/components/ui/v2';

import type {
  AdvertiserSubscriptionView,
  AdvertiserCampaignListResponse,
  AdvertiserAnalyticsView,
  AdPackageRecord
} from '@/lib/types';

type DashboardTab = 'overview' | 'campaigns' | 'new_campaign' | 'analytics' | 'billing';

const TAB_OPTIONS: Array<{ value: DashboardTab; label: string }> = [
  { value: 'overview', label: 'Overview' },
  { value: 'campaigns', label: 'Campaigns' },
  { value: 'new_campaign', label: 'New Campaign' },
  { value: 'analytics', label: 'Analytics' },
  { value: 'billing', label: 'Billing' }
];

const STATUS_TONE: Record<string, 'success' | 'warning' | 'neutral' | 'danger' | 'info' | 'brand'> = {
  active: 'success',
  pending_review: 'warning',
  draft: 'neutral',
  rejected: 'danger',
  paused: 'info',
  completed: 'brand',
  approved: 'brand',
  scheduled: 'brand'
};

const BILLING_STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  active: 'success',
  trialing: 'success',
  past_due: 'warning',
  unpaid: 'danger',
  canceled: 'danger',
  unknown: 'neutral'
};

function formatDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatStatus(status: string) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function AdvertiserDashboardPage() {
  const { refreshAppConfig } = useAuth();

  const [tab, setTab] = useState<DashboardTab>('overview');
  const [subscription, setSubscription] = useState<AdvertiserSubscriptionView | null>(null);
  const [campaigns, setCampaigns] = useState<AdvertiserCampaignListResponse | null>(null);
  const [analytics, setAnalytics] = useState<AdvertiserAnalyticsView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Campaign form state
  const [cfName, setCfName] = useState('');
  const [cfHeadline, setCfHeadline] = useState('');
  const [cfDescription, setCfDescription] = useState('');
  const [cfCtaUrl, setCfCtaUrl] = useState('');
  const [cfCtaLabel, setCfCtaLabel] = useState('');
  const [cfStartsAt, setCfStartsAt] = useState('');
  const [cfEndsAt, setCfEndsAt] = useState('');
  const [cfFieldErrors, setCfFieldErrors] = useState<FieldErrors>({});
  const [cfSubmitting, setCfSubmitting] = useState(false);
  const [cfSuccess, setCfSuccess] = useState('');
  const [cfError, setCfError] = useState('');

  // Billing portal state
  const [portalLoading, setPortalLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const sub = await webApi.getAdvertiserSubscription();
      setSubscription(sub);

      if (sub.hasAccount) {
        const [camp, anal] = await Promise.all([
          webApi.listAdvertiserCampaigns({ limit: 50, offset: 0 }),
          webApi.getAdvertiserAnalytics()
        ]);
        setCampaigns(camp);
        setAnalytics(anal);
      }
    } catch (err: unknown) {
      const message = err instanceof ApiError ? err.message : 'Failed to load advertiser data.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const activePackage: AdPackageRecord | null = subscription?.activePackage ?? null;
  const advertiser = subscription?.advertiser;
  const stripe = subscription?.stripeSubscription;

  const submitCampaign = async (event: FormEvent) => {
    event.preventDefault();
    setCfError('');
    setCfSuccess('');

    const packageId = activePackage?.id || '';
    const fe = validateAdvertiserCampaign({ name: cfName, packageId, headline: cfHeadline, ctaUrl: cfCtaUrl });
    setCfFieldErrors(fe);
    if (!isValid(fe)) return;

    setCfSubmitting(true);
    try {
      await webApi.submitAdvertiserCampaign({
        name: cfName.trim(),
        packageId,
        headline: cfHeadline.trim(),
        description: cfDescription.trim() || undefined,
        ctaUrl: cfCtaUrl.trim(),
        ctaLabel: cfCtaLabel.trim() || undefined,
        startsAt: cfStartsAt || undefined,
        endsAt: cfEndsAt || undefined
      });
      setCfSuccess('Campaign submitted for review. You will be notified once approved.');
      setCfName('');
      setCfHeadline('');
      setCfDescription('');
      setCfCtaUrl('');
      setCfCtaLabel('');
      setCfStartsAt('');
      setCfEndsAt('');
      setCfFieldErrors({});
      await load();
    } catch (err: unknown) {
      const message = err instanceof ApiError ? err.message : 'Failed to submit campaign.';
      setCfError(message);
    } finally {
      setCfSubmitting(false);
    }
  };

  const openBillingPortal = async () => {
    setPortalLoading(true);
    try {
      const { portalUrl } = await webApi.createAdvertiserBillingPortal({
        returnUrl: `${window.location.origin}/app/advertiser`
      });
      window.location.href = portalUrl;
    } catch (err: unknown) {
      const message = err instanceof ApiError ? err.message : 'Unable to open billing portal.';
      setError(message);
      setPortalLoading(false);
    }
  };

  const clearField = (key: string) => {
    setCfFieldErrors(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const inputClass = (field: string) =>
    `w-full rounded-xl border bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500/40 ${
      cfFieldErrors[field]
        ? 'border-red-400 dark:border-red-500'
        : 'border-gray-200 dark:border-gray-700'
    }`;

  /* ── Render ── */

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Advertiser Portal" subtitle="Loading your advertising dashboard..." />
        <SkeletonSet rows={6} />
      </div>
    );
  }

  if (error && !subscription) {
    return (
      <div className="space-y-6">
        <PageHeader title="Advertiser Portal" />
        <ErrorState body={error} onRetry={load} />
      </div>
    );
  }

  if (!subscription?.hasAccount) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Advertiser Portal"
          subtitle="Reach IELTS learners with sponsored placements across Spokio."
        />
        <EmptyState
          title="No advertiser account yet"
          body="Select a sponsorship package to get started. Once subscribed, you can manage campaigns, view analytics, and track billing here."
          action={
            <Link
              href="/advertise"
              className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 hover:bg-violet-700 transition-colors"
            >
              View sponsorship packages
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Advertiser Portal"
        subtitle="Manage campaigns, track performance, and handle billing."
        actions={<StatusBadge tone={BILLING_STATUS_TONE[advertiser?.billingStatus || 'unknown'] || 'neutral'}>{formatStatus(advertiser?.billingStatus || 'unknown')}</StatusBadge>}
      />

      {error ? <div className="rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-400">{error}</div> : null}

      <SegmentedTabs<DashboardTab> options={TAB_OPTIONS} value={tab} onChange={setTab} />

      {/* ── Overview Tab ── */}
      {tab === 'overview' ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <MetricCard tone="brand" label="Active campaigns" value={analytics?.totals.activeCampaigns ?? 0} />
            <MetricCard tone="neutral" label="Total impressions" value={(analytics?.totals.impressions ?? 0).toLocaleString()} />
            <MetricCard tone="success" label="Total clicks" value={(analytics?.totals.clicks ?? 0).toLocaleString()} />
            <MetricCard tone="info" label="CTR" value={`${(analytics?.totals.ctrPercent ?? 0).toFixed(2)}%`} />
          </div>

          <SectionCard title="Active Package">
            {activePackage ? (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="text-base font-bold text-gray-900 dark:text-white">{activePackage.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{activePackage.description}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {activePackage.features.map(f => (
                      <StatusBadge key={f} tone="neutral">{f}</StatusBadge>
                    ))}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-2xl font-extrabold text-violet-600 dark:text-violet-400">
                    ${activePackage.priceAmount}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400"> / {activePackage.billingType.replace('_subscription', '')}</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">No active package.</p>
            )}
          </SectionCard>

          <SectionCard title="Subscription Details">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-gray-500 dark:text-gray-400">Status</p>
                <p className="font-semibold text-gray-900 dark:text-white">{formatStatus(stripe?.status || advertiser?.status || 'unknown')}</p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">Current period ends</p>
                <p className="font-semibold text-gray-900 dark:text-white">{formatDate(stripe?.currentPeriodEnd)}</p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">Affiliate code</p>
                <p className="font-semibold text-gray-900 dark:text-white">{advertiser?.affiliateCode || '—'}</p>
              </div>
            </div>
          </SectionCard>
        </>
      ) : null}

      {/* ── Campaigns Tab ── */}
      {tab === 'campaigns' ? (
        <SectionCard title={`Campaigns (${campaigns?.total ?? 0})`} className="p-0 overflow-hidden">
          {campaigns?.items.length ? (
            <div className="overflow-x-auto border-t border-gray-100 dark:border-gray-800 -m-6 sm:-mx-6 sm:-mb-6 mt-0">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/30">
                    <th className="px-6 py-3 font-semibold text-gray-900 dark:text-white">Name</th>
                    <th className="px-6 py-3 font-semibold text-gray-900 dark:text-white">Status</th>
                    <th className="px-6 py-3 font-semibold text-gray-900 dark:text-white">Placement</th>
                    <th className="px-6 py-3 font-semibold text-gray-900 dark:text-white text-right">Impressions</th>
                    <th className="px-6 py-3 font-semibold text-gray-900 dark:text-white text-right">Clicks</th>
                    <th className="px-6 py-3 font-semibold text-gray-900 dark:text-white text-right">Conversions</th>
                    <th className="px-6 py-3 font-semibold text-gray-900 dark:text-white text-right">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {campaigns.items.map(c => (
                    <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{c.name}</td>
                      <td className="px-6 py-4"><StatusBadge tone={STATUS_TONE[c.status] || 'neutral'}>{formatStatus(c.status)}</StatusBadge></td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{formatStatus(c.placementType)}</td>
                      <td className="px-6 py-4 text-right text-gray-600 dark:text-gray-400">{c.metrics.impressions.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right text-gray-600 dark:text-gray-400">{c.metrics.clicks.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right text-gray-600 dark:text-gray-400">{c.metrics.conversions.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right text-gray-600 dark:text-gray-400">{formatDate(c.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-6">
              <EmptyState
                title="No campaigns yet"
                body="Submit your first campaign to start reaching IELTS learners."
                action={
                  <button
                    type="button"
                    onClick={() => setTab('new_campaign')}
                    className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 transition-colors"
                  >
                    Create campaign
                  </button>
                }
              />
            </div>
          )}
        </SectionCard>
      ) : null}

      {/* ── New Campaign Tab ── */}
      {tab === 'new_campaign' ? (
        <SectionCard title="Submit a new campaign">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Fill in your campaign details below. After submission, our team will review your creative and activate the campaign within 1-2 business days.
          </p>

          {cfSuccess ? <div className="rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400 mb-4">{cfSuccess}</div> : null}
          {cfError ? <div className="rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-400 mb-4">{cfError}</div> : null}

          <form className="space-y-4" onSubmit={submitCampaign}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Campaign name *</span>
                <input className={inputClass('name')} value={cfName} onChange={e => { setCfName(e.target.value); clearField('name'); }} placeholder="e.g. Summer IELTS Coaching Promo" />
                {cfFieldErrors.name ? <span className="text-xs text-red-600">{cfFieldErrors.name}</span> : null}
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Headline * <span className="text-gray-400 normal-case">(max 80 chars)</span></span>
                <input className={inputClass('headline')} value={cfHeadline} onChange={e => { setCfHeadline(e.target.value); clearField('headline'); }} placeholder="e.g. Get Band 7+ with Expert Coaching" maxLength={80} />
                {cfFieldErrors.headline ? <span className="text-xs text-red-600">{cfFieldErrors.headline}</span> : null}
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">CTA URL *</span>
                <input className={inputClass('ctaUrl')} value={cfCtaUrl} onChange={e => { setCfCtaUrl(e.target.value); clearField('ctaUrl'); }} placeholder="https://yoursite.com/offer" type="url" />
                {cfFieldErrors.ctaUrl ? <span className="text-xs text-red-600">{cfFieldErrors.ctaUrl}</span> : null}
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">CTA label (optional)</span>
                <input className={inputClass('ctaLabel')} value={cfCtaLabel} onChange={e => setCfCtaLabel(e.target.value)} placeholder="e.g. Learn More" />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Start date (optional)</span>
                <input className={inputClass('startsAt')} type="date" value={cfStartsAt} onChange={e => setCfStartsAt(e.target.value)} />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">End date (optional)</span>
                <input className={inputClass('endsAt')} type="date" value={cfEndsAt} onChange={e => setCfEndsAt(e.target.value)} />
              </label>
            </div>
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Description (optional)</span>
              <textarea className={`${inputClass('description')} h-24`} value={cfDescription} onChange={e => setCfDescription(e.target.value)} placeholder="Brief description of your campaign goal and target audience..." />
            </label>

            {activePackage ? (
              <div className="rounded-xl border border-violet-200 dark:border-violet-500/30 bg-violet-50 dark:bg-violet-500/10 px-4 py-3 text-sm">
                <span className="font-semibold text-violet-700 dark:text-violet-300">Package:</span>{' '}
                <span className="text-violet-600 dark:text-violet-400">{activePackage.name}</span>
                <span className="text-violet-500 dark:text-violet-400"> — {formatStatus(activePackage.placementType)} placement</span>
              </div>
            ) : null}

            <button
              className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 hover:bg-violet-700 transition-colors disabled:opacity-50"
              type="submit"
              disabled={cfSubmitting}
            >
              {cfSubmitting ? 'Submitting...' : 'Submit campaign for review'}
            </button>
          </form>
        </SectionCard>
      ) : null}

      {/* ── Analytics Tab ── */}
      {tab === 'analytics' ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <MetricCard tone="neutral" label="Impressions" value={(analytics?.totals.impressions ?? 0).toLocaleString()} />
            <MetricCard tone="success" label="Clicks" value={(analytics?.totals.clicks ?? 0).toLocaleString()} />
            <MetricCard tone="brand" label="CTR" value={`${(analytics?.totals.ctrPercent ?? 0).toFixed(2)}%`} />
            <MetricCard tone="warning" label="Spend to date" value={`$${(analytics?.totals.spendToDateUsd ?? 0).toFixed(2)}`} />
          </div>

          <SectionCard title="Campaign Performance" className="p-0 overflow-hidden">
            {analytics?.byCampaign.length ? (
              <div className="overflow-x-auto border-t border-gray-100 dark:border-gray-800 -m-6 sm:-mx-6 sm:-mb-6 mt-0">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/30">
                      <th className="px-6 py-3 font-semibold text-gray-900 dark:text-white">Campaign</th>
                      <th className="px-6 py-3 font-semibold text-gray-900 dark:text-white">Status</th>
                      <th className="px-6 py-3 font-semibold text-gray-900 dark:text-white text-right">Impressions</th>
                      <th className="px-6 py-3 font-semibold text-gray-900 dark:text-white text-right">Clicks</th>
                      <th className="px-6 py-3 font-semibold text-gray-900 dark:text-white text-right">Conversions</th>
                      <th className="px-6 py-3 font-semibold text-gray-900 dark:text-white text-right">CTR</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {analytics.byCampaign.map(c => (
                      <tr key={c.campaignId} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                        <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{c.campaignName}</td>
                        <td className="px-6 py-4"><StatusBadge tone={STATUS_TONE[c.status] || 'neutral'}>{formatStatus(c.status)}</StatusBadge></td>
                        <td className="px-6 py-4 text-right text-gray-600 dark:text-gray-400">{c.impressions.toLocaleString()}</td>
                        <td className="px-6 py-4 text-right text-gray-600 dark:text-gray-400">{c.clicks.toLocaleString()}</td>
                        <td className="px-6 py-4 text-right text-gray-600 dark:text-gray-400">{c.conversions.toLocaleString()}</td>
                        <td className="px-6 py-4 text-right text-gray-600 dark:text-gray-400">{c.ctr.toFixed(2)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-6">
                <p className="text-sm text-gray-500 dark:text-gray-400">No campaign analytics available yet. Analytics populate once campaigns go live.</p>
              </div>
            )}
          </SectionCard>
        </>
      ) : null}

      {/* ── Billing Tab ── */}
      {tab === 'billing' ? (
        <>
          <SectionCard title="Current Subscription">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Package</p>
                  <p className="text-base font-bold text-gray-900 dark:text-white mt-0.5">{activePackage?.name || 'None'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Billing status</p>
                  <div className="mt-0.5">
                    <StatusBadge tone={BILLING_STATUS_TONE[advertiser?.billingStatus || 'unknown'] || 'neutral'}>
                      {formatStatus(advertiser?.billingStatus || 'unknown')}
                    </StatusBadge>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Monthly budget</p>
                  <p className="text-base font-bold text-gray-900 dark:text-white mt-0.5">
                    {advertiser?.monthlyBudgetUsd ? `$${advertiser.monthlyBudgetUsd.toFixed(2)}` : '—'}
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Current period ends</p>
                  <p className="text-base font-bold text-gray-900 dark:text-white mt-0.5">{formatDate(stripe?.currentPeriodEnd)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Auto-renew</p>
                  <p className="text-base font-bold text-gray-900 dark:text-white mt-0.5">{stripe?.cancelAtPeriodEnd ? 'No (cancels at period end)' : 'Yes'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Last invoice</p>
                  <p className="text-base font-bold text-gray-900 dark:text-white mt-0.5">
                    {advertiser?.lastInvoiceStatus ? `${formatStatus(advertiser.lastInvoiceStatus)} — ${formatDate(advertiser.lastInvoiceAt)}` : '—'}
                  </p>
                </div>
              </div>
            </div>

            {(advertiser?.failedPaymentCount ?? 0) > 0 ? (
              <div className="mt-4 rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-400">
                <span className="material-symbols-outlined text-[16px] align-text-bottom mr-1">warning</span>
                {advertiser!.failedPaymentCount} failed payment attempt{advertiser!.failedPaymentCount! > 1 ? 's' : ''}. Please update your payment method.
              </div>
            ) : null}
          </SectionCard>

          <SectionCard title="Manage Billing">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Update your payment method, view invoices, or change your subscription through the Stripe billing portal.
            </p>
            <button
              type="button"
              onClick={openBillingPortal}
              disabled={portalLoading}
              className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 hover:bg-violet-700 transition-colors disabled:opacity-50"
            >
              {portalLoading ? 'Opening portal...' : 'Open billing portal'}
            </button>
          </SectionCard>

          <SectionCard title="Upgrade Package">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Want more placements or higher visibility? Explore our sponsorship packages.
            </p>
            <Link
              href="/advertise"
              className="inline-flex rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              View packages
            </Link>
          </SectionCard>
        </>
      ) : null}
    </div>
  );
}
