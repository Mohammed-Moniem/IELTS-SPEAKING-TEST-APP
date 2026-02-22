'use client';

import { useEffect, useState } from 'react';

import { apiRequest, ApiError } from '@/lib/api/client';
import { FeatureFlag } from '@/lib/types';

export default function AdminFlagsPage() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

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

  const toggleFlag = async (flag: FeatureFlag) => {
    setError('');
    setSuccess('');

    try {
      await apiRequest<FeatureFlag>(`/admin/feature-flags/${flag.key}`, {
        method: 'PATCH',
        body: JSON.stringify({
          enabled: !flag.enabled,
          rolloutPercentage: flag.rolloutPercentage,
          description: flag.description
        })
      });

      setSuccess(`Updated ${flag.key}`);
      await loadFlags();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update feature flag');
    }
  };

  const changeRollout = async (flag: FeatureFlag, rolloutPercentage: number) => {
    setError('');
    setSuccess('');

    try {
      await apiRequest<FeatureFlag>(`/admin/feature-flags/${flag.key}`, {
        method: 'PATCH',
        body: JSON.stringify({
          enabled: flag.enabled,
          rolloutPercentage,
          description: flag.description
        })
      });

      setSuccess(`Updated rollout for ${flag.key}`);
      await loadFlags();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update rollout percentage');
    }
  };

  return (
    <section className="section-wrap">
      <div className="panel hero-panel stack">
        <span className="tag">Phased rollout controls</span>
        <h1>Feature flags</h1>
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
                      onBlur={e => void changeRollout(flag, Number(e.target.value || 0))}
                    />
                  </td>
                  <td>{flag.description || '-'}</td>
                  <td>
                    <button className="btn btn-secondary" onClick={() => void toggleFlag(flag)}>
                      Toggle
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}
      {success ? <div className="alert alert-success">{success}</div> : null}
    </section>
  );
}
