'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { ApiError, webApi } from '@/lib/api/client';
import { PageHeader, MetricCard, SectionCard, StatusBadge } from '@/components/ui/v2';
import type { ImprovementPlanView, LearnerProgressView, StrengthMapView } from '@/lib/types';

type RangeFilter = '7d' | '30d' | '90d';
type ModuleFilter = 'all' | 'speaking' | 'writing' | 'reading' | 'listening';

const moduleLabels: Record<ModuleFilter, string> = {
  all: 'All Modules',
  speaking: 'Speaking',
  writing: 'Writing',
  reading: 'Reading',
  listening: 'Listening'
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric'
  });

const statusClass = (status: string) => {
  const normalized = status.toLowerCase();
  if (normalized.includes('complete')) return 'inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400';
  if (normalized.includes('progress')) return 'inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400';
  return 'inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400';
};

const moduleDotClass: Record<string, string> = {
  speaking: 'inline-block w-2.5 h-2.5 rounded-full bg-violet-500 mr-2',
  writing: 'inline-block w-2.5 h-2.5 rounded-full bg-blue-500 mr-2',
  reading: 'inline-block w-2.5 h-2.5 rounded-full bg-amber-500 mr-2',
  listening: 'inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 mr-2'
};

const buildLibraryHref = (
  kind: 'collocations' | 'vocabulary' | 'books' | 'channels',
  module: 'speaking' | 'writing' | 'reading' | 'listening',
  seed?: string
) => {
  const query = new URLSearchParams();
  query.set('module', module);
  if (seed) query.set('search', seed);
  return `/app/library/${kind}${query.toString() ? `?${query.toString()}` : ''}`;
};

export default function ProgressPage() {
  const [range, setRange] = useState<RangeFilter>('30d');
  const [module, setModule] = useState<ModuleFilter>('all');
  const [view, setView] = useState<LearnerProgressView | null>(null);
  const [strengthMap, setStrengthMap] = useState<StrengthMapView | null>(null);
  const [improvementPlan, setImprovementPlan] = useState<ImprovementPlanView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadView = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [progressPayload, strengthPayload, improvementPayload] = await Promise.all([
        webApi.getLearnerProgressView({ range, module }),
        webApi.getStrengthMap(range),
        webApi.getImprovementPlan(module)
      ]);
      setView(progressPayload);
      setStrengthMap(strengthPayload);
      setImprovementPlan(improvementPayload);
    } catch (err: unknown) {
      const message = err instanceof ApiError ? err.message : 'Unable to load progress';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [module, range]);

  useEffect(() => {
    void loadView();
  }, [loadView]);

  const chartPoints = useMemo(() => {
    if (!view || view.trend.length === 0) return '';
    const width = 760;
    const height = 270;
    const min = Math.min(...view.trend.map(item => item.score), 4);
    const max = Math.max(...view.trend.map(item => item.score), 8.5);
    return view.trend
      .map((item, index) => {
        const x = (index / Math.max(1, view.trend.length - 1)) * width;
        const normalized = (item.score - min) / Math.max(0.1, max - min);
        const y = height - normalized * height;
        return `${x},${y}`;
      })
      .join(' ');
  }, [view]);

  const radarPoints = useMemo(() => {
    if (!view) return '';
    const centerX = 130;
    const centerY = 130;
    const radius = 86;
    const values = [
      view.skillBreakdown.reading,
      view.skillBreakdown.listening,
      view.skillBreakdown.speaking,
      view.skillBreakdown.writing
    ];

    return values
      .map((value, index) => {
        const angle = -Math.PI / 2 + (index * (Math.PI * 2)) / values.length;
        const distance = (Math.max(0, Math.min(9, value)) / 9) * radius;
        const x = centerX + Math.cos(angle) * distance;
        const y = centerY + Math.sin(angle) * distance;
        return `${x},${y}`;
      })
      .join(' ');
  }, [view]);

  const downloadBlob = (filename: string, contentType: string, content: string) => {
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

  const exportInsightsJson = () => {
    const payload = {
      generatedAt: new Date().toISOString(),
      range,
      module,
      progress: view,
      strengthMap,
      improvementPlan
    };
    downloadBlob(`spokio-insights-${range}.json`, 'application/json', JSON.stringify(payload, null, 2));
  };

  const exportInsightsCsv = () => {
    const rows: string[] = [];
    const add = (values: Array<string | number>) => {
      rows.push(values.map(value => `"${String(value).replace(/"/g, '""')}"`).join(','));
    };

    add(['section', 'key', 'value', 'extra']);
    if (view) {
      add(['kpi', 'overallBand', view.totals.overallBand, '']);
      add(['kpi', 'predictedScore', view.totals.predictedScore, '']);
      add(['kpi', 'testsCompleted', view.totals.testsCompleted, '']);
      add(['kpi', 'studyHours', view.totals.studyHours, '']);
    }
    (strengthMap?.criteria || []).forEach(item => {
      add(['strength', item.key, item.averageScore, `${item.dataPoints} points`]);
    });
    (improvementPlan?.cards || []).forEach(card => {
      add(['improvement', card.criterionKey, card.currentBand, `impact=${card.expectedBandImpact}`]);
    });

    downloadBlob(`spokio-insights-${range}.csv`, 'text/csv; charset=utf-8', rows.join('\n'));
  };

  return (
    <div className="space-y-8 max-w-[1440px] mx-auto w-full">
      <PageHeader
        kicker="Analytics"
        title="Progress Hub"
        subtitle="Track your band score improvements and detailed skill analytics."
        actions={
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white p-1 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <span className="pl-3 text-xs font-semibold text-gray-500 uppercase tracking-widest hidden sm:inline-block">Range:</span>
              <select className="rounded-lg bg-transparent px-3 py-1.5 text-sm font-semibold text-gray-900 focus:outline-none dark:text-white" value={range} onChange={event => setRange(event.target.value as RangeFilter)}>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="90d">Last 90 Days</option>
              </select>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white p-1 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <span className="pl-3 text-xs font-semibold text-gray-500 uppercase tracking-widest hidden sm:inline-block">Module:</span>
              <select className="rounded-lg bg-transparent px-3 py-1.5 text-sm font-semibold text-gray-900 focus:outline-none dark:text-white" value={module} onChange={event => setModule(event.target.value as ModuleFilter)}>
                {Object.entries(moduleLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <button className="flex items-center gap-2 rounded-xl border-2 border-gray-200 bg-white px-5 py-2.5 text-sm font-bold text-gray-700 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700" type="button">
              <span className="material-symbols-outlined text-[18px]">download</span> Export
            </button>
          </div>
        }
      />

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
            <MetricCard
              label="Overall Band Score"
              value={view.totals.overallBand.toFixed(1)}
              delta="↗ +0.5 vs last month"
              tone="brand"
            />
            <MetricCard
              label="Predicted Score"
              value={view.totals.predictedScore.toFixed(1)}
              helper="Based on recent performance"
              tone="warning"
            />
            <MetricCard
              label="Tests Completed"
              value={view.totals.testsCompleted.toString()}
              delta="+4 this week"
              tone="info"
            />
            <MetricCard
              label="Study Time"
              value={`${view.totals.studyHours}h`}
              helper={`Avg ${(view.totals.studyHours / (range === '7d' ? 7 : range === '30d' ? 30 : 90)).toFixed(1)}h / day`}
              tone="success"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
            <SectionCard title="Band Score Trend">
              <div className="relative w-full overflow-hidden rounded-xl border border-gray-100 bg-gray-50/50 p-4 dark:border-gray-800/50 dark:bg-gray-800/20 pt-8">
                <svg className="w-full" viewBox="0 0 760 300" role="img" aria-label="Band score trend overflow-visible">
                  <rect x="0" y="0" width="760" height="300" fill="transparent" />
                  <polyline points="0,250 760,250" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="4 4" className="text-gray-200 dark:text-gray-700/50" />
                  <polyline points="0,190 760,190" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="4 4" className="text-gray-200 dark:text-gray-700/50" />
                  <polyline points="0,130 760,130" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="4 4" className="text-gray-200 dark:text-gray-700/50" />
                  <polyline points="0,70 760,70" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="4 4" className="text-gray-200 dark:text-gray-700/50" />
                  <defs>
                    <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgba(124,58,237,0.3)" />
                      <stop offset="100%" stopColor="rgba(124,58,237,0)" />
                    </linearGradient>
                  </defs>
                  {/* Subtle area fill */}
                  <polygon points={`0,300 ${chartPoints} 760,300`} fill="url(#trendGradient)" />
                  <polyline points={chartPoints} fill="none" stroke="#7C3AED" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-[0_4px_8px_rgba(124,58,237,0.4)]" />
                  {view.trend.map((item, index) => {
                    const x = (index / Math.max(1, view.trend.length - 1)) * 760;
                    const min = Math.min(...view.trend.map(point => point.score), 4);
                    const max = Math.max(...view.trend.map(point => point.score), 8.5);
                    const y = 270 - ((item.score - min) / Math.max(0.1, max - min)) * 270;
                    return (
                      <g key={item.date} className="group cursor-pointer">
                        <circle cx={x} cy={y} r="6" fill="#fff" stroke="#7C3AED" strokeWidth="3" className="transition-transform group-hover:scale-125" />
                        <rect x={x - 20} y={y - 35} width="40" height="20" rx="4" fill="#111827" className="opacity-0 transition-opacity group-hover:opacity-100 dark:fill-white" />
                        <text x={x} y={y - 21} textAnchor="middle" fontSize="12" fill="#fff" className="opacity-0 transition-opacity group-hover:opacity-100 dark:fill-gray-900 font-bold">{item.score.toFixed(1)}</text>
                      </g>
                    );
                  })}
                </svg>
                <div className="flex justify-between mt-4 px-2 text-[11px] font-bold tracking-widest text-gray-400 uppercase">
                  {view.trend.map(item => (
                    <span key={item.date}>{formatDate(item.date)}</span>
                  ))}
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Skill Breakdown">
              <div className="flex flex-col items-center gap-6">
                <svg className="w-full max-w-[220px]" viewBox="0 0 260 260" role="img" aria-label="Skill breakdown">
                  {/* Radar grid rings */}
                  {[40, 60, 80].map((inset) => (
                    <polygon
                      key={inset}
                      points={`130,${inset} ${260 - inset},130 130,${260 - inset} ${inset},130`}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1"
                      strokeDasharray="4 4"
                      className="text-gray-200 dark:text-gray-700/60"
                    />
                  ))}
                  {/* Radar axes */}
                  <line x1="130" y1="40" x2="130" y2="220" stroke="currentColor" strokeWidth="1" className="text-gray-200 dark:text-gray-700/60" />
                  <line x1="40" y1="130" x2="220" y2="130" stroke="currentColor" strokeWidth="1" className="text-gray-200 dark:text-gray-700/60" />
                  {/* Filled area */}
                  <polygon points={radarPoints} fill="rgba(124,58,237,0.15)" stroke="#7C3AED" strokeWidth="2.5" strokeLinejoin="round" className="drop-shadow-[0_0_12px_rgba(124,58,237,0.3)]" />
                  {/* Data points */}
                  {radarPoints.split(' ').map((point, i) => {
                    const [px, py] = point.split(',');
                    return <circle key={i} cx={px} cy={py} r="4" fill="#7C3AED" stroke="#fff" strokeWidth="1.5" />;
                  })}
                </svg>
                <div className="w-full grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                    <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Listening</span>
                    <span className="ml-auto text-sm font-bold text-gray-900 dark:text-white">{view.skillBreakdown.listening.toFixed(1)}</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                    <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Reading</span>
                    <span className="ml-auto text-sm font-bold text-gray-900 dark:text-white">{view.skillBreakdown.reading.toFixed(1)}</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
                    <span className="h-2.5 w-2.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                    <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Writing</span>
                    <span className="ml-auto text-sm font-bold text-gray-900 dark:text-white">{view.skillBreakdown.writing.toFixed(1)}</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
                    <span className="h-2.5 w-2.5 rounded-full bg-violet-500 shadow-[0_0_8px_rgba(124,58,237,0.5)]" />
                    <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Speaking</span>
                    <span className="ml-auto text-sm font-bold text-gray-900 dark:text-white">{view.skillBreakdown.speaking.toFixed(1)}</span>
                  </div>
                </div>
              </div>
            </SectionCard>
          </div>

          <SectionCard
            title="History & Attempts"
            actions={
              <div className="relative w-full sm:w-64">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-gray-400">search</span>
                <input className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-400 transition-colors focus:border-violet-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-violet-500/10 dark:border-gray-800 dark:bg-gray-900/50 dark:text-white dark:focus:border-violet-500 dark:focus:bg-gray-900 dark:focus:ring-violet-500/20" placeholder="Search topics..." />
              </div>
            }
          >
            <div className="overflow-hidden rounded-xl border border-gray-100 dark:border-gray-800/80 mt-2">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50/80 dark:bg-gray-800/50">
                    <tr className="border-b border-gray-100 dark:border-gray-800 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                      <th className="px-5 py-3.5">Module</th>
                      <th className="px-5 py-3.5">Test / Topic</th>
                      <th className="px-5 py-3.5">Date</th>
                      <th className="px-5 py-3.5">Duration</th>
                      <th className="px-5 py-3.5">Score</th>
                      <th className="px-5 py-3.5">Status</th>
                      <th className="px-5 py-3.5">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800/80 bg-white dark:bg-gray-900">
                    {view.attempts.slice(0, 10).map(item => (
                      <tr key={`${item.module}-${item.itemId}`} className="group hover:bg-gray-50/80 dark:hover:bg-gray-800/30 transition-colors">
                        <td className="px-5 py-4">
                          <span className={moduleDotClass[item.module] || 'inline-block w-2 h-2 rounded-full bg-gray-400 mr-2 shadow-sm'} />
                          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 capitalize">{item.module}</span>
                        </td>
                        <td className="px-5 py-4">
                          <Link href={item.href} className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors line-clamp-1">{item.title}</Link>
                          {item.subtitle ? <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 line-clamp-1">{item.subtitle}</p> : null}
                        </td>
                        <td className="px-5 py-4 text-sm font-medium text-gray-500 dark:text-gray-400">{formatDate(item.createdAt)}</td>
                        <td className="px-5 py-4 text-sm font-medium text-gray-500 dark:text-gray-400">{item.durationSeconds ? `${Math.max(1, Math.round(item.durationSeconds / 60))}m` : '--'}</td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center justify-center rounded-lg px-2.5 py-1 text-sm font-bold ${item.score ? 'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300' : 'bg-gray-50 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>
                            {item.score ? item.score.toFixed(1) : '--'}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <StatusBadge tone={item.status.toLowerCase().includes('complete') ? 'success' : item.status.toLowerCase().includes('progress') ? 'warning' : 'neutral'}>
                            {item.status}
                          </StatusBadge>
                        </td>
                        <td className="px-5 py-4">
                          <Link href={item.href} className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-xs font-bold text-gray-700 dark:text-gray-300 shadow-sm hover:border-violet-300 hover:text-violet-700 dark:hover:border-violet-500/50 dark:hover:text-violet-400 transition-all">
                            Open <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                          </Link>
                        </td>
                      </tr>
                    ))}
                    {view.attempts.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-5 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                          No attempts found for this period.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </SectionCard>

          <section className="grid grid-cols-1 xl:grid-cols-[1fr_1fr] gap-6">
            <SectionCard
              title="Strength Map"
              actions={
                <StatusBadge tone="neutral">Data sufficiency: {strengthMap?.dataSufficiency || '--'}</StatusBadge>
              }
            >
              {(strengthMap?.criteria || []).length === 0 ? (
                <div className="rounded-2xl border border-gray-100 bg-gray-50/50 p-8 text-center dark:border-gray-800 dark:bg-gray-800/20">
                  <span className="material-symbols-outlined mb-2 text-[32px] text-gray-400">query_stats</span>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No sufficient scoring data yet for this range.</p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2 mt-2">
                  {(strengthMap?.criteria || []).slice(0, 6).map(criterion => (
                    <article key={criterion.key} className="group flex flex-col justify-between rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700">
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h4 className="font-bold text-gray-900 dark:text-white leading-tight">{criterion.label}</h4>
                          <span className="flex h-7 items-center rounded-lg bg-emerald-50 px-2 text-sm font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 shrink-0">
                            {criterion.averageScore.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                          <span className={criterion.module === 'speaking' ? 'text-violet-500' : criterion.module === 'writing' ? 'text-blue-500' : criterion.module === 'reading' ? 'text-amber-500' : 'text-emerald-500'}>{criterion.module}</span>
                          <span>•</span>
                          <span>{criterion.dataPoints} pts</span>
                          <span>•</span>
                          <span>{criterion.confidence}</span>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-50 pt-3 dark:border-gray-800/60">
                        <Link
                          href={buildLibraryHref('collocations', criterion.module as any, criterion.label)}
                          className="rounded-lg bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-600 transition-colors hover:bg-violet-50 hover:text-violet-700 dark:bg-gray-800/50 dark:text-gray-300 dark:hover:bg-violet-500/10 dark:hover:text-violet-300"
                        >
                          Collocations
                        </Link>
                        <Link
                          href={buildLibraryHref('vocabulary', criterion.module as any, criterion.label)}
                          className="rounded-lg bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-600 transition-colors hover:bg-violet-50 hover:text-violet-700 dark:bg-gray-800/50 dark:text-gray-300 dark:hover:bg-violet-500/10 dark:hover:text-violet-300"
                        >
                          Vocabulary
                        </Link>
                        <Link
                          href={buildLibraryHref('books', criterion.module as any, criterion.label)}
                          className="rounded-lg bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-600 transition-colors hover:bg-violet-50 hover:text-violet-700 dark:bg-gray-800/50 dark:text-gray-300 dark:hover:bg-violet-500/10 dark:hover:text-violet-300"
                        >
                          Resources
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard
              title="Improvement Plan"
              actions={
                <StatusBadge tone="brand">Confidence: {improvementPlan?.predictionConfidence || '--'}</StatusBadge>
              }
            >
              {(improvementPlan?.cards || []).length === 0 ? (
                <div className="rounded-2xl border border-gray-100 bg-gray-50/50 p-8 text-center dark:border-gray-800 dark:bg-gray-800/20">
                  <span className="material-symbols-outlined mb-2 text-[32px] text-gray-400">tips_and_updates</span>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No improvement cards available yet. Keep practicing to unlock recommendations.</p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2 mt-2">
                  {(improvementPlan?.cards || []).slice(0, 4).map(card => (
                    <article key={card.criterionKey} className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-violet-100 bg-violet-50/30 p-4 transition-all hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-lg dark:border-violet-500/20 dark:bg-violet-500/5 dark:hover:border-violet-500/40">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-violet-400/10 blur-2xl rounded-full translate-x-12 -translate-y-12"></div>
                      <div className="relative z-10">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h4 className="font-bold text-gray-900 dark:text-white leading-tight">{card.title}</h4>
                          <span className="flex items-center gap-0.5 rounded-lg bg-violet-100 px-2 py-0.5 text-xs font-bold text-violet-700 dark:bg-violet-500/20 dark:text-violet-300 shrink-0">
                            <span className="material-symbols-outlined text-[14px]">moving</span> +{card.expectedBandImpact.toFixed(2)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{card.recommendedAction}</p>
                      </div>
                      <div className="relative z-10 mt-4 space-y-3">
                        <Link href={card.deepLink} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white shadow-md transition-colors hover:bg-violet-700">
                          Start Practice <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                        </Link>
                        <div className="flex flex-wrap justify-center gap-2">
                          <Link
                            href={buildLibraryHref('collocations', card.module as any, card.title)}
                            className="rounded-lg bg-white/60 px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-white hover:text-violet-700 dark:bg-gray-800/50 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-violet-400 transition-colors"
                          >
                            Collocations
                          </Link>
                          <Link
                            href={buildLibraryHref('vocabulary', card.module as any, card.title)}
                            className="rounded-lg bg-white/60 px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-white hover:text-violet-700 dark:bg-gray-800/50 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-violet-400 transition-colors"
                          >
                            Alternatives
                          </Link>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}

              <div className="mt-6 flex flex-wrap gap-3 border-t border-gray-100 pt-5 dark:border-gray-800">
                <button
                  type="button"
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                  onClick={exportInsightsJson}
                >
                  <span className="material-symbols-outlined text-[18px]">data_object</span> Export JSON
                </button>
                <button
                  type="button"
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                  onClick={exportInsightsCsv}
                >
                  <span className="material-symbols-outlined text-[18px]">table_chart</span> Export CSV
                </button>
              </div>
            </SectionCard>
          </section>
        </>
      ) : null}

      {error ? <div className="rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-400">{error}</div> : null}
    </div>
  );
}
