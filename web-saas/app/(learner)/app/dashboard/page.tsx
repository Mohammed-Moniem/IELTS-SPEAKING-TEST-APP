'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/components/auth/AuthProvider';
import { ApiError, webApi } from '@/lib/api/client';
import type { LearnerDashboardView, LearnerProgressView } from '@/lib/types';
import { MetricCard, PageHeader, SectionCard, SkeletonSet, StatusBadge } from '@/components/ui/v2';

type ModuleKey = 'speaking' | 'writing' | 'reading' | 'listening';

const moduleConfig: Record<
  ModuleKey,
  {
    label: string;
    materialIcon: string;
    accentBg: string;
    accentText: string;
    href: string;
  }
> = {
  speaking: {
    label: 'Speaking',
    materialIcon: 'record_voice_over',
    accentBg: 'bg-violet-100 dark:bg-violet-500/20',
    accentText: 'text-violet-600 dark:text-violet-400',
    href: '/app/speaking',
  },
  writing: {
    label: 'Writing',
    materialIcon: 'edit_note',
    accentBg: 'bg-amber-100 dark:bg-amber-500/20',
    accentText: 'text-amber-600 dark:text-amber-400',
    href: '/app/writing',
  },
  reading: {
    label: 'Reading',
    materialIcon: 'auto_stories',
    accentBg: 'bg-blue-100 dark:bg-blue-500/20',
    accentText: 'text-blue-600 dark:text-blue-400',
    href: '/app/reading',
  },
  listening: {
    label: 'Listening',
    materialIcon: 'headphones',
    accentBg: 'bg-emerald-100 dark:bg-emerald-500/20',
    accentText: 'text-emerald-600 dark:text-emerald-400',
    href: '/app/listening',
  },
};

const formatDate = (iso?: string) => {
  if (!iso) return '--';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const formatBand = (value: number) => value.toFixed(1);

const getStatusTone = (status: string) => {
  const normalized = status.toLowerCase();
  if (normalized.includes('complete')) return 'success';
  if (normalized.includes('progress')) return 'warning';
  return 'neutral';
};

const deriveTargetBand = (
  dashboardView: LearnerDashboardView | null,
  progressView: LearnerProgressView | null,
) => {
  if (typeof dashboardView?.kpis.nextGoalBand === 'number') {
    return dashboardView.kpis.nextGoalBand;
  }

  if (!progressView) return null;

  return Math.min(
    9,
    Math.ceil((progressView.totals.overallBand + 0.5) * 2) / 2,
  );
};

const buildWeakestSkill = (
  progressView: LearnerProgressView | null,
  targetBand: number | null,
) => {
  if (!progressView || targetBand == null) return null;

  const ranked = (Object.entries(progressView.skillBreakdown) as Array<
    [ModuleKey, number]
  >).sort((left, right) => {
    const leftGap = Math.max(0, targetBand - left[1]);
    const rightGap = Math.max(0, targetBand - right[1]);
    if (rightGap !== leftGap) return rightGap - leftGap;
    return left[1] - right[1];
  });

  const [module, band] = ranked[0] || [];
  if (!module || typeof band !== 'number') return null;

  const meta = moduleConfig[module];
  const gap = Math.max(0, targetBand - band);

  let reason = `${meta.label} is your lowest-scoring module right now.`;
  if (gap >= 1) {
    reason = `${meta.label} has the biggest gap to your Band ${formatBand(targetBand)} target.`;
  } else if (gap > 0) {
    reason = `${meta.label} is the clearest place to gain your next band movement.`;
  }

  return {
    module,
    band,
    gap,
    targetBand,
    reason,
    ...meta,
  };
};

export default function DashboardPage() {
  const { user } = useAuth();
  const [view, setView] = useState<LearnerDashboardView | null>(null);
  const [progressView, setProgressView] = useState<LearnerProgressView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    void (async () => {
      setLoading(true);
      setError('');

      const [dashboardResult, progressResult] = await Promise.allSettled([
        webApi.getLearnerDashboardView(),
        webApi.getLearnerProgressView({ range: '90d', module: 'all' }),
      ]);

      if (!active) return;

      if (dashboardResult.status === 'rejected') {
        const message =
          dashboardResult.reason instanceof ApiError
            ? dashboardResult.reason.message
            : 'Failed to load learner dashboard';
        setError(message);
        setView(null);
        setProgressView(null);
        setLoading(false);
        return;
      }

      setView(dashboardResult.value);
      setProgressView(
        progressResult.status === 'fulfilled' ? progressResult.value : null,
      );
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, []);

  const quickCards = useMemo(() => {
    if (!view) return [];
    return view.quickPractice
      .filter(item => item.module in moduleConfig)
      .map(item => ({
        ...item,
        ...moduleConfig[item.module as ModuleKey],
      }));
  }, [view]);

  const targetBand = useMemo(
    () => deriveTargetBand(view, progressView),
    [view, progressView],
  );

  const weakestSkill = useMemo(
    () => buildWeakestSkill(progressView, targetBand),
    [progressView, targetBand],
  );

  const fallbackQuickCard = quickCards[0] || null;

  const supportingQuickCards = useMemo(() => {
    return quickCards
      .filter(card => card.module !== weakestSkill?.module)
      .slice(0, 3);
  }, [quickCards, weakestSkill]);

  const primaryAction = useMemo(() => {
    if (view?.resume) {
      return {
        eyebrow: 'Active session',
        title: 'Resume your current session',
        description: `${view.resume.title} is still in progress. Pick up from ${Math.round(
          view.resume.progressPercent,
        )}% and keep your momentum today.`,
        ctaLabel: 'Resume now',
        href: view.resume.href,
        icon: 'play_arrow',
        tone: 'warning' as const,
      };
    }

    if (weakestSkill) {
      return {
        eyebrow: 'Next best step',
        title: 'Focus on your weakest skill',
        description: weakestSkill.reason,
        ctaLabel: `Practice ${weakestSkill.label}`,
        href: weakestSkill.href,
        icon: 'arrow_forward',
        tone: 'brand' as const,
      };
    }

    if (fallbackQuickCard) {
      return {
        eyebrow: 'Next practice',
        title: 'Pick up your next practice session',
        description:
          fallbackQuickCard.description ||
          `Start a focused ${fallbackQuickCard.label.toLowerCase()} session and keep your streak moving.`,
        ctaLabel: `Start ${fallbackQuickCard.label}`,
        href: fallbackQuickCard.href,
        icon: 'arrow_forward',
        tone: 'brand' as const,
      };
    }

    return {
      eyebrow: 'Next practice',
      title: 'Pick up your next practice session',
      description:
        'Start with a short speaking drill to rebuild momentum and get quick feedback.',
      ctaLabel: 'Start Speaking',
      href: '/app/speaking',
      icon: 'arrow_forward',
      tone: 'brand' as const,
    };
  }, [fallbackQuickCard, view, weakestSkill]);

  if (loading && !view) {
    return (
      <div className="space-y-8 max-w-7xl mx-auto">
        <SkeletonSet rows={2} />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <SkeletonSet rows={8} />
          <SkeletonSet rows={6} />
          <SkeletonSet rows={6} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
          <SkeletonSet rows={5} />
          <SkeletonSet rows={5} />
          <SkeletonSet rows={5} />
          <SkeletonSet rows={5} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-[1440px] mx-auto w-full">
      <PageHeader
        kicker="Dashboard"
        title={`Welcome back, ${user?.firstName || 'Student'}`}
        subtitle="Pick up where you left off or focus on the skill most likely to improve your score next."
      />

      {view ? (
        <div className="space-y-8">
          <section className="relative overflow-hidden rounded-[32px] border border-violet-200/60 bg-gradient-to-br from-white via-violet-50 to-indigo-50 px-6 py-6 shadow-[0_18px_60px_-30px_rgba(79,70,229,0.45)] dark:border-violet-500/20 dark:from-gray-950 dark:via-violet-950/40 dark:to-slate-950 lg:px-8 lg:py-8">
            <div className="absolute -right-10 -top-12 h-36 w-36 rounded-full bg-violet-300/30 blur-3xl dark:bg-violet-500/20" />
            <div className="absolute -bottom-16 left-0 h-40 w-40 rounded-full bg-indigo-300/20 blur-3xl dark:bg-indigo-500/20" />

            <div className="relative z-10 grid grid-cols-1 gap-6 lg:grid-cols-[1.5fr_0.9fr] lg:items-start">
              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge tone={primaryAction.tone}>
                    {primaryAction.eyebrow}
                  </StatusBadge>
                  {weakestSkill && !view.resume ? (
                    <StatusBadge tone="neutral">
                      Gap {formatBand(weakestSkill.gap)} bands
                    </StatusBadge>
                  ) : null}
                </div>

                <div className="space-y-3">
                  <h2 className="text-3xl font-black tracking-tight text-gray-950 dark:text-white sm:text-[2.5rem]">
                    {primaryAction.title}
                  </h2>
                  <p className="max-w-2xl text-base leading-7 text-gray-600 dark:text-gray-300">
                    {primaryAction.description}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {view.resume ? (
                    <>
                      <span className="rounded-full border border-white/60 bg-white/70 px-3 py-1 text-xs font-semibold text-gray-700 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5 dark:text-gray-200">
                        {view.resume.title}
                      </span>
                      <span className="rounded-full border border-white/60 bg-white/70 px-3 py-1 text-xs font-semibold text-gray-700 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5 dark:text-gray-200">
                        {view.resume.subtitle}
                      </span>
                      <span className="rounded-full border border-white/60 bg-white/70 px-3 py-1 text-xs font-semibold text-gray-700 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5 dark:text-gray-200">
                        {Math.round(view.resume.progressPercent)}% complete
                      </span>
                    </>
                  ) : weakestSkill ? (
                    <>
                      <span className="rounded-full border border-white/60 bg-white/70 px-3 py-1 text-xs font-semibold text-gray-700 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5 dark:text-gray-200">
                        Current band {formatBand(weakestSkill.band)}
                      </span>
                      <span className="rounded-full border border-white/60 bg-white/70 px-3 py-1 text-xs font-semibold text-gray-700 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5 dark:text-gray-200">
                        Target band {formatBand(weakestSkill.targetBand)}
                      </span>
                    </>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-3 pt-1">
                  <Link
                    href={primaryAction.href}
                    className="inline-flex items-center gap-2 rounded-2xl bg-violet-600 px-6 py-3 text-sm font-bold text-white shadow-xl shadow-violet-500/25 transition-all hover:-translate-y-0.5 hover:bg-violet-700"
                  >
                    {primaryAction.ctaLabel}
                    <span className="material-symbols-outlined text-[18px]">
                      {primaryAction.icon}
                    </span>
                  </Link>

                  {view.resume ? (
                    <Link
                      href="/app/study-plan"
                      className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white/80 px-5 py-3 text-sm font-bold text-gray-700 shadow-sm transition-colors hover:bg-white dark:border-gray-700 dark:bg-gray-900/70 dark:text-gray-200 dark:hover:bg-gray-900"
                    >
                      Review study plan
                    </Link>
                  ) : weakestSkill ? (
                    <Link
                      href="/app/study-plan"
                      className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white/80 px-5 py-3 text-sm font-bold text-gray-700 shadow-sm transition-colors hover:bg-white dark:border-gray-700 dark:bg-gray-900/70 dark:text-gray-200 dark:hover:bg-gray-900"
                    >
                      Open study plan
                    </Link>
                  ) : null}
                </div>
              </div>

              <div className="rounded-3xl border border-white/60 bg-white/75 p-5 shadow-lg backdrop-blur dark:border-white/10 dark:bg-white/5">
                {view.resume ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.24em] text-indigo-500 dark:text-indigo-300">
                          Resume path
                        </p>
                        <p className="mt-1 text-lg font-bold text-gray-900 dark:text-white">
                          {view.resume.title}
                        </p>
                      </div>
                      <div className={`h-12 w-12 rounded-2xl flex items-center justify-center ${moduleConfig.speaking.accentBg}`}>
                        <span className={`material-symbols-outlined text-[22px] ${moduleConfig.speaking.accentText}`}>
                          play_circle
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs font-semibold text-gray-500 dark:text-gray-400">
                        <span>Progress</span>
                        <span>{Math.round(view.resume.progressPercent)}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-400"
                          style={{
                            width: `${Math.max(
                              6,
                              Math.min(100, view.resume.progressPercent),
                            )}%`,
                          }}
                        />
                      </div>
                    </div>

                    <p className="text-sm leading-6 text-gray-600 dark:text-gray-300">
                      Finish this attempt first, then come back for a focused skill block.
                    </p>
                  </div>
                ) : weakestSkill ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className={`h-12 w-12 rounded-2xl flex items-center justify-center ${weakestSkill.accentBg}`}>
                        <span className={`material-symbols-outlined text-[22px] ${weakestSkill.accentText}`}>
                          {weakestSkill.materialIcon}
                        </span>
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.24em] text-violet-500 dark:text-violet-300">
                          Why this focus
                        </p>
                        <p className="mt-1 text-lg font-bold text-gray-900 dark:text-white">
                          {weakestSkill.label}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-2xl bg-gray-100 px-3 py-3 text-center dark:bg-gray-900/70">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                          Current
                        </p>
                        <p className="mt-1 text-lg font-black text-gray-900 dark:text-white">
                          {formatBand(weakestSkill.band)}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-gray-100 px-3 py-3 text-center dark:bg-gray-900/70">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                          Target
                        </p>
                        <p className="mt-1 text-lg font-black text-gray-900 dark:text-white">
                          {formatBand(weakestSkill.targetBand)}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-gray-100 px-3 py-3 text-center dark:bg-gray-900/70">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                          Gap
                        </p>
                        <p className="mt-1 text-lg font-black text-gray-900 dark:text-white">
                          {formatBand(weakestSkill.gap)}
                        </p>
                      </div>
                    </div>

                    <p className="text-sm leading-6 text-gray-600 dark:text-gray-300">
                      A focused session here should improve your overall score faster than spreading attention across every module.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs font-bold uppercase tracking-[0.24em] text-violet-500 dark:text-violet-300">
                      Fallback action
                    </p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                      Keep today simple
                    </p>
                    <p className="text-sm leading-6 text-gray-600 dark:text-gray-300">
                      Progress data is unavailable right now, so start with one focused practice block and keep your study streak moving.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {view.resume && weakestSkill ? (
              <SectionCard
                title="Weakest skill focus"
                subtitle="Use this as your next targeted improvement block after you finish the active session."
              >
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className={`h-12 w-12 rounded-2xl flex items-center justify-center ${weakestSkill.accentBg}`}>
                      <span className={`material-symbols-outlined text-[22px] ${weakestSkill.accentText}`}>
                        {weakestSkill.materialIcon}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                        {weakestSkill.label}
                      </h3>
                      <p className="text-sm leading-6 text-gray-500 dark:text-gray-400">
                        {weakestSkill.reason}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <StatusBadge tone="warning">
                      Current {formatBand(weakestSkill.band)}
                    </StatusBadge>
                    <StatusBadge tone="brand">
                      Target {formatBand(weakestSkill.targetBand)}
                    </StatusBadge>
                    <StatusBadge tone="neutral">
                      Gap {formatBand(weakestSkill.gap)}
                    </StatusBadge>
                  </div>

                  <div className="flex flex-wrap gap-3 pt-1">
                    <Link
                      href={weakestSkill.href}
                      className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                    >
                      Practice {weakestSkill.label}
                    </Link>
                    <Link
                      href="/app/study-plan"
                      className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                    >
                      Open study plan
                    </Link>
                  </div>
                </div>
              </SectionCard>
            ) : (
              <SectionCard
                title="Other ways to practice"
                subtitle="Keep these options secondary so your main next step stays obvious."
              >
                <div className="space-y-3">
                  {supportingQuickCards.length > 0 ? (
                    supportingQuickCards.map(card => (
                      <article
                        key={`${card.module}-${card.title}`}
                        className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4 transition-colors hover:border-violet-200 hover:bg-violet-50/60 dark:border-gray-800 dark:bg-gray-800/40 dark:hover:border-violet-500/30 dark:hover:bg-violet-500/10"
                      >
                        <div className="flex items-start gap-3">
                          <div className={`h-10 w-10 rounded-2xl flex items-center justify-center ${card.accentBg}`}>
                            <span className={`material-symbols-outlined text-[20px] ${card.accentText}`}>
                              {card.materialIcon}
                            </span>
                          </div>
                          <div className="min-w-0 flex-1 space-y-2">
                            <div>
                              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                                {card.title}
                              </h3>
                              <p className="text-sm leading-6 text-gray-500 dark:text-gray-400">
                                {card.description}
                              </p>
                            </div>
                            <Link
                              href={card.href}
                              className="inline-flex items-center gap-2 text-sm font-bold text-violet-600 transition-colors hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300"
                            >
                              Start {card.label}
                              <span className="material-symbols-outlined text-[16px]">
                                arrow_forward
                              </span>
                            </Link>
                          </div>
                        </div>
                      </article>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      More practice paths will appear here as you build activity across modules.
                    </p>
                  )}
                </div>
              </SectionCard>
            )}

            <SectionCard
              title="Suggested speaking prompts"
              subtitle="Use these to warm up when you want a lighter session before a full practice block."
            >
              <div className="space-y-3">
                {view.recommended.length > 0 ? (
                  <>
                    <ul className="space-y-3">
                      {view.recommended.slice(0, 3).map(item => (
                        <li
                          key={item.topicId}
                          className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4 dark:border-gray-800 dark:bg-gray-800/40"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-bold text-gray-900 dark:text-white">
                                {item.title}
                              </p>
                              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                Part {item.part}
                                {item.difficulty ? ` • ${item.difficulty}` : ''}
                              </p>
                            </div>
                            <span className="rounded-full bg-white px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-500 shadow-sm ring-1 ring-gray-900/5 dark:bg-gray-700 dark:text-gray-300 dark:ring-white/10">
                              Prompt
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>

                    <Link
                      href="/app/speaking"
                      className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                    >
                      Browse speaking library
                    </Link>
                  </>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    New speaking prompts will appear here after more practice activity is recorded.
                  </p>
                )}
              </div>
            </SectionCard>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
            <MetricCard
              tone="brand"
              label="Average Band"
              value={formatBand(view.kpis.averageBand)}
              helper="Current overall benchmark"
            />
            <MetricCard
              tone="success"
              label="Current Streak"
              value={`${view.kpis.currentStreak} Days`}
              helper="Stay consistent to keep improving"
            />
            <MetricCard
              tone="info"
              label="Tests Completed"
              value={view.kpis.testsCompleted}
              helper="Tracked attempts across your account"
            />
            <MetricCard
              tone="warning"
              label="Next Goal"
              value={`Band ${formatBand(view.kpis.nextGoalBand)}`}
              helper="Use the dashboard focus to close the gap"
            />
          </div>

          <SectionCard
            title="Recent Activity"
            actions={
              <Link
                href="/app/progress"
                className="text-sm font-bold text-violet-600 transition-colors hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300"
              >
                View full timeline
              </Link>
            }
          >
            <div className="overflow-x-auto -mx-6 px-6">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="border-b-2 border-gray-100 dark:border-gray-800/80">
                    <th className="px-4 py-4 text-left text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">
                      Module
                    </th>
                    <th className="px-4 py-4 text-left text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">
                      Topic
                    </th>
                    <th className="px-4 py-4 text-left text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">
                      Date
                    </th>
                    <th className="px-4 py-4 text-right text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">
                      Score
                    </th>
                    <th className="px-4 py-4 text-center text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
                  {view.activity.slice(0, 6).map(item => (
                    <tr
                      key={`${item.module}-${item.itemId}`}
                      className="group transition-colors hover:bg-gray-50/80 dark:hover:bg-gray-800/30"
                    >
                      <td className="px-4 py-5">
                        <span className="inline-flex items-center gap-1.5 text-sm font-bold text-gray-700 dark:text-gray-300">
                          <span className={`material-symbols-outlined text-[18px] ${moduleConfig[item.module as ModuleKey]?.accentText}`}>
                            {moduleConfig[item.module as ModuleKey]?.materialIcon}
                          </span>
                          {moduleConfig[item.module as ModuleKey]?.label || item.module}
                        </span>
                      </td>
                      <td className="px-4 py-5">
                        <Link
                          href={item.href}
                          className="line-clamp-1 text-sm font-semibold text-gray-900 transition-colors hover:text-violet-600 dark:text-white dark:hover:text-violet-400"
                        >
                          {item.title}
                        </Link>
                      </td>
                      <td className="px-4 py-5 text-sm font-medium text-gray-500 dark:text-gray-400">
                        {formatDate(item.createdAt)}
                      </td>
                      <td className="px-4 py-5 text-right">
                        <span className="inline-flex items-center justify-center rounded-xl bg-gray-100 px-3 py-1.5 text-sm font-black text-gray-900 ring-1 ring-inset ring-gray-900/5 dark:bg-gray-800 dark:text-white dark:ring-white/10">
                          {item.score ? formatBand(item.score) : '--'}
                        </span>
                      </td>
                      <td className="px-4 py-5 text-center">
                        <StatusBadge tone={getStatusTone(item.status)}>
                          {item.status}
                        </StatusBadge>
                      </td>
                    </tr>
                  ))}
                  {view.activity.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-12 text-center text-sm font-medium text-gray-500"
                      >
                        No recent activity found. Start a practice session to build your dashboard.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>
      ) : null}

      {error ? (
        <div className="flex items-start gap-4 rounded-2xl border border-red-200 bg-red-50 p-6 shadow-sm dark:border-red-500/20 dark:bg-red-500/10">
          <span className="material-symbols-outlined mt-0.5 text-red-600 dark:text-red-400">
            error
          </span>
          <div>
            <h3 className="text-sm font-bold text-red-800 dark:text-red-300">
              Dashboard Unavailable
            </h3>
            <p className="mt-1 text-sm text-red-700 dark:text-red-400/90">
              {error}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
