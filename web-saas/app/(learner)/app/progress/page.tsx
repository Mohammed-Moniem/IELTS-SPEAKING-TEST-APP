'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { ApiError, webApi } from '@/lib/api/client';
import type { LearnerProgressView } from '@/lib/types';

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
  if (normalized.includes('complete')) return 'pill pill-green';
  if (normalized.includes('progress')) return 'pill pill-amber';
  return 'pill pill-slate';
};

const moduleDotClass: Record<string, string> = {
  speaking: 'st2-dot speaking',
  writing: 'st2-dot writing',
  reading: 'st2-dot reading',
  listening: 'st2-dot listening'
};

export default function ProgressPage() {
  const [range, setRange] = useState<RangeFilter>('30d');
  const [module, setModule] = useState<ModuleFilter>('all');
  const [view, setView] = useState<LearnerProgressView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadView = async () => {
    setLoading(true);
    setError('');
    try {
      const payload = await webApi.getLearnerProgressView({ range, module });
      setView(payload);
    } catch (err: unknown) {
      const message = err instanceof ApiError ? err.message : 'Unable to load progress';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadView();
  }, [range, module]);

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

  return (
    <section className="section-wrap st2-progress-page">
      <header className="st2-page-heading">
        <div className="stack">
          <h1>Progress Hub</h1>
          <p className="subtitle">Track your band score improvements and detailed skill analytics.</p>
        </div>
        <div className="cta-row">
          <select className="select st2-filter-select" value={range} onChange={event => setRange(event.target.value as RangeFilter)}>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
          </select>
          <select className="select st2-filter-select" value={module} onChange={event => setModule(event.target.value as ModuleFilter)}>
            {Object.entries(moduleLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <button className="btn btn-secondary" type="button">
            Export
          </button>
        </div>
      </header>

      {loading && !view ? (
        <div className="grid-3">
          <div className="panel" style={{ minHeight: 116 }} />
          <div className="panel" style={{ minHeight: 116 }} />
          <div className="panel" style={{ minHeight: 116 }} />
        </div>
      ) : null}

      {view ? (
        <>
          <div className="st2-kpi-grid">
            <article className="panel st2-kpi-card">
              <p className="small">Overall Band Score</p>
              <p className="kpi">{view.totals.overallBand.toFixed(1)}</p>
              <p className="small st2-positive">↗ +0.5 vs last month</p>
            </article>
            <article className="panel st2-kpi-card">
              <p className="small">Predicted Score</p>
              <p className="kpi">{view.totals.predictedScore.toFixed(1)}</p>
              <p className="small">Based on recent performance</p>
            </article>
            <article className="panel st2-kpi-card">
              <p className="small">Tests Completed</p>
              <p className="kpi">{view.totals.testsCompleted}</p>
              <p className="small st2-positive">+4 this week</p>
            </article>
            <article className="panel st2-kpi-card">
              <p className="small">Study Time</p>
              <p className="kpi">{view.totals.studyHours}h</p>
              <p className="small">Avg {(view.totals.studyHours / (range === '7d' ? 7 : range === '30d' ? 30 : 90)).toFixed(1)}h / day</p>
            </article>
          </div>

          <div className="st2-progress-grid">
            <article className="panel st2-chart-card">
              <div className="st2-section-head">
                <h2>Band Score Trend</h2>
              </div>
              <svg className="st2-line-chart" viewBox="0 0 760 300" role="img" aria-label="Band score trend">
                <rect x="0" y="0" width="760" height="300" fill="transparent" />
                <polyline className="st2-line-grid" points="0,250 760,250" />
                <polyline className="st2-line-grid" points="0,190 760,190" />
                <polyline className="st2-line-grid" points="0,130 760,130" />
                <polyline className="st2-line-grid" points="0,70 760,70" />
                <polyline className="st2-line-series" points={chartPoints} />
                {view.trend.map((item, index) => {
                  const x = (index / Math.max(1, view.trend.length - 1)) * 760;
                  const min = Math.min(...view.trend.map(point => point.score), 4);
                  const max = Math.max(...view.trend.map(point => point.score), 8.5);
                  const y = 270 - ((item.score - min) / Math.max(0.1, max - min)) * 270;
                  return <circle key={item.date} cx={x} cy={y} r="4" className="st2-line-point" />;
                })}
              </svg>
              <div className="st2-line-labels">
                {view.trend.map(item => (
                  <span key={item.date}>{formatDate(item.date)}</span>
                ))}
              </div>
            </article>

            <article className="panel st2-radar-card">
              <h2>Skill Breakdown</h2>
              <svg className="st2-radar-chart" viewBox="0 0 260 260" role="img" aria-label="Skill breakdown">
                <polygon points="130,40 220,130 130,220 40,130" className="st2-radar-grid" />
                <polygon points="130,60 200,130 130,200 60,130" className="st2-radar-grid" />
                <polygon points="130,80 180,130 130,180 80,130" className="st2-radar-grid" />
                <polygon points={radarPoints} className="st2-radar-value" />
              </svg>
              <ul className="st2-skill-list">
                <li>
                  <span className="st2-dot listening" /> Listening <strong>{view.skillBreakdown.listening.toFixed(1)}</strong>
                </li>
                <li>
                  <span className="st2-dot reading" /> Reading <strong>{view.skillBreakdown.reading.toFixed(1)}</strong>
                </li>
                <li>
                  <span className="st2-dot writing" /> Writing <strong>{view.skillBreakdown.writing.toFixed(1)}</strong>
                </li>
                <li>
                  <span className="st2-dot speaking" /> Speaking <strong>{view.skillBreakdown.speaking.toFixed(1)}</strong>
                </li>
              </ul>
            </article>
          </div>

          <article className="panel">
            <div className="st2-section-head">
              <h2>History & Attempts</h2>
              <input className="input st2-search-input" placeholder="Search topics..." />
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Module</th>
                    <th>Test / Topic</th>
                    <th>Date</th>
                    <th>Duration</th>
                    <th>Score</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {view.attempts.slice(0, 10).map(item => (
                    <tr key={`${item.module}-${item.itemId}`}>
                      <td>
                        <span className={moduleDotClass[item.module] || 'st2-dot'} />
                        {item.module}
                      </td>
                      <td>
                        <Link href={item.href}>{item.title}</Link>
                        {item.subtitle ? <p className="small">{item.subtitle}</p> : null}
                      </td>
                      <td>{formatDate(item.createdAt)}</td>
                      <td>{item.durationSeconds ? `${Math.max(1, Math.round(item.durationSeconds / 60))}m` : '--'}</td>
                      <td>{item.score ? item.score.toFixed(1) : '--'}</td>
                      <td>
                        <span className={statusClass(item.status)}>{item.status}</span>
                      </td>
                      <td>
                        <Link href={item.href} className="btn btn-secondary">
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </>
      ) : null}

      {error ? <div className="alert alert-error">{error}</div> : null}
    </section>
  );
}
