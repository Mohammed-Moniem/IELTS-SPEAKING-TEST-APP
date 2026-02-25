'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { apiRequest, ApiError } from '@/lib/api/client';
import { ObjectiveAttempt } from '@/lib/types';

export default function ListeningHistoryDetailPage() {
  const params = useParams<{ attemptId: string }>();
  const [attempt, setAttempt] = useState<ObjectiveAttempt | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!params.attemptId) return;

    void (async () => {
      try {
        const detail = await apiRequest<ObjectiveAttempt>(`/listening/tests/${params.attemptId}`);
        setAttempt(detail);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Failed to load listening attempt.');
      }
    })();
  }, [params.attemptId]);

  return (
    <section className="section-wrap">
      <div className="panel stack">
        <h1>Listening Attempt Detail</h1>
        <p className="small">Attempt ID: {params.attemptId}</p>
        <Link className="btn btn-secondary" href="/app/progress">
          Back to Progress
        </Link>
      </div>

      {attempt ? (
        <div className="panel stack">
          <p className="kpi">Band {attempt.normalizedBand || '--'}</p>
          <p>
            Score: {attempt.score || 0}/{attempt.totalQuestions || 0}
          </p>
          <p>{attempt.feedback?.summary}</p>
          <ul>
            {(attempt.answers || []).map(answer => (
              <li key={answer.questionId}>
                {answer.questionId}: {answer.answer || '(empty)'} {answer.isCorrect === true ? '✓' : answer.isCorrect === false ? '✗' : ''}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? <div className="alert alert-error">{error}</div> : null}
    </section>
  );
}
