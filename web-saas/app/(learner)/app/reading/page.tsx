'use client';

import { useMemo, useState } from 'react';

import { apiRequest, ApiError } from '@/lib/api/client';
import { ObjectiveAttempt, ObjectiveQuestion, ObjectiveTestPayload } from '@/lib/types';

type StartReadingResponse = {
  attemptId: string;
  test: ObjectiveTestPayload;
};

export default function ReadingPage() {
  const [track, setTrack] = useState<'academic' | 'general'>('academic');
  const [attemptId, setAttemptId] = useState('');
  const [test, setTest] = useState<ObjectiveTestPayload | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ObjectiveAttempt | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const questionCount = useMemo(() => test?.questions.length || 0, [test]);

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
        answers: test.questions.map(q => ({ questionId: q.questionId, answer: answers[q.questionId] || '' })),
        durationSeconds: 1200
      };

      const submitted = await apiRequest<ObjectiveAttempt>(`/reading/tests/${attemptId}/submit`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      setResult(submitted);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to submit reading test');
    } finally {
      setLoading(false);
    }
  };

  const renderQuestion = (question: ObjectiveQuestion, index: number) => {
    const currentValue = answers[question.questionId] || '';

    if (question.options && question.options.length > 0) {
      return (
        <div key={question.questionId} className="panel stack">
          <p>
            <strong>Q{index + 1}.</strong> {question.prompt}
          </p>
          <select
            className="select"
            value={currentValue}
            onChange={event => setAnswers(prev => ({ ...prev, [question.questionId]: event.target.value }))}
          >
            <option value="">Select an answer</option>
            {question.options.map(option => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      );
    }

    return (
      <div key={question.questionId} className="panel stack">
        <p>
          <strong>Q{index + 1}.</strong> {question.prompt}
        </p>
        <input
          className="input"
          value={currentValue}
          onChange={event => setAnswers(prev => ({ ...prev, [question.questionId]: event.target.value }))}
          placeholder="Your answer"
        />
      </div>
    );
  };

  return (
    <section className="section-wrap">
      <div className="panel hero-panel stack">
        <span className="tag">Reading module</span>
        <h1>Timed reading practice with objective scoring</h1>
        <p className="subtitle">API flow: start test, submit answers, view attempt details and history.</p>
      </div>

      <div className="panel stack">
        <label className="stack">
          <span>Track</span>
          <select className="select" value={track} onChange={e => setTrack(e.target.value as 'academic' | 'general')}>
            <option value="academic">Academic</option>
            <option value="general">General</option>
          </select>
        </label>
        <div className="cta-row">
          <button className="btn btn-primary" onClick={() => void startTest()} disabled={loading}>
            {loading ? 'Starting...' : 'Start Reading Test'}
          </button>
        </div>
      </div>

      {test ? (
        <div className="stack">
          <div className="panel stack">
            <h3>{test.title}</h3>
            {test.passageText ? <p>{test.passageText}</p> : null}
            <p className="small">Questions: {questionCount}</p>
          </div>
          <div className="stack">{test.questions.map(renderQuestion)}</div>
          <div className="cta-row">
            <button className="btn btn-secondary" onClick={() => void submitTest()} disabled={loading}>
              {loading ? 'Submitting...' : 'Submit Reading Test'}
            </button>
          </div>
        </div>
      ) : null}

      {result ? (
        <div className="panel stack">
          <h3>Reading result</h3>
          <p className="kpi">Band {result.normalizedBand || '--'}</p>
          <p>
            Score: {result.score || 0}/{result.totalQuestions || 0}
          </p>
          <p>{result.feedback?.summary}</p>
        </div>
      ) : null}

      {error ? <div className="alert alert-error">{error}</div> : null}
    </section>
  );
}
