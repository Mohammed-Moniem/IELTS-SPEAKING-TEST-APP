'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

import { ApiError, apiRequest, webApi } from '@/lib/api/client';
import {
  CampaignPreflight,
  NotificationCampaignAudienceKind,
  NotificationCampaignDetail,
  NotificationCampaignListPage,
  NotificationCampaignRecord,
  NotificationCampaignType
} from '@/lib/types';

const audienceOptions: NotificationCampaignAudienceKind[] = [
  'all_users',
  'all_partner_owners',
  'partner_owners_by_type',
  'partner_owners_by_ids',
  'partner_attributed_users',
  'partner_owners_and_attributed'
];

export default function AdminNotificationsPage() {
  const [campaigns, setCampaigns] = useState<NotificationCampaignRecord[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [selectedDetail, setSelectedDetail] = useState<NotificationCampaignDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [preflighting, setPreflighting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [preflight, setPreflight] = useState<CampaignPreflight | null>(null);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [type, setType] = useState<NotificationCampaignType>('offer');
  const [mode, setMode] = useState<'immediate' | 'scheduled'>('immediate');
  const [scheduledAt, setScheduledAt] = useState('');
  const [fallbackImmediate, setFallbackImmediate] = useState(true);
  const [audienceKind, setAudienceKind] = useState<NotificationCampaignAudienceKind>('all_users');
  const [partnerType, setPartnerType] = useState<'influencer' | 'institute'>('influencer');
  const [partnerIds, setPartnerIds] = useState('');

  const selectedCampaign = useMemo(
    () => campaigns.find(item => item._id === selectedCampaignId) || null,
    [campaigns, selectedCampaignId]
  );

  const loadCampaigns = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiRequest<NotificationCampaignListPage>('/admin/notifications/campaigns?limit=100&offset=0');
      setCampaigns(data.campaigns || []);
      setSelectedCampaignId(prev => prev || data.campaigns?.[0]?._id || '');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCampaignDetail = useCallback(async (campaignId: string) => {
    if (!campaignId) {
      setSelectedDetail(null);
      return;
    }
    try {
      const detail = await apiRequest<NotificationCampaignDetail>(`/admin/notifications/campaigns/${campaignId}`);
      setSelectedDetail(detail);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load campaign detail');
    }
  }, []);

  useEffect(() => {
    void loadCampaigns();
  }, [loadCampaigns]);

  useEffect(() => {
    if (selectedCampaignId) {
      void loadCampaignDetail(selectedCampaignId);
    }
  }, [loadCampaignDetail, selectedCampaignId]);

  const submitCampaign = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      await apiRequest('/admin/notifications/campaigns', {
        method: 'POST',
        body: JSON.stringify(buildCampaignPayload())
      });
      setSuccess('Campaign created');
      setTitle('');
      setBody('');
      setMode('immediate');
      setScheduledAt('');
      setPartnerIds('');
      setPreflight(null);
      await loadCampaigns();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create campaign');
    } finally {
      setSubmitting(false);
    }
  };

  const buildCampaignPayload = () => ({
    title,
    body,
    type,
    mode,
    scheduledAt: mode === 'scheduled' ? new Date(scheduledAt).toISOString() : undefined,
    fallbackImmediateIfSchedulerUnavailable: fallbackImmediate,
    audience: {
      kind: audienceKind,
      partnerType: audienceKind === 'partner_owners_by_type' ? partnerType : undefined,
      partnerIds: ['partner_owners_by_ids', 'partner_attributed_users', 'partner_owners_and_attributed'].includes(audienceKind)
        ? partnerIds
            .split(',')
            .map(item => item.trim())
            .filter(Boolean)
        : undefined
    },
    data: {
      partnerOffer: type === 'offer' && audienceKind !== 'all_users'
    }
  });

  const runPreflight = async () => {
    setError('');
    setSuccess('');
    setPreflight(null);
    setPreflighting(true);
    try {
      const result = await webApi.preflightCampaign(buildCampaignPayload());
      setPreflight(result);
      setSuccess('Preflight completed');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to run preflight');
    } finally {
      setPreflighting(false);
    }
  };

  const sendNow = async (campaignId: string) => {
    setError('');
    setSuccess('');
    try {
      await apiRequest(`/admin/notifications/campaigns/${campaignId}/send-now`, { method: 'POST' });
      setSuccess('Campaign sent');
      await loadCampaigns();
      await loadCampaignDetail(campaignId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to send campaign');
    }
  };

  const cancelCampaign = async (campaignId: string) => {
    setError('');
    setSuccess('');
    try {
      await apiRequest(`/admin/notifications/campaigns/${campaignId}/cancel`, { method: 'PATCH' });
      setSuccess('Campaign cancelled');
      await loadCampaigns();
      await loadCampaignDetail(campaignId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to cancel campaign');
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-indigo-100 dark:border-indigo-900/40 bg-gradient-to-r from-indigo-600 to-violet-600 p-6 text-white">
        <span className="inline-block rounded-full bg-white/20 px-3 py-0.5 text-xs font-semibold uppercase tracking-wider mb-2">Admin notifications</span>
        <h1 className="text-2xl font-bold">Push Campaigns and Offers</h1>
        <p className="mt-1 text-sm text-white/70">Send now, schedule in UTC, and target partner or learner audiences.</p>
      </div>

      {error ? <div className="rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-400">{error}</div> : null}
      {success ? <div className="rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">{success}</div> : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-4" onSubmit={submitCampaign}>
          <h3 className="text-base font-bold text-gray-900 dark:text-white">Create Campaign</h3>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Title</span>
            <input className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40" value={title} onChange={e => setTitle(e.target.value)} required />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Body</span>
            <textarea className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40 min-h-[80px]" value={body} onChange={e => setBody(e.target.value)} required />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</span>
            <select className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40" value={type} onChange={e => setType(e.target.value as NotificationCampaignType)}>
              <option value="offer">Offer</option>
              <option value="system">System</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Mode</span>
            <select className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40" value={mode} onChange={e => setMode(e.target.value as 'immediate' | 'scheduled')}>
              <option value="immediate">Immediate</option>
              <option value="scheduled">Scheduled (UTC)</option>
            </select>
          </label>
          {mode === 'scheduled' ? (
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Scheduled At (UTC)</span>
              <input className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40" type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} required />
            </label>
          ) : null}
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Audience</span>
            <select className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40" value={audienceKind} onChange={e => setAudienceKind(e.target.value as NotificationCampaignAudienceKind)}>
              {audienceOptions.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>

          {audienceKind === 'partner_owners_by_type' ? (
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Partner type</span>
              <select className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40" value={partnerType} onChange={e => setPartnerType(e.target.value as 'influencer' | 'institute')}>
                <option value="influencer">Influencer</option>
                <option value="institute">Institute</option>
              </select>
            </label>
          ) : null}

          {['partner_owners_by_ids', 'partner_attributed_users', 'partner_owners_and_attributed'].includes(audienceKind) ? (
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Partner IDs (comma separated)</span>
              <textarea className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40" value={partnerIds} onChange={e => setPartnerIds(e.target.value)} />
            </label>
          ) : null}

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500/40" checked={fallbackImmediate} onChange={e => setFallbackImmediate(e.target.checked)} />
            <span className="text-sm text-gray-700 dark:text-gray-300">Fallback to immediate if scheduler is unavailable</span>
          </label>

          <div className="flex items-center gap-3 pt-2">
            <button className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors" type="button" onClick={() => void runPreflight()} disabled={preflighting}>
              {preflighting ? 'Running...' : 'Run Preflight'}
            </button>
            <button className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/25" type="submit" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Create Campaign'}
            </button>
          </div>

          {preflight ? (
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 p-4 space-y-1.5">
              <h4 className="text-sm font-bold text-gray-900 dark:text-white">Safety Preflight</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400">Targeted users: {preflight.audienceEstimate.targetedUsers}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Frequency cap: {preflight.safety.frequencyCapOk ? <span className="text-emerald-600">OK</span> : <span className="text-amber-600">Needs review</span>}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Link validation: {preflight.safety.linkValidationOk ? <span className="text-emerald-600">OK</span> : <span className="text-red-600">Invalid links detected</span>}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Schedule readiness: {preflight.safety.scheduleReady ? <span className="text-emerald-600">Ready</span> : <span className="text-red-600">Blocked</span>}</p>
              {preflight.safety.warnings.length ? (
                <ul className="mt-2 space-y-1">
                  {preflight.safety.warnings.map(warning => (
                    <li key={warning} className="text-xs text-amber-600 dark:text-amber-400">• {warning}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </form>

        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-4">
          <h3 className="text-base font-bold text-gray-900 dark:text-white">Campaigns</h3>
          {loading ? <p className="text-sm text-gray-500 dark:text-gray-400">Loading campaigns...</p> : null}
          {!loading && campaigns.length === 0 ? <p className="text-sm text-gray-500 dark:text-gray-400">No campaigns yet.</p> : null}
          {!loading && campaigns.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    <th className="px-5 py-3">Title</th>
                    <th className="px-5 py-3">Type</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {campaigns.map(campaign => (
                    <tr key={campaign._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="px-5 py-3">
                        <button className="text-indigo-600 dark:text-indigo-400 hover:underline font-semibold text-sm" onClick={() => setSelectedCampaignId(campaign._id)}>
                          {campaign.title}
                        </button>
                      </td>
                      <td className="px-5 py-3"><span className="inline-block rounded-full bg-indigo-50 dark:bg-indigo-500/10 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 dark:text-indigo-400">{campaign.type}</span></td>
                      <td className="px-5 py-3"><span className="inline-block rounded-full bg-gray-100 dark:bg-gray-800 px-2.5 py-0.5 text-xs font-semibold text-gray-700 dark:text-gray-300">{campaign.status}</span></td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                            onClick={() => void sendNow(campaign._id)}
                            disabled={!['draft', 'scheduled', 'failed'].includes(campaign.status)}
                          >
                            Send now
                          </button>
                          <button
                            className="rounded-xl border border-red-200 dark:border-red-500/30 bg-white dark:bg-gray-900 px-3 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                            onClick={() => void cancelCampaign(campaign._id)}
                            disabled={!['draft', 'scheduled'].includes(campaign.status)}
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </div>

      {selectedCampaign ? (
        <article className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-3">
          <h3 className="text-base font-bold text-gray-900 dark:text-white">Campaign Detail</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            <p className="text-gray-500 dark:text-gray-400"><strong className="text-gray-900 dark:text-white">Title:</strong> {selectedCampaign.title}</p>
            <p className="text-gray-500 dark:text-gray-400"><strong className="text-gray-900 dark:text-white">Status:</strong> {selectedCampaign.status}</p>
            <p className="text-gray-500 dark:text-gray-400"><strong className="text-gray-900 dark:text-white">Audience:</strong> {selectedCampaign.audience.kind}</p>
            <p className="text-gray-500 dark:text-gray-400"><strong className="text-gray-900 dark:text-white">Sent:</strong> {selectedCampaign.deliverySummary?.sent ?? 0} / {selectedCampaign.deliverySummary?.attempts ?? 0}</p>
            <p className="text-gray-500 dark:text-gray-400"><strong className="text-gray-900 dark:text-white">Failed:</strong> {selectedCampaign.deliverySummary?.failed ?? 0}</p>
          </div>

          <h4 className="text-sm font-bold text-gray-900 dark:text-white pt-2">Recent Deliveries</h4>
          <ul className="space-y-1">
            {(selectedDetail?.deliveries || []).slice(0, 20).map(item => (
              <li key={item._id} className="text-xs text-gray-500 dark:text-gray-400">
                <span className="font-semibold text-gray-700 dark:text-gray-300">{item.channel}</span> · {item.status} · {item.errorCode || 'ok'}
              </li>
            ))}
          </ul>
        </article>
      ) : null}
    </div>
  );
}
