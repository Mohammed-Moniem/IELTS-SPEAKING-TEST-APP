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

type AIUsageSummary = {
  aggregate: Array<{ _id: string; requestCount: number; costUsd: number; tokenCount: number }>;
};

export default function AdminOverviewPage() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [ai, setAi] = useState<AIUsageSummary | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    void (async () => {
      try {
        const [analytics, aiUsage] = await Promise.all([
          apiRequest<AnalyticsSummary>('/admin/analytics'),
          apiRequest<AIUsageSummary>('/admin/ai-usage?limit=20')
        ]);

        setSummary(analytics);
        setAi(aiUsage);
      } catch (err: any) {
        setError(err?.message || 'Failed to load admin overview');
      }
    })();
  }, []);

  return (
    <section className="section-wrap">
      <div className="panel hero-panel stack">
        <span className="tag">Admin overview</span>
        <h1>Operational command center</h1>
        <p className="subtitle">Content, users, subscriptions, AI costs, and rollout controls in one place.</p>
      </div>

      {summary ? (
        <div className="grid-3">
          <article className="panel stack">
            <p className="small">Users</p>
            <p className="kpi">{summary.users}</p>
          </article>
          <article className="panel stack">
            <p className="small">Paid subscriptions</p>
            <p className="kpi">{summary.activePaidSubscriptions}</p>
          </article>
          <article className="panel stack">
            <p className="small">Feature flags</p>
            <p className="kpi">{summary.featureFlags.length}</p>
          </article>
        </div>
      ) : null}

      <div className="grid-2">
        <div className="panel stack">
          <h3>Module activity</h3>
          <p>Writing: {summary?.moduleActivity.writingSubmissions || 0}</p>
          <p>Reading: {summary?.moduleActivity.readingAttempts || 0}</p>
          <p>Listening: {summary?.moduleActivity.listeningAttempts || 0}</p>
        </div>
        <div className="panel stack">
          <h3>AI usage by module</h3>
          <ul>
            {(ai?.aggregate || []).map(item => (
              <li key={item._id}>
                {item._id}: {item.requestCount} requests, ${item.costUsd.toFixed(3)}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}
    </section>
  );
}
