'use client';

import { useEffect, useMemo, useState } from 'react';

import { ApiError, webApi } from '@/lib/api/client';
import type { AdminAnalyticsView } from '@/lib/types';

type RangeFilter = '7d' | '30d' | '90d';

const currency = (value: number) =>
  new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(value);

export default function AdminAnalyticsPage() {
  const [range, setRange] = useState<RangeFilter>('30d');
  const [view, setView] = useState<AdminAnalyticsView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError('');
      try {
        const payload = await webApi.getAdminAnalyticsView({ range });
        setView(payload);
      } catch (err: unknown) {
        const message = err instanceof ApiError ? err.message : 'Failed to load analytics';
        setError(message);
      } finally {
        setLoading(false);
      }
    })();
  }, [range]);

  const maxActiveUsers = Math.max(...(view?.trafficSeries.map(item => item.activeUsers) || [1]));
  const maxSubmissions = Math.max(...(view?.trafficSeries.map(item => item.submissions) || [1]));

  const linePoints = useMemo(() => {
    if (!view || view.trafficSeries.length === 0) return { active: '', submissions: '' };
    const width = 780;
    const height = 250;

    const active = view.trafficSeries
      .map((item, index) => {
        const x = (index / Math.max(1, view.trafficSeries.length - 1)) * width;
        const y = height - (item.activeUsers / Math.max(1, maxActiveUsers)) * height;
        return `${x},${y}`;
      })
      .join(' ');

    const submissions = view.trafficSeries
      .map((item, index) => {
        const x = (index / Math.max(1, view.trafficSeries.length - 1)) * width;
        const y = height - (item.submissions / Math.max(1, maxSubmissions)) * height;
        return `${x},${y}`;
      })
      .join(' ');

    return { active, submissions };
  }, [maxActiveUsers, maxSubmissions, view]);

  const aiDonutStops = useMemo(() => {
    if (!view || view.aiExpenditure.byModule.length === 0) return 'var(--brand) 0deg 360deg';
    const total = Math.max(1, view.aiExpenditure.byModule.reduce((sum, item) => sum + item.costUsd, 0));
    let cursor = 0;
    const colors = ['#6f3ef0', '#4c79ff', '#eb4ba7', '#2bc48a', '#f59f0b'];
    return view.aiExpenditure.byModule
      .map((item, index) => {
        const degrees = (item.costUsd / total) * 360;
        const start = cursor;
        const end = cursor + degrees;
        cursor = end;
        return `${colors[index % colors.length]} ${start}deg ${end}deg`;
      })
      .join(', ');
  }, [view]);

  return (
    <section className="section-wrap st2-admin-analytics-page">
      <header className="st2-page-heading">
        <div className="stack">
          <h1>Analytics & Costs</h1>
          <p className="subtitle">Real-time overview of platform usage, AI token consumption, and partnership performance.</p>
        </div>
        <div className="cta-row">
          <select className="select st2-filter-select" value={range} onChange={event => setRange(event.target.value as RangeFilter)}>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
          </select>
          <button className="btn btn-primary" type="button">
            Export Report
          </button>
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
              <p className="small">Total Revenue</p>
              <p className="kpi">{currency(view.kpis.totalRevenueUsd)}</p>
              <p className="small st2-positive">↗ +12.5% vs last month</p>
            </article>
            <article className="panel st2-kpi-card">
              <p className="small">Active Users (Daily)</p>
              <p className="kpi">{view.kpis.activeUsersDaily.toLocaleString()}</p>
              <p className="small st2-positive">↗ +8.2% vs last month</p>
            </article>
            <article className="panel st2-kpi-card">
              <p className="small">Avg. Token Cost</p>
              <p className="kpi">${view.kpis.avgTokenCostUsd.toFixed(3)}</p>
              <p className="small" style={{ color: 'var(--danger)' }}>
                ↗ +2.1% per session
              </p>
            </article>
            <article className="panel st2-kpi-card">
              <p className="small">Gross Margin</p>
              <p className="kpi">{view.kpis.grossMarginPercent.toFixed(1)}%</p>
              <p className="small st2-positive">↗ +1.4% vs last month</p>
            </article>
          </div>

          <div className="st2-admin-analytics-grid">
            <article className="panel st2-traffic-card">
              <h2>Traffic & Submissions</h2>
              <p className="subtitle">Comparing daily active users vs. submission volume.</p>
              <svg className="st2-line-chart" viewBox="0 0 780 300">
                <polyline className="st2-line-grid" points="0,250 780,250" />
                <polyline className="st2-line-grid" points="0,190 780,190" />
                <polyline className="st2-line-grid" points="0,130 780,130" />
                <polyline className="st2-line-grid" points="0,70 780,70" />
                <polyline className="st2-line-series" points={linePoints.active} />
                <polyline className="st2-line-series-secondary" points={linePoints.submissions} />
              </svg>
            </article>

            <aside className="panel st2-ai-expenditure-card">
              <h2>AI Expenditure</h2>
              <p className="subtitle">Cost breakdown by module type</p>
              <div className="st2-donut" style={{ background: `conic-gradient(${aiDonutStops})` }}>
                <div>
                  <strong>{currency(view.aiExpenditure.totalCostUsd)}</strong>
                  <span>Total</span>
                </div>
              </div>
              <ul className="st2-donut-list">
                {view.aiExpenditure.byModule.map(item => (
                  <li key={item.module}>
                    <span>{item.module}</span>
                    <strong>{currency(item.costUsd)}</strong>
                  </li>
                ))}
              </ul>
            </aside>
          </div>

          <div className="st2-admin-analytics-grid">
            <article className="panel">
              <div className="st2-section-head">
                <h2>Partner Performance</h2>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Partner</th>
                      <th>Traffic</th>
                      <th>Conversions</th>
                      <th>Rate</th>
                      <th>Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {view.partnerPerformance.slice(0, 8).map(item => (
                      <tr key={item.partnerId}>
                        <td>{item.partnerName}</td>
                        <td>{item.touches.toLocaleString()}</td>
                        <td>{item.conversions.toLocaleString()}</td>
                        <td>{item.conversionRatePercent.toFixed(1)}%</td>
                        <td>{currency(item.revenueUsd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>

            <aside className="panel st2-api-health-card">
              <h2>API Health</h2>
              <ul className="st2-health-list">
                {view.apiHealth.map(item => (
                  <li key={item.module}>
                    <div className="st2-health-head">
                      <span>{item.module}</span>
                      <strong>{item.successRatePercent.toFixed(1)}%</strong>
                    </div>
                    <div className="st2-health-bar">
                      <span style={{ width: `${Math.max(4, Math.min(100, item.successRatePercent))}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </aside>
          </div>
        </>
      ) : null}

      {error ? <div className="alert alert-error">{error}</div> : null}
    </section>
  );
}
