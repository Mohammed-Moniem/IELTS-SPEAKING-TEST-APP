'use client';

import { useEffect, useMemo, useState } from 'react';

import { ApiError, webApi } from '@/lib/api/client';
import type { AdminAnalyticsView, AdminKpiDelta } from '@/lib/types';

type RangeFilter = '7d' | '30d' | '90d';

const currency = (value: number) =>
  new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(value);

const deltaLabel = (delta: AdminKpiDelta, inverse = false) => {
  const direction = delta.direction;
  const isPositive = direction === 'up';
  const isNegative = direction === 'down';
  const neutral = direction === 'flat';
  const arrow = neutral ? '→' : isPositive ? '↗' : '↘';
  const sign = delta.deltaPercent > 0 ? '+' : '';
  return `${arrow} ${sign}${delta.deltaPercent.toFixed(2)}% vs previous range`;
};

export default function AdminAnalyticsPage() {
  const [range, setRange] = useState<RangeFilter>('30d');
  const [view, setView] = useState<AdminAnalyticsView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

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

  const triggerDownload = (filename: string, contentType: string, content: string) => {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const exportReport = async (format: 'csv' | 'json') => {
    setExporting(true);
    try {
      const response = await webApi.exportAdminAnalyticsView({ range, format });
      const content = await response.text();
      const contentType = response.headers.get('content-type') || (format === 'csv' ? 'text/csv' : 'application/json');
      const filename = `spokio-admin-analytics-${range}.${format}`;
      triggerDownload(filename, contentType, content);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to export analytics report';
      setError(message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Analytics & Costs</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Real-time overview of platform usage, AI token consumption, and partnership performance.</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <select className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40" value={range} onChange={event => setRange(event.target.value as RangeFilter)}>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
          </select>
          <button
            className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors disabled:opacity-60"
            type="button"
            onClick={() => void exportReport('csv')}
            disabled={exporting}
          >
            {exporting ? 'Exporting...' : 'Export CSV'}
          </button>
          <button
            className="rounded-xl border border-indigo-200 dark:border-indigo-700 px-4 py-2.5 text-sm font-semibold text-indigo-700 dark:text-indigo-300"
            type="button"
            onClick={() => void exportReport('json')}
            disabled={exporting}
          >
            Export JSON
          </button>
        </div>
      </header>

      {loading && !view ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 animate-pulse" style={{ minHeight: 116 }} />
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 animate-pulse" style={{ minHeight: 116 }} />
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 animate-pulse" style={{ minHeight: 116 }} />
        </div>
      ) : null}

      {view ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <article className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Revenue</p>
              <p className="mt-1 text-3xl font-extrabold text-gray-900 dark:text-white">{currency(view.kpis.totalRevenueUsd)}</p>
              <p className={`mt-1 text-xs font-semibold ${view.kpiDeltas.totalRevenueUsd.direction === 'down' ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                {deltaLabel(view.kpiDeltas.totalRevenueUsd)}
              </p>
            </article>
            <article className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Active Users (Daily)</p>
              <p className="mt-1 text-3xl font-extrabold text-gray-900 dark:text-white">{view.kpis.activeUsersDaily.toLocaleString()}</p>
              <p className={`mt-1 text-xs font-semibold ${view.kpiDeltas.activeUsersDaily.direction === 'down' ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                {deltaLabel(view.kpiDeltas.activeUsersDaily)}
              </p>
            </article>
            <article className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Avg. Token Cost</p>
              <p className="mt-1 text-3xl font-extrabold text-gray-900 dark:text-white">${view.kpis.avgTokenCostUsd.toFixed(3)}</p>
              <p className={`mt-1 text-xs font-semibold ${view.kpiDeltas.avgTokenCostUsd.direction === 'up' ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                {deltaLabel(view.kpiDeltas.avgTokenCostUsd, true)}
              </p>
            </article>
            <article className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Gross Margin</p>
              <p className="mt-1 text-3xl font-extrabold text-gray-900 dark:text-white">{view.kpis.grossMarginPercent.toFixed(1)}%</p>
              <p className={`mt-1 text-xs font-semibold ${view.kpiDeltas.grossMarginPercent.direction === 'down' ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                {deltaLabel(view.kpiDeltas.grossMarginPercent)}
              </p>
            </article>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4 items-start">
            <article className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-3">
              <h2 className="text-base font-bold text-gray-900 dark:text-white">Traffic & Submissions</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Comparing daily active users vs. submission volume.</p>
              <svg className="w-full" viewBox="0 0 780 300">
                <polyline points="0,250 780,250" fill="none" stroke="currentColor" strokeWidth="1" className="text-gray-200 dark:text-gray-700" />
                <polyline points="0,190 780,190" fill="none" stroke="currentColor" strokeWidth="1" className="text-gray-200 dark:text-gray-700" />
                <polyline points="0,130 780,130" fill="none" stroke="currentColor" strokeWidth="1" className="text-gray-200 dark:text-gray-700" />
                <polyline points="0,70 780,70" fill="none" stroke="currentColor" strokeWidth="1" className="text-gray-200 dark:text-gray-700" />
                <polyline points={linePoints.active} fill="none" stroke="#6366F1" strokeWidth="2.5" strokeLinejoin="round" />
                <polyline points={linePoints.submissions} fill="none" stroke="#2bc48a" strokeWidth="2" strokeDasharray="6 4" strokeLinejoin="round" />
              </svg>
            </article>

            <aside className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-4">
              <h2 className="text-base font-bold text-gray-900 dark:text-white">AI Expenditure</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Cost breakdown by module type</p>
              <div className="relative mx-auto h-36 w-36 rounded-full" style={{ background: `conic-gradient(${aiDonutStops})` }}>
                <div className="absolute inset-3 rounded-full bg-white dark:bg-gray-900 flex flex-col items-center justify-center">
                  <strong className="text-lg font-extrabold text-gray-900 dark:text-white">{currency(view.aiExpenditure.totalCostUsd)}</strong>
                  <span className="text-[10px] text-gray-500 dark:text-gray-400">Total</span>
                </div>
              </div>
              <ul className="space-y-1.5">
                {view.aiExpenditure.byModule.map(item => (
                  <li key={item.module} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700 dark:text-gray-300">{item.module}</span>
                    <strong className="text-gray-900 dark:text-white">{currency(item.costUsd)}</strong>
                  </li>
                ))}
              </ul>
            </aside>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4 items-start">
            <article className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-3">
              <h2 className="text-base font-bold text-gray-900 dark:text-white">Funnel</h2>
              <ul className="space-y-2">
                {view.funnel.map(stage => (
                  <li key={stage.key} className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40 px-3 py-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">{stage.label}</span>
                      <span className="text-sm font-bold text-gray-900 dark:text-white">{stage.count.toLocaleString()}</span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Conversion from previous: {stage.conversionFromPreviousPercent.toFixed(2)}%</p>
                  </li>
                ))}
              </ul>
            </article>

            <aside className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-4">
              <h2 className="text-base font-bold text-gray-900 dark:text-white">Cohort Slices</h2>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">By plan</p>
                <ul className="mt-2 space-y-1.5">
                  {Object.entries(view.cohortSlices.plan).map(([plan, count]) => (
                    <li key={plan} className="flex items-center justify-between text-sm text-gray-700 dark:text-gray-300">
                      <span>{plan}</span>
                      <strong className="text-gray-900 dark:text-white">{count}</strong>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Module preference</p>
                <ul className="mt-2 space-y-1.5">
                  {Object.entries(view.cohortSlices.modulePreference).map(([module, count]) => (
                    <li key={module} className="flex items-center justify-between text-sm text-gray-700 dark:text-gray-300">
                      <span>{module}</span>
                      <strong className="text-gray-900 dark:text-white">{count}</strong>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Acquisition channel</p>
                <ul className="mt-2 space-y-1.5">
                  {Object.entries(view.cohortSlices.acquisitionChannel).map(([channel, count]) => (
                    <li key={channel} className="flex items-center justify-between text-sm text-gray-700 dark:text-gray-300">
                      <span>{channel}</span>
                      <strong className="text-gray-900 dark:text-white">{count}</strong>
                    </li>
                  ))}
                </ul>
              </div>
            </aside>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4 items-start">
            <article className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
                <h2 className="text-base font-bold text-gray-900 dark:text-white">Partner Performance</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      <th className="px-5 py-3">Partner</th>
                      <th className="px-5 py-3">Traffic</th>
                      <th className="px-5 py-3">Conversions</th>
                      <th className="px-5 py-3">Rate</th>
                      <th className="px-5 py-3">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {view.partnerPerformance.slice(0, 8).map(item => (
                      <tr key={item.partnerId} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                        <td className="px-5 py-3 font-semibold text-gray-900 dark:text-white">{item.partnerName}</td>
                        <td className="px-5 py-3 text-gray-500 dark:text-gray-400">{item.touches.toLocaleString()}</td>
                        <td className="px-5 py-3 text-gray-500 dark:text-gray-400">{item.conversions.toLocaleString()}</td>
                        <td className="px-5 py-3 text-gray-500 dark:text-gray-400">{item.conversionRatePercent.toFixed(1)}%</td>
                        <td className="px-5 py-3 font-bold text-gray-900 dark:text-white">{currency(item.revenueUsd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>

            <aside className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-3">
              <h2 className="text-base font-bold text-gray-900 dark:text-white">API Health</h2>
              <ul className="space-y-3">
                {view.apiHealth.map(item => (
                  <li key={item.module} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700 dark:text-gray-300">{item.module}</span>
                      <strong className="text-sm text-gray-900 dark:text-white">{item.successRatePercent.toFixed(1)}%</strong>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                      <span className="block h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${Math.max(4, Math.min(100, item.successRatePercent))}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </aside>
          </div>
        </>
      ) : null}

      {error ? <div className="rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-400">{error}</div> : null}
    </div>
  );
}
