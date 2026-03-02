'use client';

import { useEffect, useState } from 'react';

import { useAuth } from '@/components/auth/AuthProvider';
import { ApiError, webApi } from '@/lib/api/client';
import { PageHeader, SectionCard, MetricCard } from '@/components/ui/v2';
import type { LeaderboardEntry, LeaderboardMetric, LeaderboardPeriod, LeaderboardPosition } from '@/lib/types';

const PERIODS: { value: LeaderboardPeriod; label: string }[] = [
  { value: 'weekly', label: 'This Week' },
  { value: 'monthly', label: 'This Month' },
  { value: 'all-time', label: 'All Time' }
];

const METRICS: { value: LeaderboardMetric; label: string; icon: string }[] = [
  { value: 'score', label: 'Score', icon: 'trending_up' },
  { value: 'practices', label: 'Practices', icon: 'fitness_center' },
  { value: 'achievements', label: 'Achievements', icon: 'emoji_events' },
  { value: 'streak', label: 'Streak', icon: 'local_fire_department' }
];

const medalColors = ['text-yellow-500', 'text-gray-400', 'text-orange-600'];

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [position, setPosition] = useState<LeaderboardPosition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState<LeaderboardPeriod>('all-time');
  const [metric, setMetric] = useState<LeaderboardMetric>('score');
  const [tab, setTab] = useState<'global' | 'friends'>('global');
  const [optingIn, setOptingIn] = useState(false);

  useEffect(() => {
    void fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, metric, tab]);

  async function fetchData() {
    setLoading(true);
    setError('');
    try {
      const [lb, pos] = await Promise.all([
        tab === 'friends'
          ? webApi.getFriendsLeaderboard({ period, metric })
          : webApi.getLeaderboard({ period, metric, limit: 50 }),
        webApi.getMyLeaderboardPosition({ period, metric }).catch(() => null)
      ]);
      setEntries(lb);
      setPosition(pos);
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : 'Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  }

  async function handleOptIn() {
    setOptingIn(true);
    try {
      await webApi.leaderboardOptIn();
      await fetchData();
    } catch {
      /* ignore */
    } finally {
      setOptingIn(false);
    }
  }

  const metricLabel = (value: number) => {
    if (metric === 'score') return value.toFixed(1);
    return String(Math.round(value));
  };

  /* ── Loading skeleton ── */
  if (loading && entries.length === 0) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-56 rounded-lg bg-gray-200 dark:bg-gray-800 animate-pulse" />
        <div className="flex gap-3">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-10 w-28 rounded-xl bg-gray-200 dark:bg-gray-800 animate-pulse" />
          ))}
        </div>
        <div className="space-y-3">
          {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
            <div key={i} className="h-16 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <PageHeader
        title="Leaderboard"
        subtitle="Compete with other learners and climb the ranks."
      />

      {/* ── My position card ── */}
      {position ? (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <MetricCard
            tone="brand"
            label="Your Rank"
            value={`#${position.rank}`}
          />
          <MetricCard
            tone="neutral"
            label="Your Score"
            value={metricLabel(position.score)}
          />
          <MetricCard
            tone="info"
            label="Total Users"
            value={position.totalUsers.toLocaleString()}
          />
          <MetricCard
            tone="success"
            label="Percentile"
            value={`Top ${(100 - position.percentile).toFixed(1)}%`}
          />
        </div>
      ) : !loading && !error ? (
        <div className="rounded-2xl border border-violet-200 dark:border-violet-500/20 bg-violet-50 dark:bg-violet-500/10 p-6 text-center">
          <span className="material-symbols-outlined text-[36px] text-violet-500 mb-2 block">group_add</span>
          <h3 className="text-base font-bold text-violet-700 dark:text-violet-300">Join the Leaderboard</h3>
          <p className="text-sm text-violet-600/80 dark:text-violet-400/80 mt-1 mb-4">
            Opt in to see your ranking and compete with other learners.
          </p>
          <button
            onClick={handleOptIn}
            disabled={optingIn}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 hover:bg-violet-700 transition-colors disabled:opacity-50"
          >
            {optingIn ? 'Joining…' : 'Opt In'}
          </button>
        </div>
      ) : null}

      {/* ── Tabs + Filters ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Global / Friends tabs */}
        <div className="inline-flex rounded-xl bg-gray-100 dark:bg-gray-800 p-1">
          {(['global', 'friends'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${tab === t
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
            >
              {t === 'global' ? 'Global' : 'Friends'}
            </button>
          ))}
        </div>

        {/* Period filter */}
        <div className="flex flex-wrap gap-2">
          {PERIODS.map(p => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${period === p.value
                  ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/25'
                  : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-800 hover:border-violet-300 dark:hover:border-violet-500/30'
                }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Metric pills ── */}
      <div className="flex flex-wrap gap-2">
        {METRICS.map(m => (
          <button
            key={m.value}
            onClick={() => setMetric(m.value)}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors ${metric === m.value
                ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'
              }`}
          >
            <span className="material-symbols-outlined text-[16px]">{m.icon}</span>
            {m.label}
          </button>
        ))}
      </div>

      {/* ── Leaderboard list ── */}
      {entries.length > 0 ? (
        <SectionCard title="Rankings" className="p-0">
          <div className="overflow-hidden divide-y divide-gray-100 dark:divide-gray-800 -m-6 sm:-mx-6 sm:-mb-6 mt-4 border-t border-gray-100 dark:border-gray-800">
            {entries.map(entry => {
              const isMe = entry.isCurrentUser || entry.userId === user?._id;
              return (
                <div
                  key={entry.userId}
                  className={`flex items-center gap-4 px-6 py-4 transition-colors ${isMe ? 'bg-violet-50 dark:bg-violet-500/10' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                    }`}
                >
                  {/* Rank */}
                  <div className="w-10 text-center flex-shrink-0">
                    {entry.rank <= 3 ? (
                      <span className={`material-symbols-outlined text-[24px] ${medalColors[entry.rank - 1]}`}>
                        emoji_events
                      </span>
                    ) : (
                      <span className="text-sm font-bold text-gray-500 dark:text-gray-400">#{entry.rank}</span>
                    )}
                  </div>

                  {/* Avatar + Name */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {entry.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold truncate ${isMe ? 'text-violet-700 dark:text-violet-300' : 'text-gray-900 dark:text-white'}`}>
                        {entry.username} {isMe ? '(You)' : ''}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
                        <span>{entry.totalSessions} sessions</span>
                        <span>{entry.achievements} badges</span>
                        <span className="inline-flex items-center gap-0.5">
                          <span className="material-symbols-outlined text-[12px] text-orange-500">local_fire_department</span>
                          {entry.streak}d
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Score */}
                  <div className="text-right flex-shrink-0">
                    <p className={`text-lg font-extrabold ${isMe ? 'text-violet-700 dark:text-violet-300' : 'text-gray-900 dark:text-white'}`}>
                      {metricLabel(entry.score)}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {METRICS.find(m => m.value === metric)?.label || 'Score'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      ) : !loading && !error ? (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500">
          <span className="material-symbols-outlined text-[48px] mb-3 block">leaderboard</span>
          <p className="text-base font-semibold">No leaderboard data yet</p>
          <p className="text-sm mt-1">
            {tab === 'friends' ? 'Add friends and compete!' : 'Start practicing to appear on the leaderboard.'}
          </p>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 px-4 py-3 text-sm font-medium text-red-700 dark:text-red-400">
          {error}
        </div>
      ) : null}
    </div>
  );
}
