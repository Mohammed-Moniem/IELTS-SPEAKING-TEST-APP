'use client';

import { useEffect, useMemo, useState } from 'react';

import { apiRequest, ApiError } from '@/lib/api/client';
import { FeatureFlag } from '@/lib/types';

type PendingMutation = {
  flag: FeatureFlag;
  nextEnabled: boolean;
  nextRollout: number;
};

const isHighImpactFlag = (flagKey: string) => {
  const key = flagKey.toLowerCase();
  return (
    key.includes('speaking') ||
    key.includes('billing') ||
    key.includes('auth') ||
    key.includes('admin') ||
    key.includes('full_exam')
  );
};

export default function AdminFlagsPage() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingMutation, setPendingMutation] = useState<PendingMutation | null>(null);
  const [confirmationText, setConfirmationText] = useState('');

  const expectedConfirmation = useMemo(() => {
    if (!pendingMutation) return '';
    return `${pendingMutation.nextEnabled ? 'ENABLE' : 'DISABLE'} ${pendingMutation.flag.key}`;
  }, [pendingMutation]);

  const loadFlags = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiRequest<FeatureFlag[]>('/admin/feature-flags');
      setFlags(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load feature flags');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadFlags();
  }, []);

  const applyMutation = async (mutation: PendingMutation) => {
    setError('');
    setSuccess('');

    try {
      await apiRequest<FeatureFlag>(`/admin/feature-flags/${mutation.flag.key}`, {
        method: 'PATCH',
        body: JSON.stringify({
          enabled: mutation.nextEnabled,
          rolloutPercentage: mutation.nextRollout,
          description: mutation.flag.description
        })
      });

      setSuccess(`Updated ${mutation.flag.key}`);
      await loadFlags();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update feature flag');
    }
  };

  const queueToggle = (flag: FeatureFlag) => {
    const mutation: PendingMutation = {
      flag,
      nextEnabled: !flag.enabled,
      nextRollout: flag.rolloutPercentage
    };

    if (isHighImpactFlag(flag.key)) {
      setPendingMutation(mutation);
      setConfirmationText('');
      return;
    }

    void applyMutation(mutation);
  };

  const queueRolloutUpdate = (flag: FeatureFlag, rolloutPercentage: number) => {
    const mutation: PendingMutation = {
      flag,
      nextEnabled: flag.enabled,
      nextRollout: Math.max(0, Math.min(100, rolloutPercentage))
    };

    if (isHighImpactFlag(flag.key)) {
      setPendingMutation(mutation);
      setConfirmationText('');
      return;
    }

    void applyMutation(mutation);
  };

  const confirmMutation = async () => {
    if (!pendingMutation) return;
    if (confirmationText.trim() !== expectedConfirmation) {
      setError(`Confirmation text must match exactly: ${expectedConfirmation}`);
      return;
    }

    await applyMutation(pendingMutation);
    setPendingMutation(null);
    setConfirmationText('');
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-indigo-100 dark:border-indigo-900/40 bg-gradient-to-r from-indigo-600 to-violet-600 p-6 text-white">
        <span className="inline-block rounded-full bg-white/20 px-3 py-0.5 text-xs font-semibold uppercase tracking-wider mb-2">Phased rollout controls</span>
        <h1 className="text-2xl font-bold">Feature Flags with Safety Confirmation Gates</h1>
      </div>

      <article className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900 dark:text-white">All Flags</h2>
          <button className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors" onClick={() => void loadFlags()} disabled={loading}>Refresh</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                <th className="px-5 py-3">Flag</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Rollout %</th>
                <th className="px-5 py-3">Description</th>
                <th className="px-5 py-3">Safety</th>
                <th className="px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {flags.map(flag => (
                <tr key={flag.key} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <td className="px-5 py-3 font-mono text-sm font-semibold text-gray-900 dark:text-white">{flag.key}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${flag.enabled ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400'}`}>
                      {flag.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <input
                      className="w-20 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2.5 py-1.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                      type="number"
                      min={0}
                      max={100}
                      defaultValue={flag.rolloutPercentage}
                      onBlur={event => void queueRolloutUpdate(flag, Number(event.target.value || 0))}
                    />
                  </td>
                  <td className="px-5 py-3 text-gray-500 dark:text-gray-400">{flag.description || '-'}</td>
                  <td className="px-5 py-3">{isHighImpactFlag(flag.key) ? <span className="inline-block rounded-full bg-red-50 dark:bg-red-500/10 px-2.5 py-0.5 text-xs font-semibold text-red-700 dark:text-red-400">High impact</span> : <span className="text-gray-400">Standard</span>}</td>
                  <td className="px-5 py-3">
                    <button className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors" onClick={() => queueToggle(flag)}>Toggle</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      {pendingMutation ? (
        <article className="rounded-2xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-5 space-y-4">
          <h3 className="text-base font-bold text-amber-900 dark:text-amber-300">High-Impact Confirmation Required</h3>
          <p className="text-sm text-amber-800 dark:text-amber-300">
            You are about to {pendingMutation.nextEnabled ? 'enable' : 'disable'} <strong>{pendingMutation.flag.key}</strong>.
          </p>
          <p className="text-sm text-amber-800 dark:text-amber-300">Type exactly: <code className="font-mono bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded text-xs">{expectedConfirmation}</code></p>
          <input className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40" value={confirmationText} onChange={event => setConfirmationText(event.target.value)} />
          <div className="flex items-center gap-3">
            <button className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors" onClick={() => void confirmMutation()}>Confirm Change</button>
            <button className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors" onClick={() => setPendingMutation(null)}>Cancel</button>
          </div>
        </article>
      ) : null}

      {error ? <div className="rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-400">{error}</div> : null}
      {success ? <div className="rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">{success}</div> : null}
    </div>
  );
}
