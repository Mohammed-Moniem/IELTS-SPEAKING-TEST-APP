'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import ReadingEngine from '@/components/reading/ReadingEngine';
import { ModalConfirm, SessionStatusStrip, PageHeader, SectionCard, StatusBadge } from '@/components/ui/v2';
import { apiRequest, ApiError, handleUsageLimitRedirect, webApi } from '@/lib/api/client';
import {
  ExamRuntimeState,
  FullExamSession,
  IELTSModule,
  ObjectiveQuestion,
  ObjectiveTestPayload,
  SimulationStartPayload,
  WritingTask
} from '@/lib/types';

type ObjectiveStartResponse = {
  attemptId: string;
  test: ObjectiveTestPayload;
};

type AnswerValue = string | string[] | Record<string, string>;

const examStorageKey = 'spokio.web.full-exam.resume';

const moduleOrder: IELTSModule[] = ['speaking', 'writing', 'reading', 'listening'];

const formatCountdown = (seconds?: number) => {
  if (typeof seconds !== 'number' || Number.isNaN(seconds)) return '--:--';
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
};

const isAnswered = (value: AnswerValue | undefined) => {
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === 'object') return Object.keys(value).length > 0;
  return false;
};

const moduleMeta: Record<IELTSModule, { title: string; duration: string; description: string; chips: string[]; icon: string }> = {
  speaking: {
    title: 'Speaking',
    duration: '11-14 mins',
    description: 'Face-to-face interview simulation with AI examiner.',
    chips: ['3 Parts', 'Live Recording'],
    icon: 'mic'
  },
  writing: {
    title: 'Writing',
    duration: '60 mins',
    description: 'Task 1 (Graph/Chart) and Task 2 (Essay).',
    chips: ['2 Tasks', '150+ & 250+ Words'],
    icon: 'edit_note'
  },
  reading: {
    title: 'Reading',
    duration: '60 mins',
    description: '3 sections with objective question patterns.',
    chips: ['40 Questions', '3 Sections'],
    icon: 'article'
  },
  listening: {
    title: 'Listening',
    duration: '30 mins',
    description: '4 recorded monologues and conversations.',
    chips: ['40 Questions', '4 Parts'],
    icon: 'headphones'
  }
};

const getNextModule = (exam: FullExamSession | null): IELTSModule | null => {
  if (!exam) return null;
  const next = moduleOrder.find(module => exam.sections.find(section => section.module === module)?.status !== 'completed');
  return next || null;
};

export default function TestsPage() {
  const [track, setTrack] = useState<'academic' | 'general'>('academic');
  const [exam, setExam] = useState<FullExamSession | null>(null);
  const [activeModule, setActiveModule] = useState<IELTSModule | null>(null);
  const [runtimeState, setRuntimeState] = useState<ExamRuntimeState | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [speaking, setSpeaking] = useState<{
    simulation: SimulationStartPayload | null;
    responses: Record<number, string>;
  }>({ simulation: null, responses: {} });

  const [writing, setWriting] = useState<{
    task: WritingTask | null;
    response: string;
  }>({ task: null, response: '' });

  const [reading, setReading] = useState<{
    attemptId: string;
    test: ObjectiveTestPayload | null;
    answers: Record<string, AnswerValue>;
  }>({ attemptId: '', test: null, answers: {} });

  const [listening, setListening] = useState<{
    attemptId: string;
    test: ObjectiveTestPayload | null;
    answers: Record<string, string>;
  }>({ attemptId: '', test: null, answers: {} });
  const [listeningActiveQuestionIndex, setListeningActiveQuestionIndex] = useState(0);
  const [listeningFlaggedQuestionIds, setListeningFlaggedQuestionIds] = useState<string[]>([]);
  const [showSubmitReviewModal, setShowSubmitReviewModal] = useState(false);

  const timeline = useMemo(() => {
    if (!exam) return [];
    return moduleOrder.map(module => exam.sections.find(section => section.module === module));
  }, [exam]);

  const writingWordCount = useMemo(
    () => writing.response.trim().split(/\s+/).filter(Boolean).length,
    [writing.response]
  );
  const writingMinimumWords = writing.task?.minimumWords || 0;

  const readingQuestions = reading.test
    ? (reading.test.sections?.length
      ? reading.test.sections.flatMap(section =>
        section.questions.map(question => ({
          ...question,
          sectionId: question.sectionId || section.sectionId
        }))
      )
      : reading.test.questions)
    : [];
  const readingQuestionCountResolved = readingQuestions.length;
  const readingQuestionCount = readingQuestionCountResolved;
  const readingAnsweredCount = readingQuestions.reduce(
    (count, question) => (isAnswered(reading.answers[question.questionId]) ? count + 1 : count),
    0
  );
  const readingUnsolvedCount = Math.max(0, readingQuestionCountResolved - readingAnsweredCount);

  const listeningQuestionCount = listening.test?.questions.length || 0;
  const listeningAnsweredCount = listening.test
    ? listening.test.questions.reduce((count, question) => (listening.answers[question.questionId] ? count + 1 : count), 0)
    : 0;
  const listeningUnsolvedCount = Math.max(0, listeningQuestionCount - listeningAnsweredCount);
  const listeningCurrentQuestionId = listening.test?.questions[listeningActiveQuestionIndex]?.questionId;

  const speakingPartCount = speaking.simulation?.parts.length || 0;
  const speakingAnsweredCount = speaking.simulation
    ? speaking.simulation.parts.reduce(
      (count, part) => (speaking.responses[part.part]?.trim() ? count + 1 : count),
      0
    )
    : 0;

  const persistExamResume = (nextExam: FullExamSession | null, nextActiveModule: IELTSModule | null) => {
    if (!nextExam) {
      window.localStorage.removeItem(examStorageKey);
      return;
    }

    window.localStorage.setItem(
      examStorageKey,
      JSON.stringify({
        examId: nextExam._id,
        activeModule: nextActiveModule
      })
    );
  };

  const updateExamState = (nextExam: FullExamSession) => {
    const nextModule = runtimeState?.currentModule || getNextModule(nextExam);
    setExam(nextExam);
    setActiveModule(nextModule);
    persistExamResume(nextExam, nextModule);
  };

  const syncRuntime = (runtime: ExamRuntimeState | null, currentExam: FullExamSession | null = exam) => {
    setRuntimeState(runtime);
    const nextModule = runtime?.currentModule || getNextModule(currentExam);
    setActiveModule(nextModule);
    persistExamResume(currentExam, nextModule);
  };

  const loadRuntime = async (examId: string) => {
    try {
      const runtime = await webApi.getExamRuntime(examId);
      syncRuntime(runtime, exam);
      return runtime;
    } catch {
      return null;
    }
  };

  const startExam = async () => {
    setError('');
    setLoading(true);
    try {
      const started = await apiRequest<FullExamSession>('/exams/full/start', {
        method: 'POST',
        body: JSON.stringify({ track })
      });
      setExam(started);
      const runtime = await loadRuntime(started._id);
      const nextModule = runtime?.currentModule || getNextModule(started);
      setActiveModule(nextModule);
      persistExamResume(started, nextModule);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to start full exam');
    } finally {
      setLoading(false);
    }
  };

  const refreshResults = async (examId?: string) => {
    if (!examId && !exam?._id) return;
    const targetExamId = examId || exam!._id;
    setError('');
    setLoading(true);
    try {
      const result = await apiRequest<FullExamSession>(`/exams/full/${targetExamId}/results`);
      setExam(result);
      const runtime = await loadRuntime(targetExamId);
      const nextModule = runtime?.currentModule || getNextModule(result);
      setActiveModule(nextModule);
      persistExamResume(result, nextModule);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load exam results');
    } finally {
      setLoading(false);
    }
  };

  const submitSection = async (module: IELTSModule, attemptId: string, score?: number) => {
    if (!exam) return;

    const updated = await apiRequest<FullExamSession>(`/exams/full/${exam._id}/section/${module}/submit`, {
      method: 'POST',
      body: JSON.stringify({
        module,
        attemptId,
        score
      })
    });

    setExam(updated);
    const runtime = await loadRuntime(updated._id);
    const nextModule = runtime?.currentModule || getNextModule(updated);
    setActiveModule(nextModule);
    persistExamResume(updated, nextModule);
  };

  const completeExam = async () => {
    if (!exam) return;
    setError('');
    setLoading(true);
    try {
      const completed = await apiRequest<FullExamSession>(`/exams/full/${exam._id}/complete`, {
        method: 'POST',
        body: JSON.stringify({})
      });
      setRuntimeState(null);
      updateExamState(completed);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to complete exam');
    } finally {
      setLoading(false);
    }
  };

  const pauseExam = async () => {
    if (!exam || !activeModule) return;
    setError('');
    setLoading(true);
    try {
      const paused = await webApi.pauseExam(exam._id, {
        currentModule: activeModule,
        currentQuestionIndex: 0
      });
      const nextExam = paused as FullExamSession;
      setExam(nextExam);
      const runtime = await loadRuntime(nextExam._id);
      const nextModule = runtime?.currentModule || getNextModule(nextExam);
      setActiveModule(nextModule);
      persistExamResume(nextExam, nextModule);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to pause exam');
    } finally {
      setLoading(false);
    }
  };

  const resumeExam = async () => {
    if (!exam) return;
    setError('');
    setLoading(true);
    try {
      const resumed = await webApi.resumeExam(exam._id, {
        currentModule: runtimeState?.currentModule || activeModule || undefined,
        currentQuestionIndex: runtimeState?.currentQuestionIndex,
        resumeToken: runtimeState?.resumeToken
      });
      const nextExam = resumed as FullExamSession;
      setExam(nextExam);
      const runtime = await loadRuntime(nextExam._id);
      const nextModule = runtime?.currentModule || getNextModule(nextExam);
      setActiveModule(nextModule);
      persistExamResume(nextExam, nextModule);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to resume exam');
    } finally {
      setLoading(false);
    }
  };

  const discardRecovery = () => {
    setExam(null);
    setRuntimeState(null);
    setActiveModule(null);
    window.localStorage.removeItem(examStorageKey);
  };

  const startSpeakingSection = async () => {
    setError('');
    setLoading(true);
    try {
      const simulation = await apiRequest<SimulationStartPayload>('/test-simulations', {
        method: 'POST',
        body: JSON.stringify({})
      });
      setSpeaking({ simulation, responses: {} });
    } catch (err) {
      if (handleUsageLimitRedirect(err)) return;
      setError(err instanceof ApiError ? err.message : 'Failed to start speaking section');
    } finally {
      setLoading(false);
    }
  };

  const submitSpeakingSection = async () => {
    if (!speaking.simulation) return;

    setError('');
    setLoading(true);
    try {
      const parts = speaking.simulation.parts.map(part => ({
        part: part.part,
        question: part.question,
        response: speaking.responses[part.part] || '',
        timeSpent: 0
      }));

      const result = await apiRequest<{ simulationId?: string; _id?: string; overallBand?: number }>(
        `/test-simulations/${speaking.simulation.simulationId}/complete`,
        {
          method: 'POST',
          body: JSON.stringify({ parts })
        }
      );

      await submitSection('speaking', speaking.simulation.simulationId, result.overallBand);
    } catch (err) {
      if (handleUsageLimitRedirect(err)) return;
      setError(err instanceof ApiError ? err.message : 'Failed to submit speaking section');
    } finally {
      setLoading(false);
    }
  };

  const startWritingSection = async () => {
    setError('');
    setLoading(true);
    try {
      const task = await apiRequest<WritingTask>('/writing/tasks/generate', {
        method: 'POST',
        body: JSON.stringify({ track, taskType: 'task2' })
      });
      setWriting({ task, response: '' });
    } catch (err) {
      if (handleUsageLimitRedirect(err)) return;
      setError(err instanceof ApiError ? err.message : 'Failed to start writing section');
    } finally {
      setLoading(false);
    }
  };

  const submitWritingSection = async () => {
    if (!writing.task) return;

    setError('');
    setLoading(true);
    try {
      const submission = await apiRequest<{ _id: string; overallBand: number }>('/writing/submissions', {
        method: 'POST',
        body: JSON.stringify({
          taskId: writing.task.taskId,
          responseText: writing.response,
          durationSeconds: 0
        })
      });

      await submitSection('writing', submission._id, submission.overallBand);
    } catch (err) {
      if (handleUsageLimitRedirect(err)) return;
      setError(err instanceof ApiError ? err.message : 'Failed to submit writing section');
    } finally {
      setLoading(false);
    }
  };

  const startReadingSection = async () => {
    setError('');
    setLoading(true);
    try {
      const started = await apiRequest<ObjectiveStartResponse>('/reading/tests/start', {
        method: 'POST',
        body: JSON.stringify({ track })
      });
      setReading({ attemptId: started.attemptId, test: started.test, answers: {} });
    } catch (err) {
      if (handleUsageLimitRedirect(err)) return;
      setError(err instanceof ApiError ? err.message : 'Failed to start reading section');
    } finally {
      setLoading(false);
    }
  };

  const submitReadingSection = async () => {
    if (!reading.attemptId || !reading.test) return;

    setError('');
    setLoading(true);
    try {
      const questions = readingQuestions;
      const submission = await apiRequest<{ normalizedBand?: number }>(`/reading/tests/${reading.attemptId}/submit`, {
        method: 'POST',
        body: JSON.stringify({
          answers: questions.map(question => ({
            questionId: question.questionId,
            sectionId: question.sectionId,
            answer: reading.answers[question.questionId] || ''
          })),
          durationSeconds: 0
        })
      });

      await submitSection('reading', reading.attemptId, submission.normalizedBand);
    } catch (err) {
      if (handleUsageLimitRedirect(err)) return;
      setError(err instanceof ApiError ? err.message : 'Failed to submit reading section');
    } finally {
      setLoading(false);
    }
  };

  const startListeningSection = async () => {
    setError('');
    setLoading(true);
    try {
      const started = await apiRequest<ObjectiveStartResponse>('/listening/tests/start', {
        method: 'POST',
        body: JSON.stringify({ track })
      });
      setListening({ attemptId: started.attemptId, test: started.test, answers: {} });
      setListeningActiveQuestionIndex(0);
      setListeningFlaggedQuestionIds([]);
    } catch (err) {
      if (handleUsageLimitRedirect(err)) return;
      setError(err instanceof ApiError ? err.message : 'Failed to start listening section');
    } finally {
      setLoading(false);
    }
  };

  const submitListeningSection = async () => {
    if (!listening.attemptId || !listening.test) return;

    setError('');
    setLoading(true);
    try {
      const submission = await apiRequest<{ normalizedBand?: number }>(`/listening/tests/${listening.attemptId}/submit`, {
        method: 'POST',
        body: JSON.stringify({
          answers: listening.test.questions.map(question => ({
            questionId: question.questionId,
            answer: listening.answers[question.questionId] || ''
          })),
          durationSeconds: 0
        })
      });

      await submitSection('listening', listening.attemptId, submission.normalizedBand);
    } catch (err) {
      if (handleUsageLimitRedirect(err)) return;
      setError(err instanceof ApiError ? err.message : 'Failed to submit listening section');
    } finally {
      setLoading(false);
    }
  };

  const renderObjectiveQuestionInput = (
    question: ObjectiveQuestion,
    value: string,
    onChange: (value: string) => void
  ) => {
    if (question.options && question.options.length > 0) {
      return (
        <select className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40" value={value} onChange={event => onChange(event.target.value)}>
          <option value="">Select</option>
          {question.options.map((option: string) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    }

    return <input className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500/40" value={value} onChange={event => onChange(event.target.value)} placeholder="Answer" />;
  };

  const goToNextQuestion = useCallback(() => {
    if (activeModule === 'listening' && listeningQuestionCount > 0) {
      setListeningActiveQuestionIndex(prev => Math.min(listeningQuestionCount - 1, prev + 1));
    }
  }, [activeModule, listeningQuestionCount]);

  const goToPreviousQuestion = useCallback(() => {
    if (activeModule === 'listening' && listeningQuestionCount > 0) {
      setListeningActiveQuestionIndex(prev => Math.max(0, prev - 1));
    }
  }, [activeModule, listeningQuestionCount]);

  const toggleCurrentQuestionFlag = useCallback(() => {
    if (activeModule === 'listening' && listeningCurrentQuestionId) {
      setListeningFlaggedQuestionIds(prev =>
        prev.includes(listeningCurrentQuestionId)
          ? prev.filter(id => id !== listeningCurrentQuestionId)
          : [...prev, listeningCurrentQuestionId]
      );
    }
  }, [activeModule, listeningCurrentQuestionId]);

  const triggerSubmitReview = useCallback(() => {
    const canReview = activeModule === 'listening' && !!listening.test;

    if (canReview) {
      setShowSubmitReviewModal(true);
    }
  }, [activeModule, listening.test]);

  const confirmSubmitReview = async () => {
    setShowSubmitReviewModal(false);
    if (activeModule === 'listening') {
      await submitListeningSection();
    }
  };

  useEffect(() => {
    if (!listening.test) return;
    if (listeningActiveQuestionIndex < listening.test.questions.length) return;
    setListeningActiveQuestionIndex(Math.max(0, listening.test.questions.length - 1));
  }, [listening.test, listeningActiveQuestionIndex]);

  useEffect(() => {
    const hasQuestionFlow = activeModule === 'listening' && !!listening.test;
    if (!hasQuestionFlow) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      const key = event.key.toLowerCase();

      if (key === 'arrowright' || key === 'n') {
        event.preventDefault();
        goToNextQuestion();
        return;
      }

      if (key === 'arrowleft' || key === 'p') {
        event.preventDefault();
        goToPreviousQuestion();
        return;
      }

      if (key === 'f') {
        event.preventDefault();
        toggleCurrentQuestionFlag();
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault();
        triggerSubmitReview();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [activeModule, listening.test, goToNextQuestion, goToPreviousQuestion, toggleCurrentQuestionFlag, triggerSubmitReview]);

  // Resume hydration intentionally runs once on mount; it restores the last saved exam context.
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    const raw = window.localStorage.getItem(examStorageKey);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as { examId?: string; activeModule?: IELTSModule };
      if (parsed.examId) {
        setActiveModule(parsed.activeModule || null);
        void refreshResults(parsed.examId);
      }
    } catch {
      // Ignore malformed resume payloads.
    }
  }, []);
  /* eslint-enable react-hooks/exhaustive-deps */

  return (
    <div className="space-y-8 max-w-[1440px] mx-auto w-full">
      {/* ── Page header ── */}
      <PageHeader
        kicker="Simulation"
        title="Full Exam Simulation"
        subtitle="Guided section orchestration with resume support and no manual IDs."
        actions={
          <div className="flex flex-wrap items-center gap-4">
            <StatusBadge tone="neutral">Total duration 2h 45m</StatusBadge>
            <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white p-1 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <span className="pl-3 text-xs font-semibold text-gray-500 uppercase tracking-widest hidden sm:inline-block">Track:</span>
              <select className="rounded-lg bg-transparent px-3 py-1.5 text-sm font-semibold text-gray-900 focus:outline-none dark:text-white" value={track} onChange={event => setTrack(event.target.value as 'academic' | 'general')}>
                <option value="academic">Academic</option>
                <option value="general">General</option>
              </select>
            </div>
            <button className="group relative inline-flex items-center gap-2 overflow-hidden rounded-2xl bg-violet-600 px-6 py-3 text-sm font-bold text-white shadow-xl shadow-violet-500/25 transition-all hover:bg-violet-700 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0" onClick={() => void startExam()} disabled={loading}>
              <span className="material-symbols-outlined text-[20px] transition-transform group-hover:scale-110">quiz</span>
              {loading ? 'Starting...' : 'Start Full Exam'}
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 items-start">
        <SectionCard
          title="Exam Sequence"
          actions={<span className="rounded-full bg-violet-100 dark:bg-violet-500/20 px-3 py-1 text-xs font-bold text-violet-700 dark:text-violet-300 uppercase tracking-widest">{track} module</span>}
        >
          <div className="space-y-4">
            {moduleOrder.map(module => {
              const section = timeline.find(item => item?.module === module);
              const meta = moduleMeta[module];
              const isComplete = section?.status === 'completed';
              return (
                <article key={module} className={`group relative flex items-start gap-5 rounded-3xl border p-5 transition-all duration-300 ${isComplete ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-500/30 dark:bg-emerald-500/10' : 'border-gray-200/80 bg-white shadow-sm hover:border-violet-200 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700'}`}>
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-inner transition-colors duration-300 ${isComplete ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-gray-100 text-gray-400 group-hover:bg-violet-100 group-hover:text-violet-600 dark:bg-gray-800 dark:text-gray-500 dark:group-hover:bg-violet-500/20 dark:group-hover:text-violet-400'}`}>
                    <span className="material-symbols-outlined text-[24px]">{meta.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className={`text-base font-bold transition-colors ${isComplete ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300 group-hover:text-violet-700 dark:group-hover:text-violet-300'}`}>{meta.title}</h4>
                      <span className="text-xs font-semibold text-gray-400 dark:text-gray-500">{meta.duration}</span>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{meta.description}</p>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {meta.chips.map(chip => (
                        <span key={chip} className="rounded-md bg-gray-100 dark:bg-gray-800 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{chip}</span>
                      ))}
                    </div>
                    {section ? (
                      <div className="pt-2 flex items-center gap-3 text-xs font-medium">
                        <span className="flex items-center gap-1.5"><StatusBadge tone={isComplete ? 'success' : 'warning'}>{section.status}</StatusBadge></span>
                        <span className="text-gray-400">Attempt: #{section.attemptId?.slice(-6) || 'not started'}</span>
                      </div>
                    ) : null}
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Score</span>
                    <span className={`text-xl font-black ${section?.score != null ? (isComplete ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-900 dark:text-white') : 'text-gray-300 dark:text-gray-600'}`}>
                      {section?.score != null ? section.score.toFixed(1) : '--'}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        </SectionCard>

        <aside className="space-y-6">
          {exam && runtimeState?.interruptedAt ? (
            <article className="relative overflow-hidden rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm dark:border-amber-500/30 dark:bg-amber-500/10">
              <div className="absolute top-0 right-0 h-32 w-32 -translate-y-8 translate-x-8 rounded-full bg-amber-400/20 blur-2xl" />
              <div className="relative z-10 space-y-4">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-200/50 px-3 py-1 text-xs font-bold uppercase tracking-widest text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
                  <span className="flex h-1.5 w-1.5 rounded-full bg-amber-600 animate-pulse"></span>
                  Interrupted
                </span>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Resume exam #{exam._id.slice(-6)}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-amber-800/80 dark:text-amber-200/70">Continue from <strong className="text-amber-900 dark:text-amber-100">{runtimeState.currentModule || activeModule || 'current section'}</strong>.</p>
                </div>
                <div className="flex flex-col gap-2 pt-2">
                  <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 text-sm font-bold text-white shadow-md shadow-amber-500/20 transition-all hover:bg-amber-600 disabled:opacity-50" onClick={() => void resumeExam()} disabled={loading}>
                    Resume Timer
                    <span className="material-symbols-outlined text-[18px]">play_arrow</span>
                  </button>
                  <button className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-amber-200/50 bg-white/50 px-4 py-3 text-sm font-bold text-amber-800 transition-all hover:bg-white dark:border-amber-500/20 dark:bg-amber-900/20 dark:text-amber-300 dark:hover:bg-amber-900/40 disabled:opacity-50" onClick={discardRecovery} disabled={loading}>Discard Session</button>
                </div>
              </div>
            </article>
          ) : (
            <article className="relative overflow-hidden rounded-3xl border border-gray-200 bg-white p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] dark:border-gray-800 dark:bg-gray-900">
              <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-violet-500/10 blur-xl" />
              <div className="relative z-10 space-y-4">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400">
                  <span className="material-symbols-outlined text-[24px]">flag</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Start New Full Exam</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-gray-500 dark:text-gray-400">Begin a complete simulation across all four modules. Ensure you have ~2h 45m available.</p>
                </div>
                <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-3 text-sm font-bold text-white shadow-lg transition-all hover:bg-black hover:shadow-xl dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 disabled:opacity-50" onClick={() => void startExam()} disabled={loading}>
                  Launch Simulation
                  <span className="material-symbols-outlined text-[18px]">rocket_launch</span>
                </button>
              </div>
            </article>
          )}

          <article className="rounded-3xl border border-gray-100 bg-gray-50/50 p-6 dark:border-gray-800/50 dark:bg-gray-800/20">
            <h4 className="mb-4 text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Before You Start</h4>
            <ul className="space-y-3">
              {['Stable internet is required for uninterrupted timing.', 'Use headphones for listening sections.', 'Use pause/resume only when required. Avoid doing it mid-audio.'].map(tip => (
                <li key={tip} className="flex items-start gap-3 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                  <span className="material-symbols-outlined shrink-0 text-[18px] text-violet-500 mt-0.5">info</span>
                  {tip}
                </li>
              ))}
            </ul>
          </article>
        </aside>
      </div>

      {exam ? (
        <div className="space-y-6 pt-4 border-t border-gray-100 dark:border-gray-800/80">
          <SectionCard
            title="Runtime Controls"
            actions={
              <div className="flex gap-2">
                <button className="flex items-center gap-1.5 rounded-xl border-2 border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 transition-all hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 disabled:opacity-50" onClick={() => void refreshResults()} disabled={loading}>
                  <span className="material-symbols-outlined text-[16px]">refresh</span> Refresh
                </button>
                <button className="flex items-center gap-1.5 rounded-xl border-2 border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 transition-all hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 disabled:opacity-50" onClick={() => void pauseExam()} disabled={loading || !activeModule}>
                  <span className="material-symbols-outlined text-[16px]">pause</span> Pause
                </button>
                <button className="flex items-center gap-1.5 rounded-xl border-2 border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 transition-all hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 disabled:opacity-50" onClick={() => void resumeExam()} disabled={loading || !runtimeState?.interruptedAt}>
                  <span className="material-symbols-outlined text-[16px]">play_arrow</span> Resume
                </button>
              </div>
            }
          >
            <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 p-3 rounded-xl border border-gray-100 dark:border-gray-800">
              <span>Ref: {exam._id.slice(-8)}</span>
              <span>•</span>
              <span className="text-violet-600 dark:text-violet-400 uppercase tracking-widest">{exam.status}</span>
              <span>•</span>
              <span className="uppercase">{activeModule || 'idle'}</span>
              <span>•</span>
              <span>Index: {runtimeState?.currentQuestionIndex ?? 0}</span>
            </div>
          </SectionCard>

          {activeModule ? (
            <SessionStatusStrip
              timerLabel={`Timer ${formatCountdown(runtimeState?.remainingSecondsByModule?.[activeModule])}`}
              completionLabel={
                activeModule === 'speaking'
                  ? `${speakingAnsweredCount}/${Math.max(1, speakingPartCount)} parts completed`
                  : activeModule === 'writing'
                    ? `${writingMinimumWords ? Math.min(100, Math.round((writingWordCount / writingMinimumWords) * 100)) : 0}% draft target`
                    : activeModule === 'reading'
                      ? `${readingQuestionCount ? Math.round((readingAnsweredCount / readingQuestionCount) * 100) : 0}% complete`
                      : `${listeningQuestionCount ? Math.round((listeningAnsweredCount / listeningQuestionCount) * 100) : 0}% complete`
              }
              unsolvedLabel={
                activeModule === 'speaking'
                  ? `${Math.max(0, speakingPartCount - speakingAnsweredCount)} parts pending`
                  : activeModule === 'writing'
                    ? `${Math.max(0, writingMinimumWords - writingWordCount)} words remaining`
                    : activeModule === 'reading'
                      ? `${readingUnsolvedCount} unsolved`
                      : `${listeningUnsolvedCount} unsolved`
              }
              actions={
                activeModule === 'listening' ? (
                  <>
                    <button
                      type="button"
                      className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300"
                      onClick={goToPreviousQuestion}
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
                      className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300"
                      onClick={toggleCurrentQuestionFlag}
                    >
                      Flag
                    </button>
                    <button
                      type="button"
                      className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white"
                      onClick={triggerSubmitReview}
                    >
                      Review
                    </button>
                  </>
                ) : activeModule === 'reading' && reading.test ? (
                  <button
                    type="button"
                    className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                    onClick={() => void submitReadingSection()}
                    disabled={loading}
                  >
                    {loading ? 'Submitting...' : 'Submit'}
                  </button>
                ) : null
              }
            />
          ) : null}

          {activeModule === 'listening' ? (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Shortcuts: <strong>N</strong>/<strong>→</strong> next, <strong>P</strong>/<strong>←</strong> previous,{' '}
              <strong>F</strong> flag, <strong>Ctrl/Cmd + Enter</strong> submit review.
            </p>
          ) : null}

          {activeModule === 'speaking' ? (
            <SectionCard title="Speaking Section" className="border-t-4 border-t-violet-500 shadow-md">
              {!speaking.simulation ? (
                <div className="flex flex-col items-center justify-center space-y-4 rounded-2xl bg-gray-50/50 px-6 py-12 text-center dark:bg-gray-800/30 border border-gray-100 dark:border-gray-800">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400 shadow-inner">
                    <span className="material-symbols-outlined text-[32px]">record_voice_over</span>
                  </div>
                  <p className="max-w-md text-sm leading-relaxed text-gray-500 dark:text-gray-400">Launch full speaking simulation and complete all three parts before submitting.</p>
                  <button className="rounded-xl bg-violet-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-violet-500/25 transition-all hover:-translate-y-0.5 hover:bg-violet-700 disabled:opacity-50 disabled:hover:translate-y-0" onClick={() => void startSpeakingSection()} disabled={loading}>Start Speaking Simulation</button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="rounded-xl bg-violet-50/80 px-4 py-3 text-sm font-medium text-violet-800 dark:bg-violet-500/10 dark:text-violet-300 border border-violet-100 dark:border-violet-500/20 flex items-center gap-2 shadow-sm">
                    <span className="material-symbols-outlined text-[20px]">info</span>
                    Answer each part, then submit the section to lock your speaking score.
                  </div>
                  <div className="grid gap-6">
                    {speaking.simulation.parts.map(part => (
                      <label key={part.part} className="block space-y-3 rounded-2xl border border-gray-100 bg-gray-50/30 p-5 dark:border-gray-800/50 dark:bg-gray-800/10 transition-colors focus-within:border-violet-200 focus-within:bg-white dark:focus-within:border-violet-500/30 dark:focus-within:bg-gray-900 shadow-sm">
                        <span className="inline-block rounded-lg bg-gray-900 px-2.5 py-1 text-xs font-bold uppercase tracking-widest text-white dark:bg-white dark:text-gray-900 shadow-sm">Part {part.part}</span>
                        <p className="text-base font-semibold leading-relaxed text-gray-800 dark:text-gray-200">{part.question}</p>
                        <textarea
                          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 transition-all placeholder:text-gray-400 focus:border-violet-400 focus:outline-none focus:ring-4 focus:ring-violet-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:focus:border-violet-500 dark:focus:ring-violet-500/20 min-h-[120px] resize-y shadow-inner"
                          placeholder="Type or dictate your response..."
                          value={speaking.responses[part.part] || ''}
                          onChange={event =>
                            setSpeaking(prev => ({
                              ...prev,
                              responses: {
                                ...prev.responses,
                                [part.part]: event.target.value
                              }
                            }))
                          }
                        />
                      </label>
                    ))}
                  </div>
                  <div className="flex justify-end pt-4 border-t border-gray-100 dark:border-gray-800">
                    <button className="flex items-center gap-2 rounded-xl bg-violet-600 px-8 py-3 text-sm font-bold text-white shadow-xl shadow-violet-500/20 transition-all hover:-translate-y-0.5 hover:bg-violet-700 disabled:opacity-50 disabled:hover:translate-y-0" onClick={() => void submitSpeakingSection()} disabled={loading}>
                      <span className="material-symbols-outlined text-[20px]">check_circle</span>
                      Submit Speaking Section
                    </button>
                  </div>
                </div>
              )}
            </SectionCard>
          ) : null}

          {activeModule === 'writing' ? (
            <SectionCard title="Writing Section" className="border-t-4 border-t-amber-500 shadow-md">
              {!writing.task ? (
                <div className="flex flex-col items-center justify-center space-y-4 rounded-2xl bg-gray-50/50 px-6 py-12 text-center dark:bg-gray-800/30 border border-gray-100 dark:border-gray-800">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 shadow-inner">
                    <span className="material-symbols-outlined text-[32px]">edit_note</span>
                  </div>
                  <p className="max-w-md text-sm leading-relaxed text-gray-500 dark:text-gray-400">Generate a timed writing task and submit your final essay for scoring.</p>
                  <button className="rounded-xl bg-violet-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-violet-500/25 transition-all hover:-translate-y-0.5 hover:bg-violet-700 disabled:opacity-50 disabled:hover:translate-y-0" onClick={() => void startWritingSection()} disabled={loading}>Start Writing Task</button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="rounded-2xl bg-gray-50 p-5 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-amber-500" />
                    <span className="mb-2 inline-block rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-bold uppercase tracking-widest text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">Prompt</span>
                    <p className="text-base font-medium leading-relaxed text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{writing.task.prompt}</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center px-1 border-b border-gray-100 dark:border-gray-800 pb-2">
                      <span className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Your Essay</span>
                      <span className={`rounded-full px-3 py-1 text-[11px] font-bold tracking-widest uppercase transition-colors ${writingWordCount < writingMinimumWords ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300'}`}>
                        {writingWordCount} / {writingMinimumWords || 250} WORDS
                      </span>
                    </div>
                    <textarea
                      className="w-full rounded-2xl border border-gray-200 bg-white px-5 py-4 text-base leading-relaxed text-gray-900 transition-all placeholder:text-gray-400 focus:border-violet-400 focus:outline-none focus:ring-4 focus:ring-violet-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:focus:border-violet-500 dark:focus:ring-violet-500/20 min-h-[300px] resize-y shadow-inner"
                      placeholder="Begin typing your essay here..."
                      value={writing.response}
                      onChange={event => setWriting(prev => ({ ...prev, response: event.target.value }))}
                    />
                  </div>
                  <div className="flex justify-end pt-4 border-t border-gray-100 dark:border-gray-800">
                    <button className="flex items-center gap-2 rounded-xl bg-violet-600 px-8 py-3 text-sm font-bold text-white shadow-xl shadow-violet-500/20 transition-all hover:-translate-y-0.5 hover:bg-violet-700 disabled:opacity-50 disabled:hover:translate-y-0" onClick={() => void submitWritingSection()} disabled={loading}>
                      <span className="material-symbols-outlined text-[20px]">send</span> Submit Writing Section
                    </button>
                  </div>
                </div>
              )}
            </SectionCard>
          ) : null}

          {activeModule === 'reading' ? (
            <SectionCard title="Reading Section" className="border-t-4 border-t-blue-500 shadow-md">
              {!reading.test ? (
                <div className="flex flex-col items-center justify-center space-y-4 rounded-2xl bg-gray-50/50 px-6 py-12 text-center dark:bg-gray-800/30 border border-gray-100 dark:border-gray-800">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 shadow-inner">
                    <span className="material-symbols-outlined text-[32px]">menu_book</span>
                  </div>
                  <p className="max-w-md text-sm leading-relaxed text-gray-500 dark:text-gray-400">Start a full reading attempt with objective questions across multiple passages.</p>
                  <button className="rounded-xl bg-violet-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-violet-500/25 transition-all hover:-translate-y-0.5 hover:bg-violet-700 disabled:opacity-50 disabled:hover:translate-y-0" onClick={() => void startReadingSection()} disabled={loading}>Start Reading Section</button>
                </div>
              ) : (
                <ReadingEngine
                  compact
                  test={reading.test}
                  answers={reading.answers}
                  onChangeAnswers={next => setReading(prev => ({ ...prev, answers: next }))}
                  onSubmit={() => void submitReadingSection()}
                  submitting={loading}
                />
              )}
            </SectionCard>
          ) : null}

          {activeModule === 'listening' ? (
            <SectionCard title="Listening Section" className="border-t-4 border-t-emerald-500 shadow-md">
              {!listening.test ? (
                <div className="flex flex-col items-center justify-center space-y-4 rounded-2xl bg-gray-50/50 px-6 py-12 text-center dark:bg-gray-800/30 border border-gray-100 dark:border-gray-800">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 shadow-inner">
                    <span className="material-symbols-outlined text-[32px]">headphones</span>
                  </div>
                  <p className="max-w-md text-sm leading-relaxed text-gray-500 dark:text-gray-400">Start listening attempt and answer objective questions alongside the audio playback.</p>
                  <button className="rounded-xl bg-violet-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-violet-500/25 transition-all hover:-translate-y-0.5 hover:bg-violet-700 disabled:opacity-50 disabled:hover:translate-y-0" onClick={() => void startListeningSection()} disabled={loading}>Start Listening Section</button>
                </div>
              ) : (
                <div className="space-y-6">
                  {listening.test.audioUrl ? (
                    <div className="sticky top-4 z-20 rounded-2xl bg-emerald-50/90 p-4 shadow-sm backdrop-blur-md border border-emerald-100 dark:bg-emerald-900/30 dark:border-emerald-500/20 ring-1 ring-emerald-500/10">
                      <div className="mb-2 flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px] text-emerald-600 dark:text-emerald-400">volume_up</span>
                        <span className="text-xs font-bold uppercase tracking-widest text-emerald-800 dark:text-emerald-300">Listening Audio Playback</span>
                      </div>
                      <audio controls src={listening.test.audioUrl} className="w-full rounded-xl" />
                    </div>
                  ) : null}
                  <div className="space-y-3">
                    {listening.test.questions.map((question, index) => {
                      const isActive = index === listeningActiveQuestionIndex;
                      const isFlagged = listeningFlaggedQuestionIds.includes(question.questionId);
                      return (
                        <label
                          key={question.questionId}
                          className={`block space-y-3 rounded-2xl border p-5 transition-all duration-300 shadow-sm ${isActive
                            ? 'border-violet-300 bg-violet-50/80 shadow-md ring-4 ring-violet-50 dark:border-violet-500/40 dark:bg-violet-500/10 dark:ring-violet-900/20 scale-[1.01]'
                            : 'border-gray-200 bg-white hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700 opacity-80 hover:opacity-100'
                            }`}
                        >
                          <div className="flex items-center justify-between gap-2 border-b border-gray-100 dark:border-gray-800/60 pb-3">
                            <span className={`inline-flex items-center justify-center rounded-lg px-2.5 py-1 text-xs font-bold uppercase tracking-widest ${isActive ? 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>
                              Question {index + 1}
                            </span>
                            {isFlagged ? (
                              <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-widest text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                                <span className="material-symbols-outlined text-[14px]">flag</span> Flagged
                              </span>
                            ) : null}
                          </div>
                          <span className="block text-base font-semibold leading-relaxed text-gray-800 dark:text-gray-200">{question.prompt}</span>
                          <div
                            onFocusCapture={() => setListeningActiveQuestionIndex(index)}
                            onClick={() => setListeningActiveQuestionIndex(index)}
                            className="pt-1"
                          >
                            {renderObjectiveQuestionInput(question, listening.answers[question.questionId] || '', value =>
                              setListening(prev => ({
                                ...prev,
                                answers: {
                                  ...prev.answers,
                                  [question.questionId]: value
                                }
                              }))
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                  <div className="flex justify-end pt-4 border-t border-gray-100 dark:border-gray-800">
                    <button className="flex items-center gap-2 rounded-xl bg-violet-600 px-8 py-3 text-sm font-bold text-white shadow-xl shadow-violet-500/20 transition-all hover:-translate-y-0.5 hover:bg-violet-700 disabled:opacity-50 disabled:hover:translate-y-0" onClick={triggerSubmitReview} disabled={loading}>
                      <span className="material-symbols-outlined text-[20px]">fact_check</span> Open Listening Review
                    </button>
                  </div>
                </div>
              )}
            </SectionCard>
          ) : null}

          <SectionCard className="border-t-4 border-t-gray-800 dark:border-t-gray-400 bg-gray-50/50 dark:bg-gray-800/20 shadow-sm mt-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">Finalization</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-md leading-relaxed">Ready to complete the full simulation? Lock in your scores across all tested modules to calculate your overall band.</p>
              </div>
              <button className="flex justify-center items-center gap-2 rounded-2xl bg-gray-900 px-8 py-3 text-sm font-bold text-white shadow-xl transition-all hover:-translate-y-0.5 hover:bg-black hover:shadow-2xl dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 disabled:opacity-50 disabled:hover:translate-y-0" onClick={() => void completeExam()} disabled={loading || exam.status === 'completed'}>
                <span className="material-symbols-outlined text-[20px]">task_alt</span>
                Complete Full Exam
              </button>
            </div>
          </SectionCard>
        </div>
      ) : null}

      {showSubmitReviewModal ? (
        <ModalConfirm
          title="Submit Listening Review"
          subtitle="Confirm unanswered and flagged listening items before submitting."
          confirmLabel="Submit Section"
          cancelLabel="Keep Reviewing"
          onCancel={() => setShowSubmitReviewModal(false)}
          onConfirm={() => void confirmSubmitReview()}
          disabled={loading}
        >
          <div className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
            {activeModule === 'listening' ? (
              <>
                <p>
                  Listening: {listeningAnsweredCount}/{listeningQuestionCount} answered, {listeningUnsolvedCount} unsolved.
                </p>
                <p>Flagged questions: {listeningFlaggedQuestionIds.length}</p>
              </>
            ) : null}
          </div>
        </ModalConfirm>
      ) : null}

      {runtimeState?.interruptedAt ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Resume exam">
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 max-w-md w-full mx-4 space-y-4 shadow-2xl">
            <span className="inline-block rounded-full bg-amber-100 dark:bg-amber-500/20 px-2.5 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-400">Session interrupted</span>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Ready to Resume?</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Timer paused at module <strong className="text-gray-900 dark:text-white">{runtimeState.currentModule || activeModule || 'current'}</strong>. Continue where
              you left off with saved answers.
            </p>
            <div className="flex gap-2">
              <button className="flex-1 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 transition-colors disabled:opacity-50" onClick={() => void resumeExam()} disabled={loading}>Start Timer & Continue</button>
              <button className="flex-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors" onClick={discardRecovery}>Return to Dashboard</button>
            </div>
          </div>
        </div>
      ) : null}

      {error ? <div className="rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-400">{error}</div> : null}
    </div>
  );
}
