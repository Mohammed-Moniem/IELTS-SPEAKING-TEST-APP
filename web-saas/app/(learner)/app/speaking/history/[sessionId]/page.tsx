'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { ApiError, webApi } from '@/lib/api/client';
import { PageHeader, SectionCard, MetricCard, StatusBadge } from '@/components/ui/v2';
import { SpeakingSessionDetail } from '@/lib/types';

export default function SpeakingSessionHistoryDetailPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params?.sessionId || '';

  const [session, setSession] = useState<SpeakingSessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!sessionId) {
      setError('Invalid speaking session id.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    webApi
      .getPracticeSessionDetail(sessionId)
      .then(result => {
        setSession(result);
      })
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : 'Failed to load speaking session details.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [sessionId]);

  const feedback = session?.feedback;
  const overallBand = feedback?.overallBand ?? null;

  const metricRows = useMemo(() => {
    const breakdown = feedback?.bandBreakdown;
    return [
      { label: 'Fluency & Coherence', value: breakdown?.fluency },
      { label: 'Lexical Resource', value: breakdown?.lexicalResource },
      { label: 'Grammar', value: breakdown?.grammaticalRange },
      { label: 'Pronunciation', value: breakdown?.pronunciation }
    ];
  }, [feedback?.bandBreakdown]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={session?.topicTitle || 'Speaking session report'}
        subtitle={`Session ID: ${sessionId}`}
        actions={
          <div className="flex items-center gap-3">
            <StatusBadge tone="brand">Speaking evaluation detail</StatusBadge>
            <Link
              href="/app/speaking"
              className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Back to Speaking
            </Link>
          </div>
        }
      />

      {loading ? (
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 text-sm text-gray-500 dark:text-gray-400 animate-pulse">
          Loading speaking report...
        </div>
      ) : null}

      {!loading && error ? (
        <div className="rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-400">{error}</div>
      ) : null}

      {!loading && session ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SectionCard title="Transcript">
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <StatusBadge tone={session.status === 'completed' ? 'success' : 'neutral'}>
                  Status: {session.status}
                </StatusBadge>
                <StatusBadge tone="neutral">
                  {session.completedAt ? new Date(session.completedAt).toLocaleString() : 'in progress'}
                </StatusBadge>
              </div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{session.question}</p>
              <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 p-4 border border-gray-100 dark:border-gray-800">
                <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Your response</h4>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{session.userResponse || 'No transcript available for this session.'}</p>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Band insights">
            <div className="space-y-4">
              <div className="text-center pb-4 border-b border-gray-100 dark:border-gray-800">
                <p className="text-5xl font-black text-violet-600 dark:text-violet-400">{overallBand == null ? '--' : overallBand}</p>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mt-1">Overall band</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {metricRows.map(row => (
                  <MetricCard
                    key={row.label}
                    tone="neutral"
                    label={row.label}
                    value={typeof row.value === 'number' ? row.value.toFixed(1) : '--'}
                  />
                ))}
              </div>
              <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 p-4 border border-gray-100 dark:border-gray-800">
                <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Summary</h4>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{feedback?.summary || 'No summary was generated for this session.'}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-500/10 p-4 border border-emerald-100 dark:border-emerald-500/20">
                  <h4 className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider mb-2">Strengths</h4>
                  <ul className="text-sm text-emerald-800 dark:text-emerald-300 space-y-1.5 list-disc list-inside">
                    {(feedback?.strengths || []).slice(0, 6).map(item => (
                      <li key={item}>{item}</li>
                    ))}
                    {feedback?.strengths?.length ? null : <li>No strengths captured.</li>}
                  </ul>
                </div>
                <div className="rounded-xl bg-amber-50 dark:bg-amber-500/10 p-4 border border-amber-100 dark:border-amber-500/20">
                  <h4 className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-2">Improvements</h4>
                  <ul className="text-sm text-amber-800 dark:text-amber-300 space-y-1.5 list-disc list-inside">
                    {(feedback?.improvements || []).slice(0, 6).map(item => (
                      <li key={item}>{item}</li>
                    ))}
                    {feedback?.improvements?.length ? null : <li>No improvement actions captured.</li>}
                  </ul>
                </div>
              </div>
            </div>
          </SectionCard>
        </div>
      ) : null}
    </div>
  );
}
