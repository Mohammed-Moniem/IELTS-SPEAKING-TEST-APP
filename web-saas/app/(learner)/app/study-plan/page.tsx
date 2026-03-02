'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { ApiError, webApi } from '@/lib/api/client';
import type { LearnerProgressView } from '@/lib/types';
import { PageHeader, MetricCard, SectionCard, StatusBadge } from '@/components/ui/v2';

/* ── Adaptive study recommendation engine ── */

type SkillKey = 'speaking' | 'writing' | 'reading' | 'listening';

interface Recommendation {
  skill: SkillKey;
  icon: string;
  label: string;
  band: number;
  gap: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  tips: string[];
  actions: Array<{ label: string; href: string; icon: string }>;
  weeklyMinutes: number;
}

const SKILL_META: Record<SkillKey, { label: string; icon: string; color: string; accentBg: string }> = {
  speaking: { label: 'Speaking', icon: 'record_voice_over', color: 'text-violet-600 dark:text-violet-400', accentBg: 'bg-violet-50 dark:bg-violet-500/10' },
  writing: { label: 'Writing', icon: 'edit_note', color: 'text-blue-600 dark:text-blue-400', accentBg: 'bg-blue-50 dark:bg-blue-500/10' },
  reading: { label: 'Reading', icon: 'auto_stories', color: 'text-amber-600 dark:text-amber-400', accentBg: 'bg-amber-50 dark:bg-amber-500/10' },
  listening: { label: 'Listening', icon: 'headphones', color: 'text-emerald-600 dark:text-emerald-400', accentBg: 'bg-emerald-50 dark:bg-emerald-500/10' },
};

const SKILL_TIPS: Record<SkillKey, Record<string, string[]>> = {
  speaking: {
    critical: [
      'Practice speaking for at least 15 minutes daily with the AI simulator',
      'Record yourself and listen back — focus on coherence and fluency',
      'Build a vocabulary bank of 10 new topic-specific words weekly',
    ],
    high: [
      'Attempt full Part 2 cue card responses with a 2-minute timer',
      'Practice paraphrasing — say the same idea in 3 different ways',
    ],
    medium: [
      'Work on extending answers with examples and explanations',
      'Focus on pronunciation clarity with tongue-twister warm-ups',
    ],
    low: ['Maintain your speaking through regular practice sessions', 'Try more challenging Part 3 discussion topics'],
  },
  writing: {
    critical: [
      'Write one Task 2 essay per day following the 4-paragraph structure',
      'Study band 9 sample essays and note linking phrases',
      "Use the AI grader after every submission to track criteria scores",
    ],
    high: [
      'Practice time management: 20 min for Task 1, 40 min for Task 2',
      'Focus on lexical variety — avoid repeating the same words',
    ],
    medium: [
      'Work on complex sentence structures to boost grammar score',
      'Practice graph/chart descriptions for Task 1 (Academic)',
    ],
    low: ['Experiment with less-common vocabulary and idiomatic expressions', 'Aim for band 8+ by polishing cohesion devices'],
  },
  reading: {
    critical: [
      'Complete one full reading passage daily under timed conditions',
      'Practice skimming (main idea) and scanning (specific info) techniques',
      'Learn to identify question types: T/F/NG, matching, completion',
    ],
    high: [
      'Focus on time allocation — 20 minutes per passage maximum',
      'Underline keywords in questions before reading the passage',
    ],
    medium: [
      'Practice inference questions — answers not directly in the text',
      'Build academic reading stamina with longer practice sessions',
    ],
    low: ['Speed-read to cut your average time per passage', 'Try harder Academic passages for an extra challenge'],
  },
  listening: {
    critical: [
      'Listen to English podcasts or news for 30 minutes daily',
      'Practice note-taking during audio — capture keywords only',
      'Focus on Section 3 and 4 (academic discussions) which are hardest',
    ],
    high: [
      'Do dictation exercises to improve word-for-word comprehension',
      'Practice identifying signpost words (however, finally, in contrast)',
    ],
    medium: [
      'Work on map/diagram labelling question types',
      'Listen at 1.25x speed to train your ear for faster speech',
    ],
    low: ['Challenge yourself with varied accents (British, Australian, Canadian)', 'Focus on spelling accuracy in fill-in-the-blank questions'],
  },
};

function buildRecommendations(breakdown: LearnerProgressView['skillBreakdown'], targetBand: number): Recommendation[] {
  return (Object.keys(breakdown) as SkillKey[]).map(skill => {
    const band = breakdown[skill];
    const gap = Math.max(0, targetBand - band);
    const priority: Recommendation['priority'] =
      gap >= 2 ? 'critical' : gap >= 1 ? 'high' : gap >= 0.5 ? 'medium' : 'low';

    const tips = SKILL_TIPS[skill][priority] || SKILL_TIPS[skill].low;
    const meta = SKILL_META[skill];

    const weeklyMinutes =
      priority === 'critical' ? 180 : priority === 'high' ? 120 : priority === 'medium' ? 60 : 30;

    const actions: Recommendation['actions'] = [
      { label: `Practice ${meta.label}`, href: `/app/${skill}`, icon: meta.icon },
    ];
    if (skill === 'speaking') {
      actions.push({ label: 'Take Full Exam', href: '/app/tests', icon: 'quiz' });
    }

    return { skill, icon: meta.icon, label: meta.label, band, gap, priority, tips, actions, weeklyMinutes };
  }).sort((a, b) => b.gap - a.gap);
}

const BAND_OPTIONS = [5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9];

const priorityBadge: Record<Recommendation['priority'], { bg: string; text: string; label: string }> = {
  critical: { bg: 'bg-red-50 dark:bg-red-500/10', text: 'text-red-700 dark:text-red-400', label: 'Critical' },
  high: { bg: 'bg-amber-50 dark:bg-amber-500/10', text: 'text-amber-700 dark:text-amber-400', label: 'High' },
  medium: { bg: 'bg-blue-50 dark:bg-blue-500/10', text: 'text-blue-700 dark:text-blue-400', label: 'Medium' },
  low: { bg: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-700 dark:text-emerald-400', label: 'On Track' },
};

export default function StudyPlanPage() {
  const [view, setView] = useState<LearnerProgressView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [targetBand, setTargetBand] = useState(7);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const payload = await webApi.getLearnerProgressView({ range: '90d', module: 'all' });
        setView(payload);
        // Auto-set target 1 band above current overall
        const auto = Math.min(9, Math.ceil((payload.totals.overallBand + 0.5) * 2) / 2);
        setTargetBand(auto);
      } catch (err: unknown) {
        const message = err instanceof ApiError ? err.message : 'Unable to load progress data';
        setError(message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const recommendations = useMemo(() => {
    if (!view) return [];
    return buildRecommendations(view.skillBreakdown, targetBand);
  }, [view, targetBand]);

  const totalWeeklyMinutes = useMemo(() => recommendations.reduce((sum, r) => sum + r.weeklyMinutes, 0), [recommendations]);

  /* ── Loading skeleton ── */
  if (loading && !view) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-64 rounded-lg bg-gray-200 dark:bg-gray-800 animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-28 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 animate-pulse" />
          ))}
        </div>
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="h-52 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-[1440px] mx-auto w-full">
      {/* ── Header ── */}
      <PageHeader
        title="Personalised Study Plan"
        subtitle="AI-powered recommendations based on your performance across all four IELTS modules."
        kicker="Strategy"
        actions={
          <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white p-1 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <label className="pl-3 text-xs font-semibold uppercase tracking-widest text-gray-500 hidden sm:inline-block" htmlFor="target-band">
              Target Band:
            </label>
            <select
              id="target-band"
              value={targetBand}
              onChange={e => setTargetBand(Number(e.target.value))}
              className="rounded-lg bg-transparent px-3 py-1.5 text-sm font-bold text-gray-900 focus:outline-none dark:text-white"
            >
              {BAND_OPTIONS.map(b => (
                <option key={b} value={b}>{b.toFixed(1)}</option>
              ))}
            </select>
          </div>
        }
      />

      {view ? (
        <>
          {/* ── KPIs ── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <MetricCard
              label="Current Overall"
              value={view.totals.overallBand.toFixed(1)}
              helper="Based on 90-day data"
              tone="neutral"
            />
            <MetricCard
              label="Target Band"
              value={targetBand.toFixed(1)}
              delta={`Gap: ${Math.max(0, targetBand - view.totals.overallBand).toFixed(1)} bands`}
              tone="brand"
            />
            <MetricCard
              label="Weekly Study Plan"
              value={<>{Math.round(totalWeeklyMinutes / 60)}<span className="text-lg font-bold opacity-70 ml-1">hrs</span></>}
              helper={`${totalWeeklyMinutes} min across 4 skills`}
              tone="success"
            />
          </div>

          {/* ── Skill Breakdown Bar ── */}
          <SectionCard title="Skill Breakdown">
            <div className="space-y-4">
              {recommendations.map(r => {
                const meta = SKILL_META[r.skill];
                const pct = Math.min(100, (r.band / 9) * 100);
                const targetPct = Math.min(100, (targetBand / 9) * 100);
                return (
                  <div key={r.skill} className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${meta.accentBg}`}>
                      <span className={`material-symbols-outlined text-[20px] ${meta.color}`}>{meta.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">{meta.label}</span>
                        <span className="text-sm font-bold text-gray-900 dark:text-white">{r.band.toFixed(1)} <span className="text-xs font-normal text-gray-400">/ {targetBand.toFixed(1)}</span></span>
                      </div>
                      <div className="relative h-2.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                        <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-violet-500 to-violet-600 transition-all duration-500" style={{ width: `${pct}%` }} />
                        <div className="absolute top-0 bottom-0 w-0.5 bg-gray-400 dark:bg-gray-500" style={{ left: `${targetPct}%` }} title={`Target: ${targetBand}`} />
                      </div>
                    </div>
                    <StatusBadge tone={r.priority === 'critical' ? 'danger' : r.priority === 'high' ? 'warning' : r.priority === 'medium' ? 'info' : 'success'}>
                      {priorityBadge[r.priority].label}
                    </StatusBadge>
                  </div>
                );
              })}
            </div>
          </SectionCard>

          {/* ── Recommendation Cards ── */}
          <SectionCard title="Weekly Focus Areas">
            <div className="grid gap-6">
              {recommendations.map(r => {
                const meta = SKILL_META[r.skill];
                const priorityTone = r.priority === 'critical' ? 'danger' : r.priority === 'high' ? 'warning' : r.priority === 'medium' ? 'info' : 'success';
                return (
                  <article key={r.skill} className="rounded-2xl border border-gray-100 bg-gray-50/30 p-6 shadow-sm dark:border-gray-800/60 dark:bg-gray-800/10 space-y-5">
                    <div className="flex flex-wrap items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${meta.accentBg}`}>
                        <span className={`material-symbols-outlined text-[24px] ${meta.color}`}>{r.icon}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">{r.label}</h3>
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-0.5">
                          Current: {r.band.toFixed(1)} <span className="mx-1.5 text-gray-300">•</span> Gap: {r.gap.toFixed(1)} bands <span className="mx-1.5 text-gray-300">•</span> ~{r.weeklyMinutes} min/week
                        </p>
                      </div>
                      <StatusBadge tone={priorityTone}>
                        {priorityBadge[r.priority].label} Priority
                      </StatusBadge>
                    </div>

                    <ul className="space-y-3 bg-white dark:bg-gray-900 p-5 rounded-xl border border-gray-100 dark:border-gray-800">
                      {r.tips.map((tip, i) => (
                        <li key={i} className="flex gap-3 text-sm font-medium text-gray-700 dark:text-gray-300 leading-relaxed">
                          <span className="material-symbols-outlined text-[18px] text-amber-500 mt-0.5 flex-shrink-0">lightbulb</span>
                          {tip}
                        </li>
                      ))}
                    </ul>

                    <div className="flex flex-wrap gap-3 pt-1">
                      {r.actions.map(a => (
                        <Link
                          key={a.href}
                          href={a.href}
                          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-bold text-gray-700 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-gray-50 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                        >
                          <span className="material-symbols-outlined text-[18px] text-violet-500">{a.icon}</span>
                          {a.label}
                        </Link>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          </SectionCard>

          {/* ── Weekly Schedule Suggestion ── */}
          <SectionCard title="Suggested Weekly Schedule" subtitle="Distribute practice across the week. Focus on your weakest skills first when your energy is highest.">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3 mt-4">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, di) => {
                // Rotate through skills prioritised by gap
                const primary = recommendations[di % recommendations.length];
                const secondary = recommendations[(di + 1) % recommendations.length];
                const pm = SKILL_META[primary.skill];
                return (
                  <div key={day} className="rounded-xl border border-gray-100 bg-gray-50/50 p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-gray-800 dark:bg-gray-800/20 space-y-3">
                    <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">{day}</p>
                    <div className="flex items-center gap-2">
                      <span className={`material-symbols-outlined text-[18px] ${pm.color}`}>{pm.icon}</span>
                      <span className="text-sm font-bold text-gray-900 dark:text-white">{primary.label}</span>
                    </div>
                    {di < 5 && (
                      <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-800/60">
                        <span className={`material-symbols-outlined text-[16px] ${SKILL_META[secondary.skill].color}`}>{SKILL_META[secondary.skill].icon}</span>
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{secondary.label}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </SectionCard>

          {/* ── CTA ── */}
          <div className="flex flex-wrap gap-3">
            <Link
              href="/app/progress"
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">monitoring</span>
              View Full Progress
            </Link>
            <Link
              href="/app/speaking"
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 hover:bg-violet-700 transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">play_arrow</span>
              Start Practising Now
            </Link>
          </div>
        </>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 px-4 py-3 text-sm font-medium text-red-700 dark:text-red-400">
          {error}
        </div>
      ) : null}
    </div>
  );
}
