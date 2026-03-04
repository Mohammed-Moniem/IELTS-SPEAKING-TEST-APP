'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { PageHeader, SectionCard, MetricCard, StatusBadge } from '@/components/ui/v2';
import { apiRequest, ApiError } from '@/lib/api/client';
import { ObjectiveAnswer, ObjectiveAttempt, ObjectiveQuestion, ObjectiveTestPayload } from '@/lib/types';

type QuestionWithSection = ObjectiveQuestion & { sectionId: 'p1' | 'p2' | 'p3' };

const formatAnswerValue = (value: string | string[] | Record<string, string> | undefined) => {
  if (typeof value === 'string') return value.trim() || '(empty)';
  if (Array.isArray(value)) return value.length > 0 ? value.join(', ') : '(empty)';
  if (value && typeof value === 'object') {
    const pairs = Object.entries(value).map(([key, entry]) => `${key}: ${entry}`);
    return pairs.length > 0 ? pairs.join(', ') : '(empty)';
  }
  return '(empty)';
};

const normalizeAnswerCandidates = (value: string | string[] | Record<string, string> | undefined) => {
  if (typeof value === 'string') return [value.trim()].filter(Boolean);
  if (Array.isArray(value)) return value.map(item => String(item).trim()).filter(Boolean);
  if (value && typeof value === 'object') {
    return Object.values(value)
      .map(item => String(item).trim())
      .filter(Boolean);
  }
  return [];
};

const isAnswered = (value: string | string[] | Record<string, string> | undefined) => {
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === 'object') return Object.keys(value).length > 0;
  return false;
};

const resolveTestPayload = (attempt: ObjectiveAttempt | null): ObjectiveTestPayload | null => {
  if (!attempt) return null;
  if (attempt.test) return attempt.test;
  if (attempt.testId && typeof attempt.testId === 'object') return attempt.testId as ObjectiveTestPayload;
  return null;
};

const flattenQuestions = (test: ObjectiveTestPayload | null): QuestionWithSection[] => {
  if (!test) return [];
  if (Array.isArray(test.sections) && test.sections.length > 0) {
    return test.sections.flatMap(section =>
      (section.questions || []).map(question => ({
        ...question,
        sectionId: (question.sectionId || section.sectionId || 'p1') as 'p1' | 'p2' | 'p3'
      }))
    );
  }
  return (test.questions || []).map(question => ({
    ...question,
    sectionId: (question.sectionId || 'p1') as 'p1' | 'p2' | 'p3'
  }));
};

const locateEvidenceSnippet = (passage: string, expected: string | string[] | Record<string, string> | undefined) => {
  if (!passage) return '';
  const candidates = normalizeAnswerCandidates(expected);
  for (const candidate of candidates) {
    if (candidate.length < 3) continue;
    const index = passage.toLowerCase().indexOf(candidate.toLowerCase());
    if (index === -1) continue;
    const start = Math.max(0, index - 70);
    const end = Math.min(passage.length, index + candidate.length + 90);
    const prefix = start > 0 ? '…' : '';
    const suffix = end < passage.length ? '…' : '';
    return `${prefix}${passage.slice(start, end).replace(/\s+/g, ' ').trim()}${suffix}`;
  }
  return '';
};

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

  const testPayload = useMemo(() => resolveTestPayload(attempt), [attempt]);
  const questionMap = useMemo(() => {
    return new Map(flattenQuestions(testPayload).map(question => [question.questionId, question]));
  }, [testPayload]);

  const passageBySection = useMemo(() => {
    const map = new Map<'p1' | 'p2' | 'p3', string>();
    if (!testPayload) return map;
    if (Array.isArray(testPayload.sections) && testPayload.sections.length > 0) {
      testPayload.sections.forEach(section => {
        map.set(section.sectionId, section.passageText || '');
      });
      return map;
    }
    map.set('p1', testPayload.passageText || '');
    return map;
  }, [testPayload]);

  const accuracy = useMemo(() => {
    if (!attempt?.totalQuestions) return '--';
    return `${Math.round(((attempt.score || 0) / attempt.totalQuestions) * 100)}%`;
  }, [attempt]);

  const unansweredCount = useMemo(() => {
    if (!attempt?.answers) return 0;
    return attempt.answers.filter(answer => !isAnswered(answer.answer)).length;
  }, [attempt?.answers]);

  const fallbackTutorGuidance = useMemo(() => {
    if (!attempt) return [];

    const guidance: string[] = [];
    const totalQuestions = attempt.totalQuestions || 0;
    const score = attempt.score || 0;
    const attempted = Math.max(0, totalQuestions - unansweredCount);
    const suggestedSeconds = Math.max(1, (testPayload?.suggestedTimeMinutes || 60) * 60);
    const durationSeconds = attempt.durationSeconds || 0;
    const completionRatio = totalQuestions > 0 ? attempted / totalQuestions : 0;
    const timeRatio = durationSeconds / suggestedSeconds;

    if (completionRatio < 0.85) {
      guidance.push(
        `You attempted ${attempted}/${totalQuestions} questions. Improve completion first: complete every question because blanks are guaranteed losses.`
      );
    }

    if (timeRatio < 0.65) {
      guidance.push(
        'You submitted significantly early. In reading, use the final minutes to verify T/F/NG logic and word-limit compliance before submitting.'
      );
    }

    if (attempt.sectionStats?.length) {
      const weakestSection = [...attempt.sectionStats].sort((a, b) => a.score / Math.max(1, a.total) - b.score / Math.max(1, b.total))[0];
      guidance.push(
        `Weakest section: ${weakestSection.sectionId.toUpperCase()} (${weakestSection.score}/${weakestSection.total}). Re-do this section untimed, then retest timed.`
      );
    }

    if (attempt.questionTypeStats?.length) {
      const weakestType = [...attempt.questionTypeStats].sort((a, b) => a.correct / Math.max(1, a.total) - b.correct / Math.max(1, b.total))[0];
      guidance.push(
        `Most costly question family: ${weakestType.type} (${weakestType.correct}/${weakestType.total}). Practice this type in short focused sets of 10–15 questions.`
      );
    }

    const firstMistake = (attempt.answers || []).find(answer => answer.isCorrect === false);
    if (firstMistake?.feedbackHint) {
      guidance.push(`Examiner-style cue: ${firstMistake.feedbackHint}`);
    }

    guidance.push(
      `Band lift path: move from ${score}/${Math.max(1, totalQuestions)} to at least ${Math.ceil(
        Math.max(1, totalQuestions) * 0.78
      )}/${Math.max(1, totalQuestions)} by fixing timing, then evidence matching, then precision on answer format.`
    );

    return guidance.slice(0, 6);
  }, [attempt, testPayload?.suggestedTimeMinutes, unansweredCount]);

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
              <p className="text-sm font-semibold text-violet-600 dark:text-violet-400">
                Deep feedback is still being prepared. Interim AI guidance based on your current attempt:
              </p>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-gray-700 dark:text-gray-300">
                {fallbackTutorGuidance.map(item => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
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
                {(attempt.answers || []).map((answer: ObjectiveAnswer) => {
                  const question = questionMap.get(answer.questionId);
                  const sectionId = (answer.sectionId || question?.sectionId || 'p1') as 'p1' | 'p2' | 'p3';
                  const expected = answer.expectedAnswer ?? question?.answerSpec?.value ?? question?.correctAnswer;
                  const passageSnippet = locateEvidenceSnippet(passageBySection.get(sectionId) || '', expected);
                  const evidence = answer.feedbackHint || question?.explanation || '';
                  return (
                    <article key={answer.questionId} className="px-6 py-4 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <div>
                          <p className="font-mono text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                            {answer.questionId} • {sectionId.toUpperCase()}
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

                      {evidence ? (
                        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                          <strong>Why:</strong> {evidence}
                        </p>
                      ) : null}
                      {passageSnippet ? (
                        <p className="mt-1 text-xs text-violet-600 dark:text-violet-400">
                          <strong>Where in passage:</strong> {passageSnippet}
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
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </div>
      ) : null}
    </div>
  );
}
