'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

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

  const loadCampaigns = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiRequest<NotificationCampaignListPage>('/admin/notifications/campaigns?limit=100&offset=0');
      setCampaigns(data.campaigns || []);
      if (!selectedCampaignId && data.campaigns?.length) {
        setSelectedCampaignId(data.campaigns[0]._id);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  };

  const loadCampaignDetail = async (campaignId: string) => {
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
  };

  useEffect(() => {
    void loadCampaigns();
  }, []);

  useEffect(() => {
    if (selectedCampaignId) {
      void loadCampaignDetail(selectedCampaignId);
    }
  }, [selectedCampaignId]);

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
    <section className="section-wrap">
      <div className="panel hero-panel stack">
        <span className="tag">Admin notifications</span>
        <h1>Push campaigns and offers</h1>
        <p className="subtitle">Send now, schedule in UTC, and target partner or learner audiences.</p>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}
      {success ? <div className="alert alert-success">{success}</div> : null}

      <div className="grid-2">
        <form className="panel stack" onSubmit={submitCampaign}>
          <h3>Create campaign</h3>
          <label className="stack">
            <span>Title</span>
            <input className="input" value={title} onChange={e => setTitle(e.target.value)} required />
          </label>
          <label className="stack">
            <span>Body</span>
            <textarea className="input" value={body} onChange={e => setBody(e.target.value)} required />
          </label>
          <label className="stack">
            <span>Type</span>
            <select className="select" value={type} onChange={e => setType(e.target.value as NotificationCampaignType)}>
              <option value="offer">Offer</option>
              <option value="system">System</option>
            </select>
          </label>
          <label className="stack">
            <span>Mode</span>
            <select className="select" value={mode} onChange={e => setMode(e.target.value as 'immediate' | 'scheduled')}>
              <option value="immediate">Immediate</option>
              <option value="scheduled">Scheduled (UTC)</option>
            </select>
          </label>
          {mode === 'scheduled' ? (
            <label className="stack">
              <span>Scheduled At (UTC)</span>
              <input className="input" type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} required />
            </label>
          ) : null}
          <label className="stack">
            <span>Audience</span>
            <select className="select" value={audienceKind} onChange={e => setAudienceKind(e.target.value as NotificationCampaignAudienceKind)}>
              {audienceOptions.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>

          {audienceKind === 'partner_owners_by_type' ? (
            <label className="stack">
              <span>Partner type</span>
              <select className="select" value={partnerType} onChange={e => setPartnerType(e.target.value as 'influencer' | 'institute')}>
                <option value="influencer">Influencer</option>
                <option value="institute">Institute</option>
              </select>
            </label>
          ) : null}

          {['partner_owners_by_ids', 'partner_attributed_users', 'partner_owners_and_attributed'].includes(audienceKind) ? (
            <label className="stack">
              <span>Partner IDs (comma separated)</span>
              <textarea className="input" value={partnerIds} onChange={e => setPartnerIds(e.target.value)} />
            </label>
          ) : null}

          <label className="cta-row" style={{ alignItems: 'center' }}>
            <input type="checkbox" checked={fallbackImmediate} onChange={e => setFallbackImmediate(e.target.checked)} />
            <span>Fallback to immediate if scheduler is unavailable</span>
          </label>

          <div className="cta-row">
            <button className="btn btn-secondary" type="button" onClick={() => void runPreflight()} disabled={preflighting}>
              {preflighting ? 'Running...' : 'Run Preflight'}
            </button>
            <button className="btn btn-primary" type="submit" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Create Campaign'}
            </button>
          </div>

          {preflight ? (
            <div className="panel panel-subtle stack">
              <h4>Safety preflight</h4>
              <p className="small">Targeted users: {preflight.audienceEstimate.targetedUsers}</p>
              <p className="small">Frequency cap: {preflight.safety.frequencyCapOk ? 'OK' : 'Needs review'}</p>
              <p className="small">Link validation: {preflight.safety.linkValidationOk ? 'OK' : 'Invalid links detected'}</p>
              <p className="small">Schedule readiness: {preflight.safety.scheduleReady ? 'Ready' : 'Blocked'}</p>
              {preflight.safety.warnings.length ? (
                <ul>
                  {preflight.safety.warnings.map(warning => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </form>

        <div className="panel stack">
          <h3>Campaigns</h3>
          {loading ? <p className="small">Loading campaigns...</p> : null}
          {!loading && campaigns.length === 0 ? <p className="small">No campaigns yet.</p> : null}
          {!loading && campaigns.length > 0 ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map(campaign => (
                  <tr key={campaign._id}>
                    <td>
                      <button className="btn btn-link" onClick={() => setSelectedCampaignId(campaign._id)}>
                        {campaign.title}
                      </button>
                    </td>
                    <td>{campaign.type}</td>
                    <td>{campaign.status}</td>
                    <td>
                      <div className="cta-row">
                        <button
                          className="btn btn-secondary"
                          onClick={() => void sendNow(campaign._id)}
                          disabled={!['draft', 'scheduled', 'failed'].includes(campaign.status)}
                        >
                          Send now
                        </button>
                        <button
                          className="btn btn-danger"
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
          ) : null}
        </div>
      </div>

      {selectedCampaign ? (
        <div className="panel stack" style={{ marginTop: 16 }}>
          <h3>Campaign detail</h3>
          <p><strong>Title:</strong> {selectedCampaign.title}</p>
          <p><strong>Status:</strong> {selectedCampaign.status}</p>
          <p><strong>Audience:</strong> {selectedCampaign.audience.kind}</p>
          <p><strong>Sent:</strong> {selectedCampaign.deliverySummary?.sent ?? 0} / {selectedCampaign.deliverySummary?.attempts ?? 0}</p>
          <p><strong>Failed:</strong> {selectedCampaign.deliverySummary?.failed ?? 0}</p>

          <h4>Recent deliveries</h4>
          <ul>
            {(selectedDetail?.deliveries || []).slice(0, 20).map(item => (
              <li key={item._id}>
                {item.channel} · {item.status} · {item.errorCode || 'ok'}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
