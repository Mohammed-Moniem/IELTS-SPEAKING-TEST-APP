'use client';

import { useEffect, useState } from 'react';

import { ApiError, webApi } from '@/lib/api/client';
import { PageHeader, SectionCard, MetricCard } from '@/components/ui/v2';
import type { AchievementCategory, AchievementTier, AchievementWithProgress } from '@/lib/types';

const CATEGORIES: { value: AchievementCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'practice', label: 'Practice' },
  { value: 'improvement', label: 'Improvement' },
  { value: 'streak', label: 'Streak' },
  { value: 'social', label: 'Social' },
  { value: 'milestone', label: 'Milestone' },
  { value: 'speed', label: 'Speed' },
  { value: 'consistency', label: 'Consistency' },
  { value: 'mastery', label: 'Mastery' },
  { value: 'seasonal', label: 'Seasonal' }
];

const tierColors: Record<AchievementTier, { bg: string; text: string; ring: string }> = {
  bronze: { bg: 'bg-orange-50 dark:bg-orange-500/10', text: 'text-orange-700 dark:text-orange-400', ring: 'ring-orange-500/20' },
  silver: { bg: 'bg-gray-100 dark:bg-gray-500/10', text: 'text-gray-700 dark:text-gray-300', ring: 'ring-gray-500/20' },
  gold: { bg: 'bg-yellow-50 dark:bg-yellow-500/10', text: 'text-yellow-700 dark:text-yellow-400', ring: 'ring-yellow-500/20' },
  platinum: { bg: 'bg-cyan-50 dark:bg-cyan-500/10', text: 'text-cyan-700 dark:text-cyan-400', ring: 'ring-cyan-500/20' },
  diamond: { bg: 'bg-violet-50 dark:bg-violet-500/10', text: 'text-violet-700 dark:text-violet-400', ring: 'ring-violet-500/20' }
};

const tierOrder: AchievementTier[] = ['diamond', 'platinum', 'gold', 'silver', 'bronze'];

export default function AchievementsPage() {
  const [achievements, setAchievements] = useState<AchievementWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [category, setCategory] = useState<AchievementCategory | 'all'>('all');

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await webApi.getAchievementProgress();
        setAchievements(data);
      } catch (err: unknown) {
        setError(err instanceof ApiError ? err.message : 'Failed to load achievements');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = category === 'all' ? achievements : achievements.filter(a => a.category === category);

  const unlocked = filtered.filter(a => a.userProgress?.isUnlocked);
  const inProgress = filtered.filter(a => !a.userProgress?.isUnlocked);
  const totalPoints = unlocked.reduce((s, a) => s + a.points, 0);

  /* ── Loading skeleton ── */
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-64 rounded-lg bg-gray-200 dark:bg-gray-800 animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="h-10 rounded-xl bg-gray-200 dark:bg-gray-800 animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-48 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <PageHeader
        title="Achievements"
        subtitle="Track your milestones and earn points for every accomplishment."
      />

      {/* ── Stats bar ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          tone="neutral"
          label="Unlocked"
          value={unlocked.length}
          helper={`of ${filtered.length} achievements`}
        />
        <MetricCard
          tone="brand"
          label="Points Earned"
          value={totalPoints.toLocaleString()}
          helper="from achievements"
        />
        <MetricCard
          tone="success"
          label="Completion"
          value={`${filtered.length > 0 ? Math.round((unlocked.length / filtered.length) * 100) : 0}%`}
          helper={
            <div className="w-full h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden mt-1">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-violet-600"
                style={{ width: `${filtered.length > 0 ? (unlocked.length / filtered.length) * 100 : 0}%` }}
              />
            </div>
          }
        />
      </div>

      {/* ── Category filter ── */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map(cat => (
          <button
            key={cat.value}
            onClick={() => setCategory(cat.value)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${category === cat.value
              ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/25'
              : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-800 hover:border-violet-300 dark:hover:border-violet-500/30'
              }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* ── Unlocked section ── */}
      {unlocked.length > 0 ? (
        <SectionCard
          title={
            <span className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[22px] text-yellow-500">verified</span>
              Unlocked
            </span>
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {unlocked.map(a => (
              <AchievementCard key={a._id} achievement={a} unlocked />
            ))}
          </div>
        </SectionCard>
      ) : null}

      {/* ── In progress section ── */}
      {inProgress.length > 0 ? (
        <SectionCard
          title={
            <span className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
              <span className="material-symbols-outlined text-[22px] text-gray-400">lock</span>
              In Progress
            </span>
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {inProgress.map(a => (
              <AchievementCard key={a._id} achievement={a} />
            ))}
          </div>
        </SectionCard>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 px-4 py-3 text-sm font-medium text-red-700 dark:text-red-400">
          {error}
        </div>
      ) : null}

      {!loading && filtered.length === 0 && !error ? (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500">
          <span className="material-symbols-outlined text-[48px] mb-3 block">emoji_events</span>
          <p className="text-base font-semibold">No achievements found</p>
          <p className="text-sm mt-1">Start practicing to unlock achievements!</p>
        </div>
      ) : null}
    </div>
  );
}

/* ── Achievement card component ── */
function AchievementCard({ achievement: a, unlocked = false }: { achievement: AchievementWithProgress; unlocked?: boolean }) {
  const tc = a.tier ? tierColors[a.tier] : tierColors.bronze;
  const progress = a.userProgress?.progress ?? 0;
  const target = a.requirement.value;
  const pct = Math.min(100, target > 0 ? (progress / target) * 100 : 0);

  return (
    <article
      className={`rounded-2xl border p-5 flex flex-col gap-3 transition-all ${unlocked
        ? 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 shadow-sm'
        : 'bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800 opacity-75'
        }`}
    >
      <div className="flex items-start justify-between">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${tc.bg}`}>
          {a.icon}
        </div>
        <div className="flex items-center gap-2">
          {a.tier ? (
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${tc.bg} ${tc.text} ${tc.ring}`}>
              {a.tier.charAt(0).toUpperCase() + a.tier.slice(1)}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-violet-600 dark:text-violet-400">
            <span className="material-symbols-outlined text-[14px]">star</span>
            {a.points}
          </span>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-bold text-gray-900 dark:text-white">{a.name}</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{a.description}</p>
      </div>

      {/* Progress bar */}
      {!unlocked ? (
        <div className="mt-auto">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-500 dark:text-gray-400">{progress} / {target}</span>
            <span className="font-semibold text-gray-700 dark:text-gray-300">{Math.round(pct)}%</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-500 to-violet-600 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      ) : (
        <p className="mt-auto text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
          <span className="material-symbols-outlined text-[14px]">check_circle</span>
          Unlocked{a.userProgress?.unlockedAt ? ` ${new Date(a.userProgress.unlockedAt).toLocaleDateString()}` : ''}
        </p>
      )}
    </article>
  );
}
