'use client';

import { useEffect, useState } from 'react';

import { ApiError, webApi } from '@/lib/api/client';
import type { AdAnalyticsView, AdCampaignListResponse, AdCampaignRecord } from '@/lib/types';
import { EmptyState, ErrorState, SkeletonSet } from '@/components/ui/v2';

const statusOptions: Array<AdCampaignRecord['status']> = [
  'draft',
  'pending_review',
  'approved',
  'scheduled',
  'active',
  'paused',
  'completed',
  'rejected'
];

export function AdminAdsManagerPage() {
  const [analytics, setAnalytics] = useState<AdAnalyticsView | null>(null);
  const [campaigns, setCampaigns] = useState<AdCampaignListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyCampaignId, setBusyCampaignId] = useState('');

  const [newPackage, setNewPackage] = useState({
    key: '',
    name: '',
    description: '',
    placementType: 'module_panel' as const,
    billingType: 'monthly_subscription' as const,
    currency: 'USD',
    priceAmount: 149
  });
  const [newCampaign, setNewCampaign] = useState({
    name: '',
    packageId: '',
    targeting: '',
    ctaUrl: ''
  });

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [analyticsPayload, campaignsPayload] = await Promise.all([
        webApi.getAdAnalytics(),
        webApi.listAdCampaigns({ limit: 40, offset: 0 })
      ]);
      setAnalytics(analyticsPayload);
      setCampaigns(campaignsPayload);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load advertising operations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const createPackage = async () => {
    if (!newPackage.key.trim() || !newPackage.name.trim()) {
      setError('Package key and name are required.');
      return;
    }

    setNotice('');
    setError('');
    try {
      await webApi.createAdPackage({
        key: newPackage.key.trim(),
        name: newPackage.name.trim(),
        description: newPackage.description.trim() || 'Advertising package',
        placementType: newPackage.placementType,
        billingType: newPackage.billingType,
        currency: newPackage.currency,
        priceAmount: Number(newPackage.priceAmount || 0),
        features: ['Policy review', 'Analytics export']
      });
      setNotice('Ad package created.');
      setNewPackage(prev => ({ ...prev, key: '', name: '', description: '' }));
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create package');
    }
  };

  const createCampaign = async () => {
    if (!newCampaign.name.trim() || !newCampaign.packageId.trim()) {
      setError('Campaign name and package id are required.');
      return;
    }

    setNotice('');
    setError('');
    try {
      const targeting =
        newCampaign.targeting.trim().length > 0
          ? { hint: newCampaign.targeting.trim() }
          : undefined;

      await webApi.createAdCampaign({
        name: newCampaign.name.trim(),
        packageId: newCampaign.packageId.trim(),
        targeting,
        creative: {
          headline: newCampaign.name.trim(),
          ctaUrl: newCampaign.ctaUrl.trim() || undefined
        }
      });
      setNotice('Campaign created and queued for review.');
      setNewCampaign({ name: '', packageId: '', targeting: '', ctaUrl: '' });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create campaign');
    }
  };

  const updateCampaignStatus = async (campaignId: string, status: AdCampaignRecord['status']) => {
    setBusyCampaignId(campaignId);
    setNotice('');
    setError('');
    try {
      await webApi.updateAdCampaignStatus(campaignId, {
        status
      });
      setNotice(`Campaign moved to ${status}.`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update campaign status');
    } finally {
      setBusyCampaignId('');
    }
  };

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-indigo-100 dark:border-indigo-900/40 bg-gradient-to-r from-indigo-600 to-sky-600 p-6 text-white">
        <span className="inline-block rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider">
          Growth Ads V1
        </span>
        <h1 className="mt-3 text-2xl font-bold tracking-tight">Advertising Operations</h1>
        <p className="mt-1 text-sm text-white/85">
          Package catalog, campaign approval flow, and monetization analytics in one admin workspace.
        </p>
      </header>

      {notice ? <p className="text-sm text-emerald-700 dark:text-emerald-400">{notice}</p> : null}
      {error ? <ErrorState body={error} onRetry={() => void load()} /> : null}

      {loading ? <SkeletonSet rows={6} /> : null}

      {!loading && analytics ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
            <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Campaigns</p>
            <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{analytics.totals.campaignCount}</p>
          </article>
          <article className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
            <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Advertisers</p>
            <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{analytics.totals.advertiserCount}</p>
          </article>
          <article className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
            <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">CTR</p>
            <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{analytics.totals.ctrPercent.toFixed(2)}%</p>
          </article>
          <article className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
            <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Estimated MRR</p>
            <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">${analytics.totals.estimatedMonthlyRevenueUsd.toFixed(0)}</p>
          </article>
        </section>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-3">
          <h2 className="text-base font-bold text-gray-900 dark:text-white">Create package</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <input
              className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white"
              placeholder="key (coach_starter)"
              value={newPackage.key}
              onChange={event => setNewPackage(prev => ({ ...prev, key: event.target.value }))}
            />
            <input
              className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white"
              placeholder="Display name"
              value={newPackage.name}
              onChange={event => setNewPackage(prev => ({ ...prev, name: event.target.value }))}
            />
          </div>
          <textarea
            className="min-h-[90px] w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white"
            placeholder="Package description"
            value={newPackage.description}
            onChange={event => setNewPackage(prev => ({ ...prev, description: event.target.value }))}
          />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <select
              className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white"
              value={newPackage.placementType}
              onChange={event =>
                setNewPackage(prev => ({ ...prev, placementType: event.target.value as typeof prev.placementType }))
              }
            >
              <option value="homepage_sponsor">homepage_sponsor</option>
              <option value="module_panel">module_panel</option>
              <option value="blog_block">blog_block</option>
              <option value="newsletter_slot">newsletter_slot</option>
              <option value="partner_spotlight">partner_spotlight</option>
            </select>
            <select
              className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white"
              value={newPackage.billingType}
              onChange={event =>
                setNewPackage(prev => ({ ...prev, billingType: event.target.value as typeof prev.billingType }))
              }
            >
              <option value="monthly_subscription">monthly_subscription</option>
              <option value="quarterly_subscription">quarterly_subscription</option>
              <option value="annual_subscription">annual_subscription</option>
              <option value="one_time">one_time</option>
            </select>
            <input
              type="number"
              className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white"
              value={newPackage.priceAmount}
              onChange={event => setNewPackage(prev => ({ ...prev, priceAmount: Number(event.target.value || 0) }))}
            />
          </div>
          <button
            type="button"
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            onClick={() => void createPackage()}
          >
            Create Package
          </button>
        </article>

        <article className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-3">
          <h2 className="text-base font-bold text-gray-900 dark:text-white">Create campaign</h2>
          <input
            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white"
            placeholder="Campaign name"
            value={newCampaign.name}
            onChange={event => setNewCampaign(prev => ({ ...prev, name: event.target.value }))}
          />
          <input
            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white"
            placeholder="Package ID"
            value={newCampaign.packageId}
            onChange={event => setNewCampaign(prev => ({ ...prev, packageId: event.target.value }))}
          />
          <input
            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white"
            placeholder="CTA URL (https://...)"
            value={newCampaign.ctaUrl}
            onChange={event => setNewCampaign(prev => ({ ...prev, ctaUrl: event.target.value }))}
          />
          <textarea
            className="min-h-[80px] w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white"
            placeholder="Targeting hint (optional)"
            value={newCampaign.targeting}
            onChange={event => setNewCampaign(prev => ({ ...prev, targeting: event.target.value }))}
          />
          <button
            type="button"
            className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
            onClick={() => void createCampaign()}
          >
            Create Campaign
          </button>
        </article>
      </section>

      {!loading && campaigns && campaigns.items.length === 0 ? (
        <EmptyState title="No campaigns yet" body="Create a package and launch the first campaign." />
      ) : null}

      {!loading && campaigns && campaigns.items.length > 0 ? (
        <section className="space-y-3">
          {campaigns.items.map(campaign => (
            <article key={campaign.id} className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">{campaign.name}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {campaign.placementType} • {campaign.package?.name || 'No package linked'}
                  </p>
                </div>
                <span className="rounded-full bg-gray-100 dark:bg-gray-800 px-2.5 py-0.5 text-xs font-semibold text-gray-700 dark:text-gray-300">
                  {campaign.status}
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <p className="text-sm text-gray-600 dark:text-gray-300">Impressions: {campaign.metrics.impressions}</p>
                <p className="text-sm text-gray-600 dark:text-gray-300">Clicks: {campaign.metrics.clicks}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {statusOptions.map(status => (
                  <button
                    key={status}
                    type="button"
                    disabled={busyCampaignId === campaign.id || status === campaign.status}
                    onClick={() => void updateCampaignStatus(campaign.id, status)}
                    className="rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 disabled:opacity-50"
                  >
                    {status}
                  </button>
                ))}
              </div>
            </article>
          ))}
        </section>
      ) : null}
    </div>
  );
}
