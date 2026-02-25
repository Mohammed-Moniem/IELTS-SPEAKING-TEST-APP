'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { ApiError, webApi } from '@/lib/api/client';
import { SpeakingSessionDetail } from '@/lib/types';

export default function SpeakingSessionHistoryDetailPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params?.sessionId || '';

  const [session, setSession] = useState<SpeakingSessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!sessionId) {
      setError('Invalid speaking session id.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    webApi
      .getPracticeSessionDetail(sessionId)
      .then(result => {
        setSession(result);
      })
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : 'Failed to load speaking session details.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [sessionId]);

  const feedback = session?.feedback;
  const overallBand = feedback?.overallBand ?? null;

  const metricRows = useMemo(() => {
    const breakdown = feedback?.bandBreakdown;
    return [
      { label: 'Fluency & Coherence', value: breakdown?.fluency },
      { label: 'Lexical Resource', value: breakdown?.lexicalResource },
      { label: 'Grammar', value: breakdown?.grammaticalRange },
      { label: 'Pronunciation', value: breakdown?.pronunciation }
    ];
  }, [feedback?.bandBreakdown]);

  return (
    <section className="section-wrap">
      <div className="panel hero-panel stack">
        <div className="cta-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="tag">Speaking evaluation detail</span>
          <Link href="/app/speaking" className="btn btn-secondary">
            Back to Speaking
          </Link>
        </div>
        <h1>{session?.topicTitle || 'Speaking session report'}</h1>
        <p className="subtitle">Session ID: {sessionId}</p>
      </div>

      {loading ? (
        <div className="panel stack">
          <p className="small">Loading speaking report...</p>
        </div>
      ) : null}

      {!loading && error ? <div className="alert alert-error">{error}</div> : null}

      {!loading && session ? (
        <div className="grid-2">
          <article className="panel stack">
            <h3>Transcript</h3>
            <p className="small">
              Status: <strong>{session.status}</strong>
            </p>
            <p className="small">
              Completed:{' '}
              <strong>{session.completedAt ? new Date(session.completedAt).toLocaleString() : 'in progress'}</strong>
            </p>
            <p>{session.question}</p>
            <div className="panel panel-subtle stack">
              <h4>Your response</h4>
              <p>{session.userResponse || 'No transcript available for this session.'}</p>
            </div>
          </article>

          <article className="panel stack">
            <h3>Band insights</h3>
            <p className="kpi">{overallBand == null ? '--' : overallBand}</p>
            <p className="small">Overall band</p>
            <div className="grid-2">
              {metricRows.map(row => (
                <div key={row.label} className="panel panel-subtle stack">
                  <p className="small">{row.label}</p>
                  <p>
                    <strong>{typeof row.value === 'number' ? row.value.toFixed(1) : '--'}</strong>
                  </p>
                </div>
              ))}
            </div>
            <div className="panel panel-subtle stack">
              <h4>Summary</h4>
              <p>{feedback?.summary || 'No summary was generated for this session.'}</p>
            </div>
            <div className="grid-2">
              <div className="panel panel-subtle stack">
                <h4>Strengths</h4>
                <ul>
                  {(feedback?.strengths || []).slice(0, 6).map(item => (
                    <li key={item}>{item}</li>
                  ))}
                  {feedback?.strengths?.length ? null : <li>No strengths captured.</li>}
                </ul>
              </div>
              <div className="panel panel-subtle stack">
                <h4>Improvements</h4>
                <ul>
                  {(feedback?.improvements || []).slice(0, 6).map(item => (
                    <li key={item}>{item}</li>
                  ))}
                  {feedback?.improvements?.length ? null : <li>No improvement actions captured.</li>}
                </ul>
              </div>
            </div>
          </article>
        </div>
      ) : null}
    </section>
  );
}
