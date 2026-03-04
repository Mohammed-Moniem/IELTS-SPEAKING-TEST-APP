'use client';

import Link from 'next/link';
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
    sectionsJson:
      '[\n' +
      '  {\n' +
      '    "sectionId": "p1",\n' +
      '    "title": "Passage 1",\n' +
      '    "passageText": "",\n' +
      '    "suggestedMinutes": 20,\n' +
      '    "questions": []\n' +
      '  },\n' +
      '  {\n' +
      '    "sectionId": "p2",\n' +
      '    "title": "Passage 2",\n' +
      '    "passageText": "",\n' +
      '    "suggestedMinutes": 20,\n' +
      '    "questions": []\n' +
      '  },\n' +
      '  {\n' +
      '    "sectionId": "p3",\n' +
      '    "title": "Passage 3",\n' +
      '    "passageText": "",\n' +
      '    "suggestedMinutes": 20,\n' +
      '    "questions": []\n' +
      '  }\n' +
      ']',
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
      const sections = JSON.parse(objectiveForm.sectionsJson || '[]');
      const firstSection = Array.isArray(sections) ? sections[0] : null;
      const flattenedQuestions = Array.isArray(sections)
        ? sections.flatMap((section: any) => (Array.isArray(section?.questions) ? section.questions : []))
        : [];
      base.schemaVersion = 'v2';
      base.sectionCount = Array.isArray(sections) ? sections.length : 0;
      base.sections = sections;
      base.passageTitle = firstSection?.title || objectiveForm.subtitle.trim() || 'Passage 1';
      base.passageText = firstSection?.passageText || objectiveForm.bodyText.trim();
      base.questions = flattenedQuestions;
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

    if (moduleName === 'reading') {
      try {
        const sections = JSON.parse(objectiveForm.sectionsJson || '[]');
        if (!Array.isArray(sections) || sections.length === 0) {
          return 'Reading sections JSON must include at least one section.';
        }
        const hasQuestions = sections.some((section: any) => Array.isArray(section?.questions) && section.questions.length > 0);
        if (!hasQuestions) {
          return 'Reading sections must include questions.';
        }
      } catch {
        return 'Reading sections JSON is invalid.';
      }
      return '';
    }

    try {
      const parsed = JSON.parse(objectiveForm.questionsJson || '[]');
      if (!Array.isArray(parsed) || parsed.length === 0) {
        return 'At least one question is required.';
      }
    } catch {
      return 'Questions JSON is invalid.';
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
      sectionsJson: JSON.stringify(
        Array.isArray(record.sections) && record.sections.length > 0
          ? record.sections
          : [
              {
                sectionId: 'p1',
                title: record.passageTitle || 'Passage 1',
                passageText: record.passageText || '',
                suggestedMinutes: 20,
                questions: record.questions || []
              }
            ],
        null,
        2
      ),
      transcript: record.transcript || '',
      audioUrl: record.audioUrl || '',
      suggestedTimeMinutes: String(record.suggestedTimeMinutes || 20),
      questionsJson: JSON.stringify(record.questions || [], null, 2)
    });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-indigo-100 dark:border-indigo-900/40 bg-gradient-to-r from-indigo-600 to-violet-600 p-6 text-white">
        <span className="inline-block rounded-full bg-white/20 px-3 py-0.5 text-xs font-semibold uppercase tracking-wider mb-2">Content operations</span>
        <h1 className="text-2xl font-bold">Typed Content Editors for Writing, Reading, and Listening</h1>
        <div className="mt-3">
          <Link
            href="/admin/content/blog"
            className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20"
          >
            Open Blog Content Operations
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </Link>
        </div>
      </div>

      <article className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Module</span>
            <select className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40" value={moduleName} onChange={event => setModuleName(event.target.value as ContentModule)}>
              <option value="writing">Writing</option>
              <option value="reading">Reading</option>
              <option value="listening">Listening</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Target ID (for update)</span>
            <input className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40" value={targetId} onChange={event => setTargetId(event.target.value)} />
          </label>
        </div>

        {moduleName === 'writing' ? (
          <div className="space-y-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Track</span>
              <select
                className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                value={writingForm.track}
                onChange={event => setWritingForm(prev => ({ ...prev, track: event.target.value }))}
              >
                <option value="academic">Academic</option>
                <option value="general">General</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Task type</span>
              <select
                className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                value={writingForm.taskType}
                onChange={event => setWritingForm(prev => ({ ...prev, taskType: event.target.value }))}
              >
                <option value="task1">Task 1</option>
                <option value="task2">Task 2</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Title</span>
              <input className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40" value={writingForm.title} onChange={event => setWritingForm(prev => ({ ...prev, title: event.target.value }))} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Prompt</span>
              <textarea className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40 min-h-[100px]" value={writingForm.prompt} onChange={event => setWritingForm(prev => ({ ...prev, prompt: event.target.value }))} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Instructions (one line per instruction)</span>
              <textarea
                className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40 min-h-[80px]"
                value={writingForm.instructionsText}
                onChange={event => setWritingForm(prev => ({ ...prev, instructionsText: event.target.value }))}
              />
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Minimum words</span>
                <input
                  className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                  type="number"
                  value={writingForm.minimumWords}
                  onChange={event => setWritingForm(prev => ({ ...prev, minimumWords: event.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Suggested minutes</span>
                <input
                  className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                  type="number"
                  value={writingForm.suggestedTimeMinutes}
                  onChange={event => setWritingForm(prev => ({ ...prev, suggestedTimeMinutes: event.target.value }))}
                />
              </label>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Track</span>
              <select
                className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                value={objectiveForm.track}
                onChange={event => setObjectiveForm(prev => ({ ...prev, track: event.target.value }))}
              >
                <option value="academic">Academic</option>
                <option value="general">General</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Title</span>
              <input className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40" value={objectiveForm.title} onChange={event => setObjectiveForm(prev => ({ ...prev, title: event.target.value }))} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{moduleName === 'reading' ? 'Passage title' : 'Section title'}</span>
              <input className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40" value={objectiveForm.subtitle} onChange={event => setObjectiveForm(prev => ({ ...prev, subtitle: event.target.value }))} />
            </label>
            {moduleName === 'reading' ? (
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Sections JSON (p1/p2/p3)</span>
                <textarea className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm font-mono text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40 min-h-[220px]" value={objectiveForm.sectionsJson} onChange={event => setObjectiveForm(prev => ({ ...prev, sectionsJson: event.target.value }))} />
              </label>
            ) : (
              <>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Transcript</span>
                  <textarea className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40 min-h-[100px]" value={objectiveForm.transcript} onChange={event => setObjectiveForm(prev => ({ ...prev, transcript: event.target.value }))} />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Audio URL</span>
                  <input className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40" value={objectiveForm.audioUrl} onChange={event => setObjectiveForm(prev => ({ ...prev, audioUrl: event.target.value }))} />
                </label>
              </>
            )}
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Questions JSON</span>
              <textarea
                className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm font-mono text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40 min-h-[120px]"
                value={objectiveForm.questionsJson}
                onChange={event => setObjectiveForm(prev => ({ ...prev, questionsJson: event.target.value }))}
              />
            </label>
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors" onClick={() => void loadContent()} disabled={loading}>
            Load Content
          </button>
          <button className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/25" onClick={() => void createContent()} disabled={loading}>
            Create
          </button>
          <button className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors" onClick={() => void patchContent()} disabled={loading}>
            Update
          </button>
        </div>
      </article>

      <article className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <h3 className="text-base font-bold text-gray-900 dark:text-white">Existing Records</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                <th className="px-5 py-3">ID</th>
                <th className="px-5 py-3">Title</th>
                <th className="px-5 py-3">Track</th>
                <th className="px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {records.map(record => (
                <tr key={record._id || record.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <td className="px-5 py-3 font-mono text-xs text-gray-500 dark:text-gray-400">{record._id || record.id || '-'}</td>
                  <td className="px-5 py-3 font-semibold text-gray-900 dark:text-white">{record.title || record.passageTitle || record.sectionTitle || '-'}</td>
                  <td className="px-5 py-3"><span className="inline-block rounded-full bg-indigo-50 dark:bg-indigo-500/10 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 dark:text-indigo-400">{record.track || '-'}</span></td>
                  <td className="px-5 py-3">
                    <button className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors" onClick={() => loadRecordIntoForm(record)}>
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      {error ? <div className="rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-400">{error}</div> : null}
      {success ? <div className="rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">{success}</div> : null}
    </div>
  );
}
