'use client';

import { useState } from 'react';

import { apiRequest } from '@/lib/api/client';
import { WritingSubmission, WritingTask } from '@/lib/types';

export default function WritingPage() {
  const [task, setTask] = useState<WritingTask | null>(null);
  const [responseText, setResponseText] = useState('');
  const [result, setResult] = useState<WritingSubmission | null>(null);
  const [error, setError] = useState('');

  const generateTask = async () => {
    setError('');
    try {
      const generated = await apiRequest<WritingTask>('/writing/tasks/generate', {
        method: 'POST',
        body: JSON.stringify({ track: 'academic', taskType: 'task2' })
      });
      setTask(generated);
      setResult(null);
      setResponseText('');
    } catch (err: any) {
      setError(err?.message || 'Failed to generate writing task.');
    }
  };

  const submitResponse = async () => {
    if (!task) return;

    setError('');
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
    } catch (err: any) {
      setError(err?.message || 'Failed to submit writing response.');
    }
  };

  return (
    <section>
      <h1>Writing</h1>
      <p className="subtitle">Practice and full rubric scoring via `/writing/*` endpoints.</p>

      <div className="cta-row">
        <button className="btn btn-primary" onClick={generateTask}>
          Generate Task
        </button>
      </div>

      {task ? (
        <div className="panel" style={{ marginTop: '1rem' }}>
          <h3>{task.title}</h3>
          <p>{task.prompt}</p>
          <p>
            <span className="tag">{task.track}</span>
            <span className="tag">{task.taskType}</span>
            <span className="tag">Min words: {task.minimumWords}</span>
          </p>
          <textarea
            className="textarea"
            placeholder="Write your response here..."
            value={responseText}
            onChange={event => setResponseText(event.target.value)}
          />
          <div className="cta-row">
            <button className="btn btn-secondary" onClick={submitResponse} disabled={responseText.trim().length < 20}>
              Submit for Evaluation
            </button>
          </div>
        </div>
      ) : null}

      {result ? (
        <div className="panel" style={{ marginTop: '1rem' }}>
          <h3>Evaluation Result</h3>
          <p className="kpi">Band {result.overallBand}</p>
          <p>{result.feedback.summary}</p>
          <ul>
            {result.feedback.inlineSuggestions.map(item => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? <p className="warning">{error}</p> : null}
    </section>
  );
}
