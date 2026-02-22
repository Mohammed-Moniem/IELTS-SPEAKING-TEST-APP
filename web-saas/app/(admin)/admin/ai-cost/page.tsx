'use client';

import { useEffect, useState } from 'react';

import { apiRequest } from '@/lib/api/client';
import { AIUsageLog } from '@/lib/types';

type AIUsageResponse = {
  aggregate: Array<{
    _id: string;
    requestCount: number;
    costUsd: number;
    tokenCount: number;
    cacheHits: number;
  }>;
  recentLogs: AIUsageLog[];
};

export default function AdminAICostPage() {
  const [payload, setPayload] = useState<AIUsageResponse | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    void (async () => {
      try {
        const usage = await apiRequest<AIUsageResponse>('/admin/ai-usage?limit=100');
        setPayload(usage);
      } catch (err: any) {
        setError(err?.message || 'Failed to load AI usage');
      }
    })();
  }, []);

  return (
    <section className="section-wrap">
      <div className="panel hero-panel stack">
        <span className="tag">AI cost guardrails</span>
        <h1>AI request and spend visibility</h1>
      </div>

      <div className="panel stack">
        <h3>Aggregate by module</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Module</th>
                <th>Requests</th>
                <th>Tokens</th>
                <th>Cost (USD)</th>
                <th>Cache hits</th>
              </tr>
            </thead>
            <tbody>
              {(payload?.aggregate || []).map(item => (
                <tr key={item._id}>
                  <td>{item._id}</td>
                  <td>{item.requestCount}</td>
                  <td>{item.tokenCount}</td>
                  <td>${item.costUsd.toFixed(4)}</td>
                  <td>{item.cacheHits}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel stack">
        <h3>Recent AI requests</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Module</th>
                <th>Operation</th>
                <th>Status</th>
                <th>Tokens</th>
                <th>Cost</th>
              </tr>
            </thead>
            <tbody>
              {(payload?.recentLogs || []).slice(0, 20).map(log => (
                <tr key={log._id}>
                  <td>{log.module}</td>
                  <td>{log.operation}</td>
                  <td>{log.status}</td>
                  <td>{log.inputTokens + log.outputTokens}</td>
                  <td>${log.estimatedCostUsd.toFixed(4)}</td>
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
