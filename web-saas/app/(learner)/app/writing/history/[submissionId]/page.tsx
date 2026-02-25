'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { apiRequest, ApiError } from '@/lib/api/client';
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
    <section className="section-wrap">
      <div className="panel stack">
        <h1>Writing Submission Detail</h1>
        <p className="small">Submission ID: {params.submissionId}</p>
        <Link className="btn btn-secondary" href="/app/progress">
          Back to Progress
        </Link>
      </div>

      {submission ? (
        <div className="panel stack">
          <p className="kpi">Band {submission.overallBand}</p>
          <p>{submission.feedback.summary}</p>
          <p className="small">
            TR: {submission.breakdown.taskResponse} | CC: {submission.breakdown.coherenceCohesion} | LR:{' '}
            {submission.breakdown.lexicalResource} | GRA: {submission.breakdown.grammaticalRangeAccuracy}
          </p>
          <ul>
            {submission.feedback.inlineSuggestions.map(item => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? <div className="alert alert-error">{error}</div> : null}
    </section>
  );
}
