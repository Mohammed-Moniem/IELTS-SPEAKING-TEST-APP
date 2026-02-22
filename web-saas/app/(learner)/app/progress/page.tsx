'use client';

import { useEffect, useState } from 'react';

import { apiRequest } from '@/lib/api/client';
import { ObjectiveAttempt, WritingSubmission } from '@/lib/types';

type ProgressPayload = {
  writing: WritingSubmission[];
  reading: ObjectiveAttempt[];
  listening: ObjectiveAttempt[];
};

export default function ProgressPage() {
  const [progress, setProgress] = useState<ProgressPayload>({ writing: [], reading: [], listening: [] });
  const [error, setError] = useState('');

  useEffect(() => {
    void (async () => {
      try {
        const [writing, reading, listening] = await Promise.all([
          apiRequest<WritingSubmission[]>('/writing/history'),
          apiRequest<ObjectiveAttempt[]>('/reading/history'),
          apiRequest<ObjectiveAttempt[]>('/listening/history')
        ]);

        setProgress({ writing, reading, listening });
      } catch (err: any) {
        setError(err?.message || 'Unable to load progress history');
      }
    })();
  }, []);

  const writingAverage =
    progress.writing.length > 0
      ? (
          progress.writing.reduce((sum, item) => sum + (item.overallBand || 0), 0) / progress.writing.length
        ).toFixed(1)
      : '--';

  return (
    <section className="section-wrap">
      <div className="panel hero-panel stack">
        <span className="tag">Cross-module progress</span>
        <h1>Track improvements across all IELTS modules</h1>
      </div>

      <div className="grid-3">
        <article className="panel stack">
          <p className="small">Writing submissions</p>
          <p className="kpi">{progress.writing.length}</p>
          <p className="small">Average band: {writingAverage}</p>
        </article>
        <article className="panel stack">
          <p className="small">Reading attempts</p>
          <p className="kpi">{progress.reading.length}</p>
        </article>
        <article className="panel stack">
          <p className="small">Listening attempts</p>
          <p className="kpi">{progress.listening.length}</p>
        </article>
      </div>

      <div className="grid-2">
        <div className="panel stack">
          <h3>Recent writing</h3>
          <ul>
            {progress.writing.slice(0, 5).map(item => (
              <li key={item._id}>Band {item.overallBand} - {item.feedback.summary}</li>
            ))}
          </ul>
        </div>
        <div className="panel stack">
          <h3>Recent objective modules</h3>
          <ul>
            {progress.reading.slice(0, 3).map(item => (
              <li key={item._id}>Reading band {item.normalizedBand || '--'} ({item.score || 0}/{item.totalQuestions || 0})</li>
            ))}
            {progress.listening.slice(0, 3).map(item => (
              <li key={item._id}>Listening band {item.normalizedBand || '--'} ({item.score || 0}/{item.totalQuestions || 0})</li>
            ))}
          </ul>
        </div>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}
    </section>
  );
}
