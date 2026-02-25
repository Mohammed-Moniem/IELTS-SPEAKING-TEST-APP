'use client';

import { useEffect, useMemo, useState } from 'react';

import { apiRequest, ApiError, webApi } from '@/lib/api/client';
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

const examStorageKey = 'spokio.web.full-exam.resume';

const moduleOrder: IELTSModule[] = ['speaking', 'writing', 'reading', 'listening'];

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
    answers: Record<string, string>;
  }>({ attemptId: '', test: null, answers: {} });

  const [listening, setListening] = useState<{
    attemptId: string;
    test: ObjectiveTestPayload | null;
    answers: Record<string, string>;
  }>({ attemptId: '', test: null, answers: {} });

  const timeline = useMemo(() => {
    if (!exam) return [];
    return moduleOrder.map(module => exam.sections.find(section => section.module === module));
  }, [exam]);

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
      const submission = await apiRequest<{ normalizedBand?: number }>(`/reading/tests/${reading.attemptId}/submit`, {
        method: 'POST',
        body: JSON.stringify({
          answers: reading.test.questions.map(question => ({
            questionId: question.questionId,
            answer: reading.answers[question.questionId] || ''
          })),
          durationSeconds: 0
        })
      });

      await submitSection('reading', reading.attemptId, submission.normalizedBand);
    } catch (err) {
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
    } catch (err) {
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
        <select className="select" value={value} onChange={event => onChange(event.target.value)}>
          <option value="">Select</option>
          {question.options.map(option => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    }

    return <input className="input" value={value} onChange={event => onChange(event.target.value)} placeholder="Answer" />;
  };

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

  return (
    <section className="section-wrap st2-tests-page">
      <header className="st2-page-title">
        <div className="stack">
          <p className="small st2-breadcrumb">Home / Exams</p>
          <h1>Full exam simulation</h1>
          <p className="subtitle">Guided section orchestration with resume support and no manual IDs.</p>
        </div>
        <div className="cta-row">
          <span className="tag">Total duration 2h 45m</span>
          <label className="stack st2-inline-field">
            <span>Track</span>
            <select className="select" value={track} onChange={event => setTrack(event.target.value as 'academic' | 'general')}>
              <option value="academic">Academic</option>
              <option value="general">General</option>
            </select>
          </label>
          <button className="btn btn-primary" onClick={() => void startExam()} disabled={loading}>
            {loading ? 'Starting...' : 'Start Full Exam'}
          </button>
        </div>
      </header>

      <div className="st2-tests-grid">
        <article className="panel st2-tests-sequence">
          <div className="st2-section-head">
            <h3>Exam sequence</h3>
            <span className="tag">{track} module</span>
          </div>
          <div className="st2-tests-sequence-cards">
            {moduleOrder.map(module => {
              const section = timeline.find(item => item?.module === module);
              const meta = moduleMeta[module];
              return (
                <article key={module} className={`st2-tests-sequence-card ${section?.status === 'completed' ? 'is-complete' : ''}`}>
                  <div className="st2-tests-sequence-icon">
                    <span className="material-symbols-outlined">{meta.icon}</span>
                  </div>
                  <div className="st2-tests-sequence-body">
                    <div className="st2-tests-sequence-row">
                      <h4>{meta.title}</h4>
                      <span className="small">{meta.duration}</span>
                    </div>
                    <p className="small">{meta.description}</p>
                    <div className="st2-tests-sequence-chips">
                      {meta.chips.map(chip => (
                        <span key={chip} className="st2-tests-chip">
                          {chip}
                        </span>
                      ))}
                    </div>
                    <p className="small">
                      Status: {section?.status || 'pending'} · Attempt: {section?.attemptId || 'not started'}
                    </p>
                  </div>
                  <span className="small st2-tests-sequence-score">{section?.score != null ? `Band ${section.score}` : '--'}</span>
                </article>
              );
            })}
          </div>
        </article>

        <aside className="st2-tests-rail">
          {exam && runtimeState?.interruptedAt ? (
            <article className="panel st2-resume-card-light">
              <p className="tag">Interrupted</p>
              <h3>Resume exam #{exam._id.slice(-6)}</h3>
              <p>
                Continue from <strong>{runtimeState.currentModule || activeModule || 'current section'}</strong>.
              </p>
              <div className="cta-row">
                <button className="btn btn-primary" onClick={() => void resumeExam()} disabled={loading}>
                  Resume Exam
                </button>
                <button className="btn btn-secondary" onClick={discardRecovery} disabled={loading}>
                  Discard
                </button>
              </div>
            </article>
          ) : (
            <article className="panel st2-start-card">
              <h3>Start new full exam</h3>
              <p className="small">Begin a complete simulation across speaking, writing, reading, and listening.</p>
              <button className="btn btn-primary" onClick={() => void startExam()} disabled={loading}>
                Start Full Exam
              </button>
            </article>
          )}

          <article className="panel st2-before-start">
            <h4>Before you start</h4>
            <ul>
              <li>Stable internet is required for uninterrupted timing.</li>
              <li>Use headphones for listening sections.</li>
              <li>Use pause/resume only when required by interruption.</li>
            </ul>
          </article>
        </aside>
      </div>

      {exam ? (
        <div className="stack">
          <article className="panel">
            <div className="st2-section-head">
              <h3>Runtime controls</h3>
              <div className="cta-row">
                <button className="btn btn-secondary" onClick={() => void refreshResults()} disabled={loading}>
                  Refresh
                </button>
                <button className="btn btn-secondary" onClick={() => void pauseExam()} disabled={loading || !activeModule}>
                  Pause
                </button>
                <button className="btn btn-secondary" onClick={() => void resumeExam()} disabled={loading || !runtimeState?.interruptedAt}>
                  Resume
                </button>
              </div>
            </div>
            <p className="small">
              Exam ID: {exam._id} · Status: {exam.status} · Active module: {activeModule || 'none'} · Runtime index:{' '}
              {runtimeState?.currentQuestionIndex ?? 0}
            </p>
          </article>

          {activeModule === 'speaking' ? (
            <article className="panel st2-module-panel">
              <h3>Speaking section</h3>
              {!speaking.simulation ? (
                <div className="st2-module-action">
                  <p className="small">Launch full speaking simulation and complete all three parts before submit.</p>
                  <button className="btn btn-primary" onClick={() => void startSpeakingSection()} disabled={loading}>
                    Start Speaking Simulation
                  </button>
                </div>
              ) : (
                <>
                  <p className="small">Answer each part, then submit the section to lock your speaking score.</p>
                  {speaking.simulation.parts.map(part => (
                    <label key={part.part} className="stack st2-module-question">
                      <span className="st2-module-question-title">Part {part.part}</span>
                      <p className="small">{part.question}</p>
                      <textarea
                        className="textarea st2-module-textarea"
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
                  <button className="btn btn-primary" onClick={() => void submitSpeakingSection()} disabled={loading}>
                    Submit Speaking Section
                  </button>
                </>
              )}
            </article>
          ) : null}

          {activeModule === 'writing' ? (
            <article className="panel st2-module-panel">
              <h3>Writing section</h3>
              {!writing.task ? (
                <div className="st2-module-action">
                  <p className="small">Generate a timed writing task and submit your final essay for scoring.</p>
                  <button className="btn btn-primary" onClick={() => void startWritingSection()} disabled={loading}>
                    Start Writing Task
                  </button>
                </div>
              ) : (
                <>
                  <p>{writing.task.prompt}</p>
                  <textarea
                    className="textarea st2-module-textarea"
                    value={writing.response}
                    onChange={event => setWriting(prev => ({ ...prev, response: event.target.value }))}
                  />
                  <button className="btn btn-primary" onClick={() => void submitWritingSection()} disabled={loading}>
                    Submit Writing Section
                  </button>
                </>
              )}
            </article>
          ) : null}

          {activeModule === 'reading' ? (
            <article className="panel st2-module-panel">
              <h3>Reading section</h3>
              {!reading.test ? (
                <div className="st2-module-action">
                  <p className="small">Start a full reading attempt with objective answers and band normalization.</p>
                  <button className="btn btn-primary" onClick={() => void startReadingSection()} disabled={loading}>
                    Start Reading Section
                  </button>
                </div>
              ) : (
                <>
                  {reading.test.questions.map(question => (
                    <label key={question.questionId} className="stack st2-module-question">
                      <span>{question.prompt}</span>
                      {renderObjectiveQuestionInput(question, reading.answers[question.questionId] || '', value =>
                        setReading(prev => ({
                          ...prev,
                          answers: {
                            ...prev.answers,
                            [question.questionId]: value
                          }
                        }))
                      )}
                    </label>
                  ))}
                  <button className="btn btn-primary" onClick={() => void submitReadingSection()} disabled={loading}>
                    Submit Reading Section
                  </button>
                </>
              )}
            </article>
          ) : null}

          {activeModule === 'listening' ? (
            <article className="panel st2-module-panel">
              <h3>Listening section</h3>
              {!listening.test ? (
                <div className="st2-module-action">
                  <p className="small">Start listening attempt and submit objective answers after playback.</p>
                  <button className="btn btn-primary" onClick={() => void startListeningSection()} disabled={loading}>
                    Start Listening Section
                  </button>
                </div>
              ) : (
                <>
                  {listening.test.audioUrl ? <audio controls src={listening.test.audioUrl} /> : null}
                  {listening.test.questions.map(question => (
                    <label key={question.questionId} className="stack st2-module-question">
                      <span>{question.prompt}</span>
                      {renderObjectiveQuestionInput(question, listening.answers[question.questionId] || '', value =>
                        setListening(prev => ({
                          ...prev,
                          answers: {
                            ...prev.answers,
                            [question.questionId]: value
                          }
                        }))
                      )}
                    </label>
                  ))}
                  <button className="btn btn-primary" onClick={() => void submitListeningSection()} disabled={loading}>
                    Submit Listening Section
                  </button>
                </>
              )}
            </article>
          ) : null}

          <article className="panel st2-module-panel">
            <h3>Finalization</h3>
            <button className="btn btn-primary" onClick={() => void completeExam()} disabled={loading || exam.status === 'completed'}>
              Complete Full Exam
            </button>
          </article>
        </div>
      ) : null}

      {runtimeState?.interruptedAt ? (
        <div className="st2-resume-overlay" role="dialog" aria-modal="true" aria-label="Resume exam">
          <div className="panel st2-resume-modal">
            <span className="tag">Session interrupted</span>
            <h3>Ready to Resume?</h3>
            <p>
              Timer paused at module <strong>{runtimeState.currentModule || activeModule || 'current'}</strong>. Continue where
              you left off with saved answers.
            </p>
            <div className="cta-row">
              <button className="btn btn-primary" onClick={() => void resumeExam()} disabled={loading}>
                Start Timer & Continue
              </button>
              <button className="btn btn-secondary" onClick={discardRecovery}>
                Return to Dashboard
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {error ? <div className="alert alert-error">{error}</div> : null}
    </section>
  );
}
