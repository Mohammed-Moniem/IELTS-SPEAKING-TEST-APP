'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { ApiError, apiRequest } from '@/lib/api/client';
import { MetricCard, PageHeader, SectionCard, StatusBadge } from '@/components/ui/v2';
import { SimulationSession } from '@/lib/types';

const buildLibraryHref = (kind: 'collocations' | 'vocabulary', seed?: string) => {
  const query = new URLSearchParams();
  query.set('module', 'speaking');
  if (seed) query.set('search', seed);
  return `/app/library/${kind}${query.toString() ? `?${query.toString()}` : ''}`;
};

const buildModelAnswer = (question: string, partNumber: number) => {
  const normalized = question.trim().replace(/\?$/, '');

  if (partNumber === 2) {
    return `One answer I could give for this cue card is about ${normalized
      .replace(/^describe\s+/i, '')
      .replace(/^talk about\s+/i, '')}. I would begin by setting the scene clearly, then describe the people or events involved, and finally explain why the experience mattered to me. That gives the examiner a complete story instead of a short list of facts. I would also try to link each idea naturally so the answer sounds more fluent and confident.`;
  }

  if (/hometown|city|place/i.test(normalized)) {
    return 'I would say that my hometown is a busy but welcoming place, and that is probably why I still feel attached to it. It has a mix of modern buildings and traditional areas, so daily life there never feels boring. For example, I can enjoy lively markets, quiet neighbourhoods, and places where families meet in the evening. Overall, it is special to me because it feels energetic and familiar at the same time.';
  }

  if (/travel|trip|journey/i.test(normalized)) {
    return 'I think travel can change people because it exposes them to different ways of living and thinking. When someone spends time in a new environment, they usually become more open-minded and adaptable. For example, travelling can teach a person to communicate with unfamiliar people, solve problems quickly, and appreciate other cultures. As a result, it often makes people more confident and more understanding.';
  }

  return 'I would start with a direct answer, add one clear reason, support it with a short personal example, and end with a simple concluding thought. That structure helps the response sound more complete, natural, and convincing.';
};

const formatTimestamp = (value?: string) => {
  if (!value) return 'Completed simulation';

  try {
    return new Date(value).toLocaleString();
  } catch {
    return 'Completed simulation';
  }
};

export default function SpeakingSimulationReportPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params?.sessionId || '';

  const [simulation, setSimulation] = useState<SimulationSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!sessionId) {
      setError('Invalid simulation id.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    apiRequest<SimulationSession>(`/test-simulations/${sessionId}`)
      .then(result => {
        setSimulation(result);
      })
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : 'Failed to load the simulation report.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [sessionId]);

  const fullEvaluation = simulation?.fullEvaluation;
  const overallBand = simulation?.overallBand ?? fullEvaluation?.overallBand ?? null;
  const weakestSeed = useMemo(() => {
    if (fullEvaluation?.suggestions?.[0]?.suggestion) return fullEvaluation.suggestions[0].suggestion;
    return simulation?.overallFeedback?.improvements?.[0] || simulation?.overallFeedback?.summary || '';
  }, [fullEvaluation?.suggestions, simulation?.overallFeedback?.improvements, simulation?.overallFeedback?.summary]);

  const metricCards = useMemo(() => {
    if (!fullEvaluation?.criteria) return [];

    return [
      {
        label: 'Fluency & Coherence',
        band: fullEvaluation.criteria.fluencyCoherence.band,
        body: fullEvaluation.criteria.fluencyCoherence.feedback
      },
      {
        label: 'Lexical Resource',
        band: fullEvaluation.criteria.lexicalResource.band,
        body: fullEvaluation.criteria.lexicalResource.feedback
      },
      {
        label: 'Grammar',
        band: fullEvaluation.criteria.grammaticalRange.band,
        body: fullEvaluation.criteria.grammaticalRange.feedback
      },
      {
        label: 'Pronunciation',
        band: fullEvaluation.criteria.pronunciation.band,
        body: fullEvaluation.criteria.pronunciation.feedback
      }
    ];
  }, [fullEvaluation?.criteria]);

  const whyThisScore = useMemo(() => {
    const items = [
      fullEvaluation?.spokenSummary,
      fullEvaluation?.detailedFeedback,
      simulation?.overallFeedback?.summary,
      simulation?.overallFeedback?.improvements?.[0]
    ].filter(Boolean) as string[];

    return Array.from(new Set(items)).slice(0, 4);
  }, [fullEvaluation?.detailedFeedback, fullEvaluation?.spokenSummary, simulation?.overallFeedback?.improvements, simulation?.overallFeedback?.summary]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Full speaking simulation report"
        subtitle="Review the complete IELTS speaking debrief, part by part, with corrections and stronger answer examples."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge tone="brand">Simulation report</StatusBadge>
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
        <div className="grid gap-4">
          <div className="h-40 rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 animate-pulse" />
          <div className="h-56 rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 animate-pulse" />
        </div>
      ) : null}

      {!loading && error ? (
        <div className="rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      ) : null}

      {!loading && simulation ? (
        <div className="space-y-6">
          <section className="rounded-3xl border border-violet-200 dark:border-violet-500/20 bg-gradient-to-br from-violet-50 via-white to-white dark:from-violet-500/10 dark:via-gray-900 dark:to-gray-900 p-6 lg:p-8">
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_320px]">
              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge tone={simulation.status === 'completed' ? 'success' : 'neutral'}>
                    {simulation.status === 'completed' ? 'Completed simulation' : simulation.status}
                  </StatusBadge>
                  <StatusBadge tone="neutral">{formatTimestamp(simulation.completedAt || simulation.createdAt)}</StatusBadge>
                  <StatusBadge tone="neutral">Session ID: {sessionId}</StatusBadge>
                </div>

                <div className="space-y-3">
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-violet-700 dark:text-violet-400">
                    Examiner-led debrief
                  </p>
                  <h2 className="text-3xl font-black tracking-tight text-gray-900 dark:text-white">
                    {fullEvaluation?.spokenSummary || simulation.overallFeedback?.summary || 'Your full speaking evaluation is ready.'}
                  </h2>
                  <p className="max-w-3xl text-base leading-8 text-gray-700 dark:text-gray-300">
                    {fullEvaluation?.detailedFeedback
                      || 'Use the sections below to understand how you performed across all three speaking parts and what to improve before the next simulation.'}
                  </p>
                </div>
              </div>

              <aside className="rounded-3xl border border-violet-200 dark:border-violet-500/20 bg-white dark:bg-gray-950/60 p-6 space-y-5">
                <div className="text-center">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                    Overall band
                  </p>
                  <p className="mt-3 text-6xl font-black tracking-tight text-violet-600 dark:text-violet-400">
                    {overallBand == null ? '--' : overallBand.toFixed(1)}
                  </p>
                  <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">
                    {simulation.overallFeedback?.summary || 'Detailed feedback is organized below by rubric area and speaking part.'}
                  </p>
                </div>

                <div className="space-y-3">
                  <Link
                    href="/app/speaking"
                    className="inline-flex w-full items-center justify-center rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-700"
                  >
                    Start another simulation
                  </Link>
                  <Link
                    href={buildLibraryHref('collocations', weakestSeed)}
                    className="inline-flex w-full items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    Review collocations
                  </Link>
                  <Link
                    href={buildLibraryHref('vocabulary', weakestSeed)}
                    className="inline-flex w-full items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    Review vocabulary
                  </Link>
                </div>
              </aside>
            </div>
          </section>

          <SectionCard
            title="Why this score happened"
            subtitle="A plain-language explanation of what the evaluator heard across the full speaking test."
          >
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_320px]">
              <ul className="space-y-3">
                {whyThisScore.map(item => (
                  <li key={item} className="flex items-start gap-3 text-sm leading-7 text-gray-700 dark:text-gray-300">
                    <span className="material-symbols-outlined mt-1 text-[18px] text-violet-500">insights</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                  Part scores
                </p>
                <div className="mt-3 space-y-2 text-sm text-gray-700 dark:text-gray-300">
                  <p>Part 1: {fullEvaluation?.partScores?.part1 ?? simulation.parts.find(part => part.part === 1)?.feedback?.overallBand ?? '--'}</p>
                  <p>Part 2: {fullEvaluation?.partScores?.part2 ?? simulation.parts.find(part => part.part === 2)?.feedback?.overallBand ?? '--'}</p>
                  <p>Part 3: {fullEvaluation?.partScores?.part3 ?? simulation.parts.find(part => part.part === 3)?.feedback?.overallBand ?? '--'}</p>
                </div>
              </div>
            </div>
          </SectionCard>

          {metricCards.length ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {metricCards.map(metric => (
                <MetricCard
                  key={metric.label}
                  label={metric.label}
                  value={metric.band.toFixed(1)}
                  helper={metric.body}
                />
              ))}
            </div>
          ) : null}

          <SectionCard
            title="Part-by-part transcripts"
            subtitle="See what you said in each part before you review the model answers and improvement plan."
          >
            <div className="grid gap-4 xl:grid-cols-3">
              {simulation.parts.map(part => (
                <article key={part.part} className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/50 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-base font-bold text-gray-900 dark:text-white">Part {part.part}</h4>
                    <StatusBadge tone="neutral">
                      {fullEvaluation?.partScores?.[`part${part.part}` as 'part1' | 'part2' | 'part3'] ?? part.feedback?.overallBand ?? '--'}
                    </StatusBadge>
                  </div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{part.question}</p>
                  <p className="text-sm leading-7 text-gray-700 dark:text-gray-300">
                    {part.response?.trim() || 'No transcript was captured for this part.'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {part.feedback?.summary || 'Detailed notes are summarized in the sections below.'}
                  </p>
                </article>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title="Stronger answer examples by part"
            subtitle="These model answers show what a fuller, higher-band response could sound like for each part of the test."
          >
            <div className="grid gap-4 xl:grid-cols-3">
              {simulation.parts.map(part => (
                <article key={part.part} className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-base font-bold text-gray-900 dark:text-white">Part {part.part}</h4>
                    <StatusBadge tone="info">{part.topicTitle || `Part ${part.part}`}</StatusBadge>
                  </div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{part.question}</p>
                  <p className="text-sm leading-7 text-gray-700 dark:text-gray-300">
                    {buildModelAnswer(part.question, part.part)}
                  </p>
                </article>
              ))}
            </div>
          </SectionCard>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <SectionCard
              title="Corrections to study"
              subtitle="Review the language-level fixes that would lift the clarity and accuracy of your speaking."
            >
              <div className="space-y-3">
                {(fullEvaluation?.corrections || []).map(item => (
                  <div key={`${item.original}-${item.corrected}`} className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/50 p-4 space-y-2">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{item.original}</p>
                    <p className="text-sm text-emerald-700 dark:text-emerald-400">{item.corrected}</p>
                    <p className="text-xs leading-6 text-gray-600 dark:text-gray-400">{item.explanation}</p>
                  </div>
                ))}
                {fullEvaluation?.corrections?.length ? null : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No detailed corrections were saved for this simulation.</p>
                )}
              </div>
            </SectionCard>

            <SectionCard
              title="Upgrade plan"
              subtitle="Use these next-step actions to push toward a higher speaking band."
            >
              <div className="space-y-3">
                {(fullEvaluation?.suggestions || []).map(item => (
                  <div key={`${item.category}-${item.suggestion}`} className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/50 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge tone={item.priority === 'high' ? 'warning' : 'neutral'}>{item.priority} priority</StatusBadge>
                      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                        {item.category}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-7 text-gray-700 dark:text-gray-300">{item.suggestion}</p>
                  </div>
                ))}
                {fullEvaluation?.suggestions?.length ? null : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No additional improvement plan was generated for this simulation.</p>
                )}
              </div>
            </SectionCard>
          </div>
        </div>
      ) : null}
    </div>
  );
}
