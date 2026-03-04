'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import ReadingEngine, { ReadingWorkspaceState } from '@/components/reading/ReadingEngine';
import { SessionStatusStrip, PageHeader, SectionCard, StatusBadge } from '@/components/ui/v2';
import { apiRequest, ApiError, handleUsageLimitRedirect } from '@/lib/api/client';
import { ObjectiveAttempt, ObjectiveTestPayload } from '@/lib/types';

type StartReadingResponse = {
  attemptId: string;
  test: ObjectiveTestPayload;
};

type AnswerValue = string | string[] | Record<string, string>;

const formatCountdown = (secondsLeft: number) => {
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

const isAnswered = (value: AnswerValue | undefined) => {
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === 'object') return Object.keys(value).length > 0;
  return false;
};

export default function ReadingPage() {
  const timerRef = useRef<number | null>(null);
  const [track, setTrack] = useState<'academic' | 'general'>('academic');
  const [attemptId, setAttemptId] = useState('');
  const [test, setTest] = useState<ObjectiveTestPayload | null>(null);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [result, setResult] = useState<ObjectiveAttempt | null>(null);
  const [history, setHistory] = useState<ObjectiveAttempt[]>([]);
  const [timerSecondsLeft, setTimerSecondsLeft] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isTimerPaused, setIsTimerPaused] = useState(false);
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [savingProgress, setSavingProgress] = useState(false);
  const [openingAttemptId, setOpeningAttemptId] = useState('');

  const allQuestions = useMemo(() => {
    if (!test) return [];
    if (test.sections && test.sections.length > 0) {
      return test.sections.flatMap(section =>
        section.questions.map(question => ({
          ...question,
          sectionId: question.sectionId || section.sectionId
        }))
      );
    }
    return test.questions || [];
  }, [test]);

  const questionCount = allQuestions.length;
  const answeredCount = allQuestions.reduce((count, question) => (isAnswered(answers[question.questionId]) ? count + 1 : count), 0);

  const stopTimer = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startTimer = (seconds: number, elapsed = 0) => {
    stopTimer();
    setTimerSecondsLeft(seconds);
    setElapsedSeconds(elapsed);
    setIsTimerPaused(false);
    timerRef.current = window.setInterval(() => {
      setTimerSecondsLeft(prev => Math.max(prev - 1, 0));
      setElapsedSeconds(prev => prev + 1);
    }, 1000);
  };

  const pauseTimer = () => {
    stopTimer();
    setIsTimerPaused(true);
  };

  const resumeTimer = () => {
    if (timerRef.current || timerSecondsLeft <= 0 || result) return;
    setIsTimerPaused(false);
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
      // Keep interface usable if history fetch fails.
    }
  }, [track]);

  const startTest = async () => {
    setError('');
    setStatusMessage('');
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
      setIsTimerPaused(false);
      startTimer((started.test.suggestedTimeMinutes || 60) * 60);
      setStatusMessage('Reading test started.');
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
    setStatusMessage('');
    setLoading(true);
    try {
      const payload = {
        answers: allQuestions.map(question => ({
          questionId: question.questionId,
          sectionId: question.sectionId,
          answer: answers[question.questionId] ?? ''
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
      setIsTimerPaused(false);
      setStatusMessage('Reading test submitted successfully.');
      await loadHistory();
    } catch (err) {
      if (handleUsageLimitRedirect(err)) return;
      setError(err instanceof ApiError ? err.message : 'Failed to submit reading test');
    } finally {
      setLoading(false);
    }
  }, [allQuestions, answers, attemptId, elapsedSeconds, loadHistory, test]);

  const buildAnswerPayload = useCallback(() => {
    return allQuestions.map(question => ({
      questionId: question.questionId,
      sectionId: question.sectionId,
      answer: answers[question.questionId] ?? ''
    }));
  }, [allQuestions, answers]);

  const saveReadingProgress = useCallback(
    async (workspaceState?: ReadingWorkspaceState, options?: { paused?: boolean }) => {
      if (!attemptId || !test) return;

      setError('');
      setSavingProgress(true);
      try {
        const paused = options?.paused === true;
        const endpoint = paused ? `/reading/tests/${attemptId}/pause` : `/reading/tests/${attemptId}/save`;
        await apiRequest<ObjectiveAttempt>(endpoint, {
          method: 'POST',
          body: JSON.stringify({
            answers: buildAnswerPayload(),
            durationSeconds: elapsedSeconds,
            activeSectionId: workspaceState?.activeSectionId,
            activeQuestionIndex: workspaceState?.activeQuestionIndex,
            flaggedQuestionIds: workspaceState?.flaggedQuestionIds,
            isPaused: paused
          })
        });
        setStatusMessage(paused ? 'Timer paused. Progress saved.' : 'Progress saved.');
      } catch (err) {
        if (handleUsageLimitRedirect(err)) return;
        setError(err instanceof ApiError ? err.message : 'Failed to save progress');
      } finally {
        setSavingProgress(false);
      }
    },
    [attemptId, buildAnswerPayload, elapsedSeconds, test]
  );

  const handlePause = useCallback(
    async (workspaceState: ReadingWorkspaceState) => {
      pauseTimer();
      await saveReadingProgress(workspaceState, { paused: true });
    },
    [saveReadingProgress]
  );

  const handleResume = useCallback(
    async (workspaceState: ReadingWorkspaceState) => {
      resumeTimer();
      await saveReadingProgress(workspaceState, { paused: false });
    },
    [saveReadingProgress]
  );

  const openAttempt = async (id: string) => {
    setOpeningAttemptId(id);
    setError('');
    setStatusMessage('');
    try {
      const detail = await apiRequest<ObjectiveAttempt>(`/reading/tests/${id}`);
      const testPayload = (() => {
        if (detail.test) return detail.test;
        if (detail.testId && typeof detail.testId === 'object') return detail.testId as ObjectiveTestPayload;
        return null;
      })();

      if (testPayload) {
        setTest(testPayload);
        setAttemptId(detail._id);
      }

      const persistedAnswers =
        detail.workspaceState?.answers ||
        (detail.answers || []).reduce<Record<string, AnswerValue>>((acc, item) => {
          acc[item.questionId] = item.answer;
          return acc;
        }, {});
      setAnswers(persistedAnswers || {});
      setResult(detail.status === 'completed' ? detail : null);

      if (detail.status === 'in_progress' && testPayload) {
        const elapsed = detail.workspaceState?.durationSeconds ?? detail.durationSeconds ?? 0;
        const totalSeconds = (testPayload.suggestedTimeMinutes || 60) * 60;
        const remaining = Math.max(0, totalSeconds - elapsed);
        setElapsedSeconds(elapsed);
        setTimerSecondsLeft(remaining);
        if (detail.workspaceState?.isPaused || remaining === 0) {
          stopTimer();
          setIsTimerPaused(true);
          setStatusMessage('Loaded saved attempt in paused state.');
        } else {
          startTimer(remaining, elapsed);
          setStatusMessage('Loaded saved attempt and resumed timer.');
        }
      }
    } catch (err) {
      if (handleUsageLimitRedirect(err)) return;
      setError(err instanceof ApiError ? err.message : 'Failed to load attempt');
    } finally {
      setOpeningAttemptId('');
    }
  };

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (timerSecondsLeft > 0) return;
    if (!attemptId || !test || result) return;
    void submitTest();
  }, [attemptId, result, submitTest, test, timerSecondsLeft]);

  useEffect(() => () => stopTimer(), []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reading Comprehension"
        subtitle="IELTS-style 3-passage reading with full question-type coverage, timing controls, and tutor-grade feedback."
        actions={
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white p-1 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <label className="hidden pl-3 text-xs font-semibold uppercase tracking-widest text-gray-500 sm:inline-block">Track</label>
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
          <article className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <h3 className="text-base font-bold text-gray-900 dark:text-white">{test.title}</h3>
            <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-violet-700 dark:bg-violet-500/20 dark:text-violet-300">
              {formatCountdown(timerSecondsLeft)}
            </span>
          </article>

          <SessionStatusStrip
            timerLabel={`Timer ${formatCountdown(timerSecondsLeft)}`}
            completionLabel={`${questionCount ? Math.round((answeredCount / questionCount) * 100) : 0}% complete`}
            unsolvedLabel={`${Math.max(0, questionCount - answeredCount)} unsolved`}
            actions={
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                  onClick={() => {
                    if (isTimerPaused) resumeTimer();
                    else pauseTimer();
                  }}
                  disabled={!test || loading}
                >
                  {isTimerPaused ? 'Resume' : 'Pause'}
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                  onClick={() => void saveReadingProgress()}
                  disabled={!test || loading || savingProgress}
                >
                  {savingProgress ? 'Saving...' : 'Save'}
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white"
                  onClick={() => void submitTest()}
                  disabled={loading}
                >
                  {loading ? 'Submitting...' : 'Submit'}
                </button>
              </div>
            }
          />

          <ReadingEngine
            test={test}
            answers={answers}
            onChangeAnswers={setAnswers}
            onSubmit={() => void submitTest()}
            submitting={loading}
            onSaveProgress={state => saveReadingProgress(state)}
            onPause={handlePause}
            onResume={handleResume}
            timerPaused={isTimerPaused}
            saving={savingProgress}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <article className="space-y-4 rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Start a reading test</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              You will get a 3-passage IELTS-style flow with integrated navigator, review, and scoring.
            </p>
            <button
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 hover:bg-violet-700 disabled:opacity-50"
              onClick={() => void startTest()}
              disabled={loading}
            >
              {loading ? 'Starting...' : 'Start Reading Test'}
            </button>
          </article>
          <article className="space-y-3 rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
            <h4 className="text-base font-bold text-gray-900 dark:text-white">What you get</h4>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li className="flex items-start gap-2">
                <span className="material-symbols-outlined mt-0.5 text-[14px] text-violet-500">check_circle</span>
                3 passages with mixed official IELTS question families.
              </li>
              <li className="flex items-start gap-2">
                <span className="material-symbols-outlined mt-0.5 text-[14px] text-violet-500">check_circle</span>
                Immediate scoring plus deep tutor-style coaching.
              </li>
              <li className="flex items-start gap-2">
                <span className="material-symbols-outlined mt-0.5 text-[14px] text-violet-500">check_circle</span>
                Attempt history and detailed review.
              </li>
            </ul>
          </article>
        </div>
      )}

      {result ? (
        <article className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5 dark:border-emerald-500/20 dark:bg-emerald-500/5">
          <div className="flex items-center gap-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Band</p>
            <p className="text-3xl font-extrabold text-gray-900 dark:text-white">{result.normalizedBand?.toFixed(1) || '--'}</p>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Score: {result.score || 0}/{result.totalQuestions || 0}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-300">{result.feedback?.summary}</p>
          {result.deepFeedbackReady && result.deepFeedback?.overallSummary ? (
            <div className="rounded-xl border border-emerald-200/70 bg-white px-3 py-2 text-sm text-gray-700 dark:border-emerald-500/20 dark:bg-gray-900 dark:text-gray-300">
              {result.deepFeedback.overallSummary}
            </div>
          ) : (
            <p className="text-xs font-medium text-violet-600 dark:text-violet-400">Deep feedback is being prepared. Open detail for updates.</p>
          )}
        </article>
      ) : null}

      <SectionCard
        title="Recent Reading History"
        actions={<span className="text-xs text-gray-500 dark:text-gray-400">{history.length} attempts</span>}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px]">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Attempt</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Status</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Band</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Created</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {history.map(item => (
                <tr key={item._id} className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-5 py-3.5 font-mono text-sm text-gray-600 dark:text-gray-400">{item._id.slice(0, 8)}…</td>
                  <td className="px-5 py-3.5 text-sm text-gray-500 dark:text-gray-400">
                    <StatusBadge tone={item.status === 'completed' ? 'success' : 'neutral'}>{item.status || '-'}</StatusBadge>
                  </td>
                  <td className="px-5 py-3.5 text-sm font-bold text-gray-900 dark:text-white">{item.normalizedBand?.toFixed(1) || '-'}</td>
                  <td className="px-5 py-3.5 text-sm text-gray-500 dark:text-gray-400">
                    {item.createdAt ? new Date(item.createdAt).toLocaleString() : '-'}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <button
                        className="text-sm font-semibold text-violet-600 hover:underline dark:text-violet-400"
                        onClick={() => void openAttempt(item._id)}
                      >
                        {openingAttemptId === item._id ? 'Opening…' : 'Open'}
                      </button>
                      <Link href={`/app/reading/history/${item._id}`} className="text-sm font-semibold text-violet-600 hover:underline dark:text-violet-400">
                        Detail
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </div>
      ) : null}
      {statusMessage ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
          {statusMessage}
        </div>
      ) : null}
    </div>
  );
}
