'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { PageHeader, SectionCard, MetricCard, StatusBadge } from '@/components/ui/v2';
import { apiRequest, ApiError } from '@/lib/api/client';
import { ObjectiveAttempt } from '@/lib/types';

export default function ReadingHistoryDetailPage() {
  const params = useParams<{ attemptId: string }>();
  const [attempt, setAttempt] = useState<ObjectiveAttempt | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!params.attemptId) return;
    const fetchDetail = async () => {
      try {
        const detail = await apiRequest<ObjectiveAttempt>(`/reading/tests/${params.attemptId}`);
        setAttempt(detail);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Failed to load reading attempt.');
      }
    };
    void fetchDetail();
  }, [params.attemptId]);

  const accuracy = useMemo(() => {
    if (!attempt?.totalQuestions) return '--';
    return `${Math.round(((attempt.score || 0) / attempt.totalQuestions) * 100)}%`;
  }, [attempt]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reading Attempt Detail"
        subtitle={`Attempt ID: ${params.attemptId}`}
        actions={
          <Link
            href="/app/progress"
            className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Back to Progress
          </Link>
        }
      />

      {attempt ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <MetricCard tone="brand" label="Band Score" value={attempt.normalizedBand || '--'} />
            <MetricCard tone="success" label="Score" value={`${attempt.score || 0}/${attempt.totalQuestions || 0}`} />
            <MetricCard tone="neutral" label="Accuracy" value={accuracy} />
            <MetricCard tone="neutral" label="Feedback" value={attempt.deepFeedbackReady ? 'Deep Ready' : 'Pending'} />
          </div>

          {attempt.feedback?.summary ? (
            <SectionCard title="Immediate Summary">
              <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">{attempt.feedback.summary}</p>
            </SectionCard>
          ) : null}

          {attempt.deepFeedback?.overallSummary ? (
            <SectionCard title="Tutor-Grade Guidance">
              <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">{attempt.deepFeedback.overallSummary}</p>
              {attempt.deepFeedback.top5Fixes?.length ? (
                <div className="mt-4 space-y-2">
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white">Top 5 Fixes</h4>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700 dark:text-gray-300">
                    {attempt.deepFeedback.top5Fixes.map(item => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {attempt.deepFeedback.next24hPlan?.length || attempt.deepFeedback.next7dPlan?.length ? (
                <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
                  <article className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
                    <h5 className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">24h plan</h5>
                    <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700 dark:text-gray-300">
                      {(attempt.deepFeedback.next24hPlan || []).map(item => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </article>
                  <article className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
                    <h5 className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">7d plan</h5>
                    <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700 dark:text-gray-300">
                      {(attempt.deepFeedback.next7dPlan || []).map(item => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </article>
                </div>
              ) : null}
            </SectionCard>
          ) : (
            <SectionCard title="Tutor-Grade Guidance">
              <p className="text-sm text-violet-600 dark:text-violet-400">
                Deep feedback is still being prepared for this attempt. Refresh in a few seconds.
              </p>
            </SectionCard>
          )}

          {(attempt.sectionStats || []).length > 0 ? (
            <SectionCard title="Section Breakdown">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {(attempt.sectionStats || []).map(section => (
                  <article key={section.sectionId} className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{section.sectionId.toUpperCase()}</p>
                    <p className="mt-1 text-lg font-bold text-gray-900 dark:text-white">
                      {section.score}/{section.total}
                    </p>
                  </article>
                ))}
              </div>
            </SectionCard>
          ) : null}

          {(attempt.questionTypeStats || []).length > 0 ? (
            <SectionCard title="Question Type Performance">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px]">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800">
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Type</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Correct</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {(attempt.questionTypeStats || []).map(item => (
                      <tr key={item.type}>
                        <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">{item.type}</td>
                        <td className="px-3 py-2 text-sm font-semibold text-gray-900 dark:text-white">{item.correct}</td>
                        <td className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400">{item.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          ) : null}

          {(attempt.answers || []).length > 0 ? (
            <SectionCard title="Answer Breakdown" className="overflow-hidden p-0">
              <div className="divide-y divide-gray-100 border-t border-gray-100 dark:divide-gray-800 dark:border-gray-800">
                {(attempt.answers || []).map(answer => (
                  <div key={answer.questionId} className="flex items-center gap-4 px-6 py-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <span className="w-24 flex-shrink-0 truncate font-mono text-xs font-semibold text-gray-500 dark:text-gray-400">
                      {answer.questionId}
                    </span>
                    <span className="flex-1 truncate text-sm text-gray-700 dark:text-gray-300">
                      {typeof answer.answer === 'string' ? answer.answer || '(empty)' : JSON.stringify(answer.answer)}
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
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </div>
      ) : null}
    </div>
  );
}
