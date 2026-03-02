'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { SessionStatusStrip, PageHeader, SectionCard, StatusBadge } from '@/components/ui/v2';
import { apiRequest, ApiError } from '@/lib/api/client';
import { WritingSubmission, WritingTask } from '@/lib/types';

const draftStorageKey = (taskId?: string) => `spokio.web.writing.draft.${taskId || 'no-task'}`;
const recoveryStorageKey = 'spokio.web.writing.recovery';

type RecoveryDraft = {
  taskId: string;
  responseText: string;
  durationSeconds: number;
  savedAt: string;
};

const formatCountdown = (secondsLeft: number) => {
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

const buildLibraryHref = (
  kind: 'collocations' | 'vocabulary' | 'books' | 'channels',
  module: 'speaking' | 'writing' | 'reading' | 'listening',
  seed?: string
) => {
  const query = new URLSearchParams();
  query.set('module', module);
  if (seed) query.set('search', seed);
  return `/app/library/${kind}${query.toString() ? `?${query.toString()}` : ''}`;
};

export default function WritingPage() {
  const timerRef = useRef<number | null>(null);
  const [track, setTrack] = useState<'academic' | 'general'>('academic');
  const [taskType, setTaskType] = useState<'task1' | 'task2'>('task2');
  const [task, setTask] = useState<WritingTask | null>(null);
  const [responseText, setResponseText] = useState('');
  const [result, setResult] = useState<WritingSubmission | null>(null);
  const [history, setHistory] = useState<WritingSubmission[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<WritingSubmission | null>(null);
  const [timerSecondsLeft, setTimerSecondsLeft] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isAutosaved, setIsAutosaved] = useState(false);

  const wordCount = useMemo(() => responseText.trim().split(/\s+/).filter(Boolean).length, [responseText]);

  const wordPolicy = useMemo(() => {
    if (!task) return '';
    if (wordCount >= task.minimumWords) return 'Ready to submit';
    const remaining = task.minimumWords - wordCount;
    return `${remaining} more words needed to hit policy`;
  }, [task, wordCount]);

  const weakestWritingCriterion = useMemo(() => {
    if (!selectedSubmission) return '';
    const scores = [
      { key: 'task response', score: selectedSubmission.breakdown.taskResponse },
      { key: 'coherence cohesion', score: selectedSubmission.breakdown.coherenceCohesion },
      { key: 'lexical resource', score: selectedSubmission.breakdown.lexicalResource },
      { key: 'grammar accuracy', score: selectedSubmission.breakdown.grammaticalRangeAccuracy }
    ];
    return scores.sort((a, b) => a.score - b.score)[0]?.key || '';
  }, [selectedSubmission]);

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
      const items = await apiRequest<WritingSubmission[]>(`/writing/history?limit=10&offset=0&track=${track}`);
      setHistory(items);
    } catch {
      // Keep page usable if history is unavailable.
    }
  }, [track]);

  const generateTask = async () => {
    setError('');
    setLoading(true);
    try {
      const generated = await apiRequest<WritingTask>('/writing/tasks/generate', {
        method: 'POST',
        body: JSON.stringify({ track, taskType })
      });

      setTask(generated);
      setResult(null);
      setSelectedSubmission(null);

      const savedDraft = window.localStorage.getItem(draftStorageKey(generated.taskId));
      setResponseText(savedDraft || '');

      startTimer((generated.suggestedTimeMinutes || 20) * 60);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to generate writing task.');
    } finally {
      setLoading(false);
    }
  };

  const submitResponse = async () => {
    if (!task) return;
    if (responseText.trim().length < 20) {
      setError('Response is too short. Please provide a complete essay.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const recoveryPayload: RecoveryDraft = {
        taskId: task.taskId,
        responseText,
        durationSeconds: elapsedSeconds,
        savedAt: new Date().toISOString()
      };
      window.localStorage.setItem(recoveryStorageKey, JSON.stringify(recoveryPayload));

      const submission = await apiRequest<WritingSubmission>('/writing/submissions', {
        method: 'POST',
        body: JSON.stringify({
          taskId: task.taskId,
          responseText,
          durationSeconds: elapsedSeconds
        })
      });

      window.localStorage.removeItem(recoveryStorageKey);
      window.localStorage.removeItem(draftStorageKey(task.taskId));
      setResult(submission);
      setSelectedSubmission(submission);
      stopTimer();
      await loadHistory();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to submit writing response.');
    } finally {
      setLoading(false);
    }
  };

  const openSubmission = async (submissionId: string) => {
    setError('');
    try {
      const detail = await apiRequest<WritingSubmission>(`/writing/submissions/${submissionId}`);
      setSelectedSubmission(detail);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load submission details.');
    }
  };

  const saveDraftNow = () => {
    if (!task) return;
    window.localStorage.setItem(draftStorageKey(task.taskId), responseText);
    setIsAutosaved(true);
    window.setTimeout(() => setIsAutosaved(false), 900);
  };

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (!task) return;
    const key = draftStorageKey(task.taskId);
    window.localStorage.setItem(key, responseText);
    setIsAutosaved(true);

    const timeout = window.setTimeout(() => setIsAutosaved(false), 850);
    return () => window.clearTimeout(timeout);
  }, [responseText, task]);

  useEffect(() => {
    const raw = window.localStorage.getItem(recoveryStorageKey);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as RecoveryDraft;
      setResponseText(parsed.responseText || '');
      setElapsedSeconds(parsed.durationSeconds || 0);
    } catch {
      // Ignore malformed recovery payloads.
    }
  }, []);

  useEffect(() => {
    return () => stopTimer();
  }, []);

  return (
    <div className="space-y-6">
      {/* ── Page header ── */}
      <PageHeader
        title="Writing Workspace"
        subtitle="Timed drafting, autosave recovery, and rubric-aware AI scoring."
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
            <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white p-1 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <label className="pl-3 text-xs font-semibold uppercase tracking-widest text-gray-500 hidden sm:inline-block">Task</label>
              <select
                className="rounded-lg bg-transparent px-3 py-1.5 text-sm font-bold text-gray-900 focus:outline-none dark:text-white"
                value={taskType}
                onChange={event => setTaskType(event.target.value as 'task1' | 'task2')}
              >
                <option value="task1">Task 1</option>
                <option value="task2">Task 2</option>
              </select>
            </div>
            <button
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2 text-sm font-bold text-white shadow-md shadow-violet-500/25 transition-all hover:-translate-y-0.5 hover:bg-violet-700 hover:shadow-lg disabled:opacity-50"
              onClick={() => void generateTask()}
              disabled={loading}
            >
              <span className="material-symbols-outlined text-[18px]">edit_note</span>
              {loading ? 'Generating...' : 'Generate Task'}
            </button>
          </div>
        }
      />

      {task ? (
        <div className="space-y-4">
          <SessionStatusStrip
            timerLabel={`Timer ${formatCountdown(timerSecondsLeft)}`}
            completionLabel={`${Math.min(100, Math.round((wordCount / Math.max(1, task.minimumWords)) * 100))}% draft target`}
            unsolvedLabel={`${Math.max(0, task.minimumWords - wordCount)} words remaining`}
            actions={
              <>
                <button
                  type="button"
                  className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300"
                  onClick={saveDraftNow}
                >
                  Save Draft
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white"
                  onClick={() => void submitResponse()}
                  disabled={loading || wordCount < Math.min(task.minimumWords, 30)}
                >
                  Submit
                </button>
              </>
            }
          />

          <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] xl:grid-cols-[340px_1fr_280px] gap-6">
            {/* ── Task brief (left) ── */}
            <aside className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-4 self-start lg:sticky lg:top-4">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-violet-100 dark:bg-violet-500/20 px-3 py-0.5 text-xs font-bold text-violet-700 dark:text-violet-300">{task.track}</span>
                <span className="rounded-full bg-gray-100 dark:bg-gray-800 px-3 py-0.5 text-xs font-bold text-gray-600 dark:text-gray-400">{task.taskType}</span>
              </div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">{task.title}</h2>
              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{task.prompt}</p>
              <div className="grid grid-cols-3 gap-2 rounded-xl bg-gray-50 dark:bg-gray-800/60 p-3">
                <div className="h-8 rounded-lg bg-gray-200 dark:bg-gray-700" />
                <div className="h-8 rounded-lg bg-gray-200 dark:bg-gray-700" />
                <div className="h-8 rounded-lg bg-gray-200 dark:bg-gray-700" />
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                <span>Min. words: <strong className="text-gray-700 dark:text-gray-300">{task.minimumWords}</strong></span>
                <span>Time: <strong className="text-gray-700 dark:text-gray-300">{task.suggestedTimeMinutes} min</strong></span>
              </div>
              <article className="rounded-xl bg-violet-50 dark:bg-violet-500/10 border border-violet-100 dark:border-violet-500/20 p-3 space-y-1">
                <h4 className="text-sm font-bold text-violet-800 dark:text-violet-300 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">lightbulb</span>
                  Key Tip
                </h4>
                <p className="text-xs text-violet-700 dark:text-violet-400">{task.instructions?.[0] || 'Include a concise overview first, then support with specific comparisons.'}</p>
              </article>
              {(task.instructions || []).length > 0 ? (
                <ul className="space-y-1.5">
                  {(task.instructions || []).slice(0, 3).map(rule => (
                    <li key={rule} className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400">
                      <span className="material-symbols-outlined text-[14px] text-violet-500 mt-0.5">check_circle</span>
                      {rule}
                    </li>
                  ))}
                </ul>
              ) : null}
            </aside>

            {/* ── Editor (center) ── */}
            <article className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 px-4 py-2.5">
                <div className="flex items-center gap-1" role="toolbar" aria-label="Editor tools">
                  <button type="button" className="rounded-lg px-2.5 py-1.5 text-sm font-bold text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" aria-label="Bold">B</button>
                  <button type="button" className="rounded-lg px-2.5 py-1.5 text-sm italic text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" aria-label="Italic">I</button>
                  <button type="button" className="rounded-lg px-2.5 py-1.5 text-sm underline text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" aria-label="Underline">U</button>
                  <button type="button" className="rounded-lg px-2.5 py-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" aria-label="Bullet list">
                    <span className="material-symbols-outlined text-[18px]">format_list_bulleted</span>
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-violet-100 dark:bg-violet-500/20 px-3 py-1 text-xs font-bold text-violet-700 dark:text-violet-300">{formatCountdown(timerSecondsLeft)}</span>
                  <span className="text-xs text-gray-400">{isAutosaved ? 'Saved locally' : 'Editing...'}</span>
                </div>
              </div>

              <textarea
                className="flex-1 min-h-[320px] px-5 py-4 text-sm text-gray-900 dark:text-white bg-transparent placeholder:text-gray-400 resize-none focus:outline-none"
                placeholder="Write your response here..."
                value={responseText}
                onChange={event => setResponseText(event.target.value)}
              />

              <footer className="border-t border-gray-100 dark:border-gray-800 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                  <span><strong className="text-gray-900 dark:text-white">{wordCount}</strong> words</span>
                  <span><strong className="text-gray-900 dark:text-white">{task.minimumWords}</strong> minimum</span>
                  <span><strong className="text-gray-900 dark:text-white">{Math.floor(elapsedSeconds / 60)}</strong> min used</span>
                  <span className={`font-semibold ${wordCount >= task.minimumWords ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>{wordPolicy}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    onClick={saveDraftNow}
                  >
                    Save Draft
                  </button>
                  <button
                    className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2 text-sm font-semibold text-white hover:bg-violet-700 transition-colors disabled:opacity-50"
                    onClick={() => void submitResponse()}
                    disabled={loading || wordCount < Math.min(task.minimumWords, 30)}
                  >
                    {loading ? 'Submitting...' : 'Submit for AI Evaluation'}
                  </button>
                </div>
              </footer>
            </article>

            {/* ── Score rail (right) ── */}
            {selectedSubmission ? (
              <aside className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-4 self-start">
                <div className="text-center space-y-1">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Overall Band</p>
                  <p className="text-4xl font-extrabold text-gray-900 dark:text-white">{selectedSubmission.overallBand.toFixed(1)}</p>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center">Submission #{selectedSubmission._id.slice(-6)}</p>
                <p className="text-sm text-gray-600 dark:text-gray-300">{selectedSubmission.feedback.summary}</p>
                <ul className="space-y-2">
                  <li className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Task Response</span>
                    <strong className="text-gray-900 dark:text-white">{selectedSubmission.breakdown.taskResponse.toFixed(1)}</strong>
                  </li>
                  <li className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Coherence</span>
                    <strong className="text-gray-900 dark:text-white">{selectedSubmission.breakdown.coherenceCohesion.toFixed(1)}</strong>
                  </li>
                  <li className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Lexical</span>
                    <strong className="text-gray-900 dark:text-white">{selectedSubmission.breakdown.lexicalResource.toFixed(1)}</strong>
                  </li>
                  <li className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Grammar</span>
                    <strong className="text-gray-900 dark:text-white">{selectedSubmission.breakdown.grammaticalRangeAccuracy.toFixed(1)}</strong>
                  </li>
                </ul>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Link
                    href={buildLibraryHref('collocations', 'writing', weakestWritingCriterion)}
                    className="font-semibold text-violet-600 dark:text-violet-400 hover:underline"
                  >
                    Related collocations
                  </Link>
                  <Link
                    href={buildLibraryHref('vocabulary', 'writing', weakestWritingCriterion)}
                    className="font-semibold text-violet-600 dark:text-violet-400 hover:underline"
                  >
                    Word alternatives
                  </Link>
                  <Link
                    href={buildLibraryHref('books', 'writing', weakestWritingCriterion)}
                    className="font-semibold text-violet-600 dark:text-violet-400 hover:underline"
                  >
                    Recommended resources
                  </Link>
                </div>
                <div className="flex gap-2">
                  <button
                    className="flex-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    onClick={() => void openSubmission(selectedSubmission._id)}
                  >
                    Refresh
                  </button>
                  <Link
                    className="flex-1 rounded-xl bg-violet-600 px-3 py-2 text-sm font-semibold text-white text-center hover:bg-violet-700 transition-colors"
                    href={`/app/writing/history/${selectedSubmission._id}`}
                  >
                    Full Eval
                  </Link>
                </div>
              </aside>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <article className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Generate a writing task to begin</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">You will get timer controls, autosave recovery, and detailed rubric scoring after submission.</p>
            <div className="flex gap-2">
              <span className="rounded-full bg-emerald-50 dark:bg-emerald-500/10 px-3 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">Autosave enabled</span>
              <span className="rounded-full bg-blue-50 dark:bg-blue-500/10 px-3 py-0.5 text-xs font-bold text-blue-700 dark:text-blue-400">Recovery ready</span>
            </div>
            <button
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 hover:bg-violet-700 transition-colors disabled:opacity-50"
              onClick={() => void generateTask()}
              disabled={loading}
            >
              {loading ? 'Generating...' : 'Start Writing Task'}
            </button>
          </article>
          <article className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 space-y-3">
            <h4 className="text-base font-bold text-gray-900 dark:text-white">Writing Flow</h4>
            <ol className="space-y-2 text-sm text-gray-600 dark:text-gray-400 list-decimal list-inside">
              <li>Generate a task for your selected track and type.</li>
              <li>Draft in the split workspace with live timer and autosave.</li>
              <li>Submit for rubric score and open full evaluation details.</li>
            </ol>
          </article>
        </div>
      )}

      {/* ── History table ── */}
      <SectionCard
        title="Recent Writing History"
        actions={<span className="text-xs text-gray-500 dark:text-gray-400">{history.length} submissions</span>}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[580px]">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Submission</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Band</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Created</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {history.map(item => (
                <tr key={item._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <td className="px-5 py-3.5 text-sm font-mono text-gray-600 dark:text-gray-400">{item._id.slice(0, 8)}…</td>
                  <td className="px-5 py-3.5 text-sm font-bold text-gray-900 dark:text-white">{item.overallBand.toFixed(1)}</td>
                  <td className="px-5 py-3.5 text-sm text-gray-500 dark:text-gray-400">{item.createdAt ? new Date(item.createdAt).toLocaleString() : '-'}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <button className="text-sm font-semibold text-violet-600 dark:text-violet-400 hover:underline" onClick={() => void openSubmission(item._id)}>Open</button>
                      <Link href={`/app/writing/history/${item._id}`} className="text-sm font-semibold text-violet-600 dark:text-violet-400 hover:underline">Detail</Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {result ? (
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-700 dark:text-emerald-400">
          Submission evaluated successfully.
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 px-4 py-3 text-sm font-medium text-red-700 dark:text-red-400">
          {error}
        </div>
      ) : null}
    </div>
  );
}
