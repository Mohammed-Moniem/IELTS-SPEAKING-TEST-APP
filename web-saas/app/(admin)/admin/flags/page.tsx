'use client';

import { useEffect, useMemo, useState } from 'react';

import { apiRequest, ApiError } from '@/lib/api/client';
import { FeatureFlag } from '@/lib/types';

type PendingMutation = {
  flag: FeatureFlag;
  nextEnabled: boolean;
  nextRollout: number;
};

const isHighImpactFlag = (flagKey: string) => {
  const key = flagKey.toLowerCase();
  return (
    key.includes('speaking') ||
    key.includes('billing') ||
    key.includes('auth') ||
    key.includes('admin') ||
    key.includes('full_exam')
  );
};

export default function AdminFlagsPage() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingMutation, setPendingMutation] = useState<PendingMutation | null>(null);
  const [confirmationText, setConfirmationText] = useState('');

  const expectedConfirmation = useMemo(() => {
    if (!pendingMutation) return '';
    return `${pendingMutation.nextEnabled ? 'ENABLE' : 'DISABLE'} ${pendingMutation.flag.key}`;
  }, [pendingMutation]);

  const loadFlags = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiRequest<FeatureFlag[]>('/admin/feature-flags');
      setFlags(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load feature flags');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadFlags();
  }, []);

  const applyMutation = async (mutation: PendingMutation) => {
    setError('');
    setSuccess('');

    try {
      await apiRequest<FeatureFlag>(`/admin/feature-flags/${mutation.flag.key}`, {
        method: 'PATCH',
        body: JSON.stringify({
          enabled: mutation.nextEnabled,
          rolloutPercentage: mutation.nextRollout,
          description: mutation.flag.description
        })
      });

      setSuccess(`Updated ${mutation.flag.key}`);
      await loadFlags();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update feature flag');
    }
  };

  const queueToggle = (flag: FeatureFlag) => {
    const mutation: PendingMutation = {
      flag,
      nextEnabled: !flag.enabled,
      nextRollout: flag.rolloutPercentage
    };

    if (isHighImpactFlag(flag.key)) {
      setPendingMutation(mutation);
      setConfirmationText('');
      return;
    }

    void applyMutation(mutation);
  };

  const queueRolloutUpdate = (flag: FeatureFlag, rolloutPercentage: number) => {
    const mutation: PendingMutation = {
      flag,
      nextEnabled: flag.enabled,
      nextRollout: Math.max(0, Math.min(100, rolloutPercentage))
    };

    if (isHighImpactFlag(flag.key)) {
      setPendingMutation(mutation);
      setConfirmationText('');
      return;
    }

    void applyMutation(mutation);
  };

  const confirmMutation = async () => {
    if (!pendingMutation) return;
    if (confirmationText.trim() !== expectedConfirmation) {
      setError(`Confirmation text must match exactly: ${expectedConfirmation}`);
      return;
    }

    await applyMutation(pendingMutation);
    setPendingMutation(null);
    setConfirmationText('');
  };

  return (
    <section className="section-wrap">
      <div className="panel hero-panel stack">
        <span className="tag">Phased rollout controls</span>
        <h1>Feature flags with safety confirmation gates</h1>
      </div>

      <div className="panel stack">
        <div className="cta-row">
          <button className="btn btn-secondary" onClick={() => void loadFlags()} disabled={loading}>
            Refresh
          </button>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Flag</th>
                <th>Status</th>
                <th>Rollout %</th>
                <th>Description</th>
                <th>Safety</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {flags.map(flag => (
                <tr key={flag.key}>
                  <td>{flag.key}</td>
                  <td>
                    <span className={`pill ${flag.enabled ? 'pill-green' : 'pill-amber'}`}>
                      {flag.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>
                  <td>
                    <input
                      className="input"
                      style={{ minWidth: 90 }}
                      type="number"
                      min={0}
                      max={100}
                      defaultValue={flag.rolloutPercentage}
                      onBlur={event => void queueRolloutUpdate(flag, Number(event.target.value || 0))}
                    />
                  </td>
                  <td>{flag.description || '-'}</td>
                  <td>{isHighImpactFlag(flag.key) ? 'High impact' : 'Standard'}</td>
                  <td>
                    <button className="btn btn-secondary" onClick={() => queueToggle(flag)}>
                      Toggle
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {pendingMutation ? (
        <div className="panel stack">
          <h3>High-impact confirmation required</h3>
          <p className="small">
            You are about to {pendingMutation.nextEnabled ? 'enable' : 'disable'} <strong>{pendingMutation.flag.key}</strong>.
          </p>
          <p className="small">Type exactly: {expectedConfirmation}</p>
          <input className="input" value={confirmationText} onChange={event => setConfirmationText(event.target.value)} />
          <div className="cta-row">
            <button className="btn btn-primary" onClick={() => void confirmMutation()}>
              Confirm Change
            </button>
            <button className="btn btn-secondary" onClick={() => setPendingMutation(null)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {error ? <div className="alert alert-error">{error}</div> : null}
      {success ? <div className="alert alert-success">{success}</div> : null}
    </section>
  );
}
