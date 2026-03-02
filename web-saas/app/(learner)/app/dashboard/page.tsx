'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/components/auth/AuthProvider';
import { ApiError, webApi } from '@/lib/api/client';
import type { LearnerDashboardView } from '@/lib/types';
import { PageHeader, MetricCard, SectionCard, StatusBadge, SkeletonSet } from '@/components/ui/v2';

type ModuleKey = 'speaking' | 'writing' | 'reading' | 'listening';

const moduleConfig: Record<ModuleKey, { materialIcon: string; accentBg: string; accentText: string; href: string }> = {
  speaking: { materialIcon: 'record_voice_over', accentBg: 'bg-violet-100 dark:bg-violet-500/20', accentText: 'text-violet-600 dark:text-violet-400', href: '/app/speaking' },
  writing: { materialIcon: 'edit_note', accentBg: 'bg-amber-100 dark:bg-amber-500/20', accentText: 'text-amber-600 dark:text-amber-400', href: '/app/writing' },
  reading: { materialIcon: 'auto_stories', accentBg: 'bg-blue-100 dark:bg-blue-500/20', accentText: 'text-blue-600 dark:text-blue-400', href: '/app/reading' },
  listening: { materialIcon: 'headphones', accentBg: 'bg-emerald-100 dark:bg-emerald-500/20', accentText: 'text-emerald-600 dark:text-emerald-400', href: '/app/listening' }
};

const titleCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const formatDate = (iso?: string) => {
  if (!iso) return '--';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
};

const getStatusTone = (status: string) => {
  const s = status.toLowerCase();
  if (s.includes('complete')) return 'success';
  if (s.includes('progress')) return 'warning';
  return 'neutral';
};

export default function DashboardPage() {
  const { user } = useAuth();
  const [view, setView] = useState<LearnerDashboardView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError('');
      try {
        const payload = await webApi.getLearnerDashboardView();
        setView(payload);
      } catch (err: unknown) {
        const message = err instanceof ApiError ? err.message : 'Failed to load learner dashboard';
        setError(message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const quickCards = useMemo(() => {
    if (!view) return [];
    return view.quickPractice
      .filter(item => item.module in moduleConfig)
      .map(item => ({
        ...item,
        ...moduleConfig[item.module as ModuleKey]
      }));
  }, [view]);

  /* ── Loading skeleton ── */
  if (loading && !view) {
    return (
      <div className="space-y-8 max-w-7xl mx-auto">
        <SkeletonSet rows={2} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <SkeletonSet rows={6} />
          <SkeletonSet rows={6} />
          <SkeletonSet rows={6} />
          <SkeletonSet rows={6} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-[1440px] mx-auto w-full">
      {/* ── Page header ── */}
      <PageHeader
        kicker="Dashboard"
        title={`Welcome back, ${user?.firstName || 'Student'} 👋`}
        subtitle="Ready to boost your IELTS score today? Your next session is waiting."
        actions={
          <Link
            href="/app/tests"
            className="group relative inline-flex items-center gap-2 overflow-hidden rounded-2xl bg-violet-600 px-6 py-3 text-sm font-bold text-white shadow-xl shadow-violet-500/25 transition-all hover:bg-violet-700 hover:-translate-y-0.5"
          >
            <span className="material-symbols-outlined text-[20px] transition-transform group-hover:rotate-90">add</span>
            Start New Test
          </Link>
        }
      />

      {view ? (
        <div className="space-y-8">
          {/* ── KPI grid ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard
              tone="brand"
              label="Average Band"
              value={view.kpis.averageBand.toFixed(1)}
              delta="↗ +0.5"
            />

            <MetricCard
              tone="success"
              label="Current Streak"
              value={`${view.kpis.currentStreak} Days`}
              helper={
                <div className="flex gap-1.5 mt-1" aria-hidden>
                  {[0, 1, 2, 3, 4].map(index => (
                    <span
                      key={index}
                      className={`h-1.5 w-8 rounded-full transition-all duration-500 ${index < Math.min(5, view.kpis.currentStreak)
                          ? 'bg-gradient-to-r from-emerald-400 to-emerald-500 shadow-sm shadow-emerald-500/30'
                          : 'bg-gray-200 dark:bg-gray-700'
                        }`}
                    />
                  ))}
                </div>
              }
            />

            <MetricCard
              tone="info"
              label="Tests Completed"
              value={view.kpis.testsCompleted}
              helper="Total monitored sessions"
            />

            <MetricCard
              tone="warning"
              label="Next Goal"
              value={`Band ${view.kpis.nextGoalBand.toFixed(1)}`}
              helper="Target: Intermediate Level"
            />
          </div>

          {/* ── Main + Rail ── */}
          <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-8 items-start">

            {/* Left Main Column: Quick Practice */}
            <SectionCard
              title="Quick Practice"
              subtitle="Jump right into your lowest-scoring modules."
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {quickCards.map((item, index) => (
                  <article
                    key={`${item.module}-${item.title}`}
                    className={`group relative overflow-hidden rounded-3xl p-6 flex flex-col gap-4 min-h-[240px] shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${index === 0
                        ? 'bg-gradient-to-br from-violet-600 via-violet-700 to-indigo-800 border-[rgba(255,255,255,0.1)] text-white shadow-violet-500/20'
                        : 'bg-white border-2 border-gray-100 dark:bg-gray-900 dark:border-gray-800'
                      }`}
                  >
                    {/* Background decoration */}
                    {index === 0 && (
                      <div className="absolute -bottom-10 -right-10 opacity-30 blur-2xl transition-transform duration-700 group-hover:scale-150">
                        <div className="w-48 h-48 rounded-full bg-violet-400 mix-blend-screen" />
                      </div>
                    )}

                    <div className="relative z-10 flex items-center justify-between">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner ${index === 0 ? 'bg-white/20 backdrop-blur-sm shadow-white/10' : item.accentBg}`}>
                        <span className={`material-symbols-outlined text-[28px] ${index === 0 ? 'text-white' : item.accentText}`}>
                          {item.materialIcon}
                        </span>
                      </div>
                    </div>

                    <div className="relative z-10 flex-1 space-y-1.5 mt-2">
                      <h3 className={`text-xl font-bold tracking-tight ${index === 0 ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                        {item.title}
                      </h3>
                      <p className={`text-sm leading-relaxed ${index === 0 ? 'text-violet-100/90' : 'text-gray-500 dark:text-gray-400'}`}>
                        {item.description}
                      </p>
                    </div>

                    <Link
                      href={item.href}
                      className={`relative z-10 mt-2 flex items-center justify-between gap-2 rounded-xl px-5 py-3 text-sm font-bold transition-all ${index === 0
                          ? 'bg-white/10 text-white hover:bg-white/20 backdrop-blur-md border border-white/20'
                          : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700'
                        }`}
                    >
                      {index === 0 ? 'Start Speaking' : `Start ${titleCase(item.module)}`}
                      <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                    </Link>
                  </article>
                ))}
              </div>
            </SectionCard>

            {/* Right rail */}
            <aside className="space-y-6">
              {/* Resume Card */}
              {view.resume ? (
                <article className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-900 to-slate-900 text-white p-6 shadow-2xl shadow-indigo-900/20">
                  <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiLz48L3N2Zz4=')] opacity-30" />

                  <div className="relative z-10 space-y-4">
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-indigo-300 backdrop-blur-md">
                      <span className="flex h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse"></span>
                      Session active
                    </div>

                    <div>
                      <h3 className="text-xl font-bold tracking-tight">{view.resume.title}</h3>
                      <p className="mt-1 text-sm text-slate-300 leading-relaxed">{view.resume.subtitle}</p>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-semibold text-slate-400">
                        <span>Progress</span>
                        <span>{Math.round(view.resume.progressPercent)}%</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden shadow-inner flex">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]"
                          style={{ width: `${Math.max(4, Math.min(100, view.resume.progressPercent))}%` }}
                        />
                      </div>
                    </div>

                    <Link
                      href={view.resume.href}
                      className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-bold text-white hover:bg-white/20 transition-all backdrop-blur-sm border border-white/20"
                    >
                      Resume Now
                      <span className="material-symbols-outlined text-[18px]">play_arrow</span>
                    </Link>
                  </div>
                </article>
              ) : null}

              {/* Recommended Topics */}
              <SectionCard title="Recommended for you" className="bg-white px-1">
                <ul className="space-y-3 mt-1">
                  {view.recommended.slice(0, 3).map(item => (
                    <li
                      key={item.topicId}
                      className="group flex flex-col gap-1 rounded-2xl border border-gray-100 bg-gray-50/50 p-4 transition-all hover:border-violet-200 hover:bg-violet-50/50 dark:border-gray-800 dark:bg-gray-800/30 dark:hover:border-violet-500/30 dark:hover:bg-violet-500/10"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <p className="font-bold text-gray-900 dark:text-white leading-snug group-hover:text-violet-700 dark:group-hover:text-violet-300 transition-colors">
                          {item.title}
                        </p>
                        <span className="shrink-0 rounded-full bg-white px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-500 shadow-sm ring-1 ring-gray-900/5 dark:bg-gray-700 dark:text-gray-300 dark:ring-white/10">
                          {item.difficulty || `Part ${item.part}`}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/app/speaking"
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 transition-all hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Browse Library
                </Link>
              </SectionCard>

              {/* Premium Upsell */}
              <article className="group overflow-hidden rounded-3xl bg-gradient-to-br from-gray-900 via-gray-800 to-black p-1 shadow-2xl">
                <div className="rounded-[22px] bg-gradient-to-br from-gray-900 to-black p-6 text-center space-y-4 relative overflow-hidden backdrop-blur-xl h-full border border-gray-800">
                  <div className="absolute -top-10 -right-10 w-32 h-32 bg-yellow-500/20 rounded-full blur-2xl transition-transform duration-700 group-hover:scale-150" />

                  <div className="relative z-10 mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center shadow-lg shadow-yellow-500/20 text-white">
                    <span className="material-symbols-outlined text-[32px]">workspace_premium</span>
                  </div>

                  <div className="relative z-10">
                    <h3 className="text-xl font-extrabold tracking-tight text-white mb-1">Go Premium</h3>
                    <p className="text-sm text-gray-400">Unlock unlimited tests, adaptive AI insights, and the band score guarantee.</p>
                  </div>

                  <Link
                    href="/app/billing"
                    className="relative z-10 inline-flex w-full justify-center rounded-xl bg-yellow-400 px-4 py-3 text-sm font-bold text-gray-900 transition-transform hover:scale-105 shadow-xl shadow-yellow-500/20"
                  >
                    View Upgrade Plans
                  </Link>
                </div>
              </article>
            </aside>
          </div>

          {/* ── Recent Activity ── */}
          <SectionCard
            title="Recent Activity"
            actions={
              <Link href="/app/progress" className="text-sm font-bold text-violet-600 dark:text-violet-400 hover:text-violet-700 transition-colors">
                View Full Timeline
              </Link>
            }
          >
            <div className="overflow-x-auto -mx-6 px-6">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="border-b-2 border-gray-100 dark:border-gray-800/80">
                    <th className="px-4 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest whitespace-nowrap">Module</th>
                    <th className="px-4 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest min-w-[200px]">Topic</th>
                    <th className="px-4 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest whitespace-nowrap">Date</th>
                    <th className="px-4 py-4 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest whitespace-nowrap">Score</th>
                    <th className="px-4 py-4 text-center text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest whitespace-nowrap">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dashed dark:divide-gray-800/60">
                  {view.activity.slice(0, 6).map((item, index) => (
                    <tr key={`${item.module}-${item.itemId}`} className="group hover:bg-gray-50/80 dark:hover:bg-gray-800/30 transition-colors">
                      <td className="px-4 py-5">
                        <span className="inline-flex items-center gap-1.5 text-sm font-bold text-gray-700 dark:text-gray-300">
                          <span className={`material-symbols-outlined text-[18px] opacity-70 ${moduleConfig[item.module as ModuleKey]?.accentText}`}>
                            {moduleConfig[item.module as ModuleKey]?.materialIcon}
                          </span>
                          {titleCase(item.module)}
                        </span>
                      </td>
                      <td className="px-4 py-5">
                        <Link href={item.href} className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors line-clamp-1">
                          {item.title}
                        </Link>
                      </td>
                      <td className="px-4 py-5 text-sm font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {formatDate(item.createdAt)}
                      </td>
                      <td className="px-4 py-5 text-right">
                        <span className="inline-flex items-center justify-center rounded-xl bg-gray-100 px-3 py-1.5 text-sm font-black text-gray-900 dark:bg-gray-800 dark:text-white ring-1 ring-inset ring-gray-900/5 dark:ring-white/10">
                          {item.score ? item.score.toFixed(1) : '--'}
                        </span>
                      </td>
                      <td className="px-4 py-5 text-center whitespace-nowrap">
                        <StatusBadge tone={getStatusTone(item.status)}>
                          {item.status}
                        </StatusBadge>
                      </td>
                    </tr>
                  ))}
                  {view.activity.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center text-sm font-medium text-gray-500">
                        No recent activity found. Start a practice session!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 shadow-sm dark:border-red-500/20 dark:bg-red-500/10 flex items-start gap-4">
          <span className="material-symbols-outlined text-red-600 dark:text-red-400 mt-0.5">error</span>
          <div>
            <h3 className="text-sm font-bold text-red-800 dark:text-red-300">Dashboard Unavailable</h3>
            <p className="mt-1 text-sm text-red-700 dark:text-red-400/90">{error}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
