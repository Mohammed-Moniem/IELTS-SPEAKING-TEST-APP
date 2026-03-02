'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { apiRequest, ApiError } from '@/lib/api/client';
import { PageHeader, SectionCard, MetricCard } from '@/components/ui/v2';
import { WritingSubmission } from '@/lib/types';

export default function WritingHistoryDetailPage() {
  const params = useParams<{ submissionId: string }>();
  const [submission, setSubmission] = useState<WritingSubmission | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!params.submissionId) return;

    void (async () => {
      try {
        const detail = await apiRequest<WritingSubmission>(`/writing/submissions/${params.submissionId}`);
        setSubmission(detail);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Failed to load writing submission.');
      }
    })();
  }, [params.submissionId]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Writing Submission Detail"
        subtitle={`Submission ID: ${params.submissionId}`}
        actions={
          <Link
            href="/app/progress"
            className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Back to Progress
          </Link>
        }
      />

      {submission ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <MetricCard tone="brand" label="Overall Band" value={submission.overallBand} />
            <MetricCard tone="neutral" label="Task Response" value={submission.breakdown.taskResponse} />
            <MetricCard tone="neutral" label="Coherence" value={submission.breakdown.coherenceCohesion} />
            <MetricCard tone="neutral" label="Lexical" value={submission.breakdown.lexicalResource} />
            <MetricCard tone="neutral" label="Grammar" value={submission.breakdown.grammaticalRangeAccuracy} />
          </div>

          <SectionCard title="Feedback Summary">
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{submission.feedback.summary}</p>
          </SectionCard>

          {submission.feedback.inlineSuggestions.length > 0 ? (
            <SectionCard title="Inline Suggestions">
              <ul className="space-y-2">
                {submission.feedback.inlineSuggestions.map(item => (
                  <li key={item} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <span className="material-symbols-outlined text-[16px] text-violet-500 mt-0.5 flex-shrink-0">lightbulb</span>
                    {item}
                  </li>
                ))}
              </ul>
            </SectionCard>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-400">{error}</div>
      ) : null}
    </div>
  );
}
