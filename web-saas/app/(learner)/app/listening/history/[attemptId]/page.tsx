'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { apiRequest, ApiError } from '@/lib/api/client';
import { PageHeader, SectionCard, MetricCard, StatusBadge } from '@/components/ui/v2';
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
    <div className="space-y-6">
      <PageHeader
        title="Listening Attempt Detail"
        subtitle={`Attempt ID: ${params.attemptId}`}
        actions={
          <Link
            href="/app/progress"
            className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Back to Progress
          </Link>
        }
      />

      {attempt ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <MetricCard tone="brand" label="Band Score" value={attempt.normalizedBand || '--'} />
            <MetricCard tone="success" label="Score" value={`${attempt.score || 0}/${attempt.totalQuestions || 0}`} />
            <MetricCard
              tone="neutral"
              label="Accuracy"
              value={attempt.totalQuestions ? `${Math.round(((attempt.score || 0) / attempt.totalQuestions) * 100)}%` : '--'}
            />
          </div>

          {attempt.feedback?.summary ? (
            <SectionCard title="Feedback Summary">
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{attempt.feedback.summary}</p>
            </SectionCard>
          ) : null}

          {(attempt.answers || []).length > 0 ? (
            <SectionCard title="Answer Breakdown" className="p-0 overflow-hidden">
              <div className="divide-y divide-gray-100 dark:divide-gray-800 border-t border-gray-100 dark:border-gray-800 -m-6 sm:-mx-6 sm:-mb-6 mt-0">
                {(attempt.answers || []).map(answer => (
                  <div key={answer.questionId} className="flex items-center gap-4 px-6 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <span className="text-xs font-mono font-semibold text-gray-500 dark:text-gray-400 w-20 flex-shrink-0 truncate">
                      {answer.questionId}
                    </span>
                    <span className="flex-1 text-sm text-gray-700 dark:text-gray-300 truncate">
                      {answer.answer || '(empty)'}
                    </span>
                    {answer.isCorrect === true ? (
                      <StatusBadge tone="success">✓ Correct</StatusBadge>
                    ) : answer.isCorrect === false ? (
                      <StatusBadge tone="danger">✗ Wrong</StatusBadge>
                    ) : null}
                  </div>
                ))}
              </div>
            </SectionCard>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-400">{error}</div>
      ) : null}
    </div>
  );
}
