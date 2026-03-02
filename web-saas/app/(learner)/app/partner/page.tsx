'use client';

import { FormEvent, useEffect, useState } from 'react';

import { ApiError, apiRequest } from '@/lib/api/client';
import { PageHeader, SectionCard, MetricCard, StatusBadge } from '@/components/ui/v2';

type PartnerSelfResponse = {
  enabled: boolean;
  isPartner: boolean;
  status?: string;
  partnerType?: string;
  dashboardUrl?: string;
  registrationUrl?: string;
  partner?: {
    _id: string;
    displayName: string;
    status: string;
    partnerType: string;
  } | null;
};

type PartnerDashboard = {
  partner: {
    id: string;
    partnerType: string;
    displayName: string;
    status: string;
    defaultCommissionRate: number;
  };
  lifetime: {
    conversions: number;
    revenueUsd: number;
    commissionUsd: number;
    bonusUsd: number;
    totalEarningsUsd: number;
  };
  thisMonth: {
    periodStart: string;
    periodEnd: string;
    conversions: number;
    revenueUsd: number;
    commissionUsd: number;
  };
  payouts: {
    unpaidUsd: number;
    paidItems: number;
    pendingItems: number;
  };
  activeCodes: Array<{
    id: string;
    code: string;
    attributionOnly: boolean;
    commissionRateOverride?: number;
    validUntil?: string;
  }>;
};

export default function PartnerPage() {
  const [partnerSelf, setPartnerSelf] = useState<PartnerSelfResponse | null>(null);
  const [dashboard, setDashboard] = useState<PartnerDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [partnerType, setPartnerType] = useState<'influencer' | 'institute'>('influencer');
  const [displayName, setDisplayName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [notes, setNotes] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');

    try {
      const me = await apiRequest<PartnerSelfResponse>('/partners/me');
      setPartnerSelf(me);

      if (me.isPartner) {
        const payload = await apiRequest<PartnerDashboard>('/partners/dashboard');
        setDashboard(payload);
      } else {
        setDashboard(null);
      }
    } catch (err: any) {
      const message = err instanceof ApiError ? err.message : err?.message || 'Failed to load partner data';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const submitApplication = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      await apiRequest('/partners/applications', {
        method: 'POST',
        body: JSON.stringify({
          partnerType,
          displayName,
          legalName: legalName || undefined,
          contactEmail: contactEmail || undefined,
          notes: notes || undefined
        })
      });

      setSuccess('Application submitted. A super admin will review it shortly.');
      await loadData();
    } catch (err: any) {
      const message = err instanceof ApiError ? err.message : err?.message || 'Failed to submit application';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Influencer and institute earnings dashboard"
        subtitle="Track your invite-code performance, monthly conversions, and payout-ready earnings."
        actions={<StatusBadge tone="brand">Partner Program</StatusBadge>}
      />

      {loading ? <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 text-sm text-gray-500 dark:text-gray-400 animate-pulse">Loading partner data...</div> : null}

      {!loading && partnerSelf && !partnerSelf.enabled ? (
        <SectionCard title="Partner program is currently disabled">
          <p className="text-sm text-gray-500 dark:text-gray-400">Ask super admin to enable the partner_program feature flag.</p>
        </SectionCard>
      ) : null}

      {!loading && partnerSelf?.enabled && partnerSelf.isPartner && dashboard ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MetricCard
              tone="neutral"
              label="Lifetime conversions"
              value={dashboard.lifetime.conversions}
              helper={`Revenue $${dashboard.lifetime.revenueUsd.toFixed(2)}`}
            />
            <MetricCard
              tone="brand"
              label="Lifetime earnings"
              value={`$${dashboard.lifetime.totalEarningsUsd.toFixed(2)}`}
              helper={`Commission $${dashboard.lifetime.commissionUsd.toFixed(2)} + Bonus $${dashboard.lifetime.bonusUsd.toFixed(2)}`}
            />
            <MetricCard
              tone="warning"
              label="Unpaid payout queue"
              value={`$${dashboard.payouts.unpaidUsd.toFixed(2)}`}
              helper={`Pending items: ${dashboard.payouts.pendingItems}`}
            />
          </div>

          <SectionCard title="Current month">
            <div className="space-y-4">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                {new Date(dashboard.thisMonth.periodStart).toLocaleDateString()} -{' '}
                {new Date(dashboard.thisMonth.periodEnd).toLocaleDateString()}
              </p>
              <div className="flex flex-wrap gap-2">
                <StatusBadge tone="neutral">Conversions: {dashboard.thisMonth.conversions}</StatusBadge>
                <StatusBadge tone="neutral">Revenue: ${dashboard.thisMonth.revenueUsd.toFixed(2)}</StatusBadge>
                <StatusBadge tone="success">Commission: ${dashboard.thisMonth.commissionUsd.toFixed(2)}</StatusBadge>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Active codes" className="p-0 overflow-hidden">
            {dashboard.activeCodes.length ? (
              <div className="overflow-x-auto border-t border-gray-100 dark:border-gray-800 -m-6 sm:-mx-6 sm:-mb-6 mt-0">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/30">
                      <th className="px-6 py-3 font-semibold text-gray-900 dark:text-white">Code</th>
                      <th className="px-6 py-3 font-semibold text-gray-900 dark:text-white">Mode</th>
                      <th className="px-6 py-3 font-semibold text-gray-900 dark:text-white text-right">Commission rate</th>
                      <th className="px-6 py-3 font-semibold text-gray-900 dark:text-white text-right">Valid until</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {dashboard.activeCodes.map(code => (
                      <tr key={code.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                        <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{code.code}</td>
                        <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                          {code.attributionOnly ? <StatusBadge tone="neutral">Attribution only</StatusBadge> : <StatusBadge tone="brand">Discount + attribution</StatusBadge>}
                        </td>
                        <td className="px-6 py-4 text-right text-gray-600 dark:text-gray-400">{code.commissionRateOverride ? `${code.commissionRateOverride}%` : 'Default'}</td>
                        <td className="px-6 py-4 text-right text-gray-600 dark:text-gray-400">{code.validUntil ? new Date(code.validUntil).toLocaleDateString() : 'Open ended'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-6">
                <p className="text-sm text-gray-500 dark:text-gray-400">No active codes assigned yet.</p>
              </div>
            )}
          </SectionCard>
        </>
      ) : null}

      {!loading && partnerSelf?.enabled && !partnerSelf.isPartner ? (
        <SectionCard title="Apply to join partner program">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Submit your application and start earning through invite codes once approved.
          </p>
          {partnerSelf.status === 'pending' ? (
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
              Your application is pending review.
            </div>
          ) : (
            <form className="space-y-4" onSubmit={submitApplication}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Partner type</span>
                  <select className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40" value={partnerType} onChange={e => setPartnerType(e.target.value as 'influencer' | 'institute')}>
                    <option value="influencer">Influencer</option>
                    <option value="institute">Institute</option>
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Display name</span>
                  <input className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500/40" value={displayName} onChange={e => setDisplayName(e.target.value)} required />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Legal name (optional)</span>
                  <input className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500/40" value={legalName} onChange={e => setLegalName(e.target.value)} />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Contact email (optional)</span>
                  <input className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500/40" type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} />
                </label>
              </div>
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Notes (optional)</span>
                <textarea className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500/40 h-24" value={notes} onChange={e => setNotes(e.target.value)} />
              </label>
              <button className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 hover:bg-violet-700 transition-colors disabled:opacity-50" type="submit" disabled={submitting || !displayName.trim()}>
                {submitting ? 'Submitting...' : 'Submit application'}
              </button>
            </form>
          )}
        </SectionCard>
      ) : null}

      {error ? <div className="rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-400">{error}</div> : null}
      {success ? <div className="rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">{success}</div> : null}
    </div>
  );
}
