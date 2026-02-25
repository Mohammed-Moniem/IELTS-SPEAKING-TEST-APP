'use client';

import { useState } from 'react';

import { apiRequest, ApiError } from '@/lib/api/client';

type ContentModule = 'writing' | 'reading' | 'listening';

type ContentRecord = Record<string, any> & { _id?: string };

export default function AdminContentPage() {
  const [moduleName, setModuleName] = useState<ContentModule>('writing');
  const [records, setRecords] = useState<ContentRecord[]>([]);
  const [targetId, setTargetId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [writingForm, setWritingForm] = useState({
    track: 'academic',
    taskType: 'task2',
    title: '',
    prompt: '',
    instructionsText: '',
    minimumWords: '250',
    suggestedTimeMinutes: '40'
  });

  const [objectiveForm, setObjectiveForm] = useState({
    track: 'academic',
    title: '',
    subtitle: '',
    bodyText: '',
    transcript: '',
    audioUrl: '',
    suggestedTimeMinutes: '20',
    questionsJson: '[\n  {\n    "questionId": "q1",\n    "type": "multiple-choice",\n    "prompt": "",\n    "options": [],\n    "correctAnswer": ""\n  }\n]'
  });

  const buildPayload = () => {
    if (moduleName === 'writing') {
      return {
        track: writingForm.track,
        taskType: writingForm.taskType,
        title: writingForm.title.trim(),
        prompt: writingForm.prompt.trim(),
        instructions: writingForm.instructionsText
          .split('\n')
          .map(item => item.trim())
          .filter(Boolean),
        minimumWords: Number(writingForm.minimumWords),
        suggestedTimeMinutes: Number(writingForm.suggestedTimeMinutes),
        active: true,
        autoPublished: true
      };
    }

    const base = {
      track: objectiveForm.track,
      title: objectiveForm.title.trim(),
      suggestedTimeMinutes: Number(objectiveForm.suggestedTimeMinutes),
      questions: JSON.parse(objectiveForm.questionsJson || '[]'),
      active: true,
      autoPublished: true
    } as Record<string, unknown>;

    if (moduleName === 'reading') {
      base.passageTitle = objectiveForm.subtitle.trim();
      base.passageText = objectiveForm.bodyText.trim();
    } else {
      base.sectionTitle = objectiveForm.subtitle.trim();
      base.transcript = objectiveForm.transcript.trim();
      base.audioUrl = objectiveForm.audioUrl.trim();
    }

    return base;
  };

  const validateForm = () => {
    if (moduleName === 'writing') {
      if (!writingForm.title.trim() || !writingForm.prompt.trim()) {
        return 'Title and prompt are required for writing content.';
      }
      if (Number(writingForm.minimumWords) < 50) {
        return 'Minimum words must be at least 50.';
      }
      return '';
    }

    if (!objectiveForm.title.trim()) {
      return 'Title is required.';
    }

    try {
      const parsed = JSON.parse(objectiveForm.questionsJson || '[]');
      if (!Array.isArray(parsed) || parsed.length === 0) {
        return 'At least one question is required.';
      }
    } catch {
      return 'Questions JSON is invalid.';
    }

    if (moduleName === 'reading' && !objectiveForm.bodyText.trim()) {
      return 'Passage text is required for reading content.';
    }

    return '';
  };

  const loadContent = async () => {
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const data = await apiRequest<ContentRecord[]>(`/admin/content/${moduleName}?limit=30&offset=0`);
      setRecords(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load content');
    } finally {
      setLoading(false);
    }
  };

  const createContent = async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    setSuccess('');
    setLoading(true);
    try {
      await apiRequest(`/admin/content`, {
        method: 'POST',
        body: JSON.stringify({ module: moduleName, payload: buildPayload() })
      });
      setSuccess('Content created');
      await loadContent();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create content');
    } finally {
      setLoading(false);
    }
  };

  const patchContent = async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!targetId.trim()) {
      setError('Target ID is required for update.');
      return;
    }

    setError('');
    setSuccess('');
    setLoading(true);
    try {
      await apiRequest(`/admin/content/${moduleName}/${targetId.trim()}`, {
        method: 'PATCH',
        body: JSON.stringify({ module: moduleName, payload: buildPayload() })
      });
      setSuccess('Content updated');
      await loadContent();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update content');
    } finally {
      setLoading(false);
    }
  };

  const loadRecordIntoForm = (record: ContentRecord) => {
    setTargetId(record._id || '');
    if (moduleName === 'writing') {
      setWritingForm({
        track: record.track || 'academic',
        taskType: record.taskType || 'task2',
        title: record.title || '',
        prompt: record.prompt || '',
        instructionsText: Array.isArray(record.instructions) ? record.instructions.join('\n') : '',
        minimumWords: String(record.minimumWords || 250),
        suggestedTimeMinutes: String(record.suggestedTimeMinutes || 40)
      });
      return;
    }

    setObjectiveForm({
      track: record.track || 'academic',
      title: record.title || '',
      subtitle: record.passageTitle || record.sectionTitle || '',
      bodyText: record.passageText || '',
      transcript: record.transcript || '',
      audioUrl: record.audioUrl || '',
      suggestedTimeMinutes: String(record.suggestedTimeMinutes || 20),
      questionsJson: JSON.stringify(record.questions || [], null, 2)
    });
  };

  return (
    <section className="section-wrap">
      <div className="panel hero-panel stack">
        <span className="tag">Content operations</span>
        <h1>Typed content editors for writing, reading, and listening</h1>
      </div>

      <div className="panel stack">
        <div className="grid-2">
          <label className="stack">
            <span>Module</span>
            <select className="select" value={moduleName} onChange={event => setModuleName(event.target.value as ContentModule)}>
              <option value="writing">Writing</option>
              <option value="reading">Reading</option>
              <option value="listening">Listening</option>
            </select>
          </label>
          <label className="stack">
            <span>Target ID (for update)</span>
            <input className="input" value={targetId} onChange={event => setTargetId(event.target.value)} />
          </label>
        </div>

        {moduleName === 'writing' ? (
          <div className="stack">
            <label className="stack">
              <span>Track</span>
              <select
                className="select"
                value={writingForm.track}
                onChange={event => setWritingForm(prev => ({ ...prev, track: event.target.value }))}
              >
                <option value="academic">Academic</option>
                <option value="general">General</option>
              </select>
            </label>
            <label className="stack">
              <span>Task type</span>
              <select
                className="select"
                value={writingForm.taskType}
                onChange={event => setWritingForm(prev => ({ ...prev, taskType: event.target.value }))}
              >
                <option value="task1">Task 1</option>
                <option value="task2">Task 2</option>
              </select>
            </label>
            <label className="stack">
              <span>Title</span>
              <input className="input" value={writingForm.title} onChange={event => setWritingForm(prev => ({ ...prev, title: event.target.value }))} />
            </label>
            <label className="stack">
              <span>Prompt</span>
              <textarea className="textarea" value={writingForm.prompt} onChange={event => setWritingForm(prev => ({ ...prev, prompt: event.target.value }))} />
            </label>
            <label className="stack">
              <span>Instructions (one line per instruction)</span>
              <textarea
                className="textarea"
                value={writingForm.instructionsText}
                onChange={event => setWritingForm(prev => ({ ...prev, instructionsText: event.target.value }))}
              />
            </label>
            <div className="grid-2">
              <label className="stack">
                <span>Minimum words</span>
                <input
                  className="input"
                  type="number"
                  value={writingForm.minimumWords}
                  onChange={event => setWritingForm(prev => ({ ...prev, minimumWords: event.target.value }))}
                />
              </label>
              <label className="stack">
                <span>Suggested minutes</span>
                <input
                  className="input"
                  type="number"
                  value={writingForm.suggestedTimeMinutes}
                  onChange={event => setWritingForm(prev => ({ ...prev, suggestedTimeMinutes: event.target.value }))}
                />
              </label>
            </div>
          </div>
        ) : (
          <div className="stack">
            <label className="stack">
              <span>Track</span>
              <select
                className="select"
                value={objectiveForm.track}
                onChange={event => setObjectiveForm(prev => ({ ...prev, track: event.target.value }))}
              >
                <option value="academic">Academic</option>
                <option value="general">General</option>
              </select>
            </label>
            <label className="stack">
              <span>Title</span>
              <input className="input" value={objectiveForm.title} onChange={event => setObjectiveForm(prev => ({ ...prev, title: event.target.value }))} />
            </label>
            <label className="stack">
              <span>{moduleName === 'reading' ? 'Passage title' : 'Section title'}</span>
              <input className="input" value={objectiveForm.subtitle} onChange={event => setObjectiveForm(prev => ({ ...prev, subtitle: event.target.value }))} />
            </label>
            {moduleName === 'reading' ? (
              <label className="stack">
                <span>Passage text</span>
                <textarea className="textarea" value={objectiveForm.bodyText} onChange={event => setObjectiveForm(prev => ({ ...prev, bodyText: event.target.value }))} />
              </label>
            ) : (
              <>
                <label className="stack">
                  <span>Transcript</span>
                  <textarea className="textarea" value={objectiveForm.transcript} onChange={event => setObjectiveForm(prev => ({ ...prev, transcript: event.target.value }))} />
                </label>
                <label className="stack">
                  <span>Audio URL</span>
                  <input className="input" value={objectiveForm.audioUrl} onChange={event => setObjectiveForm(prev => ({ ...prev, audioUrl: event.target.value }))} />
                </label>
              </>
            )}
            <label className="stack">
              <span>Questions JSON</span>
              <textarea
                className="textarea"
                value={objectiveForm.questionsJson}
                onChange={event => setObjectiveForm(prev => ({ ...prev, questionsJson: event.target.value }))}
              />
            </label>
          </div>
        )}

        <div className="cta-row">
          <button className="btn btn-secondary" onClick={() => void loadContent()} disabled={loading}>
            Load Content
          </button>
          <button className="btn btn-primary" onClick={() => void createContent()} disabled={loading}>
            Create
          </button>
          <button className="btn btn-secondary" onClick={() => void patchContent()} disabled={loading}>
            Update
          </button>
        </div>
      </div>

      <div className="panel stack">
        <h3>Existing records</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Title</th>
                <th>Track</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {records.map(record => (
                <tr key={record._id || record.id}>
                  <td>{record._id || record.id || '-'}</td>
                  <td>{record.title || record.passageTitle || record.sectionTitle || '-'}</td>
                  <td>{record.track || '-'}</td>
                  <td>
                    <button className="btn btn-secondary" onClick={() => loadRecordIntoForm(record)}>
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}
      {success ? <div className="alert alert-success">{success}</div> : null}
    </section>
  );
}
