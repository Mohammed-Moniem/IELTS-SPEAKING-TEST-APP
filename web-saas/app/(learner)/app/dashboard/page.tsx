'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { useAuth } from '@/components/auth/AuthProvider';
import { apiRequest } from '@/lib/api/client';
import { UsageSummary } from '@/lib/types';

export default function DashboardPage() {
  const { user } = useAuth();
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    void (async () => {
      try {
        const summary = await apiRequest<UsageSummary>('/usage/summary');
        setUsage(summary);
      } catch (err: any) {
        setError(err?.message || 'Unable to load usage summary');
      }
    })();
  }, []);

  return (
    <section className="section-wrap">
      <div className="panel hero-panel stack">
        <span className="tag">Learner Control Center</span>
        <h1>Welcome back, {user?.firstName || 'Learner'}</h1>
        <p className="subtitle">Full IELTS workflow across speaking, writing, reading, listening, and full mock orchestration.</p>
      </div>

      <div className="grid-3">
        <article className="panel stack">
          <p className="small">Current plan</p>
          <p className="kpi">{(usage?.plan || user?.subscriptionPlan || 'free').toUpperCase()}</p>
        </article>
        <article className="panel stack">
          <p className="small">Writing used</p>
          <p className="kpi">{usage ? `${usage.writingCount}/${usage.writingLimit}` : '--'}</p>
        </article>
        <article className="panel stack">
          <p className="small">AI usage this cycle</p>
          <p className="kpi">{usage ? usage.aiRequestCount : '--'}</p>
        </article>
      </div>

      <div className="grid-2">
        <article className="panel stack">
          <h3>Quick start</h3>
          <div className="cta-row">
            <Link className="btn btn-primary" href="/app/speaking">
              Speaking Session
            </Link>
            <Link className="btn btn-secondary" href="/app/writing">
              Writing Task
            </Link>
            <Link className="btn btn-secondary" href="/app/tests">
              Full Mock
            </Link>
          </div>
        </article>

        <article className="panel stack">
          <h3>Compatibility guardrail</h3>
          <p className="subtitle">
            Speaking flow in web calls existing `/speech/*`, `/practice/*`, `/test-simulations/*`, and `/topics/*`
            contracts additively.
          </p>
        </article>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}
    </section>
  );
}
