'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';

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
      const items = await apiRequest<WritingSubmission[]>(`/writing/history?limit=10&offset=0&track=${track}`);
      setHistory(items);
    } catch {
      // Keep page usable if history is unavailable.
    }
  };

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
  }, [track]);

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
    <section className="section-wrap st2-writing-page">
      <header className="st2-page-title">
        <div className="stack">
          <p className="small st2-breadcrumb">Dashboard / Writing Practice</p>
          <h1>Writing workspace</h1>
          <p className="subtitle">Timed drafting, autosave recovery, and rubric-aware AI scoring.</p>
        </div>
        <div className="cta-row">
          <label className="stack st2-inline-field">
            <span>Track</span>
            <select className="select" value={track} onChange={event => setTrack(event.target.value as 'academic' | 'general')}>
              <option value="academic">Academic</option>
              <option value="general">General</option>
            </select>
          </label>
          <label className="stack st2-inline-field">
            <span>Task</span>
            <select className="select" value={taskType} onChange={event => setTaskType(event.target.value as 'task1' | 'task2')}>
              <option value="task1">Task 1</option>
              <option value="task2">Task 2</option>
            </select>
          </label>
          <button className="btn btn-primary" onClick={() => void generateTask()} disabled={loading}>
            {loading ? 'Generating...' : 'Generate Task'}
          </button>
        </div>
      </header>

      {task ? (
        <div className="st2-writing-workbench">
          <aside className="panel st2-writing-brief">
            <div className="cta-row">
              <span className="tag">{task.track}</span>
              <span className="tag">{task.taskType}</span>
            </div>
            <h2>{task.title}</h2>
            <p className="subtitle">{task.prompt}</p>
            <div className="st2-writing-visual">
              <div />
              <div />
              <div />
            </div>
            <div className="st2-writing-prompt-meta">
              <p className="small">Minimum words: {task.minimumWords}</p>
              <p className="small">Suggested time: {task.suggestedTimeMinutes} min</p>
            </div>
            <article className="st2-tip-card">
              <h4>Key tip</h4>
              <p className="small">{task.instructions?.[0] || 'Include a concise overview first, then support with specific comparisons.'}</p>
            </article>
            <ul className="st2-writing-rule-list">
              {(task.instructions || []).slice(0, 3).map(rule => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </aside>

          <article className="panel st2-writing-editor-shell">
            <div className="st2-writing-toolbar">
              <div className="st2-writing-tools" role="toolbar" aria-label="Editor tools">
                <button type="button" className="st2-tool-btn" aria-label="Bold">
                  B
                </button>
                <button type="button" className="st2-tool-btn" aria-label="Italic">
                  I
                </button>
                <button type="button" className="st2-tool-btn" aria-label="Underline">
                  U
                </button>
                <button type="button" className="st2-tool-btn" aria-label="Bullet list">
                  List
                </button>
              </div>
              <div className="st2-writing-toolbar-meta">
                <span className="tag">{formatCountdown(timerSecondsLeft)}</span>
                <span className="small st2-autosave-state">{isAutosaved ? 'Saved locally' : 'Editing...'}</span>
              </div>
            </div>

            <textarea
              className="textarea st2-writing-canvas"
              placeholder="Write your response here..."
              value={responseText}
              onChange={event => setResponseText(event.target.value)}
            />

            <footer className="st2-writing-bottombar">
              <div className="st2-writing-metrics">
                <p>
                  <strong>{wordCount}</strong> words
                </p>
                <p>
                  <strong>{task.minimumWords}</strong> minimum
                </p>
                <p>
                  <strong>{Math.floor(elapsedSeconds / 60)}</strong> min used
                </p>
                <p>{wordPolicy}</p>
              </div>
              <div className="cta-row">
                <button className="btn btn-secondary" onClick={saveDraftNow}>
                  Save Draft
                </button>
                <button className="btn btn-primary" onClick={() => void submitResponse()} disabled={loading || wordCount < Math.min(task.minimumWords, 30)}>
                  {loading ? 'Submitting...' : 'Submit for AI Evaluation'}
                </button>
              </div>
            </footer>
          </article>

          {selectedSubmission ? (
            <aside className="panel st2-writing-score-rail">
              <div className="st2-band-pill">
                <span>Overall band</span>
                <strong>{selectedSubmission.overallBand.toFixed(1)}</strong>
              </div>
              <p className="small">Submission #{selectedSubmission._id}</p>
              <p>{selectedSubmission.feedback.summary}</p>
              <ul className="st2-writing-breakdown-list">
                <li>
                  <span>Task Response</span>
                  <strong>{selectedSubmission.breakdown.taskResponse.toFixed(1)}</strong>
                </li>
                <li>
                  <span>Coherence</span>
                  <strong>{selectedSubmission.breakdown.coherenceCohesion.toFixed(1)}</strong>
                </li>
                <li>
                  <span>Lexical</span>
                  <strong>{selectedSubmission.breakdown.lexicalResource.toFixed(1)}</strong>
                </li>
                <li>
                  <span>Grammar</span>
                  <strong>{selectedSubmission.breakdown.grammaticalRangeAccuracy.toFixed(1)}</strong>
                </li>
              </ul>
              <div className="cta-row">
                <button className="btn btn-secondary" onClick={() => void openSubmission(selectedSubmission._id)}>
                  Refresh
                </button>
                <Link className="btn btn-primary" href={`/app/writing/history/${selectedSubmission._id}`}>
                  Open Full Evaluation
                </Link>
              </div>
            </aside>
          ) : null}
        </div>
      ) : (
        <div className="st2-writing-start-grid">
          <article className="panel st2-writing-start-card">
            <h3>Generate a writing task to begin</h3>
            <p className="small">You will get timer controls, autosave recovery, and detailed rubric scoring after submission.</p>
            <div className="st2-writing-start-pill-row">
              <span className="tag">Autosave enabled</span>
              <span className="tag">Recovery ready</span>
            </div>
            <button className="btn btn-primary" onClick={() => void generateTask()} disabled={loading}>
              {loading ? 'Generating...' : 'Start Writing Task'}
            </button>
          </article>

          <article className="panel st2-writing-policy-card">
            <h4>Writing flow</h4>
            <ol>
              <li>Generate a task for your selected track and type.</li>
              <li>Draft in the split workspace with live timer and autosave.</li>
              <li>Submit for rubric score and open full evaluation details.</li>
            </ol>
          </article>
        </div>
      )}

      <article className="panel st2-history-table">
        <div className="st2-section-head">
          <h3>Recent writing history</h3>
          <span className="small">{history.length} submissions</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Submission</th>
                <th>Band</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {history.map(item => (
                <tr key={item._id}>
                  <td>{item._id}</td>
                  <td>{item.overallBand.toFixed(1)}</td>
                  <td>{item.createdAt ? new Date(item.createdAt).toLocaleString() : '-'}</td>
                  <td>
                    <div className="cta-row">
                      <button className="btn btn-secondary" onClick={() => void openSubmission(item._id)}>
                        Open
                      </button>
                      <Link className="btn btn-secondary" href={`/app/writing/history/${item._id}`}>
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

      {result ? <div className="alert alert-success">Submission evaluated successfully.</div> : null}
      {error ? <div className="alert alert-error">{error}</div> : null}
    </section>
  );
}
