'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { PageHeader, SectionCard, MetricCard } from '@/components/ui/v2';
import { apiRequest, ApiError } from '@/lib/api/client';
import {
  WritingBandUpgradeExamples,
  WritingCriterionDetails,
  WritingDeepFeedback,
  WritingOverallBandDetails,
  WritingSubmission,
  WritingTask
} from '@/lib/types';

type CriterionKey = keyof WritingDeepFeedback;
const deepFeedbackUiEnabled = (process.env.NEXT_PUBLIC_WRITING_DEEP_FEEDBACK_V2 || 'true') === 'true';

const fallbackOverall = (band: number, summary: string): WritingOverallBandDetails => ({
  band,
  label: `Band ${band.toFixed(1)}`,
  examinerSummary: summary,
  whyThisBand: ['This band reflects current consistency across rubric criteria.'],
  bandGapTo8: ['Improve criterion consistency and reduce recurring sentence-level errors.'],
  bandGapTo9: ['Maintain sophisticated control with near-error-free execution throughout.'],
  priorityOrder: ['Task Achievement/Response', 'Coherence and Cohesion', 'Lexical Resource', 'Grammatical Range and Accuracy'],
  nextSteps24h: ['Rewrite one paragraph using clearer logic and stronger evidence support.'],
  nextSteps7d: ['Complete three timed practice essays and compare rubric weaknesses.'],
  nextSteps14d: ['Submit two full essays with targeted criterion drills between attempts.']
});

const fallbackCriterion = (label: string, band: number): WritingCriterionDetails => ({
  band,
  descriptorSummary: `${label} feedback is limited for this older submission.`,
  strengths: ['Basic strengths are present but detailed rubric reasoning was not recorded.'],
  limitations: ['Re-opened evaluation can provide richer examiner-level detail.'],
  evidence: [],
  whyNotHigher: [`To move higher, ${label.toLowerCase()} must be more consistent under exam conditions.`],
  howToReach8: [`Build repeatable ${label.toLowerCase()} quality across every paragraph.`],
  howToReach9: [`Sustain precise, near-flawless ${label.toLowerCase()} control throughout the response.`],
  targetedDrills: [`Run one focused ${label.toLowerCase()} drill before your next timed attempt.`],
  commonExaminerPenaltyTriggers: [`Inconsistent ${label.toLowerCase()} execution across longer responses.`],
  bandUpgradeExamples: {
    nextBandSnippet: 'Band-8 style revision should be more precise and explicitly supported.',
    band9Snippet: 'Band-9 style revision should be concise, nuanced, and nearly error-free.',
    differenceNotes: ['Band 8 raises consistency.', 'Band 9 adds sustained sophistication.']
  }
});

const fallbackBandUpgradeExamples = (): WritingBandUpgradeExamples => ({
  nextBandSnippet: 'Band-8 revision: improve precision and explicit support in each claim.',
  band9Snippet: 'Band-9 revision: maintain nuanced argumentation with near-error-free language control.',
  differenceNotes: ['Band 8 requires consistency.', 'Band 9 requires sustained excellence in all criteria.']
});

export default function WritingHistoryDetailPage() {
  const params = useParams<{ submissionId: string }>();
  const [submission, setSubmission] = useState<WritingSubmission | null>(null);
  const [error, setError] = useState('');
  const [showOverallDetails, setShowOverallDetails] = useState(true);
  const [activeCriterion, setActiveCriterion] = useState<CriterionKey>('taskAchievementOrResponse');

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

  const breakdown = useMemo(() => {
    const breakdownRaw = (submission?.breakdown as unknown as Record<string, unknown>) || {};
    return {
      taskResponse: Number(breakdownRaw.taskResponse || breakdownRaw.taskAchievement || 0),
      coherenceCohesion: Number(breakdownRaw.coherenceCohesion || breakdownRaw.coherenceAndCohesion || 0),
      lexicalResource: Number(breakdownRaw.lexicalResource || 0),
      grammaticalRangeAccuracy: Number(
        breakdownRaw.grammaticalRangeAccuracy || breakdownRaw.grammaticalRangeAndAccuracy || 0
      )
    };
  }, [submission]);

  const feedback = {
    summary:
      typeof submission?.feedback?.summary === 'string' && submission.feedback.summary.trim().length > 0
        ? submission.feedback.summary
        : 'Feedback is unavailable for this submission.',
    inlineSuggestions: Array.isArray(submission?.feedback?.inlineSuggestions) ? submission.feedback.inlineSuggestions : [],
    strengths: Array.isArray(submission?.feedback?.strengths) ? submission.feedback.strengths : [],
    improvements: Array.isArray(submission?.feedback?.improvements) ? submission.feedback.improvements : []
  };

  const taskRef = submission?.taskId;
  const submissionTask = taskRef && typeof taskRef === 'object' ? (taskRef as WritingTask) : null;
  const track = submission?.track || submissionTask?.track || 'academic';
  const taskType = submission?.taskType || submissionTask?.taskType || 'task2';
  const taskTitle = submissionTask?.title || `Writing ${taskType === 'task1' ? 'Task 1' : 'Task 2'}`;
  const taskPrompt = submissionTask?.prompt || 'Prompt unavailable for this historical submission.';
  const minimumWords =
    typeof submissionTask?.minimumWords === 'number' ? submissionTask.minimumWords : taskType === 'task2' ? 250 : 150;
  const suggestedTime =
    typeof submissionTask?.suggestedTimeMinutes === 'number'
      ? submissionTask.suggestedTimeMinutes
      : taskType === 'task2'
        ? 40
        : 20;
  const responseText =
    typeof submission?.responseText === 'string' && submission.responseText.trim().length > 0
      ? submission.responseText
      : 'Response text unavailable.';

  const deepFeedbackReady = useMemo(
    () =>
      Boolean(
        submission?.deepFeedbackReady ||
          submission?.feedbackVersion === 'v2' ||
          submission?.feedback?.overall ||
          submission?.feedback?.criteria
      ),
    [submission]
  );

  const overallBand = Number(submission?.overallBand || 0);

  const overallDetails: WritingOverallBandDetails = useMemo(() => {
    const raw = submission?.feedback?.overall;
    if (!raw) {
      return fallbackOverall(overallBand, feedback.summary);
    }

    return {
      band: Number(raw.band || overallBand || 0),
      label: typeof raw.label === 'string' && raw.label.trim().length > 0 ? raw.label : `Band ${overallBand.toFixed(1)}`,
      examinerSummary:
        typeof raw.examinerSummary === 'string' && raw.examinerSummary.trim().length > 0
          ? raw.examinerSummary
          : feedback.summary,
      whyThisBand: Array.isArray(raw.whyThisBand) ? raw.whyThisBand : [],
      bandGapTo8: Array.isArray(raw.bandGapTo8) ? raw.bandGapTo8 : [],
      bandGapTo9: Array.isArray(raw.bandGapTo9) ? raw.bandGapTo9 : [],
      priorityOrder: Array.isArray(raw.priorityOrder) ? raw.priorityOrder : [],
      nextSteps24h: Array.isArray(raw.nextSteps24h) ? raw.nextSteps24h : [],
      nextSteps7d: Array.isArray(raw.nextSteps7d) ? raw.nextSteps7d : [],
      nextSteps14d: Array.isArray(raw.nextSteps14d) ? raw.nextSteps14d : []
    };
  }, [feedback.summary, overallBand, submission]);

  const criteria: WritingDeepFeedback = useMemo(() => {
    const raw = submission?.feedback?.criteria;
    const taskLabel = taskType === 'task1' ? 'Task Achievement' : 'Task Response';

    return {
      taskAchievementOrResponse: raw?.taskAchievementOrResponse || fallbackCriterion(taskLabel, breakdown.taskResponse),
      coherenceCohesion: raw?.coherenceCohesion || fallbackCriterion('Coherence and Cohesion', breakdown.coherenceCohesion),
      lexicalResource: raw?.lexicalResource || fallbackCriterion('Lexical Resource', breakdown.lexicalResource),
      grammaticalRangeAccuracy:
        raw?.grammaticalRangeAccuracy ||
        fallbackCriterion('Grammatical Range and Accuracy', breakdown.grammaticalRangeAccuracy)
    };
  }, [submission, taskType, breakdown]);

  const criterionLabels: Record<CriterionKey, string> = {
    taskAchievementOrResponse: taskType === 'task1' ? 'Task Achievement' : 'Task Response',
    coherenceCohesion: 'Coherence & Cohesion',
    lexicalResource: 'Lexical Resource',
    grammaticalRangeAccuracy: 'Grammar'
  };

  useEffect(() => {
    setActiveCriterion('taskAchievementOrResponse');
  }, [taskType]);

  const activeCriterionDetails = criteria[activeCriterion];
  const activeCriterionExamples = activeCriterionDetails.bandUpgradeExamples || fallbackBandUpgradeExamples();

  const strengths =
    Array.isArray(feedback.strengths) && feedback.strengths.length > 0
      ? feedback.strengths
      : [
          'Task focus is maintained for most of the response.',
          'Core ideas are understandable to the reader.'
        ];

  const improvements =
    Array.isArray(feedback.improvements) && feedback.improvements.length > 0
      ? feedback.improvements
      : [
          'Add more concrete support and examples for each main point.',
          'Increase sentence variety while keeping grammar consistent.',
          'Use stronger paragraph transitions to improve coherence.'
        ];

  const inlineSuggestions =
    Array.isArray(feedback.inlineSuggestions) && feedback.inlineSuggestions.length > 0
      ? feedback.inlineSuggestions
      : [
          'Open this submission in the editor and improve one paragraph at a time.',
          'Focus on clearer linking between ideas and evidence.',
          'Proofread final sentences for tense and article accuracy.'
        ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Writing Submission Detail"
        subtitle={`Submission ID: ${params.submissionId}`}
        actions={
          <Link
            href={`/app/writing?open_submission=${encodeURIComponent(params.submissionId)}`}
            className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Back to Writing
          </Link>
        }
      />

      {submission ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <button
              type="button"
              onClick={() => setShowOverallDetails(prev => !prev)}
              onKeyDown={event => {
                if (!deepFeedbackUiEnabled) return;
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setShowOverallDetails(prev => !prev);
                }
              }}
              className={`text-left rounded-2xl ${deepFeedbackUiEnabled ? 'focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500' : 'cursor-default'}`}
              aria-expanded={deepFeedbackUiEnabled ? showOverallDetails : undefined}
              aria-controls={deepFeedbackUiEnabled ? 'overall-band-details' : undefined}
              disabled={!deepFeedbackUiEnabled}
            >
              <MetricCard
                tone="brand"
                label="Overall Band"
                value={Number(submission.overallBand || 0).toFixed(1)}
                helper={
                  deepFeedbackUiEnabled
                    ? showOverallDetails
                      ? 'Hide detailed rationale'
                      : 'Show detailed rationale'
                    : undefined
                }
              />
            </button>
            <MetricCard
              tone="neutral"
              label={taskType === 'task1' ? 'Task Achievement' : 'Task Response'}
              value={Number(breakdown.taskResponse || 0).toFixed(1)}
            />
            <MetricCard tone="neutral" label="Coherence" value={Number(breakdown.coherenceCohesion || 0).toFixed(1)} />
            <MetricCard tone="neutral" label="Lexical" value={Number(breakdown.lexicalResource || 0).toFixed(1)} />
            <MetricCard tone="neutral" label="Grammar" value={Number(breakdown.grammaticalRangeAccuracy || 0).toFixed(1)} />
          </div>

          {deepFeedbackUiEnabled && showOverallDetails ? (
            <SectionCard title="Overall Band Analysis" className="border-violet-200 dark:border-violet-500/30" >
              <div id="overall-band-details" className="space-y-5">
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{overallDetails.examinerSummary}</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <article className="rounded-xl border border-gray-200 dark:border-gray-800 p-4 bg-gray-50/70 dark:bg-gray-900/40">
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-2">Why this band</h4>
                    <ul className="space-y-1.5 text-sm text-gray-700 dark:text-gray-300 list-disc pl-5">
                      {(overallDetails.whyThisBand || []).map(item => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </article>
                  <article className="rounded-xl border border-amber-200 dark:border-amber-500/30 p-4 bg-amber-50/60 dark:bg-amber-500/10">
                    <h4 className="text-sm font-bold text-amber-900 dark:text-amber-300 mb-2">What blocks Band 8</h4>
                    <ul className="space-y-1.5 text-sm text-amber-800 dark:text-amber-200 list-disc pl-5">
                      {(overallDetails.bandGapTo8 || []).map(item => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </article>
                  <article className="rounded-xl border border-red-200 dark:border-red-500/30 p-4 bg-red-50/60 dark:bg-red-500/10">
                    <h4 className="text-sm font-bold text-red-900 dark:text-red-300 mb-2">What blocks Band 9</h4>
                    <ul className="space-y-1.5 text-sm text-red-800 dark:text-red-200 list-disc pl-5">
                      {(overallDetails.bandGapTo9 || []).map(item => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </article>
                  <article className="rounded-xl border border-violet-200 dark:border-violet-500/30 p-4 bg-violet-50/60 dark:bg-violet-500/10">
                    <h4 className="text-sm font-bold text-violet-900 dark:text-violet-300 mb-2">Priority fix order</h4>
                    <ol className="space-y-1.5 text-sm text-violet-800 dark:text-violet-200 list-decimal pl-5">
                      {(overallDetails.priorityOrder || []).map(item => (
                        <li key={item}>{item}</li>
                      ))}
                    </ol>
                  </article>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <article className="rounded-xl border border-gray-200 dark:border-gray-800 p-4">
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-2">Action plan (24h)</h4>
                    <ul className="space-y-1.5 text-sm text-gray-700 dark:text-gray-300 list-disc pl-5">
                      {(overallDetails.nextSteps24h || []).map(item => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </article>
                  <article className="rounded-xl border border-gray-200 dark:border-gray-800 p-4">
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-2">Action plan (7d)</h4>
                    <ul className="space-y-1.5 text-sm text-gray-700 dark:text-gray-300 list-disc pl-5">
                      {(overallDetails.nextSteps7d || []).map(item => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </article>
                  <article className="rounded-xl border border-gray-200 dark:border-gray-800 p-4">
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-2">Action plan (14d)</h4>
                    <ul className="space-y-1.5 text-sm text-gray-700 dark:text-gray-300 list-disc pl-5">
                      {(overallDetails.nextSteps14d || []).map(item => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </article>
                </div>
              </div>
            </SectionCard>
          ) : null}

          {deepFeedbackUiEnabled && !deepFeedbackReady ? (
            <SectionCard title="Deep feedback status" className="border-amber-200 dark:border-amber-500/30">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                Detailed rubric analysis is still being prepared for this older submission. You can continue using the
                summary below, and deeper criterion feedback will appear automatically when available.
              </p>
            </SectionCard>
          ) : null}

          <SectionCard
            title="Submission Context"
            actions={
              <Link
                href={`/app/writing?open_submission=${encodeURIComponent(params.submissionId)}`}
                className="rounded-lg border border-violet-200 dark:border-violet-500/30 px-3 py-1.5 text-xs font-semibold text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-500/10"
              >
                Open In Editor
              </Link>
            }
          >
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-violet-100 dark:bg-violet-500/20 px-3 py-1 text-xs font-bold text-violet-700 dark:text-violet-300">{track}</span>
              <span className="rounded-full bg-gray-100 dark:bg-gray-800 px-3 py-1 text-xs font-bold text-gray-700 dark:text-gray-300">
                {taskType === 'task1' ? 'Task 1' : 'Task 2'}
              </span>
              <span className="rounded-full bg-gray-100 dark:bg-gray-800 px-3 py-1 text-xs font-bold text-gray-700 dark:text-gray-300">
                Min {minimumWords} words
              </span>
              <span className="rounded-full bg-gray-100 dark:bg-gray-800 px-3 py-1 text-xs font-bold text-gray-700 dark:text-gray-300">
                Target {suggestedTime} min
              </span>
            </div>
            <h3 className="mt-4 text-base font-bold text-gray-900 dark:text-white">{taskTitle}</h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-700 dark:text-gray-300">{taskPrompt}</p>
          </SectionCard>

          <SectionCard title="Your Response">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700 dark:text-gray-300">{responseText}</p>
          </SectionCard>

          <SectionCard title="Feedback Summary">
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{feedback.summary}</p>
          </SectionCard>

          {deepFeedbackUiEnabled ? (
            <SectionCard title="Criterion Deep-Dive" subtitle="Tutor-style criterion analysis, evidence, and band-upgrade guidance.">
            <div className="space-y-5">
              <div className="flex flex-wrap gap-2" role="tablist" aria-label="Writing criteria">
                {(Object.keys(criteria) as CriterionKey[]).map(key => {
                  const active = key === activeCriterion;
                  return (
                    <button
                      key={key}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                        active
                          ? 'bg-violet-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                      }`}
                      onClick={() => setActiveCriterion(key)}
                    >
                      {criterionLabels[key]}
                    </button>
                  );
                })}
              </div>

              <article className="rounded-2xl border border-gray-200 dark:border-gray-800 p-5 space-y-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h4 className="text-base font-bold text-gray-900 dark:text-white">{criterionLabels[activeCriterion]}</h4>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                      {activeCriterionDetails.descriptorSummary}
                    </p>
                  </div>
                  <span className="rounded-xl bg-violet-100 dark:bg-violet-500/20 px-3 py-1.5 text-sm font-bold text-violet-700 dark:text-violet-300">
                    Band {Number(activeCriterionDetails.band || 0).toFixed(1)}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <article className="rounded-xl border border-emerald-200 dark:border-emerald-500/30 p-4 bg-emerald-50/60 dark:bg-emerald-500/10">
                    <h5 className="text-sm font-bold text-emerald-900 dark:text-emerald-300 mb-2">Strengths</h5>
                    <ul className="space-y-1.5 text-sm text-emerald-800 dark:text-emerald-200 list-disc pl-5">
                      {(activeCriterionDetails.strengths || []).map(item => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </article>
                  <article className="rounded-xl border border-amber-200 dark:border-amber-500/30 p-4 bg-amber-50/60 dark:bg-amber-500/10">
                    <h5 className="text-sm font-bold text-amber-900 dark:text-amber-300 mb-2">Limitations</h5>
                    <ul className="space-y-1.5 text-sm text-amber-800 dark:text-amber-200 list-disc pl-5">
                      {(activeCriterionDetails.limitations || []).map(item => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </article>
                </div>

                <div className="space-y-3">
                  <h5 className="text-sm font-bold text-gray-900 dark:text-white">Sentence-anchored evidence</h5>
                  {activeCriterionDetails.evidence.length > 0 ? (
                    <div className="space-y-3">
                      {activeCriterionDetails.evidence.map((item, index) => (
                        <article key={`${item.issue}-${index}`} className="rounded-xl border border-gray-200 dark:border-gray-800 p-4 bg-gray-50/60 dark:bg-gray-900/40 space-y-2">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">Issue: {item.issue}</p>
                          <p className="text-sm text-gray-700 dark:text-gray-300"><span className="font-semibold">Quoted text:</span> “{item.quotedText}”</p>
                          <p className="text-sm text-gray-700 dark:text-gray-300"><span className="font-semibold">Why it costs band:</span> {item.whyItCostsBand}</p>
                          <p className="text-sm text-violet-800 dark:text-violet-300"><span className="font-semibold">Revision:</span> {item.revision}</p>
                          <p className="text-sm text-gray-700 dark:text-gray-300"><span className="font-semibold">Why revision is better:</span> {item.whyRevisionIsBetter}</p>
                          <p className="text-sm text-gray-700 dark:text-gray-300"><span className="font-semibold">Practice instruction:</span> {item.practiceInstruction}</p>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400">No sentence-level examples were provided for this criterion.</p>
                  )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <article className="rounded-xl border border-gray-200 dark:border-gray-800 p-4">
                    <h5 className="text-sm font-bold text-gray-900 dark:text-white mb-2">Why not higher</h5>
                    <ul className="space-y-1.5 text-sm text-gray-700 dark:text-gray-300 list-disc pl-5">
                      {(activeCriterionDetails.whyNotHigher || []).map(item => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </article>
                  <article className="rounded-xl border border-violet-200 dark:border-violet-500/30 p-4 bg-violet-50/60 dark:bg-violet-500/10">
                    <h5 className="text-sm font-bold text-violet-900 dark:text-violet-300 mb-2">How to reach Band 8</h5>
                    <ul className="space-y-1.5 text-sm text-violet-800 dark:text-violet-200 list-disc pl-5">
                      {(activeCriterionDetails.howToReach8 || []).map(item => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </article>
                  <article className="rounded-xl border border-fuchsia-200 dark:border-fuchsia-500/30 p-4 bg-fuchsia-50/60 dark:bg-fuchsia-500/10">
                    <h5 className="text-sm font-bold text-fuchsia-900 dark:text-fuchsia-300 mb-2">How to reach Band 9</h5>
                    <ul className="space-y-1.5 text-sm text-fuchsia-800 dark:text-fuchsia-200 list-disc pl-5">
                      {(activeCriterionDetails.howToReach9 || []).map(item => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </article>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <article className="rounded-xl border border-gray-200 dark:border-gray-800 p-4">
                    <h5 className="text-sm font-bold text-gray-900 dark:text-white mb-2">Targeted drills</h5>
                    <ul className="space-y-1.5 text-sm text-gray-700 dark:text-gray-300 list-disc pl-5">
                      {(activeCriterionDetails.targetedDrills || []).map(item => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </article>
                  <article className="rounded-xl border border-red-200 dark:border-red-500/30 p-4 bg-red-50/60 dark:bg-red-500/10">
                    <h5 className="text-sm font-bold text-red-900 dark:text-red-300 mb-2">Common examiner penalty triggers</h5>
                    <ul className="space-y-1.5 text-sm text-red-800 dark:text-red-200 list-disc pl-5">
                      {(activeCriterionDetails.commonExaminerPenaltyTriggers || []).map(item => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </article>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <article className="rounded-xl border border-violet-200 dark:border-violet-500/30 p-4 bg-violet-50/60 dark:bg-violet-500/10">
                    <h5 className="text-sm font-bold text-violet-900 dark:text-violet-300 mb-2">Band 8 sample snippet</h5>
                    <p className="text-sm text-violet-800 dark:text-violet-200 leading-relaxed">{activeCriterionExamples.nextBandSnippet}</p>
                  </article>
                  <article className="rounded-xl border border-fuchsia-200 dark:border-fuchsia-500/30 p-4 bg-fuchsia-50/60 dark:bg-fuchsia-500/10">
                    <h5 className="text-sm font-bold text-fuchsia-900 dark:text-fuchsia-300 mb-2">Band 9 sample snippet</h5>
                    <p className="text-sm text-fuchsia-800 dark:text-fuchsia-200 leading-relaxed">{activeCriterionExamples.band9Snippet}</p>
                  </article>
                </div>

                <article className="rounded-xl border border-gray-200 dark:border-gray-800 p-4">
                  <h5 className="text-sm font-bold text-gray-900 dark:text-white mb-2">What changed from Band 8 to 9</h5>
                  <ul className="space-y-1.5 text-sm text-gray-700 dark:text-gray-300 list-disc pl-5">
                    {(activeCriterionExamples.differenceNotes || []).map(item => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </article>
              </article>
            </div>
            </SectionCard>
          ) : null}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SectionCard title="Strengths">
              {strengths.length > 0 ? (
                <ul className="space-y-2">
                  {strengths.map(item => (
                    <li key={item} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <span className="material-symbols-outlined text-[16px] text-emerald-500 mt-0.5 flex-shrink-0">check_circle</span>
                      {item}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">No strengths were provided in this evaluation.</p>
              )}
            </SectionCard>

            <SectionCard title="Improvements">
              {improvements.length > 0 ? (
                <ul className="space-y-2">
                  {improvements.map(item => (
                    <li key={item} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <span className="material-symbols-outlined text-[16px] text-amber-500 mt-0.5 flex-shrink-0">report</span>
                      {item}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">No improvement points were provided in this evaluation.</p>
              )}
            </SectionCard>
          </div>

          {inlineSuggestions.length > 0 ? (
            <SectionCard title="Inline Suggestions">
              <ul className="space-y-2">
                {inlineSuggestions.map(item => (
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
