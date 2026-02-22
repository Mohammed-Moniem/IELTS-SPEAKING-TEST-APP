'use client';

import { useEffect, useState } from 'react';

import { apiRequest } from '@/lib/api/client';

type SubscriptionRecord = {
  _id: string;
  userId?: string;
  planType: string;
  status: string;
  expiresAt?: string;
};

type SubscriptionsResponse = {
  subscriptions: SubscriptionRecord[];
  total: number;
};

export default function AdminSubscriptionsPage() {
  const [payload, setPayload] = useState<SubscriptionsResponse | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    void (async () => {
      try {
        const subscriptions = await apiRequest<SubscriptionsResponse>('/admin/subscriptions?limit=50&offset=0');
        setPayload(subscriptions);
      } catch (err: any) {
        setError(err?.message || 'Failed to load subscriptions');
      }
    })();
  }, []);

  return (
    <section className="section-wrap">
      <div className="panel hero-panel stack">
        <span className="tag">Subscription support</span>
        <h1>Admin subscriptions</h1>
      </div>

      <div className="panel stack">
        <p className="small">Total subscriptions: {payload?.total || 0}</p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>User</th>
                <th>Plan</th>
                <th>Status</th>
                <th>Expires</th>
              </tr>
            </thead>
            <tbody>
              {(payload?.subscriptions || []).map(row => (
                <tr key={row._id}>
                  <td>{row._id}</td>
                  <td>{row.userId || '-'}</td>
                  <td>{row.planType}</td>
                  <td>{row.status}</td>
                  <td>{row.expiresAt || '-'}</td>
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
