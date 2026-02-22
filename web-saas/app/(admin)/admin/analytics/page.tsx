'use client';

import { useEffect, useState } from 'react';

import { apiRequest } from '@/lib/api/client';

type AnalyticsSummary = {
  users: number;
  moduleActivity: {
    writingSubmissions: number;
    readingAttempts: number;
    listeningAttempts: number;
  };
  activePaidSubscriptions: number;
  featureFlags: Array<{ key: string; enabled: boolean }>;
};

export default function AdminAnalyticsPage() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    void (async () => {
      try {
        const analytics = await apiRequest<AnalyticsSummary>('/admin/analytics');
        setSummary(analytics);
      } catch (err: any) {
        setError(err?.message || 'Failed to load analytics');
      }
    })();
  }, []);

  return (
    <section className="section-wrap">
      <div className="panel hero-panel stack">
        <span className="tag">Analytics</span>
        <h1>Module and subscription performance</h1>
      </div>

      {summary ? (
        <div className="grid-3">
          <article className="panel stack">
            <p className="small">Users</p>
            <p className="kpi">{summary.users}</p>
          </article>
          <article className="panel stack">
            <p className="small">Writing submissions</p>
            <p className="kpi">{summary.moduleActivity.writingSubmissions}</p>
          </article>
          <article className="panel stack">
            <p className="small">Paid subscriptions</p>
            <p className="kpi">{summary.activePaidSubscriptions}</p>
          </article>
        </div>
      ) : null}

      <div className="panel stack">
        <h3>Feature flags</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Flag key</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(summary?.featureFlags || []).map(flag => (
                <tr key={flag.key}>
                  <td>{flag.key}</td>
                  <td>
                    <span className={`pill ${flag.enabled ? 'pill-green' : 'pill-amber'}`}>
                      {flag.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}
    </section>
  );
}
