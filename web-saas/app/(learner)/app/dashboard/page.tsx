'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { ApiError, webApi } from '@/lib/api/client';
import type { LearnerDashboardView } from '@/lib/types';

type ModuleKey = 'speaking' | 'writing' | 'reading' | 'listening';

const moduleConfig: Record<ModuleKey, { icon: string; accent: string; href: string }> = {
  speaking: { icon: '🎙', accent: 'purple', href: '/app/speaking' },
  writing: { icon: '✍', accent: 'amber', href: '/app/writing' },
  reading: { icon: '📘', accent: 'blue', href: '/app/reading' },
  listening: { icon: '🎧', accent: 'mint', href: '/app/listening' }
};

const titleCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const formatDuration = (seconds?: number) => {
  if (!seconds || seconds <= 0) return '--';
  const mins = Math.floor(seconds / 60);
  return `${mins} min`;
};

const formatDate = (iso?: string) => {
  if (!iso) return '--';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
};

const statusClass = (status: string) => {
  const normalized = status.toLowerCase();
  if (normalized.includes('complete')) return 'pill pill-green';
  if (normalized.includes('progress')) return 'pill pill-amber';
  return 'pill pill-slate';
};

export default function DashboardPage() {
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

  if (loading && !view) {
    return (
      <section className="section-wrap">
        <div className="panel hero-panel stack">
          <span className="tag">Learner dashboard</span>
          <h1>Loading your IELTS workspace...</h1>
        </div>
        <div className="grid-3">
          <div className="panel" style={{ minHeight: 120 }} />
          <div className="panel" style={{ minHeight: 120 }} />
          <div className="panel" style={{ minHeight: 120 }} />
        </div>
      </section>
    );
  }

  return (
    <section className="section-wrap st2-dashboard-page">
      <header className="st2-page-heading">
        <div className="stack">
          <h1>Welcome back, Student 👋</h1>
          <p className="subtitle">Ready to boost your IELTS score today? Your speaking simulation is waiting.</p>
        </div>
        <div className="cta-row">
          <button className="icon-btn" aria-label="Notifications">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M12 22a2.5 2.5 0 002.5-2.5h-5A2.5 2.5 0 0012 22zm7-5h-1V11a6 6 0 10-12 0v6H5v2h14v-2z"
                fill="currentColor"
              />
            </svg>
          </button>
          <Link className="btn btn-primary" href="/app/tests">
            + Start New Test
          </Link>
        </div>
      </header>

      {view ? (
        <>
          <div className="st2-kpi-grid">
            <article className="panel st2-kpi-card">
              <p className="small">Average Band Score</p>
              <p className="kpi">{view.kpis.averageBand.toFixed(1)}</p>
              <p className="small st2-positive">↗ +0.5</p>
            </article>
            <article className="panel st2-kpi-card">
              <p className="small">Current Streak</p>
              <p className="kpi">{view.kpis.currentStreak} Days</p>
              <div className="st2-mini-bars" aria-hidden>
                {[0, 1, 2, 3, 4].map(index => (
                  <span key={index} className={index < Math.min(5, view.kpis.currentStreak) ? 'on' : ''} />
                ))}
              </div>
            </article>
            <article className="panel st2-kpi-card">
              <p className="small">Tests Completed</p>
              <p className="kpi">{view.kpis.testsCompleted}</p>
              <p className="small">Total session count</p>
            </article>
            <article className="panel st2-kpi-card">
              <p className="small">Next Goal</p>
              <p className="kpi">Band {view.kpis.nextGoalBand.toFixed(1)}</p>
              <span className="tag">Intermediate</span>
            </article>
          </div>

          <div className="st2-dashboard-grid">
            <div className="st2-quick-practice">
              <div className="st2-section-head">
                <h2>Quick Practice</h2>
                <Link href="/app/speaking">View all topics</Link>
              </div>
              <div className="st2-quick-grid">
                {quickCards.map((item, index) => (
                  <article
                    key={`${item.module}-${item.title}`}
                    className={`panel st2-quick-card ${index === 0 ? 'featured' : ''}`}
                    data-accent={item.accent}
                  >
                    <div className="st2-card-icon">{item.icon}</div>
                    <h3>{item.title}</h3>
                    <p className="subtitle">{item.description}</p>
                    <Link className={index === 0 ? 'btn btn-light' : 'btn btn-link'} href={item.href}>
                      {index === 0 ? 'Start Speaking' : `Start ${titleCase(item.module)} →`}
                    </Link>
                  </article>
                ))}
              </div>
            </div>

            <aside className="st2-dashboard-rail">
              {view.resume ? (
                <article className="panel st2-resume-card">
                  <p className="st2-resume-kicker">Continue</p>
                  <h3>{view.resume.title}</h3>
                  <p>{view.resume.subtitle}</p>
                  <div className="st2-progress-line">
                    <span style={{ width: `${Math.max(8, Math.min(100, view.resume.progressPercent))}%` }} />
                  </div>
                  <Link className="btn btn-primary" href={view.resume.href}>
                    Continue Session
                  </Link>
                </article>
              ) : null}

              <article className="panel st2-recommended-card">
                <h3>Recommended for you</h3>
                <ul className="st2-recommended-list">
                  {view.recommended.slice(0, 3).map(item => (
                    <li key={item.topicId}>
                      <p>{item.title}</p>
                      <span>{item.difficulty || `Part ${item.part}`}</span>
                    </li>
                  ))}
                </ul>
                <Link className="btn btn-secondary" href="/app/speaking">
                  Browse Library
                </Link>
              </article>

              <article className="panel st2-premium-card">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M12 3l2.7 5.4L21 9.3l-4.5 4.4 1 6.3-5.5-2.9L6.5 20l1-6.3L3 9.3l6.3-.9L12 3z"
                    fill="currentColor"
                  />
                </svg>
                <h3>Go Premium</h3>
                <p>Unlock unlimited practice and detailed AI analytics.</p>
                <Link className="btn btn-secondary" href="/app/billing">
                  View Plans
                </Link>
              </article>
            </aside>
          </div>

          <article className="panel">
            <div className="st2-section-head">
              <h2>Recent Activity</h2>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Module</th>
                    <th>Topic</th>
                    <th>Date</th>
                    <th>Score</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {view.activity.slice(0, 6).map(item => (
                    <tr key={`${item.module}-${item.itemId}`}>
                      <td>{titleCase(item.module)}</td>
                      <td>
                        <Link href={item.href}>{item.title}</Link>
                      </td>
                      <td>{formatDate(item.createdAt)}</td>
                      <td>{item.score ? item.score.toFixed(1) : '--'}</td>
                      <td>
                        <span className={statusClass(item.status)}>{item.status}</span>
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
