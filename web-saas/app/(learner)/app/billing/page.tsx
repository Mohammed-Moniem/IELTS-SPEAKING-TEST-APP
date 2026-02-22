'use client';

import { useEffect, useState } from 'react';

import { apiRequest } from '@/lib/api/client';
import { UsageSummary } from '@/lib/types';

type PlanItem = {
  tier: string;
  name: string;
  price: number;
  features: string[];
};

type PlansResponse = {
  plans: PlanItem[];
};

export default function BillingPage() {
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    void (async () => {
      try {
        const [planPayload, usageSummary] = await Promise.all([
          apiRequest<PlansResponse>('/subscription/plans'),
          apiRequest<UsageSummary>('/usage/summary')
        ]);

        setPlans(planPayload.plans || []);
        setSummary(usageSummary);
      } catch (err: any) {
        setError(err?.message || 'Unable to load billing data');
      }
    })();
  }, []);

  return (
    <section className="section-wrap">
      <div className="panel hero-panel stack">
        <span className="tag">Billing + usage</span>
        <h1>Plan and quota overview</h1>
        <p className="subtitle">Stripe-backed subscriptions with free/premium/pro structure preserved.</p>
      </div>

      {summary ? (
        <div className="panel stack">
          <h3>Current usage</h3>
          <p>
            <span className="tag">Plan: {summary.plan}</span>
            <span className="tag">Practice: {summary.practiceCount}/{summary.practiceLimit}</span>
            <span className="tag">Tests: {summary.testCount}/{summary.testLimit}</span>
          </p>
          <p className="small">
            Writing {summary.writingCount}/{summary.writingLimit} | Reading {summary.readingCount}/{summary.readingLimit} |
            Listening {summary.listeningCount}/{summary.listeningLimit}
          </p>
        </div>
      ) : null}

      <div className="grid-3">
        {plans.map(plan => (
          <article key={plan.tier} className="panel stack">
            <h3>{plan.name}</h3>
            <p className="kpi">${plan.price}</p>
            <ul>
              {plan.features.map(feature => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}
    </section>
  );
}
