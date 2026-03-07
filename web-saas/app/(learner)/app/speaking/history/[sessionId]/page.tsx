'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { ApiError, webApi } from '@/lib/api/client';
import { MetricCard, PageHeader, SectionCard, StatusBadge } from '@/components/ui/v2';
import { SpeakingSessionDetail } from '@/lib/types';

const buildLibraryHref = (kind: 'collocations' | 'vocabulary', seed?: string) => {
  const query = new URLSearchParams();
  query.set('module', 'speaking');
  if (seed) query.set('search', seed);
  return `/app/library/${kind}${query.toString() ? `?${query.toString()}` : ''}`;
};

const countWords = (value?: string) =>
  String(value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

const formatSessionTimestamp = (session: SpeakingSessionDetail | null) => {
  const raw = session?.completedAt || session?.createdAt || session?.startedAt;
  if (!raw) return 'Saved speaking attempt';

  try {
    return new Date(raw).toLocaleString();
  } catch {
    return 'Saved speaking attempt';
  }
};

const getBandVerdict = (overallBand: number | null, wordCount: number) => {
  if (overallBand == null) {
    return {
      title: 'Feedback is still limited',
      body: 'Your report is available, but some evaluation detail is missing. Use the transcript and action plan below to guide the next attempt.'
    };
  }

  if (wordCount < 12) {
    return {
      title: 'Too little language to score confidently',
      body: 'The response is so short that the evaluator cannot hear enough idea development, vocabulary range, or sentence control.'
    };
  }

  if (overallBand >= 7.5) {
    return {
      title: 'Strong performance with room to sharpen',
      body: 'You already sound clear and organized. Focus on richer vocabulary and more precise support to push toward the next band.'
    };
  }

  if (overallBand >= 6.5) {
    return {
      title: 'Good foundation, but not fully developed yet',
      body: 'Your response is understandable and reasonably controlled, but it still needs stronger detail, range, and follow-through to feel complete.'
    };
  }

  return {
    title: 'This answer needs more development',
    body: 'You need a fuller answer with clearer ideas, better support, and more natural sentence flow so the evaluator can hear real speaking ability.'
  };
};

const buildQuestionExample = (question: string) => {
  const normalized = question.trim().replace(/\?$/, '');

  if (/journey|trip|travel/i.test(normalized)) {
    return 'One memorable journey I would describe is a family trip I took during a school holiday. We spent several days exploring a new city, trying local food, and visiting historical places. What made it unforgettable was the time I spent with my family and the confidence I gained from navigating somewhere unfamiliar. Overall, it stayed in my mind because it helped me relax, learn something new, and become more independent.';
  }

  if (/food|cook|cooking/i.test(normalized)) {
    return 'The type of food I most enjoy cooking at home is simple homemade dishes like rice, pasta, or grilled chicken. I enjoy making them because the ingredients are easy to prepare and I can adjust the flavor depending on who I am cooking for. For example, on weekends I sometimes cook with my family, and that makes the whole experience more enjoyable. Overall, I like this kind of food because it is comforting, practical, and easy to share.';
  }

  if (/hometown|city|place/i.test(normalized)) {
    return 'I would describe my hometown as a busy but welcoming place with a strong sense of community. One thing I really like about it is that there is always a mix of modern life and local tradition. For example, you can find busy markets, small family businesses, and public spaces where people meet in the evening. That is why I feel proud of it and usually recommend it to visitors.';
  }

  if (/skill/i.test(normalized)) {
    return 'A skill I learned recently was managing my time more carefully. At first, it was difficult because I used to do everything at the last minute. However, I started planning my day in advance and setting smaller goals, which made my schedule less stressful. As a result, I became more productive and much more confident about balancing work and personal responsibilities.';
  }

  if (/challenge|problem/i.test(normalized)) {
    return 'One challenge I remember clearly was solving a difficult problem under time pressure. At first, I felt stressed because I was not sure where to begin, but I broke the task into smaller parts and asked for advice when necessary. That helped me stay calm and make better decisions. In the end, the experience taught me how important patience and planning can be.';
  }

  if (/music/i.test(normalized)) {
    return 'The kind of music I enjoy most is music that helps me relax while still keeping me focused. I usually listen to it when I am working, studying, or traveling because it creates a calm mood. For example, if I have had a stressful day, listening to familiar songs helps me reset my mind. That is why music is an important part of my daily routine.';
  }

  if (/^describe\b/i.test(normalized)) {
    const subject = normalized.replace(/^describe\s+/i, '');
    return `One ${subject} I would talk about is something that left a strong impression on me. I would first explain when it happened and who was involved, then add one or two concrete details that made it memorable. After that, I would describe how I felt at the time and why the experience still matters to me now. That structure makes the answer sound fuller, clearer, and more personal.`;
  }

  return 'I would begin with a direct answer, then explain the main reason behind it, add one specific example from my own experience, and finish with a short conclusion. That structure makes the response clearer, more natural, and easier for the evaluator to follow.';
};

const buildWhyThisScore = ({
  summary,
  firstImprovement,
  weakestLabel,
  wordCount
}: {
  summary?: string;
  firstImprovement?: string;
  weakestLabel?: string;
  wordCount: number;
}) => {
  const items = [
    summary,
    wordCount < 20 ? 'The answer is very short, so the evaluator cannot hear enough development to reward fluency, vocabulary, and grammar range.' : undefined,
    weakestLabel ? `${weakestLabel} is the weakest scoring area right now, so it is likely pulling the overall band down.` : undefined,
    firstImprovement ? `Your clearest next improvement is: ${firstImprovement}` : undefined
  ].filter(Boolean) as string[];

  return Array.from(new Set(items)).slice(0, 4);
};

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
  const overallBand = typeof feedback?.overallBand === 'number' ? feedback.overallBand : null;
  const transcript = session?.userResponse?.trim() || 'No transcript is available for this session.';
  const transcriptWordCount = countWords(session?.userResponse);
  const strengths =
    feedback?.strengths && feedback.strengths.length > 0
      ? feedback.strengths
      : ['You answered the prompt directly. Keep that directness, but add fuller support and more personal detail.'];
  const improvements =
    feedback?.improvements && feedback.improvements.length > 0
      ? feedback.improvements
      : ['Add one specific example and a final reflection so the answer sounds more developed and complete.'];

  const metricRows = useMemo(() => {
    const breakdown = feedback?.bandBreakdown;
    return [
      { label: 'Fluency & Coherence', value: breakdown?.fluency },
      { label: 'Lexical Resource', value: breakdown?.lexicalResource },
      { label: 'Grammar', value: breakdown?.grammaticalRange },
      { label: 'Pronunciation', value: breakdown?.pronunciation }
    ];
  }, [feedback?.bandBreakdown]);

  const weakestMetric = useMemo(() => {
    return metricRows
      .filter(row => typeof row.value === 'number')
      .sort((a, b) => (a.value as number) - (b.value as number))[0] || null;
  }, [metricRows]);

  const verdict = useMemo(() => getBandVerdict(overallBand, transcriptWordCount), [overallBand, transcriptWordCount]);

  const whyThisScore = useMemo(
    () =>
      buildWhyThisScore({
        summary: feedback?.summary,
        firstImprovement: improvements[0],
        weakestLabel: weakestMetric?.label,
        wordCount: transcriptWordCount
      }),
    [feedback?.summary, improvements, transcriptWordCount, weakestMetric?.label]
  );

  const strongerAnswer = useMemo(
    () => buildQuestionExample(session?.question || session?.topicTitle || 'this speaking prompt'),
    [session?.question, session?.topicTitle]
  );

  const strongerAnswerReasons = useMemo(() => {
    return [
      'It answers the prompt directly in the opening sentence.',
      'It adds specific supporting detail instead of stopping after one short idea.',
      improvements[0] || 'It ends with a clear reason or reflection so the answer feels complete.'
    ].slice(0, 3);
  }, [improvements]);

  const weakestFocusSeed = useMemo(() => {
    if (improvements[0]) return improvements[0];
    return weakestMetric?.label || '';
  }, [improvements, weakestMetric?.label]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={session?.topicTitle || 'Speaking session report'}
        subtitle={session?.question || 'See your transcript, score explanation, and next speaking actions.'}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge tone="brand">Speaking full report</StatusBadge>
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
        <div className="space-y-4">
          <div className="rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 animate-pulse">
            <div className="h-4 w-28 rounded bg-gray-200 dark:bg-gray-800" />
            <div className="mt-4 h-10 w-48 rounded bg-gray-200 dark:bg-gray-800" />
            <div className="mt-3 h-4 w-full max-w-2xl rounded bg-gray-200 dark:bg-gray-800" />
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="h-32 rounded-2xl bg-gray-100 dark:bg-gray-800" />
              <div className="h-32 rounded-2xl bg-gray-100 dark:bg-gray-800" />
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="h-56 rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 animate-pulse" />
            <div className="h-56 rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 animate-pulse" />
          </div>
        </div>
      ) : null}

      {!loading && error ? (
        <div className="rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      ) : null}

      {!loading && session ? (
        <div className="space-y-6">
          <section className="rounded-3xl border border-violet-200 dark:border-violet-500/20 bg-gradient-to-br from-violet-50 via-white to-white dark:from-violet-500/10 dark:via-gray-900 dark:to-gray-900 p-6 lg:p-8">
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_320px]">
              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge tone={session.status === 'completed' ? 'success' : 'neutral'}>
                    {session.status === 'completed' ? 'Completed report' : 'In progress'}
                  </StatusBadge>
                  <StatusBadge tone="neutral">{formatSessionTimestamp(session)}</StatusBadge>
                  <StatusBadge tone="neutral">Session ID: {sessionId}</StatusBadge>
                </div>

                <div className="space-y-3">
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-violet-700 dark:text-violet-400">
                    Speaking debrief
                  </p>
                  <h2 className="text-3xl font-black tracking-tight text-gray-900 dark:text-white">
                    {verdict.title}
                  </h2>
                  <p className="max-w-3xl text-base leading-8 text-gray-700 dark:text-gray-300">{verdict.body}</p>
                </div>

                <div className="rounded-2xl border border-violet-100 dark:border-violet-500/20 bg-white/80 dark:bg-gray-950/40 p-4">
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">Best next focus</h3>
                  <p className="mt-2 text-sm leading-7 text-gray-700 dark:text-gray-300">
                    {weakestMetric
                      ? `${weakestMetric.label} is the weakest rubric area in this attempt. Improve that first, then retry speaking with a fuller answer.`
                      : 'Use the transcript and model answer below to build a longer, more specific response before your next attempt.'}
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
                    {feedback?.summary || 'Use the sections below to understand this score and improve the next answer.'}
                  </p>
                </div>

                <div className="space-y-3">
                  <Link
                    href="/app/speaking"
                    className="inline-flex w-full items-center justify-center rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-700"
                  >
                    Practice again
                  </Link>
                  <Link
                    href={buildLibraryHref('collocations', weakestFocusSeed)}
                    className="inline-flex w-full items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    Review collocations
                  </Link>
                  <Link
                    href={buildLibraryHref('vocabulary', weakestFocusSeed)}
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
            subtitle="A plain-language explanation of what the evaluator likely heard in this response."
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
                  Quick context
                </p>
                <div className="mt-3 space-y-2 text-sm text-gray-700 dark:text-gray-300">
                  <p>Prompt type: Speaking practice</p>
                  <p>Transcript length: {Math.max(transcriptWordCount, 1)} words</p>
                  <p>Weakest focus: {weakestMetric?.label || 'General development'}</p>
                </div>
              </div>
            </div>
          </SectionCard>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <SectionCard
              title="Your transcript"
              subtitle="This is the response text used to generate the current speaking evaluation."
            >
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge tone="neutral">{transcriptWordCount} words</StatusBadge>
                  {transcriptWordCount < 20 ? (
                    <StatusBadge tone="warning">Short response limited the analysis</StatusBadge>
                  ) : null}
                </div>
                <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-900/50 p-4">
                  <p className="whitespace-pre-wrap text-sm leading-7 text-gray-700 dark:text-gray-300">{transcript}</p>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Example stronger answer"
              subtitle="Model response to show a stronger structure. This is not your original answer."
            >
              <div className="space-y-4">
                <div className="rounded-2xl border border-violet-200 dark:border-violet-500/20 bg-violet-50/70 dark:bg-violet-500/10 p-4">
                  <p className="text-sm leading-7 text-gray-700 dark:text-gray-200">{strongerAnswer}</p>
                </div>
                <div>
                  <h4 className="text-sm font-bold uppercase tracking-[0.16em] text-gray-600 dark:text-gray-300">
                    Why this is stronger
                  </h4>
                  <ul className="mt-3 space-y-2">
                    {strongerAnswerReasons.map(item => (
                      <li key={item} className="flex items-start gap-3 text-sm leading-7 text-gray-700 dark:text-gray-300">
                        <span className="material-symbols-outlined mt-1 text-[18px] text-emerald-500">check_circle</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </SectionCard>
          </div>

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {metricRows.map(row => (
              <MetricCard
                key={row.label}
                tone={row.label === weakestMetric?.label ? 'brand' : 'neutral'}
                label={row.label}
                value={typeof row.value === 'number' ? row.value.toFixed(1) : '--'}
                helper={row.label === weakestMetric?.label ? 'Lowest scoring area' : undefined}
              />
            ))}
          </section>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <SectionCard title="Strengths">
              <ul className="space-y-2">
                {strengths.map(item => (
                  <li key={item} className="flex items-start gap-3 text-sm leading-7 text-gray-700 dark:text-gray-300">
                    <span className="material-symbols-outlined mt-1 text-[18px] text-emerald-500">check_circle</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </SectionCard>

            <SectionCard title="Next improvements">
              <ul className="space-y-2">
                {improvements.map(item => (
                  <li key={item} className="flex items-start gap-3 text-sm leading-7 text-gray-700 dark:text-gray-300">
                    <span className="material-symbols-outlined mt-1 text-[18px] text-amber-500">arrow_upward</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </SectionCard>
          </div>

          <SectionCard title="Next step plan" subtitle="Use the result above to choose one clear action before your next speaking attempt.">
            <div className="grid gap-4 lg:grid-cols-3">
              <Link
                href="/app/speaking"
                className="rounded-2xl border border-violet-200 dark:border-violet-500/20 bg-violet-50 dark:bg-violet-500/10 p-4 transition-colors hover:bg-violet-100 dark:hover:bg-violet-500/15"
              >
                <p className="text-sm font-bold text-violet-800 dark:text-violet-300">Practice again</p>
                <p className="mt-2 text-sm leading-6 text-gray-700 dark:text-gray-300">
                  Return to speaking practice and apply a fuller answer structure on the next attempt.
                </p>
              </Link>
              <Link
                href={buildLibraryHref('collocations', weakestFocusSeed)}
                className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <p className="text-sm font-bold text-gray-900 dark:text-white">Build supporting language</p>
                <p className="mt-2 text-sm leading-6 text-gray-700 dark:text-gray-300">
                  Review collocations related to your weakest area before the next response.
                </p>
              </Link>
              <Link
                href={buildLibraryHref('vocabulary', weakestFocusSeed)}
                className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <p className="text-sm font-bold text-gray-900 dark:text-white">Upgrade vocabulary</p>
                <p className="mt-2 text-sm leading-6 text-gray-700 dark:text-gray-300">
                  Collect better alternatives and reuse them when you retry the topic.
                </p>
              </Link>
            </div>
          </SectionCard>
        </div>
      ) : null}
    </div>
  );
}
