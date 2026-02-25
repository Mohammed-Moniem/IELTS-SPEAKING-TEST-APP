'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';

import { apiRequest, ApiError } from '@/lib/api/client';
import { ObjectiveAttempt, ObjectiveQuestion, ObjectiveTestPayload } from '@/lib/types';

type StartListeningResponse = {
  attemptId: string;
  test: ObjectiveTestPayload;
};

const formatCountdown = (secondsLeft: number) => {
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

export default function ListeningPage() {
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
      const items = await apiRequest<ObjectiveAttempt[]>(`/listening/history?limit=10&offset=0&track=${track}`);
      setHistory(items);
    } catch {
      // Keep experience usable if history fails.
    }
  };

  const startTest = async () => {
    setError('');
    setLoading(true);
    try {
      const started = await apiRequest<StartListeningResponse>('/listening/tests/start', {
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
      setError(err instanceof ApiError ? err.message : 'Failed to start listening test');
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

      await apiRequest<ObjectiveAttempt>(`/listening/tests/${attemptId}/submit`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      const detail = await apiRequest<ObjectiveAttempt>(`/listening/tests/${attemptId}`);
      setResult(detail);
      stopTimer();
      await loadHistory();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to submit listening test');
    } finally {
      setLoading(false);
    }
  };

  const openAttempt = async (id: string) => {
    try {
      const detail = await apiRequest<ObjectiveAttempt>(`/listening/tests/${id}`);
      setResult(detail);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load attempt');
    }
  };

  const setQuestionAnswer = (question: ObjectiveQuestion, value: string) => {
    setAnswers(prev => ({ ...prev, [question.questionId]: value }));
  };

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
    <section className="section-wrap st2-objective-page st2-listening-page">
      <header className="st2-page-title">
        <div className="stack">
          <p className="small st2-breadcrumb">Dashboard / Listening</p>
          <h1>Listening test workspace</h1>
          <p className="subtitle">Audio-first test flow with section navigator, review, and submission analysis.</p>
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
            {loading ? 'Starting...' : 'Start Listening Test'}
          </button>
        </div>
      </header>

      {test ? (
        <div className="st2-listening-runtime">
          <div className="st2-listening-main">
            <article className="panel st2-listening-player-card">
              <div className="st2-section-head">
                <div>
                  <h3>{test.title}</h3>
                  <p className="small">
                    Question {activeQuestionIndex + 1} of {questionCount}
                  </p>
                </div>
                <div className="cta-row">
                  <span className="tag st2-timer-chip">{formatCountdown(timerSecondsLeft)}</span>
                </div>
              </div>

              <div className="st2-listening-player-controls">
                {test.audioUrl ? <audio controls src={test.audioUrl} /> : <p className="small">Audio unavailable, transcript fallback enabled.</p>}
              </div>

              <div className="st2-reading-progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={questionCount} aria-valuenow={answeredCount}>
                <span style={{ width: `${questionCount ? (answeredCount / questionCount) * 100 : 0}%` }} />
              </div>
            </article>

            {reviewMode ? (
              <article className="panel st2-listening-question-card">
                <div className="st2-section-head">
                  <h4>Review answers</h4>
                  <span className="small">
                    {answeredCount}/{questionCount} answered
                  </span>
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
                    {loading ? 'Submitting...' : 'Submit Listening Test'}
                  </button>
                </div>
              </article>
            ) : activeQuestion ? (
              <article className="panel st2-listening-question-card">
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

            <article className="panel st2-reading-bottombar st2-listening-bottom">
              <button className="btn btn-secondary" onClick={() => setActiveQuestionIndex(Math.max(0, activeQuestionIndex - 1))} disabled={activeQuestionIndex === 0}>
                Previous
              </button>
              <div className="cta-row">
                <button className="btn btn-secondary" onClick={() => setActiveQuestionIndex(Math.min(questionCount - 1, activeQuestionIndex + 1))} disabled={activeQuestionIndex >= questionCount - 1}>
                  Next
                </button>
                <button className="btn btn-primary" onClick={() => setReviewMode(true)}>
                  Review & Submit
                </button>
              </div>
            </article>
          </div>

          <aside className="st2-listening-rail">
            <article className="panel st2-listening-progress-card">
              <h4>Test progress</h4>
              <p className="small">
                {answeredCount} of {questionCount} answered
              </p>
              <div className="st2-reading-progress-track">
                <span style={{ width: `${questionCount ? (answeredCount / questionCount) * 100 : 0}%` }} />
              </div>
            </article>

            <article className="panel st2-question-nav">
              <h4>Question navigator</h4>
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

            {test.transcript ? (
              <article className="panel st2-listening-transcript-card">
                <h4>Transcript preview</h4>
                <p className="small">{test.transcript.slice(0, 320)}...</p>
              </article>
            ) : null}
          </aside>
        </div>
      ) : (
        <div className="st2-listening-start-grid">
          <article className="panel st2-listening-start-card">
            <h3>Start a listening test to open the audio workspace</h3>
            <p className="small">You get timed section navigation, review mode, and detailed attempt analysis.</p>
            <button className="btn btn-primary" onClick={() => void startTest()} disabled={loading}>
              {loading ? 'Starting...' : 'Start Listening Test'}
            </button>
          </article>
          <article className="panel st2-listening-start-meta">
            <h4>What you get</h4>
            <ul>
              <li>Audio controller with progress and timer.</li>
              <li>Question navigator with answered-state markers.</li>
              <li>History table and deep-link attempt details.</li>
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
          <h3>Recent listening history</h3>
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
                      <Link className="btn btn-secondary" href={`/app/listening/history/${item._id}`}>
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
