'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { apiRequest, ApiError } from '@/lib/api/client';
import { PageHeader, SectionCard, MetricCard, StatusBadge } from '@/components/ui/v2';
import { ObjectiveAnswer, ObjectiveAttempt, ObjectiveQuestion, ObjectiveTestPayload } from '@/lib/types';

const formatAnswerValue = (value: string | string[] | Record<string, string> | undefined) => {
  if (typeof value === 'string') return value.trim() || '(empty)';
  if (Array.isArray(value)) return value.length > 0 ? value.join(', ') : '(empty)';
  if (value && typeof value === 'object') {
    const pairs = Object.entries(value).map(([key, entry]) => `${key}: ${entry}`);
    return pairs.length > 0 ? pairs.join(', ') : '(empty)';
  }
  return '(empty)';
};

const normalizeCandidates = (value: string | string[] | Record<string, string> | undefined) => {
  if (typeof value === 'string') return [value.trim()].filter(Boolean);
  if (Array.isArray(value)) return value.map(item => String(item).trim()).filter(Boolean);
  if (value && typeof value === 'object') {
    return Object.values(value)
      .map(item => String(item).trim())
      .filter(Boolean);
  }
  return [];
};

const resolveTestPayload = (attempt: ObjectiveAttempt | null): ObjectiveTestPayload | null => {
  if (!attempt) return null;
  if (attempt.test) return attempt.test;
  if (attempt.testId && typeof attempt.testId === 'object') return attempt.testId as ObjectiveTestPayload;
  return null;
};

const locateTranscriptSnippet = (transcript: string, expected: string | string[] | Record<string, string> | undefined) => {
  if (!transcript) return '';
  const candidates = normalizeCandidates(expected);
  for (const candidate of candidates) {
    if (candidate.length < 3) continue;
    const index = transcript.toLowerCase().indexOf(candidate.toLowerCase());
    if (index === -1) continue;
    const start = Math.max(0, index - 70);
    const end = Math.min(transcript.length, index + candidate.length + 90);
    const prefix = start > 0 ? '…' : '';
    const suffix = end < transcript.length ? '…' : '';
    return `${prefix}${transcript.slice(start, end).replace(/\s+/g, ' ').trim()}${suffix}`;
  }
  return '';
};

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

  const testPayload = useMemo(() => resolveTestPayload(attempt), [attempt]);
  const questionMap = useMemo(() => {
    const questions = (testPayload?.questions || []) as ObjectiveQuestion[];
    return new Map(questions.map(question => [question.questionId, question]));
  }, [testPayload?.questions]);

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
              <div className="divide-y divide-gray-100 dark:divide-gray-800 border-t border-gray-100 dark:border-gray-800">
                {(attempt.answers || []).map((answer: ObjectiveAnswer) => {
                  const question = questionMap.get(answer.questionId);
                  const expected = answer.expectedAnswer ?? question?.answerSpec?.value ?? question?.correctAnswer;
                  const transcriptEvidence = locateTranscriptSnippet(testPayload?.transcript || '', expected);
                  const reason = answer.feedbackHint || question?.explanation || '';

                  return (
                    <article key={answer.questionId} className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <div>
                          <p className="font-mono text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                            {answer.questionId}
                          </p>
                          <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">{question?.prompt || 'Question prompt unavailable.'}</p>
                        </div>
                        {answer.isCorrect === true ? (
                          <StatusBadge tone="success">✓ Correct</StatusBadge>
                        ) : answer.isCorrect === false ? (
                          <StatusBadge tone="danger">✗ Wrong</StatusBadge>
                        ) : null}
                      </div>

                      <div className="grid gap-2 text-sm md:grid-cols-2">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Your answer</p>
                          <p className="mt-1 text-gray-700 dark:text-gray-300">{formatAnswerValue(answer.answer)}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Expected answer</p>
                          <p className="mt-1 text-gray-700 dark:text-gray-300">{formatAnswerValue(expected)}</p>
                        </div>
                      </div>

                      {reason ? (
                        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                          <strong>Why:</strong> {reason}
                        </p>
                      ) : null}
                      {transcriptEvidence ? (
                        <p className="mt-1 text-xs text-violet-600 dark:text-violet-400">
                          <strong>Where in transcript:</strong> {transcriptEvidence}
                        </p>
                      ) : null}
                    </article>
                  );
                })}
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
