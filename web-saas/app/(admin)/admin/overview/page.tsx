'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { ApiError, apiRequest, webApi } from '@/lib/api/client';
import type { AdminKpiDelta, AdminOverviewView } from '@/lib/types';
import { useAuth } from '@/components/auth/AuthProvider';
import { ModalConfirm } from '@/components/ui/v2';

type WindowFilter = '1h' | '24h' | '7d';

const growthFlags = ['growth_blog_v1', 'growth_geo_v1', 'growth_library_v1', 'growth_ads_v1', 'growth_insights_v1'];

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

const severityTone: Record<AdminOverviewView['alerts'][number]['severity'], string> = {
  critical: 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400',
  warning: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400',
  info: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'
};

const deltaLabel = (delta: AdminKpiDelta, inverse = false) => {
  const direction = delta.direction;
  const isPositive = direction === 'up';
  const isNegative = direction === 'down';
  const neutral = direction === 'flat';
  const good = neutral ? true : inverse ? isNegative : isPositive;
  const toneClass = good ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400';
  const arrow = neutral ? '→' : isPositive ? '↗' : '↘';
  const sign = delta.deltaPercent > 0 ? '+' : '';
  return (
    <span className={`mt-1 text-xs font-semibold ${toneClass}`}>
      {arrow} {sign}
      {delta.deltaPercent.toFixed(2)}% vs previous window
    </span>
  );
};

export default function AdminOverviewPage() {
  const [windowFilter, setWindowFilter] = useState<WindowFilter>('1h');
  const [view, setView] = useState<AdminOverviewView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selectedAlert, setSelectedAlert] = useState<AdminOverviewView['alerts'][number] | null>(null);
  const [rollbackModalOpen, setRollbackModalOpen] = useState(false);
  const [rollbackBusy, setRollbackBusy] = useState(false);

  const router = useRouter();
  const { user } = useAuth();
  const isSuperadmin = Boolean(user?.adminRoles?.includes('superadmin'));

  const load = async () => {
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
  };

  useEffect(() => {
    void load();
    // windowFilter is intentionally the trigger for refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowFilter]);

  const peakLatency = Math.max(...(view?.latencySeries.map(item => item.value) || [1]));
  const alertRows = useMemo(() => view?.alerts.slice(0, 6) || [], [view?.alerts]);

  const rollbackGrowthFlags = async () => {
    if (!isSuperadmin) return;

    setRollbackBusy(true);
    setError('');
    setNotice('');
    try {
      await Promise.all(
        growthFlags.map(flag =>
          apiRequest(`/admin/feature-flags/${flag}`, {
            method: 'PATCH',
            body: JSON.stringify({
              enabled: false
            })
          })
        )
      );
      setNotice('Growth rollback applied. All growth_* flags were disabled.');
      setRollbackModalOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to execute growth rollback');
    } finally {
      setRollbackBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Dashboard / Overview</h1>
        <span className="rounded-full bg-emerald-100 dark:bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-400">
          System Normal
        </span>
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
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Active Users</p>
              <p className="mt-1 text-3xl font-extrabold text-gray-900 dark:text-white">{view.kpis.activeUsers.toLocaleString()}</p>
              {deltaLabel(view.kpiDeltas.activeUsers)}
            </article>
            <article className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Weekly Revenue</p>
              <p className="mt-1 text-3xl font-extrabold text-gray-900 dark:text-white">{formatCurrency(view.kpis.estimatedRevenueUsd)}</p>
              {deltaLabel(view.kpiDeltas.estimatedRevenueUsd)}
            </article>
            <article className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">AI Cost (Est.)</p>
              <p className="mt-1 text-3xl font-extrabold text-gray-900 dark:text-white">{formatCurrency(view.kpis.aiCostUsd)}</p>
              {deltaLabel(view.kpiDeltas.aiCostUsd, true)}
            </article>
            <article className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Platform Health</p>
              <p className="mt-1 text-3xl font-extrabold text-gray-900 dark:text-white">{view.kpis.platformHealthPercent.toFixed(2)}%</p>
              {deltaLabel(view.kpiDeltas.platformHealthPercent)}
            </article>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4 items-start">
            <article className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-gray-900 dark:text-white">AI Endpoint Latency</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Real-time monitoring of OpenAI and custom model response times.
                  </p>
                </div>
                <select
                  className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                  value={windowFilter}
                  onChange={event => setWindowFilter(event.target.value as WindowFilter)}
                >
                  <option value="1h">Last Hour</option>
                  <option value="24h">24 Hours</option>
                  <option value="7d">7 Days</option>
                </select>
              </div>
              <div className="flex items-end gap-2 h-48">
                {view.latencySeries.map(item => (
                  <div key={item.label} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full rounded-t-lg bg-indigo-500 transition-all"
                      style={{ height: `${Math.max(8, (item.value / peakLatency) * 180)}px` }}
                    />
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate max-w-full">{item.label}</span>
                  </div>
                ))}
              </div>
            </article>

            <aside className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">Feature Flags</h3>
                <span className="rounded-full bg-gray-100 dark:bg-gray-800 px-2.5 py-0.5 text-[10px] font-bold text-gray-600 dark:text-gray-400">
                  Production
                </span>
              </div>
              <ul className="space-y-2">
                {view.featureFlagSummary.slice(0, 4).map(item => (
                  <li key={item.key} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-700 dark:text-gray-300">{item.key}</p>
                      <span className="text-[10px] text-gray-500 dark:text-gray-400">{item.rolloutPercentage}% rollout</span>
                    </div>
                    <span
                      className={`inline-flex h-5 w-9 items-center rounded-full px-0.5 ${
                        item.enabled ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm ${item.enabled ? 'translate-x-4' : 'translate-x-0'} transition-transform`} />
                    </span>
                  </li>
                ))}
              </ul>
              <button
                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                type="button"
                onClick={() => router.push('/admin/flags')}
              >
                + Manage Flags
              </button>
            </aside>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4 items-start">
            <article className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
                <h2 className="text-base font-bold text-gray-900 dark:text-white">Recent Alerts & Logs</h2>
                <button
                  type="button"
                  className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                  onClick={() => router.push('/admin/users?auditAction=update-subscription-status')}
                >
                  View All Logs
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      <th className="px-5 py-3">Severity</th>
                      <th className="px-5 py-3">Event</th>
                      <th className="px-5 py-3">Timestamp</th>
                      <th className="px-5 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {alertRows.map(item => (
                      <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                        <td className="px-5 py-3">
                          <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${severityTone[item.severity]}`}>
                            {item.severity.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <p className="text-sm text-gray-900 dark:text-white">{item.action}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{item.targetType}</p>
                        </td>
                        <td className="px-5 py-3 text-gray-500 dark:text-gray-400">{formatRelativeDate(item.createdAt)}</td>
                        <td className="px-5 py-3">
                          <button
                            className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                            type="button"
                            onClick={() => setSelectedAlert(item)}
                          >
                            Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>

            <aside className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-3">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Deployments</h3>
              <ul className="space-y-2">
                {view.deployments.slice(0, 3).map(item => (
                  <li key={item.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-700 dark:text-gray-300">{item.name}</p>
                      <span className="text-[10px] text-gray-500 dark:text-gray-400">{formatRelativeDate(item.createdAt)}</span>
                    </div>
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        item.status === 'success'
                          ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                          : 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400'
                      }`}
                    >
                      {item.status}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <button
                  className="flex-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  type="button"
                  onClick={() => router.push('/admin/users?auditAction=deployment')}
                >
                  View Logs
                </button>
                <button
                  className="flex-1 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
                  type="button"
                  onClick={() => setRollbackModalOpen(true)}
                  disabled={!isSuperadmin}
                  title={isSuperadmin ? 'Rollback growth flags' : 'Only superadmin can trigger rollback'}
                >
                  Rollback
                </button>
              </div>
              {!isSuperadmin ? (
                <p className="text-[11px] text-amber-700 dark:text-amber-300">
                  Rollback is restricted to superadmin.
                </p>
              ) : null}
            </aside>
          </div>
        </>
      ) : null}

      {selectedAlert ? (
        <ModalConfirm
          title="Alert Details"
          subtitle="Event context and payload"
          confirmLabel="Close"
          cancelLabel="Dismiss"
          onCancel={() => setSelectedAlert(null)}
          onConfirm={() => setSelectedAlert(null)}
        >
          <div className="space-y-2 text-sm">
            <p className="text-gray-700 dark:text-gray-200">
              <strong>Action:</strong> {selectedAlert.action}
            </p>
            <p className="text-gray-700 dark:text-gray-200">
              <strong>Target:</strong> {selectedAlert.targetType} {selectedAlert.targetId ? `(${selectedAlert.targetId})` : ''}
            </p>
            <p className="text-gray-700 dark:text-gray-200">
              <strong>When:</strong> {new Date(selectedAlert.createdAt).toLocaleString()}
            </p>
            <p className="text-gray-700 dark:text-gray-200">
              <strong>Severity:</strong> {selectedAlert.severity}
            </p>
            <pre className="mt-2 max-h-56 overflow-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-3 text-xs text-gray-700 dark:text-gray-300">
              {JSON.stringify(selectedAlert.details || {}, null, 2)}
            </pre>
          </div>
        </ModalConfirm>
      ) : null}

      {rollbackModalOpen ? (
        <ModalConfirm
          title="Confirm Growth Rollback"
          subtitle="This disables growth feature flags in production."
          confirmLabel={rollbackBusy ? 'Rolling back...' : 'Disable Growth Flags'}
          cancelLabel="Cancel"
          onCancel={() => (rollbackBusy ? undefined : setRollbackModalOpen(false))}
          onConfirm={() => void rollbackGrowthFlags()}
          disabled={rollbackBusy}
        >
          <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
            <p>Flags to disable:</p>
            <ul className="list-disc pl-5">
              {growthFlags.map(flag => (
                <li key={flag}>{flag}</li>
              ))}
            </ul>
          </div>
        </ModalConfirm>
      ) : null}

      {notice ? (
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
          {notice}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      ) : null}
    </div>
  );
}
