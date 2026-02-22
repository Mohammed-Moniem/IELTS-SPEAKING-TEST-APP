'use client';

import { useState } from 'react';

import { apiRequest, ApiError } from '@/lib/api/client';
import { WritingSubmission, WritingTask } from '@/lib/types';

export default function WritingPage() {
  const [track, setTrack] = useState<'academic' | 'general'>('academic');
  const [taskType, setTaskType] = useState<'task1' | 'task2'>('task2');
  const [task, setTask] = useState<WritingTask | null>(null);
  const [responseText, setResponseText] = useState('');
  const [result, setResult] = useState<WritingSubmission | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
      setResponseText('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to generate writing task.');
    } finally {
      setLoading(false);
    }
  };

  const submitResponse = async () => {
    if (!task) return;

    setError('');
    setLoading(true);
    try {
      const submission = await apiRequest<WritingSubmission>('/writing/submissions', {
        method: 'POST',
        body: JSON.stringify({
          taskId: task.taskId,
          responseText,
          durationSeconds: 1200
        })
      });

      setResult(submission);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to submit writing response.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="section-wrap">
      <div className="panel hero-panel stack">
        <span className="tag">Writing module</span>
        <h1>Generate tasks and submit scored responses</h1>
        <p className="subtitle">Backed by `/api/v1/writing/*` endpoints with rubric feedback and history support.</p>
      </div>

      <div className="panel stack">
        <div className="grid-2">
          <label className="stack">
            <span>Track</span>
            <select className="select" value={track} onChange={e => setTrack(e.target.value as 'academic' | 'general')}>
              <option value="academic">Academic</option>
              <option value="general">General</option>
            </select>
          </label>
          <label className="stack">
            <span>Task type</span>
            <select className="select" value={taskType} onChange={e => setTaskType(e.target.value as 'task1' | 'task2')}>
              <option value="task1">Task 1</option>
              <option value="task2">Task 2</option>
            </select>
          </label>
        </div>
        <div className="cta-row">
          <button className="btn btn-primary" onClick={() => void generateTask()} disabled={loading}>
            {loading ? 'Generating...' : 'Generate Writing Task'}
          </button>
        </div>
      </div>

      {task ? (
        <div className="panel stack">
          <h3>{task.title}</h3>
          <p>{task.prompt}</p>
          <div>
            <span className="tag">{task.track}</span>
            <span className="tag">{task.taskType}</span>
            <span className="tag">Min words: {task.minimumWords}</span>
          </div>
          <textarea
            className="textarea"
            placeholder="Write your response here..."
            value={responseText}
            onChange={event => setResponseText(event.target.value)}
          />
          <div className="cta-row">
            <button
              className="btn btn-secondary"
              onClick={() => void submitResponse()}
              disabled={loading || responseText.trim().length < 20}
            >
              {loading ? 'Submitting...' : 'Submit for Evaluation'}
            </button>
          </div>
        </div>
      ) : null}

      {result ? (
        <div className="panel stack">
          <h3>Evaluation result</h3>
          <p className="kpi">Band {result.overallBand}</p>
          <p>{result.feedback.summary}</p>
          <ul>
            {result.feedback.inlineSuggestions.map(item => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? <div className="alert alert-error">{error}</div> : null}
    </section>
  );
}
