'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { SessionStatusStrip, PageHeader, SectionCard, StatusBadge } from '@/components/ui/v2';
import { apiRequest, ApiError, handleUsageLimitRedirect } from '@/lib/api/client';
import { ObjectiveAttempt, ObjectiveQuestion, ObjectiveTestPayload } from '@/lib/types';

type StartReadingResponse = {
  attemptId: string;
  test: ObjectiveTestPayload;
};

const formatCountdown = (secondsLeft: number) => {
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

export default function ReadingPage() {
  const timerRef = useRef<number | null>(null);
  const [track, setTrack] = useState<'academic' | 'general'>('academic');
  const [attemptId, setAttemptId] = useState('');
  const [test, setTest] = useState<ObjectiveTestPayload | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ObjectiveAttempt | null>(null);
  const [history, setHistory] = useState<ObjectiveAttempt[]>([]);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [reviewMode, setReviewMode] = useState(false);
  const [timerSecondsLeft, setTimerSecondsLeft] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const questionCount = useMemo(() => test?.questions.length || 0, [test]);

  const answeredCount = useMemo(() => {
    if (!test) return 0;
    return test.questions.reduce((count, question) => (answers[question.questionId] ? count + 1 : count), 0);
  }, [answers, test]);

  const activeQuestion = test?.questions[activeQuestionIndex];
  const activeQuestionAnswer = activeQuestion ? answers[activeQuestion.questionId] || '' : '';

  const stopTimer = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startTimer = (seconds: number) => {
    stopTimer();
    setTimerSecondsLeft(seconds);
    setElapsedSeconds(0);
    timerRef.current = window.setInterval(() => {
      setTimerSecondsLeft(prev => Math.max(prev - 1, 0));
      setElapsedSeconds(prev => prev + 1);
    }, 1000);
  };

  const loadHistory = useCallback(async () => {
    try {
      const items = await apiRequest<ObjectiveAttempt[]>(`/reading/history?limit=10&offset=0&track=${track}`);
      setHistory(items);
    } catch {
      // Keep experience usable if history fails.
    }
  }, [track]);

  const startTest = async () => {
    setError('');
    setLoading(true);
    try {
      const started = await apiRequest<StartReadingResponse>('/reading/tests/start', {
        method: 'POST',
        body: JSON.stringify({ track })
      });

      setAttemptId(started.attemptId);
      setTest(started.test);
      setAnswers({});
      setResult(null);
      setReviewMode(false);
      setActiveQuestionIndex(0);
      startTimer((started.test.suggestedTimeMinutes || 20) * 60);
    } catch (err) {
      if (handleUsageLimitRedirect(err)) return;
      setError(err instanceof ApiError ? err.message : 'Failed to start reading test');
    } finally {
      setLoading(false);
    }
  };

  const submitTest = useCallback(async () => {
    if (!attemptId || !test) return;

    setError('');
    setLoading(true);
    try {
      const payload = {
        answers: test.questions.map(question => ({
          questionId: question.questionId,
          answer: answers[question.questionId] || ''
        })),
        durationSeconds: elapsedSeconds
      };

      await apiRequest<ObjectiveAttempt>(`/reading/tests/${attemptId}/submit`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      const detail = await apiRequest<ObjectiveAttempt>(`/reading/tests/${attemptId}`);
      setResult(detail);
      stopTimer();
      setReviewMode(false);
      await loadHistory();
    } catch (err) {
      if (handleUsageLimitRedirect(err)) return;
      setError(err instanceof ApiError ? err.message : 'Failed to submit reading test');
    } finally {
      setLoading(false);
    }
  }, [answers, attemptId, elapsedSeconds, loadHistory, test]);

  const openAttempt = async (id: string) => {
    try {
      const detail = await apiRequest<ObjectiveAttempt>(`/reading/tests/${id}`);
      setResult(detail);
    } catch (err) {
      if (handleUsageLimitRedirect(err)) return;
      setError(err instanceof ApiError ? err.message : 'Failed to load attempt');
    }
  };

  const setQuestionAnswer = (question: ObjectiveQuestion, value: string) => {
    setAnswers(prev => ({ ...prev, [question.questionId]: value }));
  };

  const goToPrevQuestion = () => setActiveQuestionIndex(prev => Math.max(0, prev - 1));
  const goToNextQuestion = () => setActiveQuestionIndex(prev => Math.min(questionCount - 1, prev + 1));

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (timerSecondsLeft > 0) return;
    if (!attemptId || !test) return;
    if (result) return;
    void submitTest();
  }, [attemptId, result, submitTest, test, timerSecondsLeft]);

  useEffect(() => {
    return () => stopTimer();
  }, []);

  return (
    <div className="space-y-6">
      {/* ── Page header ── */}
      <PageHeader
        title="Reading Comprehension"
        subtitle="Passage split view, timed controls, navigator, and review-before-submit flow."
        actions={
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white p-1 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <label className="pl-3 text-xs font-semibold uppercase tracking-widest text-gray-500 hidden sm:inline-block">Track</label>
              <select
                className="rounded-lg bg-transparent px-3 py-1.5 text-sm font-bold text-gray-900 focus:outline-none dark:text-white"
                value={track}
                onChange={event => setTrack(event.target.value as 'academic' | 'general')}
              >
                <option value="academic">Academic</option>
                <option value="general">General</option>
              </select>
            </div>
            <button
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-violet-500/25 transition-all hover:-translate-y-0.5 hover:bg-violet-700 hover:shadow-lg disabled:opacity-50"
              onClick={() => void startTest()}
              disabled={loading}
            >
              <span className="material-symbols-outlined text-[18px]">auto_stories</span>
              {loading ? 'Starting...' : 'Start Reading Test'}
            </button>
          </div>
        }
      />

      {test ? (
        <div className="space-y-4">
          {/* Runtime head */}
          <article className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-base font-bold text-gray-900 dark:text-white">{test.title}</h3>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-violet-100 dark:bg-violet-500/20 px-3 py-1 text-xs font-bold text-violet-700 dark:text-violet-300">{formatCountdown(timerSecondsLeft)}</span>
              <select
                className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                value={activeQuestionIndex}
                onChange={event => {
                  setReviewMode(false);
                  setActiveQuestionIndex(Number(event.target.value));
                }}
              >
                {test.questions.map((question, index) => (
                  <option key={question.questionId} value={index}>
                    Question {index + 1}
                  </option>
                ))}
              </select>
              <button className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 transition-colors" onClick={() => setReviewMode(true)}>
                Review & Submit
              </button>
            </div>
          </article>

          <SessionStatusStrip
            timerLabel={`Timer ${formatCountdown(timerSecondsLeft)}`}
            completionLabel={`${questionCount ? Math.round((answeredCount / questionCount) * 100) : 0}% complete`}
            unsolvedLabel={`${Math.max(0, questionCount - answeredCount)} unsolved`}
            actions={
              <>
                <button
                  type="button"
                  className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300"
                  onClick={goToPrevQuestion}
                >
                  Prev
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300"
                  onClick={goToNextQuestion}
                >
                  Next
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white"
                  onClick={() => setReviewMode(true)}
                >
                  Review
                </button>
              </>
            }
          />

          {/* Split view */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4">
            {/* Passage */}
            <article className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-3 self-start">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-gray-900 dark:text-white">Passage 1</h4>
                <div className="flex items-center gap-1">
                  <button type="button" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" aria-label="Highlight text">
                    <span className="material-symbols-outlined text-[18px]">ink_highlighter</span>
                  </button>
                  <button type="button" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" aria-label="Zoom in">
                    <span className="material-symbols-outlined text-[18px]">zoom_in</span>
                  </button>
                  <button type="button" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" aria-label="Zoom out">
                    <span className="material-symbols-outlined text-[18px]">zoom_out</span>
                  </button>
                </div>
              </div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">{test.title}</h2>
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">{test.passageText || 'Passage content unavailable for this attempt.'}</p>
            </article>

            {/* Question column */}
            <aside className="space-y-4">
              <article className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white">Questions</h4>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{activeQuestionIndex + 1}/{questionCount}</span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Answered {answeredCount}/{questionCount}</p>
                <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={questionCount} aria-valuenow={answeredCount}>
                  <span className="block h-full rounded-full bg-violet-500 transition-all" style={{ width: `${questionCount ? (answeredCount / questionCount) * 100 : 0}%` }} />
                </div>
              </article>

              {reviewMode ? (
                <article className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white">Review Answers</h4>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{answeredCount}/{questionCount}</span>
                  </div>
                  <ul className="space-y-1.5">
                    {test.questions.map((question, index) => (
                      <li key={question.questionId} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700 dark:text-gray-300">Question {index + 1}</span>
                        <span className={answers[question.questionId] ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-amber-600 dark:text-amber-400'}>{answers[question.questionId] ? 'Answered' : 'Missing'}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex gap-2">
                    <button className="flex-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors" onClick={() => setReviewMode(false)}>Back</button>
                    <button className="flex-1 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 transition-colors disabled:opacity-50" onClick={() => void submitTest()} disabled={loading}>{loading ? 'Submitting...' : 'Submit Reading Test'}</button>
                  </div>
                </article>
              ) : activeQuestion ? (
                <article className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white">Question {activeQuestionIndex + 1}</h4>
                    <button type="button" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" aria-label="Flag question">
                      <span className="material-symbols-outlined text-[18px]">flag</span>
                    </button>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{activeQuestion.prompt}</p>
                  {activeQuestion.options && activeQuestion.options.length > 0 ? (
                    <div className="space-y-2">
                      {activeQuestion.options.map(option => {
                        const selected = activeQuestionAnswer === option;
                        return (
                          <label key={option} className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm cursor-pointer transition-colors ${selected ? 'border-violet-300 dark:border-violet-500/40 bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300' : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                            <input type="radio" name={`question-${activeQuestion.questionId}`} checked={selected} onChange={() => setQuestionAnswer(activeQuestion, option)} className="accent-violet-600" />
                            <span>{option}</span>
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <input
                      className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                      value={activeQuestionAnswer}
                      onChange={event => setQuestionAnswer(activeQuestion, event.target.value)}
                      placeholder="Type your answer"
                    />
                  )}
                </article>
              ) : null}

              <article className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white">Navigator</h4>
                  <span className="text-xs text-gray-500 dark:text-gray-400">Part 1</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {test.questions.map((question, index) => (
                    <button
                      key={question.questionId}
                      type="button"
                      className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${index === activeQuestionIndex ? 'bg-violet-600 text-white' : answers[question.questionId] ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                      onClick={() => {
                        setReviewMode(false);
                        setActiveQuestionIndex(index);
                      }}
                    >
                      {index + 1}
                    </button>
                  ))}
                </div>
              </article>
            </aside>
          </div>

          {/* Bottom bar */}
          <div className="flex items-center justify-between rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-5 py-3">
            <button className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50" onClick={goToPrevQuestion} disabled={activeQuestionIndex === 0}>Previous</button>
            <div className="flex gap-2">
              <button className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50" onClick={goToNextQuestion} disabled={activeQuestionIndex >= questionCount - 1}>Next</button>
              <button className="rounded-xl bg-violet-600 px-5 py-2 text-sm font-semibold text-white hover:bg-violet-700 transition-colors disabled:opacity-50" onClick={() => void submitTest()} disabled={loading}>{loading ? 'Submitting...' : 'Submit Test'}</button>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <article className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Start a reading test to open the split workspace</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">You will get passage-question split mode with timer, navigation, and review before submit.</p>
            <button className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 hover:bg-violet-700 transition-colors disabled:opacity-50" onClick={() => void startTest()} disabled={loading}>
              {loading ? 'Starting...' : 'Start Reading Test'}
            </button>
          </article>
          <article className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 space-y-3">
            <h4 className="text-base font-bold text-gray-900 dark:text-white">What You Get</h4>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li className="flex items-start gap-2"><span className="material-symbols-outlined text-[14px] text-violet-500 mt-0.5">check_circle</span>Question navigator with answered-state chips.</li>
              <li className="flex items-start gap-2"><span className="material-symbols-outlined text-[14px] text-violet-500 mt-0.5">check_circle</span>Timed section flow with auto-submit on timeout.</li>
              <li className="flex items-start gap-2"><span className="material-symbols-outlined text-[14px] text-violet-500 mt-0.5">check_circle</span>Attempt history and detail deep links.</li>
            </ul>
          </article>
        </div>
      )}

      {result ? (
        <article className="rounded-2xl border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-500/5 p-5 space-y-2">
          <div className="flex items-center gap-3">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Band</p>
            <p className="text-3xl font-extrabold text-gray-900 dark:text-white">{result.normalizedBand?.toFixed(1) || '--'}</p>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300">Score: {result.score || 0}/{result.totalQuestions || 0}</p>
          <p className="text-sm text-gray-600 dark:text-gray-300">{result.feedback?.summary}</p>
        </article>
      ) : null}

      <SectionCard
        title="Recent Reading History"
        actions={<span className="text-xs text-gray-500 dark:text-gray-400">{history.length} attempts</span>}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[580px]">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Attempt</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Band</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Created</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {history.map(item => (
                <tr key={item._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <td className="px-5 py-3.5 text-sm font-mono text-gray-600 dark:text-gray-400">{item._id.slice(0, 8)}…</td>
                  <td className="px-5 py-3.5 text-sm text-gray-500 dark:text-gray-400">
                    <StatusBadge tone={item.status === 'completed' ? 'success' : 'neutral'}>{item.status || '-'}</StatusBadge>
                  </td>
                  <td className="px-5 py-3.5 text-sm font-bold text-gray-900 dark:text-white">{item.normalizedBand?.toFixed(1) || '-'}</td>
                  <td className="px-5 py-3.5 text-sm text-gray-500 dark:text-gray-400">{item.createdAt ? new Date(item.createdAt).toLocaleString() : '-'}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <button className="text-sm font-semibold text-violet-600 dark:text-violet-400 hover:underline" onClick={() => void openAttempt(item._id)}>Open</button>
                      <Link href={`/app/reading/history/${item._id}`} className="text-sm font-semibold text-violet-600 dark:text-violet-400 hover:underline">Detail</Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {error ? (
        <div className="rounded-xl border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 px-4 py-3 text-sm font-medium text-red-700 dark:text-red-400">{error}</div>
      ) : null}
    </div>
  );
}
