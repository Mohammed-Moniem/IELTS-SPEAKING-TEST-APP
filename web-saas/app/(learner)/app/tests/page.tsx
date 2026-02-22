'use client';

import { useState } from 'react';

import { apiRequest, ApiError } from '@/lib/api/client';
import { FullExamSession, IELTSModule } from '@/lib/types';

export default function TestsPage() {
  const [track, setTrack] = useState<'academic' | 'general'>('academic');
  const [exam, setExam] = useState<FullExamSession | null>(null);
  const [module, setModule] = useState<IELTSModule>('speaking');
  const [attemptId, setAttemptId] = useState('');
  const [score, setScore] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const startExam = async () => {
    setError('');
    setLoading(true);
    try {
      const started = await apiRequest<FullExamSession>('/exams/full/start', {
        method: 'POST',
        body: JSON.stringify({ track })
      });
      setExam(started);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to start full exam');
    } finally {
      setLoading(false);
    }
  };

  const submitSection = async () => {
    if (!exam || !attemptId.trim()) return;

    setError('');
    setLoading(true);
    try {
      const submitted = await apiRequest<FullExamSession>(`/exams/full/${exam._id}/section/${module}/submit`, {
        method: 'POST',
        body: JSON.stringify({ module, attemptId: attemptId.trim(), score: score ? Number(score) : undefined })
      });
      setExam(submitted);
      setAttemptId('');
      setScore('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to submit section');
    } finally {
      setLoading(false);
    }
  };

  const completeExam = async () => {
    if (!exam) return;

    setError('');
    setLoading(true);
    try {
      const completed = await apiRequest<FullExamSession>(`/exams/full/${exam._id}/complete`, {
        method: 'POST',
        body: JSON.stringify({})
      });
      setExam(completed);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to complete exam');
    } finally {
      setLoading(false);
    }
  };

  const refreshResults = async () => {
    if (!exam) return;

    setError('');
    setLoading(true);
    try {
      const result = await apiRequest<FullExamSession>(`/exams/full/${exam._id}/results`);
      setExam(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load results');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="section-wrap">
      <div className="panel hero-panel stack">
        <span className="tag">Full exam orchestration</span>
        <h1>Run complete IELTS mock sessions</h1>
        <p className="subtitle">Endpoints: start, section submit, complete, results.</p>
      </div>

      <div className="panel stack">
        <label className="stack">
          <span>Track</span>
          <select className="select" value={track} onChange={e => setTrack(e.target.value as 'academic' | 'general')}>
            <option value="academic">Academic</option>
            <option value="general">General</option>
          </select>
        </label>
        <div className="cta-row">
          <button className="btn btn-primary" onClick={() => void startExam()} disabled={loading}>
            {loading ? 'Starting...' : 'Start Full Exam'}
          </button>
          <button className="btn btn-secondary" onClick={() => void refreshResults()} disabled={loading || !exam}>
            Refresh Results
          </button>
        </div>
      </div>

      {exam ? (
        <div className="stack">
          <div className="panel stack">
            <h3>Exam session</h3>
            <p>
              <span className="tag">ID: {exam._id}</span>
              <span className="tag">Track: {exam.track}</span>
              <span className="tag">Status: {exam.status}</span>
            </p>
            {typeof exam.overallBand === 'number' ? <p className="kpi">Overall band {exam.overallBand}</p> : null}
          </div>

          <div className="panel stack">
            <h3>Submit section result</h3>
            <div className="grid-2">
              <label className="stack">
                <span>Module</span>
                <select className="select" value={module} onChange={e => setModule(e.target.value as IELTSModule)}>
                  <option value="speaking">Speaking</option>
                  <option value="writing">Writing</option>
                  <option value="reading">Reading</option>
                  <option value="listening">Listening</option>
                </select>
              </label>
              <label className="stack">
                <span>Band score (optional)</span>
                <input
                  className="input"
                  value={score}
                  onChange={e => setScore(e.target.value)}
                  placeholder="e.g. 6.5"
                  type="number"
                  min={0}
                  max={9}
                  step="0.1"
                />
              </label>
            </div>
            <label className="stack">
              <span>Attempt ID</span>
              <input
                className="input"
                value={attemptId}
                onChange={e => setAttemptId(e.target.value)}
                placeholder="module attempt id"
              />
            </label>
            <div className="cta-row">
              <button className="btn btn-secondary" onClick={() => void submitSection()} disabled={loading || !attemptId.trim()}>
                Submit Section
              </button>
              <button className="btn btn-primary" onClick={() => void completeExam()} disabled={loading}>
                Complete Exam
              </button>
            </div>
          </div>

          <div className="panel">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Module</th>
                    <th>Status</th>
                    <th>Attempt</th>
                    <th>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {exam.sections.map(section => (
                    <tr key={section.module}>
                      <td>{section.module}</td>
                      <td>{section.status}</td>
                      <td>{section.attemptId || '-'}</td>
                      <td>{typeof section.score === 'number' ? section.score : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {error ? <div className="alert alert-error">{error}</div> : null}
    </section>
  );
}
