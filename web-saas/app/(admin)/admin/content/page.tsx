'use client';

import { useState } from 'react';

import { apiRequest, ApiError } from '@/lib/api/client';

type ContentModule = 'writing' | 'reading' | 'listening';

export default function AdminContentPage() {
  const [moduleName, setModuleName] = useState<ContentModule>('writing');
  const [records, setRecords] = useState<any[]>([]);
  const [payloadText, setPayloadText] = useState('{\n  "title": "New Content"\n}');
  const [targetId, setTargetId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const loadContent = async () => {
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const data = await apiRequest<any[]>(`/admin/content/${moduleName}?limit=30&offset=0`);
      setRecords(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load content');
    } finally {
      setLoading(false);
    }
  };

  const createContent = async () => {
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const payload = JSON.parse(payloadText);
      await apiRequest(`/admin/content`, {
        method: 'POST',
        body: JSON.stringify({ module: moduleName, payload })
      });
      setSuccess('Content created');
      await loadContent();
    } catch (err: any) {
      setError(err?.message || 'Failed to create content');
    } finally {
      setLoading(false);
    }
  };

  const patchContent = async () => {
    if (!targetId.trim()) {
      setError('Target ID is required for patch');
      return;
    }

    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const payload = JSON.parse(payloadText);
      await apiRequest(`/admin/content/${moduleName}/${targetId.trim()}`, {
        method: 'PATCH',
        body: JSON.stringify({ module: moduleName, payload })
      });
      setSuccess('Content updated');
      await loadContent();
    } catch (err: any) {
      setError(err?.message || 'Failed to update content');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="section-wrap">
      <div className="panel hero-panel stack">
        <span className="tag">Content operations</span>
        <h1>Manage module content bank + AI-assisted records</h1>
      </div>

      <div className="panel stack">
        <div className="grid-2">
          <label className="stack">
            <span>Module</span>
            <select className="select" value={moduleName} onChange={e => setModuleName(e.target.value as ContentModule)}>
              <option value="writing">Writing</option>
              <option value="reading">Reading</option>
              <option value="listening">Listening</option>
            </select>
          </label>
          <label className="stack">
            <span>Target ID (for patch)</span>
            <input className="input" value={targetId} onChange={e => setTargetId(e.target.value)} />
          </label>
        </div>

        <label className="stack">
          <span>Payload (JSON)</span>
          <textarea className="textarea" value={payloadText} onChange={e => setPayloadText(e.target.value)} />
        </label>

        <div className="cta-row">
          <button className="btn btn-secondary" onClick={() => void loadContent()} disabled={loading}>
            Load Content
          </button>
          <button className="btn btn-primary" onClick={() => void createContent()} disabled={loading}>
            Create
          </button>
          <button className="btn btn-secondary" onClick={() => void patchContent()} disabled={loading}>
            Patch
          </button>
        </div>
      </div>

      <div className="panel stack">
        <h3>Results</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Title</th>
                <th>Track</th>
                <th>Active</th>
              </tr>
            </thead>
            <tbody>
              {records.map(record => (
                <tr key={record._id || record.id}>
                  <td>{record._id || record.id || '-'}</td>
                  <td>{record.title || record.passageTitle || record.sectionTitle || '-'}</td>
                  <td>{record.track || '-'}</td>
                  <td>{String(record.active ?? true)}</td>
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
