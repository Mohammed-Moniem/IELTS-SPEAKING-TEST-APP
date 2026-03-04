'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { SessionStatusStrip, PageHeader, SectionCard, StatusBadge } from '@/components/ui/v2';
import { apiRequest, ApiError, handleUsageLimitRedirect } from '@/lib/api/client';
import { WritingSubmission, WritingTask } from '@/lib/types';

const draftStorageKey = (taskId?: string) => `spokio.web.writing.draft.${taskId || 'no-task'}`;
const draftSnapshotStorageKey = 'spokio.web.writing.savedDraftSnapshots';
const recoveryStorageKey = 'spokio.web.writing.recovery';
const deepFeedbackUiEnabled = (process.env.NEXT_PUBLIC_WRITING_DEEP_FEEDBACK_V2 || 'true') === 'true';

type RecoveryDraft = {
  taskId: string;
  responseText: string;
  durationSeconds: number;
  savedAt: string;
};

type StoredDraftPayload = {
  responseText: string;
  taskSnapshot?: WritingTask;
  savedAt?: string;
  source?: 'autosave' | 'manual';
};

type DraftSnapshot = {
  id: string;
  task: WritingTask;
  responseText: string;
  savedAt: string;
};

type Task1GraphPoint = {
  label: string;
  seriesA: number;
  seriesB: number;
  seriesC: number;
};

const formatCountdown = (secondsLeft: number) => {
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

const normalizeEssayText = (value: string) => value.trim().replace(/\s+/g, ' ');

const buildEssayFingerprint = (taskId?: string, responseText = '') =>
  `${taskId || 'no-task'}::${normalizeEssayText(responseText)}`;

const buildStableSeed = (value: string) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash || 1;
};

const createSeededNumber = (seed: number, min: number, max: number, step = 1) => {
  const next = (seed * 1664525 + 1013904223) % 4294967296;
  const normalized = next / 4294967296;
  const raw = min + normalized * (max - min);
  const snapped = Math.round(raw / step) * step;
  return { nextSeed: next || 1, value: snapped };
};

const deriveTask1GraphPoints = (task: WritingTask): Task1GraphPoint[] => {
  const yearMatches = task.prompt.match(/\b(19|20)\d{2}\b/g) || [];
  const uniqueYears = Array.from(new Set(yearMatches)).slice(0, 6);
  const labels =
    uniqueYears.length >= 4
      ? uniqueYears
      : ['2012', '2014', '2016', '2018', '2020', '2022'];

  let seed = buildStableSeed(`${task.taskId}:${task.title}:${task.prompt}`);
  const points: Task1GraphPoint[] = [];

  labels.forEach((label, index) => {
    const a = createSeededNumber(seed + index * 13, 35, 95, 1);
    const b = createSeededNumber(a.nextSeed + index * 17, 20, 85, 1);
    const c = createSeededNumber(b.nextSeed + index * 19, 15, 75, 1);
    seed = c.nextSeed;
    points.push({
      label,
      seriesA: a.value,
      seriesB: b.value,
      seriesC: c.value
    });
  });

  return points;
};

const parseStoredDraftPayload = (raw: string | null): StoredDraftPayload | null => {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as StoredDraftPayload;
    return {
      responseText: typeof parsed.responseText === 'string' ? parsed.responseText : '',
      taskSnapshot: parsed.taskSnapshot,
      savedAt: parsed.savedAt,
      source: parsed.source
    };
  } catch {
    return {
      responseText: raw
    };
  }
};

const serializeStoredDraftPayload = (
  task: WritingTask,
  responseText: string,
  source: 'autosave' | 'manual'
) =>
  JSON.stringify({
    responseText,
    taskSnapshot: task,
    savedAt: new Date().toISOString(),
    source
  } satisfies StoredDraftPayload);

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

const getTaskDisplayFallback = (track: 'academic' | 'general', taskType: 'task1' | 'task2') => {
  if (taskType === 'task1' && track === 'academic') {
    return {
      title: 'Academic Task 1 Visual Data Summary',
      prompt:
        'Summarize the key trends in the visual information, highlight major comparisons, and report the most significant changes clearly.'
    };
  }

  if (taskType === 'task1' && track === 'general') {
    return {
      title: 'General Task 1 Letter Prompt',
      prompt:
        'Write a clear letter that addresses all bullet points, uses the right tone, and stays focused on the requested outcome.'
    };
  }

  return {
    title: `${track === 'academic' ? 'Academic' : 'General'} Task 2 Essay`,
    prompt:
      'Discuss both perspectives, present a clear position, and support your argument with specific reasons and examples.'
  };
};

const normalizeSubmissionTask = (submission: WritingSubmission): WritingTask | null => {
  const taskRef = submission.taskId;

  if (taskRef && typeof taskRef === 'object') {
    const taskId = (taskRef.taskId || (taskRef as { _id?: string })._id || '').toString();
    const track = (taskRef.track || submission.track || 'academic') as 'academic' | 'general';
    const taskType = (taskRef.taskType || submission.taskType || 'task2') as 'task1' | 'task2';
    const fallback = getTaskDisplayFallback(track, taskType);

    return {
      taskId,
      track,
      taskType,
      title:
        typeof taskRef.title === 'string' && taskRef.title.trim().length > 0 ? taskRef.title : fallback.title,
      prompt:
        typeof taskRef.prompt === 'string' && taskRef.prompt.trim().length > 0 ? taskRef.prompt : fallback.prompt,
      instructions: Array.isArray(taskRef.instructions) ? taskRef.instructions : [],
      suggestedTimeMinutes:
        typeof taskRef.suggestedTimeMinutes === 'number' && taskRef.suggestedTimeMinutes > 0
          ? taskRef.suggestedTimeMinutes
          : taskType === 'task2'
            ? 40
            : 20,
      minimumWords:
        typeof taskRef.minimumWords === 'number' && taskRef.minimumWords > 0
          ? taskRef.minimumWords
          : taskType === 'task2'
            ? 250
            : 150,
      tags: Array.isArray(taskRef.tags) ? taskRef.tags : []
    };
  }

  if (typeof taskRef === 'string' && submission.track && submission.taskType) {
    const fallback = getTaskDisplayFallback(submission.track, submission.taskType);
    return {
      taskId: taskRef,
      track: submission.track,
      taskType: submission.taskType,
      title: fallback.title,
      prompt: fallback.prompt,
      instructions: [],
      suggestedTimeMinutes: submission.taskType === 'task2' ? 40 : 20,
      minimumWords: submission.taskType === 'task2' ? 250 : 150,
      tags: []
    };
  }

  return null;
};

export default function WritingPage() {
  const searchParams = useSearchParams();
  const timerRef = useRef<number | null>(null);
  const [track, setTrack] = useState<'academic' | 'general'>('academic');
  const [taskType, setTaskType] = useState<'task1' | 'task2'>('task2');
  const [task, setTask] = useState<WritingTask | null>(null);
  const [responseText, setResponseText] = useState('');
  const [result, setResult] = useState<WritingSubmission | null>(null);
  const [history, setHistory] = useState<WritingSubmission[]>([]);
  const [draftSnapshots, setDraftSnapshots] = useState<DraftSnapshot[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<WritingSubmission | null>(null);
  const [timerSecondsLeft, setTimerSecondsLeft] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingSubmissionId, setLoadingSubmissionId] = useState<string | null>(null);
  const [isAutosaved, setIsAutosaved] = useState(false);
  const [isTimerPaused, setIsTimerPaused] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [baselineFingerprint, setBaselineFingerprint] = useState('');
  const [lastPersistedFingerprint, setLastPersistedFingerprint] = useState('');
  const taskDisplayFallback = useMemo(() => getTaskDisplayFallback(track, taskType), [track, taskType]);
  const submissionToOpen = searchParams.get('open_submission');
  const selectedSubmissionId = typeof selectedSubmission?._id === 'string' ? selectedSubmission._id : '';
  const selectedTaskMetricLabel = selectedSubmission?.taskType === 'task1' ? 'Task Achievement' : 'Task Response';
  const selectedBreakdown = useMemo(
    () => {
      const source = (selectedSubmission?.breakdown as unknown as Record<string, unknown>) || {};
      return {
        taskResponse: Number(source.taskResponse || source.taskAchievement || 0),
        coherenceCohesion: Number(source.coherenceCohesion || source.coherenceAndCohesion || 0),
        lexicalResource: Number(source.lexicalResource || 0),
        grammaticalRangeAccuracy: Number(source.grammaticalRangeAccuracy || source.grammaticalRangeAndAccuracy || 0)
      };
    },
    [selectedSubmission]
  );
  const selectedFeedback = {
    summary:
      typeof selectedSubmission?.feedback?.summary === 'string' && selectedSubmission.feedback.summary.trim().length > 0
        ? selectedSubmission.feedback.summary
        : 'Evaluation details are being prepared.',
    inlineSuggestions: Array.isArray(selectedSubmission?.feedback?.inlineSuggestions)
      ? selectedSubmission.feedback.inlineSuggestions
      : [],
    strengths: Array.isArray(selectedSubmission?.feedback?.strengths) ? selectedSubmission.feedback.strengths : [],
    improvements: Array.isArray(selectedSubmission?.feedback?.improvements) ? selectedSubmission.feedback.improvements : []
  };
  const selectedDeepFeedbackReady = deepFeedbackUiEnabled && Boolean(
    selectedSubmission?.deepFeedbackReady ||
      selectedSubmission?.feedbackVersion === 'v2' ||
      selectedSubmission?.feedback?.overall ||
      selectedSubmission?.feedback?.criteria
  );
  const selectedOverall = selectedSubmission?.feedback?.overall;
  const selectedPriorityActions = useMemo(() => {
    if (Array.isArray(selectedOverall?.priorityOrder) && selectedOverall.priorityOrder.length > 0) {
      return selectedOverall.priorityOrder.slice(0, 3);
    }
    if (Array.isArray(selectedOverall?.nextSteps24h) && selectedOverall.nextSteps24h.length > 0) {
      return selectedOverall.nextSteps24h.slice(0, 3);
    }
    return selectedFeedback.improvements.slice(0, 3);
  }, [selectedFeedback.improvements, selectedOverall]);

  const wordCount = useMemo(() => responseText.trim().split(/\s+/).filter(Boolean).length, [responseText]);
  const currentFingerprint = useMemo(
    () => buildEssayFingerprint(task?.taskId, responseText),
    [task?.taskId, responseText]
  );
  const hasChangedSinceLoaded = Boolean(task) && currentFingerprint !== baselineFingerprint;
  const hasChangedSincePersisted = Boolean(task) && currentFingerprint !== lastPersistedFingerprint;

  const wordPolicy = useMemo(() => {
    if (!task) return '';
    if (wordCount >= task.minimumWords) return 'Ready to submit';
    const remaining = task.minimumWords - wordCount;
    return `${remaining} more words needed to hit policy`;
  }, [task, wordCount]);
  const canSaveDraft =
    Boolean(task) &&
    responseText.trim().length > 0 &&
    hasChangedSinceLoaded &&
    hasChangedSincePersisted &&
    !loading;
  const canSubmit =
    Boolean(task) &&
    wordCount >= Math.min(task?.minimumWords || 0, 30) &&
    !loading;
  const task1GraphPoints = useMemo(
    () =>
      task && task.track === 'academic' && task.taskType === 'task1'
        ? deriveTask1GraphPoints(task)
        : [],
    [task]
  );

  const weakestWritingCriterion = useMemo(() => {
    if (!selectedSubmission) return '';
    const scores = [
      { key: 'task response', score: selectedBreakdown.taskResponse },
      { key: 'coherence cohesion', score: selectedBreakdown.coherenceCohesion },
      { key: 'lexical resource', score: selectedBreakdown.lexicalResource },
      { key: 'grammar accuracy', score: selectedBreakdown.grammaticalRangeAccuracy }
    ];
    return scores.sort((a, b) => a.score - b.score)[0]?.key || '';
  }, [selectedSubmission, selectedBreakdown]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback((seconds: number) => {
    stopTimer();
    setTimerSecondsLeft(seconds);
    setElapsedSeconds(0);
    setIsTimerPaused(false);
    timerRef.current = window.setInterval(() => {
      setTimerSecondsLeft(prev => Math.max(prev - 1, 0));
      setElapsedSeconds(prev => prev + 1);
    }, 1000);
  }, [stopTimer]);

  const pauseTimer = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsTimerPaused(true);
  }, []);

  const resumeTimer = useCallback(() => {
    if (timerRef.current || !task || timerSecondsLeft <= 0) {
      return;
    }
    setIsTimerPaused(false);
    timerRef.current = window.setInterval(() => {
      setTimerSecondsLeft(prev => Math.max(prev - 1, 0));
      setElapsedSeconds(prev => prev + 1);
    }, 1000);
  }, [task, timerSecondsLeft]);

  const readDraftSnapshots = useCallback((): DraftSnapshot[] => {
    const raw = window.localStorage.getItem(draftSnapshotStorageKey);
    if (!raw) return [];

    try {
      const parsed = JSON.parse(raw) as DraftSnapshot[];
      return Array.isArray(parsed)
        ? parsed
            .filter(
              item =>
                Boolean(item?.id) &&
                Boolean(item?.task?.taskId) &&
                typeof item?.responseText === 'string' &&
                Boolean(item?.savedAt)
            )
            .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime())
        : [];
    } catch {
      return [];
    }
  }, []);

  const syncDraftSnapshots = useCallback(() => {
    setDraftSnapshots(readDraftSnapshots());
  }, [readDraftSnapshots]);

  const pushDraftSnapshot = useCallback(
    (nextSnapshot: DraftSnapshot) => {
      const current = readDraftSnapshots();
      const next = [nextSnapshot, ...current].slice(0, 20);
      window.localStorage.setItem(draftSnapshotStorageKey, JSON.stringify(next));
      setDraftSnapshots(next);
    },
    [readDraftSnapshots]
  );

  const removeDraftSnapshot = useCallback(
    (snapshotId: string) => {
      const next = readDraftSnapshots().filter(item => item.id !== snapshotId);
      window.localStorage.setItem(draftSnapshotStorageKey, JSON.stringify(next));
      setDraftSnapshots(next);
    },
    [readDraftSnapshots]
  );

  const loadTaskIntoWorkspace = useCallback(
    (nextTask: WritingTask, nextResponseText: string, message: string) => {
      setTask(nextTask);
      setTrack(nextTask.track);
      setTaskType(nextTask.taskType);
      setResponseText(nextResponseText);
      setResult(null);
      setSelectedSubmission(null);
      startTimer((nextTask.suggestedTimeMinutes || 20) * 60);
      const fingerprint = buildEssayFingerprint(nextTask.taskId, nextResponseText);
      setBaselineFingerprint(fingerprint);
      setLastPersistedFingerprint(fingerprint);
      setStatusMessage(message);
    },
    [startTimer]
  );

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
    setStatusMessage('');
    setLoading(true);
    try {
      const generated = await apiRequest<WritingTask>('/writing/tasks/generate', {
        method: 'POST',
        body: JSON.stringify({ track, taskType })
      });

      setTask(generated);
      setResult(null);
      setSelectedSubmission(null);

      const storedDraft = parseStoredDraftPayload(window.localStorage.getItem(draftStorageKey(generated.taskId)));
      const restoredText = storedDraft?.responseText || '';
      setResponseText(restoredText);
      startTimer((generated.suggestedTimeMinutes || 20) * 60);
      const fingerprint = buildEssayFingerprint(generated.taskId, restoredText);
      setBaselineFingerprint(fingerprint);
      setLastPersistedFingerprint(fingerprint);
      if (restoredText.trim().length > 0) {
        setStatusMessage('Recovered your saved draft for this task.');
      }
    } catch (err) {
      if (handleUsageLimitRedirect(err)) return;
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
    setStatusMessage('');
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
      setBaselineFingerprint(currentFingerprint);
      setLastPersistedFingerprint(currentFingerprint);
      setStatusMessage('Essay submitted successfully. Open Full Eval for complete scoring details.');
      await loadHistory();
      syncDraftSnapshots();
    } catch (err) {
      if (handleUsageLimitRedirect(err)) return;
      setError(err instanceof ApiError ? err.message : 'Failed to submit writing response.');
    } finally {
      setLoading(false);
    }
  };

  const openSubmission = useCallback(
    async (submissionId: string) => {
      setError('');
      setStatusMessage('');
      setLoadingSubmissionId(submissionId);
      try {
        const detail = await apiRequest<WritingSubmission>(`/writing/submissions/${submissionId}`);
        setSelectedSubmission(detail);
        const normalizedTask = normalizeSubmissionTask(detail);
        if (normalizedTask) {
          loadTaskIntoWorkspace(
            normalizedTask,
            typeof detail.responseText === 'string' ? detail.responseText : '',
            'Loaded previous submission into the editor. Edit before saving or submitting a new attempt.'
          );
        }
      } catch (err) {
        if (handleUsageLimitRedirect(err)) return;
        setError(err instanceof ApiError ? err.message : 'Failed to load submission details.');
      } finally {
        setLoadingSubmissionId(null);
      }
    },
    [loadTaskIntoWorkspace]
  );

  const saveDraftNow = () => {
    if (!task) return;
    if (!hasChangedSincePersisted || !hasChangedSinceLoaded) {
      setError('No changes to save. Edit your essay first.');
      return;
    }

    const serialized = serializeStoredDraftPayload(task, responseText, 'manual');
    window.localStorage.setItem(draftStorageKey(task.taskId), serialized);
    pushDraftSnapshot({
      id: `${task.taskId}-${Date.now()}`,
      task,
      responseText,
      savedAt: new Date().toISOString()
    });
    setBaselineFingerprint(currentFingerprint);
    setLastPersistedFingerprint(currentFingerprint);
    pauseTimer();
    setStatusMessage('Draft saved locally and timer paused. Reopen it from Saved Draft Snapshots below.');
    setIsAutosaved(true);
    window.setTimeout(() => setIsAutosaved(false), 900);
  };

  const openDraftSnapshot = (snapshot: DraftSnapshot) => {
    loadTaskIntoWorkspace(snapshot.task, snapshot.responseText, 'Opened saved draft snapshot.');
    syncDraftSnapshots();
  };

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (!submissionToOpen) return;
    void openSubmission(submissionToOpen).finally(() => {
      const url = new URL(window.location.href);
      if (!url.searchParams.has('open_submission')) return;
      url.searchParams.delete('open_submission');
      const nextUrl = `${url.pathname}${url.searchParams.toString() ? `?${url.searchParams.toString()}` : ''}${url.hash}`;
      window.history.replaceState({}, '', nextUrl);
    });
  }, [openSubmission, submissionToOpen]);

  useEffect(() => {
    syncDraftSnapshots();
  }, [syncDraftSnapshots]);

  useEffect(() => {
    if (!task) return;
    const key = draftStorageKey(task.taskId);
    window.localStorage.setItem(key, serializeStoredDraftPayload(task, responseText, 'autosave'));
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
      setStatusMessage('Recovered unsent response from your previous session.');
    } catch {
      // Ignore malformed recovery payloads.
    }
  }, []);

  useEffect(() => {
    return () => stopTimer();
  }, [stopTimer]);

  return (
    <div className="space-y-6">
      {/* ── Page header ── */}
      <PageHeader
        title="Writing Workspace"
        subtitle="Timed drafting, autosave recovery, and rubric-aware AI scoring."
        actions={
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white p-1.5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <span className="pl-2 text-xs font-semibold uppercase tracking-widest text-gray-500 hidden sm:inline-block">Track</span>
              <div className="flex items-center rounded-lg bg-gray-100 p-0.5 dark:bg-gray-800">
                <button
                  type="button"
                  className={`rounded-md px-3 py-1.5 text-sm font-bold transition-colors ${
                    track === 'academic'
                      ? 'bg-violet-600 text-white shadow-sm dark:bg-violet-500 dark:text-white'
                      : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'
                  }`}
                  onClick={() => setTrack('academic')}
                  aria-pressed={track === 'academic'}
                >
                  Academic
                </button>
                <button
                  type="button"
                  className={`rounded-md px-3 py-1.5 text-sm font-bold transition-colors ${
                    track === 'general'
                      ? 'bg-violet-600 text-white shadow-sm dark:bg-violet-500 dark:text-white'
                      : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'
                  }`}
                  onClick={() => setTrack('general')}
                  aria-pressed={track === 'general'}
                >
                  General
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white p-1.5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <span className="pl-2 text-xs font-semibold uppercase tracking-widest text-gray-500 hidden sm:inline-block">Task</span>
              <div className="flex items-center rounded-lg bg-gray-100 p-0.5 dark:bg-gray-800">
                <button
                  type="button"
                  className={`rounded-md px-3 py-1.5 text-sm font-bold transition-colors ${
                    taskType === 'task1'
                      ? 'bg-violet-600 text-white shadow-sm dark:bg-violet-500 dark:text-white'
                      : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'
                  }`}
                  onClick={() => setTaskType('task1')}
                  aria-pressed={taskType === 'task1'}
                >
                  Task 1
                </button>
                <button
                  type="button"
                  className={`rounded-md px-3 py-1.5 text-sm font-bold transition-colors ${
                    taskType === 'task2'
                      ? 'bg-violet-600 text-white shadow-sm dark:bg-violet-500 dark:text-white'
                      : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'
                  }`}
                  onClick={() => setTaskType('task2')}
                  aria-pressed={taskType === 'task2'}
                >
                  Task 2
                </button>
              </div>
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

      {statusMessage ? (
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-500/25 bg-emerald-50 dark:bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-700 dark:text-emerald-300">
          {statusMessage}
        </div>
      ) : null}

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
                  className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 disabled:opacity-50"
                  onClick={isTimerPaused ? resumeTimer : pauseTimer}
                  disabled={!task || loading || timerSecondsLeft <= 0}
                >
                  {isTimerPaused ? 'Resume Timer' : 'Pause Timer'}
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 disabled:opacity-50"
                  onClick={saveDraftNow}
                  disabled={!canSaveDraft}
                >
                  Save Draft
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                  onClick={() => void submitResponse()}
                  disabled={!canSubmit}
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
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">{task.title?.trim() || taskDisplayFallback.title}</h2>
              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{task.prompt?.trim() || taskDisplayFallback.prompt}</p>
              {task.track === 'academic' && task.taskType === 'task1' && task1GraphPoints.length > 0 ? (
                <article className="rounded-xl border border-violet-200 dark:border-violet-500/30 bg-violet-50 dark:bg-violet-500/10 p-3 space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-700 dark:text-violet-300">
                    Visual Data Snapshot
                  </p>
                  <svg viewBox="0 0 300 130" className="w-full h-[130px] rounded-lg bg-white/80 dark:bg-gray-900/70 border border-violet-100 dark:border-violet-500/20">
                    <line x1="22" y1="106" x2="286" y2="106" stroke="currentColor" className="text-violet-200/80 dark:text-violet-400/40" />
                    <line x1="22" y1="22" x2="22" y2="106" stroke="currentColor" className="text-violet-200/80 dark:text-violet-400/40" />
                    {[0, 1, 2, 3].map(level => (
                      <line
                        key={level}
                        x1="22"
                        x2="286"
                        y1={26 + level * 20}
                        y2={26 + level * 20}
                        stroke="currentColor"
                        className="text-violet-100/90 dark:text-violet-500/15"
                      />
                    ))}
                    <polyline
                      fill="none"
                      strokeWidth="2.5"
                      className="text-violet-600 dark:text-violet-300"
                      stroke="currentColor"
                      points={task1GraphPoints
                        .map((point, index) => `${30 + index * (245 / Math.max(1, task1GraphPoints.length - 1))},${106 - point.seriesA * 0.82}`)
                        .join(' ')}
                    />
                    <polyline
                      fill="none"
                      strokeWidth="2.5"
                      className="text-blue-500 dark:text-blue-300"
                      stroke="currentColor"
                      points={task1GraphPoints
                        .map((point, index) => `${30 + index * (245 / Math.max(1, task1GraphPoints.length - 1))},${106 - point.seriesB * 0.82}`)
                        .join(' ')}
                    />
                    <polyline
                      fill="none"
                      strokeWidth="2.5"
                      className="text-emerald-500 dark:text-emerald-300"
                      stroke="currentColor"
                      points={task1GraphPoints
                        .map((point, index) => `${30 + index * (245 / Math.max(1, task1GraphPoints.length - 1))},${106 - point.seriesC * 0.82}`)
                        .join(' ')}
                    />
                    {task1GraphPoints.map((point, index) => {
                      const x = 30 + index * (245 / Math.max(1, task1GraphPoints.length - 1));
                      return (
                        <g key={point.label}>
                          <text x={x} y="122" textAnchor="middle" className="fill-violet-700 dark:fill-violet-300 text-[9px] font-semibold">
                            {point.label}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                  <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold">
                    <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 dark:bg-violet-500/20 px-2 py-0.5 text-violet-700 dark:text-violet-200">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-violet-600 dark:bg-violet-300" />
                      Series A
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 dark:bg-blue-500/20 px-2 py-0.5 text-blue-700 dark:text-blue-200">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500 dark:bg-blue-300" />
                      Series B
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-500/20 px-2 py-0.5 text-emerald-700 dark:text-emerald-200">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-300" />
                      Series C
                    </span>
                  </div>
                </article>
              ) : (
                <div className="grid grid-cols-3 gap-2 rounded-xl bg-gray-50 dark:bg-gray-800/60 p-3">
                  <div className="h-8 rounded-lg bg-gray-200 dark:bg-gray-700" />
                  <div className="h-8 rounded-lg bg-gray-200 dark:bg-gray-700" />
                  <div className="h-8 rounded-lg bg-gray-200 dark:bg-gray-700" />
                </div>
              )}
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
                  <span className="text-xs text-gray-400">{isTimerPaused ? 'Paused' : isAutosaved ? 'Saved locally' : 'Editing...'}</span>
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
                    className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                    onClick={isTimerPaused ? resumeTimer : pauseTimer}
                    disabled={!task || loading || timerSecondsLeft <= 0}
                  >
                    {isTimerPaused ? 'Resume Timer' : 'Pause Timer'}
                  </button>
                  <button
                    className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                    onClick={saveDraftNow}
                    disabled={!canSaveDraft}
                  >
                    Save Draft
                  </button>
                  <button
                    className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2 text-sm font-semibold text-white hover:bg-violet-700 transition-colors disabled:opacity-50"
                    onClick={() => void submitResponse()}
                    disabled={!canSubmit}
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
                  <p className="text-4xl font-extrabold text-gray-900 dark:text-white">{Number(selectedSubmission.overallBand || 0).toFixed(1)}</p>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center">Submission #{selectedSubmissionId ? selectedSubmissionId.slice(-6) : 'n/a'}</p>
                <p className="text-sm text-gray-600 dark:text-gray-300">{selectedFeedback.summary}</p>
                {deepFeedbackUiEnabled ? (
                  <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40 px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Deep feedback</p>
                    <p className={`mt-1 text-xs font-semibold ${selectedDeepFeedbackReady ? 'text-emerald-600 dark:text-emerald-300' : 'text-amber-600 dark:text-amber-300'}`}>
                      {selectedDeepFeedbackReady
                        ? 'Ready: full tutor-grade criterion analysis is available in Full Eval.'
                        : 'Preparing: detailed criterion analysis is still being enriched.'}
                    </p>
                  </div>
                ) : null}
                <ul className="space-y-2">
                  <li className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">{selectedTaskMetricLabel}</span>
                    <strong className="text-gray-900 dark:text-white">{Number(selectedBreakdown.taskResponse || 0).toFixed(1)}</strong>
                  </li>
                  <li className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Coherence</span>
                    <strong className="text-gray-900 dark:text-white">{Number(selectedBreakdown.coherenceCohesion || 0).toFixed(1)}</strong>
                  </li>
                  <li className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Lexical</span>
                    <strong className="text-gray-900 dark:text-white">{Number(selectedBreakdown.lexicalResource || 0).toFixed(1)}</strong>
                  </li>
                  <li className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Grammar</span>
                    <strong className="text-gray-900 dark:text-white">{Number(selectedBreakdown.grammaticalRangeAccuracy || 0).toFixed(1)}</strong>
                  </li>
                </ul>
                {deepFeedbackUiEnabled ? (
                  <article className="rounded-xl border border-violet-200 dark:border-violet-500/30 bg-violet-50 dark:bg-violet-500/10 p-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-violet-700 dark:text-violet-300">Top 3 priority actions</h4>
                    <ul className="mt-2 space-y-1.5">
                      {selectedPriorityActions.length > 0 ? (
                        selectedPriorityActions.map(item => (
                          <li key={item} className="text-xs text-violet-800 dark:text-violet-200 leading-relaxed">
                            • {item}
                          </li>
                        ))
                      ) : (
                        <li className="text-xs text-violet-800 dark:text-violet-200 leading-relaxed">
                          • Submit your next draft to unlock targeted priorities.
                        </li>
                      )}
                    </ul>
                  </article>
                ) : null}
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
                    onClick={() => {
                      if (selectedSubmissionId) void openSubmission(selectedSubmissionId);
                    }}
                  >
                    Refresh
                  </button>
                  <Link
                    className="flex-1 rounded-xl bg-violet-600 px-3 py-2 text-sm font-semibold text-white text-center hover:bg-violet-700 transition-colors"
                    href={selectedSubmissionId ? `/app/writing/history/${selectedSubmissionId}` : '/app/writing'}
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
          <table className="w-full min-w-[860px]">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Submission</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Track</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Task</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Band</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Created</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {history.map(item => (
                <tr key={item._id || `${item.createdAt || ''}-${item.overallBand || 0}`} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <td className="px-5 py-3.5 text-sm font-mono text-gray-600 dark:text-gray-400">{typeof item._id === 'string' ? `${item._id.slice(0, 8)}…` : 'n/a'}</td>
                  <td className="px-5 py-3.5 text-sm text-gray-700 dark:text-gray-300">{item.track || '-'}</td>
                  <td className="px-5 py-3.5 text-sm text-gray-700 dark:text-gray-300">{item.taskType === 'task1' ? 'Task 1' : item.taskType === 'task2' ? 'Task 2' : '-'}</td>
                  <td className="px-5 py-3.5 text-sm font-bold text-gray-900 dark:text-white">{Number(item.overallBand || 0).toFixed(1)}</td>
                  <td className="px-5 py-3.5 text-sm text-gray-500 dark:text-gray-400">{item.createdAt ? new Date(item.createdAt).toLocaleString() : '-'}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <button className="text-sm font-semibold text-violet-600 dark:text-violet-400 hover:underline disabled:opacity-50" onClick={() => {
                        if (typeof item._id === 'string') void openSubmission(item._id);
                      }} disabled={loadingSubmissionId === item._id}>{loadingSubmissionId === item._id ? 'Opening…' : 'Open'}</button>
                      <Link href={typeof item._id === 'string' ? `/app/writing/history/${item._id}` : '/app/writing'} className="text-sm font-semibold text-violet-600 dark:text-violet-400 hover:underline">Detail</Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        title="Saved Draft Snapshots (Local Browser)"
        subtitle="Manual Save Draft creates snapshots you can reopen on this device."
        actions={<span className="text-xs text-gray-500 dark:text-gray-400">{draftSnapshots.length} saved</span>}
      >
        {draftSnapshots.length > 0 ? (
          <div className="space-y-3">
            {draftSnapshots.map(snapshot => (
              <article
                key={snapshot.id}
                className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/60 px-4 py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{snapshot.task.title || 'Saved Draft'}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {snapshot.task.track} · {snapshot.task.taskType === 'task1' ? 'Task 1' : 'Task 2'} · {new Date(snapshot.savedAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-800"
                      onClick={() => openDraftSnapshot(snapshot)}
                    >
                      Open Draft
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-red-200 dark:border-red-500/30 px-3 py-1.5 text-xs font-semibold text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-500/10"
                      onClick={() => removeDraftSnapshot(snapshot.id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No saved snapshots yet. Use Save Draft to keep recoverable versions of your essay.
          </p>
        )}
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
