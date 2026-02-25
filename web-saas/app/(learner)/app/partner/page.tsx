'use client';

import { FormEvent, useEffect, useState } from 'react';

import { ApiError, apiRequest } from '@/lib/api/client';

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
    <section className="section-wrap">
      <div className="panel hero-panel stack">
        <span className="tag">Partner Program</span>
        <h1>Influencer and institute earnings dashboard</h1>
        <p className="subtitle">
          Track your invite-code performance, monthly conversions, and payout-ready earnings.
        </p>
      </div>

      {loading ? <div className="panel">Loading partner data...</div> : null}

      {!loading && partnerSelf && !partnerSelf.enabled ? (
        <div className="panel stack">
          <h3>Partner program is currently disabled</h3>
          <p className="small">Ask super admin to enable the partner_program feature flag.</p>
        </div>
      ) : null}

      {!loading && partnerSelf?.enabled && partnerSelf.isPartner && dashboard ? (
        <>
          <div className="grid-3">
            <article className="panel stack">
              <p className="small">Lifetime conversions</p>
              <p className="kpi">{dashboard.lifetime.conversions}</p>
              <p className="small">Revenue ${dashboard.lifetime.revenueUsd.toFixed(2)}</p>
            </article>
            <article className="panel stack">
              <p className="small">Lifetime earnings</p>
              <p className="kpi">${dashboard.lifetime.totalEarningsUsd.toFixed(2)}</p>
              <p className="small">
                Commission ${dashboard.lifetime.commissionUsd.toFixed(2)} + Bonus ${dashboard.lifetime.bonusUsd.toFixed(2)}
              </p>
            </article>
            <article className="panel stack">
              <p className="small">Unpaid payout queue</p>
              <p className="kpi">${dashboard.payouts.unpaidUsd.toFixed(2)}</p>
              <p className="small">Pending items: {dashboard.payouts.pendingItems}</p>
            </article>
          </div>

          <div className="panel stack">
            <h3>Current month</h3>
            <p className="small">
              {new Date(dashboard.thisMonth.periodStart).toLocaleDateString()} -{' '}
              {new Date(dashboard.thisMonth.periodEnd).toLocaleDateString()}
            </p>
            <p>
              <span className="tag">Conversions: {dashboard.thisMonth.conversions}</span>
              <span className="tag">Revenue: ${dashboard.thisMonth.revenueUsd.toFixed(2)}</span>
              <span className="tag">Commission: ${dashboard.thisMonth.commissionUsd.toFixed(2)}</span>
            </p>
          </div>

          <div className="panel stack">
            <h3>Active codes</h3>
            {dashboard.activeCodes.length ? (
              <table>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Mode</th>
                    <th>Commission rate</th>
                    <th>Valid until</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.activeCodes.map(code => (
                    <tr key={code.id}>
                      <td>{code.code}</td>
                      <td>{code.attributionOnly ? 'Attribution only' : 'Discount + attribution'}</td>
                      <td>{code.commissionRateOverride ? `${code.commissionRateOverride}%` : 'Default'}</td>
                      <td>{code.validUntil ? new Date(code.validUntil).toLocaleDateString() : 'Open ended'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="small">No active codes assigned yet.</p>
            )}
          </div>
        </>
      ) : null}

      {!loading && partnerSelf?.enabled && !partnerSelf.isPartner ? (
        <div className="panel stack">
          <h3>Apply to join partner program</h3>
          <p className="small">
            Submit your application and start earning through invite codes once approved.
          </p>
          {partnerSelf.status === 'pending' ? (
            <div className="alert alert-success">Your application is pending review.</div>
          ) : (
            <form className="stack" onSubmit={submitApplication}>
              <label className="stack">
                <span>Partner type</span>
                <select className="input" value={partnerType} onChange={e => setPartnerType(e.target.value as 'influencer' | 'institute')}>
                  <option value="influencer">Influencer</option>
                  <option value="institute">Institute</option>
                </select>
              </label>
              <label className="stack">
                <span>Display name</span>
                <input className="input" value={displayName} onChange={e => setDisplayName(e.target.value)} required />
              </label>
              <label className="stack">
                <span>Legal name (optional)</span>
                <input className="input" value={legalName} onChange={e => setLegalName(e.target.value)} />
              </label>
              <label className="stack">
                <span>Contact email (optional)</span>
                <input className="input" type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} />
              </label>
              <label className="stack">
                <span>Notes (optional)</span>
                <textarea className="input" value={notes} onChange={e => setNotes(e.target.value)} />
              </label>
              <button className="btn btn-primary" type="submit" disabled={submitting || !displayName.trim()}>
                {submitting ? 'Submitting...' : 'Submit application'}
              </button>
            </form>
          )}
        </div>
      ) : null}

      {error ? <div className="alert alert-error">{error}</div> : null}
      {success ? <div className="alert alert-success">{success}</div> : null}
    </section>
  );
}
