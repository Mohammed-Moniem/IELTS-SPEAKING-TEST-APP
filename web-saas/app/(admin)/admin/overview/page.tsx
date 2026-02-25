'use client';

import { useEffect, useState } from 'react';

import { ApiError, webApi } from '@/lib/api/client';
import type { AdminOverviewView } from '@/lib/types';

type WindowFilter = '1h' | '24h' | '7d';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(value);

const formatRelativeDate = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.max(1, Math.floor(diff / 60000));
  if (minutes < 60) return `${minutes} mins ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

export default function AdminOverviewPage() {
  const [windowFilter, setWindowFilter] = useState<WindowFilter>('1h');
  const [view, setView] = useState<AdminOverviewView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError('');
      try {
        const payload = await webApi.getAdminOverviewView({ window: windowFilter });
        setView(payload);
      } catch (err: unknown) {
        const message = err instanceof ApiError ? err.message : 'Failed to load admin overview';
        setError(message);
      } finally {
        setLoading(false);
      }
    })();
  }, [windowFilter]);

  const peakLatency = Math.max(...(view?.latencySeries.map(item => item.value) || [1]));

  return (
    <section className="section-wrap st2-admin-overview-page">
      <header className="st2-page-heading">
        <div className="stack">
          <h1>Dashboard / Overview</h1>
        </div>
        <div className="cta-row">
          <span className="pill pill-green">System Normal</span>
        </div>
      </header>

      {loading && !view ? (
        <div className="grid-3">
          <div className="panel" style={{ minHeight: 116 }} />
          <div className="panel" style={{ minHeight: 116 }} />
          <div className="panel" style={{ minHeight: 116 }} />
        </div>
      ) : null}

      {view ? (
        <>
          <div className="st2-kpi-grid">
            <article className="panel st2-kpi-card">
              <p className="small">Total Active Users</p>
              <p className="kpi">{view.kpis.activeUsers.toLocaleString()}</p>
              <p className="small st2-positive">↗ +12.5% vs last month</p>
            </article>
            <article className="panel st2-kpi-card">
              <p className="small">Weekly Revenue</p>
              <p className="kpi">{formatCurrency(view.kpis.estimatedRevenueUsd)}</p>
              <p className="small st2-positive">↗ +4.2% vs last week</p>
            </article>
            <article className="panel st2-kpi-card">
              <p className="small">AI Cost (Est.)</p>
              <p className="kpi">{formatCurrency(view.kpis.aiCostUsd)}</p>
              <p className="small" style={{ color: 'var(--danger)' }}>
                ↗ +8.1% spike detected
              </p>
            </article>
            <article className="panel st2-kpi-card">
              <p className="small">Platform Health</p>
              <p className="kpi">{view.kpis.platformHealthPercent.toFixed(2)}%</p>
              <p className="small">Uptime (30d)</p>
            </article>
          </div>

          <div className="st2-admin-overview-grid">
            <article className="panel st2-latency-card">
              <div className="st2-section-head">
                <div>
                  <h2>AI Endpoint Latency</h2>
                  <p className="subtitle">Real-time monitoring of OpenAI and custom model response times.</p>
                </div>
                <select
                  className="select st2-filter-select"
                  value={windowFilter}
                  onChange={event => setWindowFilter(event.target.value as WindowFilter)}
                >
                  <option value="1h">Last Hour</option>
                  <option value="24h">24 Hours</option>
                  <option value="7d">7 Days</option>
                </select>
              </div>
              <div className="st2-latency-bars">
                {view.latencySeries.map(item => (
                  <div key={item.label} className="st2-latency-bar-wrap">
                    <div className="st2-latency-bar" style={{ height: `${Math.max(8, (item.value / peakLatency) * 180)}px` }} />
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
            </article>

            <aside className="panel st2-feature-rail">
              <div className="st2-section-head">
                <h3>Feature Flags</h3>
                <span className="tag">Production</span>
              </div>
              <ul className="st2-flag-list">
                {view.featureFlagSummary.slice(0, 4).map(item => (
                  <li key={item.key}>
                    <div>
                      <p>{item.key}</p>
                      <span>{item.rolloutPercentage}% rollout</span>
                    </div>
                    <button type="button" className={`st2-toggle ${item.enabled ? 'on' : ''}`} aria-label={`Toggle ${item.key}`} />
                  </li>
                ))}
              </ul>
              <button className="btn btn-secondary" type="button">
                + Manage Flags
              </button>
            </aside>
          </div>

          <div className="st2-admin-overview-grid">
            <article className="panel">
              <div className="st2-section-head">
                <h2>Recent Alerts & Logs</h2>
                <a href="/admin/flags">View All Logs</a>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Severity</th>
                      <th>Event</th>
                      <th>Timestamp</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {view.alerts.slice(0, 6).map((item, index) => (
                      <tr key={item.id}>
                        <td>
                          <span className={index === 0 ? 'pill pill-amber' : index === 1 ? 'pill pill-slate' : 'pill pill-green'}>
                            {index === 0 ? 'CRITICAL' : index === 1 ? 'WARNING' : 'INFO'}
                          </span>
                        </td>
                        <td>
                          {item.action}
                          <p className="small">{item.targetType}</p>
                        </td>
                        <td>{formatRelativeDate(item.createdAt)}</td>
                        <td>
                          <button className="btn btn-secondary" type="button">
                            Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>

            <aside className="panel st2-deploy-card">
              <h3>Deployments</h3>
              <ul>
                {view.deployments.slice(0, 3).map(item => (
                  <li key={item.id}>
                    <div>
                      <p>{item.name}</p>
                      <span>{formatRelativeDate(item.createdAt)}</span>
                    </div>
                    <span className={item.status === 'success' ? 'pill pill-green' : 'pill pill-amber'}>{item.status}</span>
                  </li>
                ))}
              </ul>
              <div className="cta-row">
                <button className="btn btn-secondary" type="button">
                  View Logs
                </button>
                <button className="btn btn-primary" type="button">
                  Rollback
                </button>
              </div>
            </aside>
          </div>
        </>
      ) : null}

      {error ? <div className="alert alert-error">{error}</div> : null}
    </section>
  );
}
