'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';

import { apiRequest, ApiError } from '@/lib/api/client';
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

  const loadHistory = async () => {
    try {
      const items = await apiRequest<ObjectiveAttempt[]>(`/reading/history?limit=10&offset=0&track=${track}`);
      setHistory(items);
    } catch {
      // Keep experience usable if history fails.
    }
  };

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
      setError(err instanceof ApiError ? err.message : 'Failed to start reading test');
    } finally {
      setLoading(false);
    }
  };

  const submitTest = async () => {
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
      setError(err instanceof ApiError ? err.message : 'Failed to submit reading test');
    } finally {
      setLoading(false);
    }
  };

  const openAttempt = async (id: string) => {
    try {
      const detail = await apiRequest<ObjectiveAttempt>(`/reading/tests/${id}`);
      setResult(detail);
    } catch (err) {
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
  }, [track]);

  useEffect(() => {
    if (timerSecondsLeft > 0) return;
    if (!attemptId || !test) return;
    if (result) return;
    void submitTest();
  }, [timerSecondsLeft]);

  useEffect(() => {
    return () => stopTimer();
  }, []);

  return (
    <section className="section-wrap st2-reading-page">
      <header className="st2-page-title">
        <div className="stack">
          <p className="small st2-breadcrumb">Dashboard / Reading</p>
          <h1>Reading comprehension workspace</h1>
          <p className="subtitle">Passage split view, timed controls, navigator, and review-before-submit flow.</p>
        </div>
        <div className="cta-row">
          <label className="stack st2-inline-field">
            <span>Track</span>
            <select className="select" value={track} onChange={event => setTrack(event.target.value as 'academic' | 'general')}>
              <option value="academic">Academic</option>
              <option value="general">General</option>
            </select>
          </label>
          <button className="btn btn-primary" onClick={() => void startTest()} disabled={loading}>
            {loading ? 'Starting...' : 'Start Reading Test'}
          </button>
        </div>
      </header>

      {test ? (
        <div className="st2-reading-runtime">
          <article className="panel st2-reading-runtime-head">
            <h3>{test.title}</h3>
            <div className="cta-row">
              <span className="tag st2-timer-chip">{formatCountdown(timerSecondsLeft)}</span>
              <select
                className="select st2-filter-select"
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
              <button className="btn btn-primary" onClick={() => setReviewMode(true)}>
                Review & Submit
              </button>
            </div>
          </article>

          <div className="st2-reading-split">
            <article className="panel st2-reading-passage-card">
              <div className="st2-reading-pane-head">
                <h4>Passage 1</h4>
                <div className="cta-row">
                  <button type="button" className="icon-btn" aria-label="Highlight text">
                    <span className="material-symbols-outlined">ink_highlighter</span>
                  </button>
                  <button type="button" className="icon-btn" aria-label="Zoom in">
                    <span className="material-symbols-outlined">zoom_in</span>
                  </button>
                  <button type="button" className="icon-btn" aria-label="Zoom out">
                    <span className="material-symbols-outlined">zoom_out</span>
                  </button>
                </div>
              </div>
              <h2>{test.title}</h2>
              <p>{test.passageText || 'Passage content unavailable for this attempt.'}</p>
            </article>

            <aside className="st2-reading-question-column">
              <article className="panel st2-reading-progress-card">
                <div className="st2-section-head">
                  <h4>Questions</h4>
                  <span className="small">
                    {activeQuestionIndex + 1}/{questionCount}
                  </span>
                </div>
                <p className="small">
                  Answered {answeredCount}/{questionCount}
                </p>
                <div className="st2-reading-progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={questionCount} aria-valuenow={answeredCount}>
                  <span style={{ width: `${questionCount ? (answeredCount / questionCount) * 100 : 0}%` }} />
                </div>
              </article>

              {reviewMode ? (
                <article className="panel st2-reading-question-card">
                  <div className="st2-section-head">
                    <h4>Review answers</h4>
                    <span className="small">{answeredCount}/{questionCount}</span>
                  </div>
                  <ul className="st2-answer-summary">
                    {test.questions.map((question, index) => (
                      <li key={question.questionId}>
                        <span>Question {index + 1}</span>
                        <span>{answers[question.questionId] ? 'Answered' : 'Missing'}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="cta-row">
                    <button className="btn btn-secondary" onClick={() => setReviewMode(false)}>
                      Back
                    </button>
                    <button className="btn btn-primary" onClick={() => void submitTest()} disabled={loading}>
                      {loading ? 'Submitting...' : 'Submit Reading Test'}
                    </button>
                  </div>
                </article>
              ) : activeQuestion ? (
                <article className="panel st2-reading-question-card">
                  <div className="st2-section-head">
                    <h4>Question {activeQuestionIndex + 1}</h4>
                    <button type="button" className="icon-btn" aria-label="Flag question">
                      <span className="material-symbols-outlined">flag</span>
                    </button>
                  </div>
                  <p>{activeQuestion.prompt}</p>
                  {activeQuestion.options && activeQuestion.options.length > 0 ? (
                    <div className="st2-option-list">
                      {activeQuestion.options.map(option => {
                        const selected = activeQuestionAnswer === option;
                        return (
                          <label key={option} className={`st2-option-row ${selected ? 'is-selected' : ''}`}>
                            <input
                              type="radio"
                              name={`question-${activeQuestion.questionId}`}
                              checked={selected}
                              onChange={() => setQuestionAnswer(activeQuestion, option)}
                            />
                            <span>{option}</span>
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <input
                      className="input"
                      value={activeQuestionAnswer}
                      onChange={event => setQuestionAnswer(activeQuestion, event.target.value)}
                      placeholder="Type your answer"
                    />
                  )}
                </article>
              ) : null}

              <article className="panel st2-reading-navigator-card">
                <div className="st2-section-head">
                  <h4>Navigator</h4>
                  <span className="small">Part 1</span>
                </div>
                <div className="st2-question-nav-grid">
                  {test.questions.map((question, index) => (
                    <button
                      key={question.questionId}
                      type="button"
                      className={`st2-nav-chip ${index === activeQuestionIndex ? 'active' : ''} ${answers[question.questionId] ? 'answered' : ''}`}
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

          <article className="panel st2-reading-bottombar">
            <button className="btn btn-secondary" onClick={goToPrevQuestion} disabled={activeQuestionIndex === 0}>
              Previous
            </button>
            <div className="cta-row">
              <button className="btn btn-secondary" onClick={goToNextQuestion} disabled={activeQuestionIndex >= questionCount - 1}>
                Next
              </button>
              <button className="btn btn-primary" onClick={() => void submitTest()} disabled={loading}>
                {loading ? 'Submitting...' : 'Submit Test'}
              </button>
            </div>
          </article>
        </div>
      ) : (
        <div className="st2-reading-start-grid">
          <article className="panel st2-reading-start-card">
            <h3>Start a reading test to open the split workspace</h3>
            <p className="small">You will get passage-question split mode with timer, navigation, and review before submit.</p>
            <button className="btn btn-primary" onClick={() => void startTest()} disabled={loading}>
              {loading ? 'Starting...' : 'Start Reading Test'}
            </button>
          </article>
          <article className="panel st2-reading-start-meta">
            <h4>What you get</h4>
            <ul>
              <li>Question navigator with answered-state chips.</li>
              <li>Timed section flow with auto-submit on timeout.</li>
              <li>Attempt history and detail deep links.</li>
            </ul>
          </article>
        </div>
      )}

      {result ? (
        <article className="panel st2-objective-result">
          <div className="st2-band-pill">
            <span>Band</span>
            <strong>{result.normalizedBand?.toFixed(1) || '--'}</strong>
          </div>
          <p>
            Score: {result.score || 0}/{result.totalQuestions || 0}
          </p>
          <p>{result.feedback?.summary}</p>
        </article>
      ) : null}

      <article className="panel st2-history-table">
        <div className="st2-section-head">
          <h3>Recent reading history</h3>
          <span className="small">{history.length} attempts</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Attempt</th>
                <th>Status</th>
                <th>Band</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {history.map(item => (
                <tr key={item._id}>
                  <td>{item._id}</td>
                  <td>{item.status || '-'}</td>
                  <td>{item.normalizedBand?.toFixed(1) || '-'}</td>
                  <td>{item.createdAt ? new Date(item.createdAt).toLocaleString() : '-'}</td>
                  <td>
                    <div className="cta-row">
                      <button className="btn btn-secondary" onClick={() => void openAttempt(item._id)}>
                        Open
                      </button>
                      <Link className="btn btn-secondary" href={`/app/reading/history/${item._id}`}>
                        Detail
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      {error ? <div className="alert alert-error">{error}</div> : null}
    </section>
  );
}
