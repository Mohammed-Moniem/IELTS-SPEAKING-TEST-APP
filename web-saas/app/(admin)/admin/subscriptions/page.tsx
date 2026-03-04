'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import { ApiError, webApi } from '@/lib/api/client';
import type { AdminSubscriptionListResponse, AdminSubscriptionRecord, SubscriptionPlan } from '@/lib/types';
import { useAuth } from '@/components/auth/AuthProvider';
import { ModalConfirm } from '@/components/ui/v2';

const plans: SubscriptionPlan[] = ['free', 'starter', 'premium', 'pro', 'team'];

export default function AdminSubscriptionsPage() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('query') || '';

  const [payload, setPayload] = useState<AdminSubscriptionListResponse | null>(null);
  const [query, setQuery] = useState(initialQuery);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [busySubscriptionId, setBusySubscriptionId] = useState<string | null>(null);
  const [planDrafts, setPlanDrafts] = useState<Record<string, SubscriptionPlan>>({});
  const [refundTarget, setRefundTarget] = useState<AdminSubscriptionRecord | null>(null);
  const [refundNote, setRefundNote] = useState('');

  const { user } = useAuth();
  const isSuperadmin = Boolean(user?.adminRoles?.includes('superadmin'));

  const loadSubscriptions = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await webApi.listAdminSubscriptions({
        limit: 50,
        offset: 0,
        query: query.trim() || undefined
      });
      setPayload(data);
      setPlanDrafts(
        data.subscriptions.reduce(
          (acc, row) => {
            acc[row._id] = row.planType;
            return acc;
          },
          {} as Record<string, SubscriptionPlan>
        )
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load subscriptions');
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    void loadSubscriptions();
  }, [loadSubscriptions]);

  const withBusyState = async (subscriptionId: string, operation: () => Promise<void>) => {
    setBusySubscriptionId(subscriptionId);
    setError('');
    setNotice('');
    try {
      await operation();
      await loadSubscriptions();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Subscription action failed');
    } finally {
      setBusySubscriptionId(null);
    }
  };

  const activateSubscription = async (subscriptionId: string) => {
    await withBusyState(subscriptionId, async () => {
      await webApi.updateAdminSubscriptionStatus(subscriptionId, { status: 'active' });
      setNotice('Subscription resumed.');
    });
  };

  const cancelAndDowngradeSubscription = async (subscriptionId: string) => {
    await withBusyState(subscriptionId, async () => {
      await webApi.updateAdminSubscriptionStatus(subscriptionId, { status: 'canceled' });
      setNotice('Subscription cancelled and downgraded to free.');
    });
  };

  const changePlan = async (subscriptionId: string) => {
    const nextPlan = planDrafts[subscriptionId];
    await withBusyState(subscriptionId, async () => {
      await webApi.updateAdminSubscriptionPlan(subscriptionId, { planType: nextPlan });
      setNotice(`Plan changed to ${nextPlan}.`);
    });
  };

  const submitRefundNote = async () => {
    if (!refundTarget) return;
    const note = refundNote.trim();
    if (!note) {
      setError('Refund note is required.');
      return;
    }

    await withBusyState(refundTarget._id, async () => {
      await webApi.logAdminSubscriptionRefundNote(refundTarget._id, { note });
      setNotice('Refund note logged.');
      setRefundTarget(null);
      setRefundNote('');
    });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-indigo-100 dark:border-indigo-900/40 bg-gradient-to-r from-indigo-600 to-violet-600 p-6 text-white">
        <span className="inline-block rounded-full bg-white/20 px-3 py-0.5 text-xs font-semibold uppercase tracking-wider mb-2">
          Subscription support
        </span>
        <h1 className="text-2xl font-bold">Admin Subscriptions</h1>
      </div>

      <article className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Total subscriptions: <strong className="text-gray-900 dark:text-white">{payload?.total || 0}</strong>
          </p>
          <div className="flex items-center gap-2">
            <input
              className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white"
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Search by email, user id, subscription id"
              onKeyDown={event => {
                if (event.key === 'Enter') void loadSubscriptions();
              }}
            />
            <button
              type="button"
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              onClick={() => void loadSubscriptions()}
              disabled={loading}
            >
              Search
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                <th className="px-5 py-3">ID</th>
                <th className="px-5 py-3">User</th>
                <th className="px-5 py-3">Plan</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Renewal</th>
                <th className="px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {(payload?.subscriptions || []).map(row => (
                <tr key={row._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors align-top">
                  <td className="px-5 py-3 font-mono text-xs text-gray-500 dark:text-gray-400">{row._id}</td>
                  <td className="px-5 py-3 text-gray-700 dark:text-gray-300">
                    <p>{row.userEmail || row.userId || '-'}</p>
                    {row.userName ? <p className="text-xs text-gray-500 dark:text-gray-400">{row.userName}</p> : null}
                  </td>
                  <td className="px-5 py-3 font-semibold text-gray-900 dark:text-white">{row.planType}</td>
                  <td className="px-5 py-3">
                    <span className="inline-block rounded-full bg-indigo-50 dark:bg-indigo-500/10 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 dark:text-indigo-400">
                      {row.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-500 dark:text-gray-400">{row.trialEndsAt || '-'}</td>
                  <td className="px-5 py-3">
                    <div className="space-y-2 min-w-[280px]">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          className="rounded-lg border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-500/30 dark:text-emerald-400 disabled:opacity-50"
                          onClick={() => void activateSubscription(row._id)}
                          disabled={!isSuperadmin || busySubscriptionId === row._id}
                        >
                          Activate/Resume
                        </button>
                        <button
                          type="button"
                          className="rounded-lg border border-amber-200 px-3 py-1 text-xs font-semibold text-amber-700 dark:border-amber-500/30 dark:text-amber-300 disabled:opacity-50"
                          onClick={() => void cancelAndDowngradeSubscription(row._id)}
                          disabled={!isSuperadmin || busySubscriptionId === row._id}
                        >
                          Cancel/Downgrade
                        </button>
                        <button
                          type="button"
                          className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1 text-xs font-semibold text-gray-700 dark:text-gray-300 disabled:opacity-50"
                          onClick={() => setRefundTarget(row)}
                          disabled={!isSuperadmin || busySubscriptionId === row._id}
                        >
                          Log Refund Note
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-xs text-gray-900 dark:text-white"
                          value={planDrafts[row._id] || row.planType}
                          onChange={event =>
                            setPlanDrafts(prev => ({ ...prev, [row._id]: event.target.value as SubscriptionPlan }))
                          }
                          disabled={!isSuperadmin || busySubscriptionId === row._id}
                        >
                          {plans.map(plan => (
                            <option key={`${row._id}-${plan}`} value={plan}>
                              {plan}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="rounded-lg bg-sky-600 px-3 py-1 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
                          onClick={() => void changePlan(row._id)}
                          disabled={!isSuperadmin || busySubscriptionId === row._id}
                        >
                          Change Plan
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      {!isSuperadmin ? (
        <div className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
          Subscription mutations are restricted to superadmin. Support roles remain read-only.
        </div>
      ) : null}
      {loading ? (
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
          Loading subscriptions...
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
          {notice}
        </div>
      ) : null}

      {refundTarget ? (
        <ModalConfirm
          title="Log Refund Note"
          subtitle={`Subscription ${refundTarget._id}`}
          confirmLabel="Save Note"
          cancelLabel="Cancel"
          onCancel={() => {
            setRefundTarget(null);
            setRefundNote('');
          }}
          onConfirm={() => void submitRefundNote()}
          disabled={busySubscriptionId === refundTarget._id}
        >
          <div className="space-y-2">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              This stores an auditable operations note only. It does not trigger Stripe refund transactions.
            </p>
            <textarea
              className="w-full min-h-[120px] rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white"
              value={refundNote}
              onChange={event => setRefundNote(event.target.value)}
              placeholder="Explain refund reason, approval source, and follow-up steps."
            />
          </div>
        </ModalConfirm>
      ) : null}
    </div>
  );
}
