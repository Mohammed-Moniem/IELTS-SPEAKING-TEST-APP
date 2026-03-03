import { Service } from 'typedi';

import { env } from '@env';
import { CSError } from '@errors/CSError';
import { CODES, HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { constructLogMessage } from '@lib/env/helpers';
import { Logger } from '@lib/logger';
import { UserModel } from '@models/UserModel';
import {
  IWritingBandUpgradeExamples,
  IWritingCriterionFeedback,
  IWritingEvidenceItem,
  IWritingOverallFeedback,
  WritingSubmissionModel
} from '@models/WritingSubmissionModel';
import { WritingTaskModel } from '@models/WritingTaskModel';

import { AIOrchestrationService } from './AIOrchestrationService';
import { UsageService } from './UsageService';

type WritingTrack = 'academic' | 'general';
type WritingTaskType = 'task1' | 'task2';
type CriterionKey =
  | 'taskAchievementOrResponse'
  | 'coherenceCohesion'
  | 'lexicalResource'
  | 'grammaticalRangeAccuracy';

type DetailCacheEntry = {
  expiresAt: number;
  submission: unknown;
};

@Service()
export class WritingService {
  private readonly log = new Logger(__filename);
  private readonly detailCache = new Map<string, DetailCacheEntry>();
  private deepBackfillInProgress = false;
  private deepBackfillScheduled = false;

  constructor(
    private readonly aiOrchestrationService: AIOrchestrationService,
    private readonly usageService: UsageService
  ) {}

  public async generateTask(
    userId: string,
    input: { track: WritingTrack; taskType: WritingTaskType },
    headers: IRequestHeaders
  ) {
    const logMessage = constructLogMessage(__filename, 'generateTask', headers);
    const fallbackContent = this.buildFallbackTaskContent(input.track, input.taskType);

    let task = await WritingTaskModel.findOne({
      track: input.track,
      taskType: input.taskType,
      active: true,
      autoPublished: true,
      title: { $exists: true, $nin: ['', null] },
      prompt: { $exists: true, $nin: ['', null] }
    }).sort({ updatedAt: -1 });

    if (!task) {
      const generated = await this.aiOrchestrationService.generateModuleTask(
        {
          module: 'writing',
          track: input.track,
          hints: [input.taskType]
        },
        { userId, plan: await this.getUserPlan(userId) }
      );
      const resolvedTaskType =
        generated.taskType === 'task1' || generated.taskType === 'task2' ? generated.taskType : input.taskType;
      const hasGeneratedTitle = typeof generated.title === 'string' && generated.title.trim().length > 0;
      const hasGeneratedPrompt = typeof generated.prompt === 'string' && generated.prompt.trim().length > 0;
      const generatedInstructions = Array.isArray(generated.instructions)
        ? generated.instructions.map(instruction => `${instruction ?? ''}`.trim()).filter(Boolean)
        : [];

      task = await WritingTaskModel.create({
        track: input.track,
        taskType: resolvedTaskType,
        title: hasGeneratedTitle ? generated.title.trim() : fallbackContent.title,
        prompt: hasGeneratedPrompt ? generated.prompt.trim() : fallbackContent.prompt,
        instructions: generatedInstructions.length > 0 ? generatedInstructions : fallbackContent.instructions,
        suggestedTimeMinutes:
          typeof generated.suggestedTimeMinutes === 'number' && generated.suggestedTimeMinutes > 0
            ? generated.suggestedTimeMinutes
            : fallbackContent.suggestedTimeMinutes,
        minimumWords:
          typeof generated.minimumWords === 'number' && generated.minimumWords > 0
            ? generated.minimumWords
            : fallbackContent.minimumWords,
        tags: generated.tags || [],
        source: 'ai',
        autoPublished: true,
        active: true
      });
    }

    if (!this.hasRenderableTask(task)) {
      task.title = fallbackContent.title;
      task.prompt = fallbackContent.prompt;
      task.instructions = task.instructions?.length ? task.instructions : fallbackContent.instructions;
      task.suggestedTimeMinutes =
        task.suggestedTimeMinutes > 0 ? task.suggestedTimeMinutes : fallbackContent.suggestedTimeMinutes;
      task.minimumWords = task.minimumWords > 0 ? task.minimumWords : fallbackContent.minimumWords;
      await task.save();
    }

    this.log.info(`${logMessage} :: Generated writing task ${task._id}`);

    return {
      taskId: task._id,
      track: task.track,
      taskType: task.taskType,
      title: task.title,
      prompt: task.prompt,
      instructions: task.instructions,
      suggestedTimeMinutes: task.suggestedTimeMinutes,
      minimumWords: task.minimumWords,
      tags: task.tags
    };
  }

  public async submitWriting(
    userId: string,
    taskId: string,
    responseText: string,
    durationSeconds: number,
    headers: IRequestHeaders
  ) {
    const logMessage = constructLogMessage(__filename, 'submitWriting', headers);
    const plan = await this.getUserPlan(userId);

    await this.usageService.assertModuleAllowance(userId, plan, 'writing', headers);

    const task = await WritingTaskModel.findById(taskId);
    if (!task) {
      throw new CSError(HTTP_STATUS_CODES.NOT_FOUND, CODES.NotFound, 'Writing task not found');
    }

    const normalizedResponse = this.normalizeEssayText(responseText);

    if (env.writing.preventDuplicateEvaluation) {
      const latestSubmission = await WritingSubmissionModel.findOne({ userId, taskId }).sort({ createdAt: -1 });
      if (
        latestSubmission &&
        this.normalizeEssayText(latestSubmission.responseText || '') === normalizedResponse &&
        normalizedResponse.length > 0
      ) {
        this.log.info(`${logMessage} :: Reusing latest submission ${latestSubmission._id} (duplicate response)`);
        this.setDetailCache(userId, String(latestSubmission._id), latestSubmission);
        return latestSubmission;
      }
    }

    const evaluation = await this.evaluateWritingWithTimeout(
      {
        prompt: task.prompt,
        responseText,
        taskType: task.taskType,
        track: task.track,
        deepFeedback: env.writing.deepFeedbackV2Enabled
      },
      userId,
      plan
    );

    const wordCount = responseText.trim().split(/\s+/).filter(Boolean).length;
    const normalizedEvaluation = this.normalizeEvaluationPayload(evaluation, {
      wordCount,
      taskType: task.taskType,
      track: task.track
    });

    const submission = await WritingSubmissionModel.create({
      userId,
      taskId,
      track: task.track,
      taskType: task.taskType,
      responseText,
      wordCount,
      durationSeconds: Math.max(0, Math.round(durationSeconds || 0)),
      overallBand: normalizedEvaluation.overallBand,
      breakdown: normalizedEvaluation.breakdown,
      feedbackVersion: normalizedEvaluation.feedbackVersion,
      deepFeedbackReady: normalizedEvaluation.deepFeedbackReady,
      feedback: normalizedEvaluation.feedback,
      model: evaluation.model,
      status: 'evaluated'
    });

    await this.usageService.incrementModuleUsage(userId, 'writing');
    this.setDetailCache(userId, String(submission._id), submission);
    this.scheduleDeepFeedbackBackfill();

    this.log.info(`${logMessage} :: Writing submission evaluated ${submission._id}`);

    return submission;
  }

  public async getSubmission(userId: string, submissionId: string) {
    const cached = this.getDetailCache(userId, submissionId);
    if (cached) {
      return cached;
    }

    let submission = await WritingSubmissionModel.findOne({
      _id: submissionId,
      userId
    }).populate('taskId');

    if (!submission) {
      throw new CSError(HTTP_STATUS_CODES.NOT_FOUND, CODES.NotFound, 'Writing submission not found');
    }

    try {
      submission = await this.enrichSubmissionDeepFeedback(submission);
    } catch (error) {
      this.log.warn(
        `Lazy deep feedback enrichment failed for ${submissionId}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
    this.setDetailCache(userId, submissionId, submission);

    return submission;
  }

  public async getHistory(
    userId: string,
    limit: number,
    offset: number,
    filters?: {
      track?: WritingTrack;
      from?: string;
      to?: string;
    }
  ) {
    const query: Record<string, unknown> = { userId };

    if (filters?.track) {
      query.track = filters.track;
    }

    if (filters?.from || filters?.to) {
      query.createdAt = {};
      if (filters.from) {
        (query.createdAt as Record<string, unknown>).$gte = new Date(filters.from);
      }
      if (filters.to) {
        (query.createdAt as Record<string, unknown>).$lte = new Date(filters.to);
      }
    }

    const history = await WritingSubmissionModel.find(query).sort({ createdAt: -1 }).skip(offset).limit(limit);
    this.scheduleDeepFeedbackBackfill();

    return history;
  }

  private async getUserPlan(userId: string) {
    const user = await UserModel.findById(userId).select('subscriptionPlan');
    if (!user) {
      throw new CSError(HTTP_STATUS_CODES.NOT_FOUND, CODES.NotFound, 'User not found');
    }

    return user.subscriptionPlan;
  }

  private getDetailCache(userId: string, submissionId: string) {
    if (!env.writing.detailCacheEnabled) return null;

    const key = `${userId}:${submissionId}`;
    const hit = this.detailCache.get(key);
    if (!hit) return null;

    if (hit.expiresAt <= Date.now()) {
      this.detailCache.delete(key);
      return null;
    }

    return hit.submission;
  }

  private setDetailCache(userId: string, submissionId: string, submission: unknown) {
    if (!env.writing.detailCacheEnabled) return;

    const ttlMs = Math.max(10, env.writing.detailCacheTtlSeconds) * 1000;
    this.detailCache.set(`${userId}:${submissionId}`, {
      expiresAt: Date.now() + ttlMs,
      submission
    });
  }

  private scheduleDeepFeedbackBackfill() {
    if (!env.writing.deepFeedbackV2Enabled || !env.writing.deepBackfillEnabled) return;
    if (this.deepBackfillInProgress || this.deepBackfillScheduled) return;

    this.deepBackfillScheduled = true;
    setTimeout(() => {
      void this.runDeepFeedbackBackfill().finally(() => {
        this.deepBackfillScheduled = false;
      });
    }, 25);
  }

  private async runDeepFeedbackBackfill() {
    if (this.deepBackfillInProgress) return;

    this.deepBackfillInProgress = true;
    try {
      const limit = Math.max(1, env.writing.deepBackfillBatchSize);
      const pending = await WritingSubmissionModel.find({
        $or: [{ feedbackVersion: { $ne: 'v2' } }, { deepFeedbackReady: { $ne: true } }]
      })
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('taskId');

      for (const submission of pending) {
        try {
          await this.enrichSubmissionDeepFeedback(submission);
        } catch (error) {
          this.log.warn(
            `Writing deep feedback backfill skipped for ${submission._id}: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    } finally {
      this.deepBackfillInProgress = false;
    }
  }

  private async enrichSubmissionDeepFeedback<T extends { [key: string]: unknown }>(submission: T) {
    const deepReady = Boolean((submission as any).deepFeedbackReady);
    const feedbackVersion = `${(submission as any).feedbackVersion || 'v1'}`;
    if (!env.writing.deepFeedbackV2Enabled || (feedbackVersion === 'v2' && deepReady)) {
      return submission;
    }

    const taskRef = (submission as any).taskId;
    const task = taskRef && typeof taskRef === 'object' && 'prompt' in taskRef ? taskRef : null;

    let prompt = typeof task?.prompt === 'string' ? task.prompt : '';
    let track = ((submission as any).track || task?.track || 'academic') as WritingTrack;
    let taskType = ((submission as any).taskType || task?.taskType || 'task2') as WritingTaskType;

    if (!prompt && taskRef) {
      const dbTask = await WritingTaskModel.findById(taskRef);
      if (dbTask) {
        prompt = dbTask.prompt;
        track = dbTask.track as WritingTrack;
        taskType = dbTask.taskType as WritingTaskType;
      }
    }

    if (!prompt) {
      prompt = this.buildFallbackTaskContent(track, taskType).prompt;
    }

    const responseText = `${(submission as any).responseText || ''}`;
    const plan = await this.getUserPlan(String((submission as any).userId));

    const evaluation = await this.evaluateWritingWithTimeout(
      {
        prompt,
        responseText,
        taskType,
        track,
        deepFeedback: true
      },
      String((submission as any).userId),
      plan
    );

    const wordCount = responseText.trim().split(/\s+/).filter(Boolean).length;
    const normalized = this.normalizeEvaluationPayload(evaluation, {
      wordCount,
      taskType,
      track
    });

    const doc = submission as any;
    doc.overallBand = normalized.overallBand;
    doc.breakdown = normalized.breakdown;
    doc.feedbackVersion = normalized.feedbackVersion;
    doc.deepFeedbackReady = normalized.deepFeedbackReady;
    doc.feedback = normalized.feedback;
    doc.model = evaluation.model || doc.model;

    if (typeof doc.save === 'function') {
      await doc.save();
      this.setDetailCache(String(doc.userId), String(doc._id), doc);
    }

    return doc as T;
  }

  private hasRenderableTask(task: { title?: string; prompt?: string } | null | undefined) {
    if (!task) return false;
    return Boolean(task.title?.trim() && task.prompt?.trim());
  }

  private buildFallbackTaskContent(track: WritingTrack, taskType: WritingTaskType) {
    if (taskType === 'task1' && track === 'academic') {
      return {
        title: 'Academic Task 1 Line Graph',
        prompt:
          'The line graph below shows changes in the number of international students in three countries between 2005 and 2025. Summarize the information by selecting and reporting the main features, and make comparisons where relevant.',
        instructions: [
          'Write at least 150 words.',
          'Include a clear overview of the main trends.',
          'Use comparative language and accurate data references.'
        ],
        suggestedTimeMinutes: 20,
        minimumWords: 150
      };
    }

    if (taskType === 'task1' && track === 'general') {
      return {
        title: 'General Task 1 Formal Letter',
        prompt:
          'You recently ordered study materials online, but the package arrived damaged. Write a letter to the store manager. In your letter: describe the problem, explain how it affects your preparation, and say what action you want the store to take.',
        instructions: [
          'Write at least 150 words.',
          'Address all bullet points in a clear paragraph structure.',
          'Use an appropriate formal tone throughout.'
        ],
        suggestedTimeMinutes: 20,
        minimumWords: 150
      };
    }

    return {
      title: track === 'academic' ? 'Academic Task 2 Opinion Essay' : 'General Task 2 Opinion Essay',
      prompt:
        'Some people believe governments should invest more in public libraries, while others think digital learning platforms are a better use of public money. Discuss both views and give your own opinion.',
      instructions: [
        'Write at least 250 words.',
        'Present a clear position and support it with specific examples.',
        'Use cohesive devices to connect your argument logically.'
      ],
      suggestedTimeMinutes: 40,
      minimumWords: 250
    };
  }

  private normalizeEvaluationPayload(
    evaluation: unknown,
    context: { wordCount: number; taskType: WritingTaskType; track: WritingTrack }
  ) {
    const raw = (evaluation as Record<string, unknown>) || {};
    const baseBand = this.clampBand(this.readNumber(raw.overallBand, this.estimateBandFromWordCount(context.wordCount)));
    const baseBreakdown = this.readObject(raw.breakdown);

    const taskResponse = this.clampBand(this.readNumber(baseBreakdown.taskResponse, baseBand));
    const coherenceCohesion = this.clampBand(this.readNumber(baseBreakdown.coherenceCohesion, baseBand));
    const lexicalResource = this.clampBand(this.readNumber(baseBreakdown.lexicalResource, baseBand));
    const grammaticalRangeAccuracy = this.clampBand(this.readNumber(baseBreakdown.grammaticalRangeAccuracy, baseBand));

    const feedbackRoot = this.readObject(raw.feedback);
    const summary =
      this.readString(feedbackRoot.summary) ||
      `Estimated band ${baseBand.toFixed(1)}. Improve lexical range and sentence control to lift consistency across all criteria.`;

    const criteria = this.normalizeCriteria(feedbackRoot, context, {
      taskResponse,
      coherenceCohesion,
      lexicalResource,
      grammaticalRangeAccuracy
    });

    const overall = this.normalizeOverallFeedback(feedbackRoot, summary, baseBand, criteria);

    const inlineSuggestions =
      this.readStringArray(feedbackRoot.inlineSuggestions) || this.deriveInlineSuggestions(criteria, context.taskType, context.track);
    const strengths = this.readStringArray(feedbackRoot.strengths) || this.deriveStrengths(criteria);
    const improvements = this.readStringArray(feedbackRoot.improvements) || this.deriveImprovements(criteria);

    const deepFeedbackEnabled = env.writing.deepFeedbackV2Enabled;
    const feedbackVersion: 'v1' | 'v2' = deepFeedbackEnabled ? 'v2' : 'v1';

    return {
      overallBand: baseBand,
      breakdown: {
        taskResponse,
        coherenceCohesion,
        lexicalResource,
        grammaticalRangeAccuracy
      },
      feedbackVersion,
      deepFeedbackReady: deepFeedbackEnabled,
      feedback: {
        summary,
        inlineSuggestions,
        strengths,
        improvements,
        ...(deepFeedbackEnabled
          ? {
              overall,
              criteria
            }
          : {})
      }
    };
  }

  private normalizeCriteria(
    feedbackRoot: Record<string, unknown>,
    context: { taskType: WritingTaskType; track: WritingTrack },
    breakdown: {
      taskResponse: number;
      coherenceCohesion: number;
      lexicalResource: number;
      grammaticalRangeAccuracy: number;
    }
  ): Record<CriterionKey, IWritingCriterionFeedback> {
    const rawCriteria = this.readObject(feedbackRoot.criteria);

    const taskLabel = context.taskType === 'task1' ? 'Task Achievement' : 'Task Response';

    return {
      taskAchievementOrResponse: this.normalizeCriterion(
        this.readObject(rawCriteria.taskAchievementOrResponse),
        taskLabel,
        breakdown.taskResponse
      ),
      coherenceCohesion: this.normalizeCriterion(
        this.readObject(rawCriteria.coherenceCohesion),
        'Coherence and Cohesion',
        breakdown.coherenceCohesion
      ),
      lexicalResource: this.normalizeCriterion(
        this.readObject(rawCriteria.lexicalResource),
        'Lexical Resource',
        breakdown.lexicalResource
      ),
      grammaticalRangeAccuracy: this.normalizeCriterion(
        this.readObject(rawCriteria.grammaticalRangeAccuracy),
        'Grammatical Range and Accuracy',
        breakdown.grammaticalRangeAccuracy
      )
    };
  }

  private normalizeCriterion(
    rawCriterion: Record<string, unknown>,
    label: string,
    fallbackBand: number
  ): IWritingCriterionFeedback {
    const strengths = this.readStringArray(rawCriterion.strengths) || [`${label} shows emerging control.`];
    const limitations =
      this.readStringArray(rawCriterion.limitations) || [`${label} needs tighter execution for higher-band consistency.`];

    const evidence = this.readEvidenceArray(rawCriterion.evidence);

    const bandUpgradeExamples = this.normalizeBandUpgradeExamples(this.readObject(rawCriterion.bandUpgradeExamples));

    return {
      band: this.clampBand(this.readNumber(rawCriterion.band, fallbackBand)),
      descriptorSummary:
        this.readString(rawCriterion.descriptorSummary) || `${label} is adequate but not yet consistently precise.`,
      strengths,
      limitations,
      evidence,
      whyNotHigher:
        this.readStringArray(rawCriterion.whyNotHigher) || [`Band 8+ requires more consistent ${label.toLowerCase()} control.`],
      howToReach8:
        this.readStringArray(rawCriterion.howToReach8) || [
          `Raise ${label.toLowerCase()} consistency by pairing each claim with specific support.`
        ],
      howToReach9:
        this.readStringArray(rawCriterion.howToReach9) || [
          `Sustain near-flawless ${label.toLowerCase()} performance across the full response.`
        ],
      targetedDrills:
        this.readStringArray(rawCriterion.targetedDrills) || [
          `${label} focused drill: rewrite one paragraph with explicit quality checks.`
        ],
      commonExaminerPenaltyTriggers:
        this.readStringArray(rawCriterion.commonExaminerPenaltyTriggers) || [
          `Inconsistent ${label.toLowerCase()} under time pressure.`
        ],
      bandUpgradeExamples
    };
  }

  private normalizeBandUpgradeExamples(rawExamples: Record<string, unknown>): IWritingBandUpgradeExamples {
    return {
      nextBandSnippet:
        this.readString(rawExamples.nextBandSnippet) ||
        'A higher-band revision should add sharper logic and more specific language choices.',
      band9Snippet:
        this.readString(rawExamples.band9Snippet) ||
        'A band-9 revision should remain concise, precise, and nearly error-free throughout.',
      differenceNotes:
        this.readStringArray(rawExamples.differenceNotes) || [
          'Band 8 usually improves precision and consistency.',
          'Band 9 adds sustained sophistication and near-perfect control.'
        ]
    };
  }

  private normalizeOverallFeedback(
    feedbackRoot: Record<string, unknown>,
    summary: string,
    baseBand: number,
    criteria: Record<CriterionKey, IWritingCriterionFeedback>
  ): IWritingOverallFeedback {
    const rawOverall = this.readObject(feedbackRoot.overall);
    const rankedCriteria = Object.entries(criteria)
      .sort(([, a], [, b]) => a.band - b.band)
      .map(([key]) => this.mapCriterionKeyToLabel(key as CriterionKey));

    return {
      band: this.clampBand(this.readNumber(rawOverall.band, baseBand)),
      label: this.readString(rawOverall.label) || `Band ${baseBand.toFixed(1)}`,
      examinerSummary:
        this.readString(rawOverall.examinerSummary) ||
        `${summary} Focus first on the lowest-scoring criterion for the fastest uplift.`,
      whyThisBand:
        this.readStringArray(rawOverall.whyThisBand) || [
          'Performance is solid in core areas but not consistently high-band in every criterion.'
        ],
      bandGapTo8:
        this.readStringArray(rawOverall.bandGapTo8) || [
          'Increase consistency in argument depth, cohesion control, and sentence accuracy.'
        ],
      bandGapTo9:
        this.readStringArray(rawOverall.bandGapTo9) || [
          'Demonstrate sophisticated control and near-error-free execution throughout.'
        ],
      priorityOrder: this.readStringArray(rawOverall.priorityOrder) || rankedCriteria,
      nextSteps24h:
        this.readStringArray(rawOverall.nextSteps24h) || [
          'Rewrite your introduction and first body paragraph with explicit band-8 targets.'
        ],
      nextSteps7d:
        this.readStringArray(rawOverall.nextSteps7d) || [
          'Complete three timed rewrites and compare errors against your criterion checklist.'
        ],
      nextSteps14d:
        this.readStringArray(rawOverall.nextSteps14d) || [
          'Submit two full essays and verify that recurring penalty triggers are removed.'
        ]
    };
  }

  private deriveInlineSuggestions(
    criteria: Record<CriterionKey, IWritingCriterionFeedback>,
    taskType: WritingTaskType,
    track: WritingTrack
  ) {
    const evidenceSuggestions = Object.values(criteria)
      .flatMap(criterion => criterion.evidence.map(item => item.practiceInstruction))
      .filter(Boolean)
      .slice(0, 3);

    if (evidenceSuggestions.length > 0) {
      return evidenceSuggestions;
    }

    return this.buildInlineSuggestions(taskType, track);
  }

  private deriveStrengths(criteria: Record<CriterionKey, IWritingCriterionFeedback>) {
    const values = Object.values(criteria)
      .flatMap(criterion => criterion.strengths)
      .filter(Boolean);

    return values.length > 0 ? Array.from(new Set(values)).slice(0, 4) : ['Maintains task relevance.'];
  }

  private deriveImprovements(criteria: Record<CriterionKey, IWritingCriterionFeedback>) {
    const values = Object.values(criteria)
      .flatMap(criterion => [...criterion.limitations, ...criterion.howToReach8])
      .filter(Boolean);

    return values.length > 0
      ? Array.from(new Set(values)).slice(0, 5)
      : ['Improve coherence between paragraphs.', 'Increase grammatical accuracy.'];
  }

  private estimateBandFromWordCount(wordCount: number) {
    const base = 4.5 + wordCount / 120;
    return this.clampBand(base);
  }

  private clampBand(value: number) {
    return Math.max(0, Math.min(9, Number(value.toFixed(1))));
  }

  private readNumber(value: unknown, fallback: number) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return fallback;
  }

  private readString(value: unknown) {
    if (typeof value !== 'string') return '';
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : '';
  }

  private readStringArray(value: unknown) {
    if (!Array.isArray(value)) return null;
    const normalized = value.map(item => `${item ?? ''}`.trim()).filter(Boolean);
    return normalized.length > 0 ? normalized : null;
  }

  private readObject(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    return value as Record<string, unknown>;
  }

  private readEvidenceArray(value: unknown): IWritingEvidenceItem[] {
    if (!Array.isArray(value)) return [];

    return value
      .map(item => this.readObject(item))
      .map(item => {
        const issue = this.readString(item.issue);
        const quotedText = this.readString(item.quotedText);
        const whyItCostsBand = this.readString(item.whyItCostsBand);
        const revision = this.readString(item.revision);
        const whyRevisionIsBetter = this.readString(item.whyRevisionIsBetter);
        const practiceInstruction = this.readString(item.practiceInstruction);

        if (!issue && !quotedText && !revision) {
          return null;
        }

        return {
          issue: issue || 'Sentence-level clarity issue detected.',
          quotedText: quotedText || 'No direct quote provided.',
          whyItCostsBand:
            whyItCostsBand ||
            'This pattern lowers rubric consistency because the meaning or precision is weakened.',
          revision: revision || 'Rewrite the sentence with clearer structure and precision.',
          whyRevisionIsBetter:
            whyRevisionIsBetter || 'The revision clarifies logic and improves examiner readability.',
          practiceInstruction:
            practiceInstruction || 'Practice rewriting similar sentences before your next timed submission.'
        } satisfies IWritingEvidenceItem;
      })
      .filter((item): item is IWritingEvidenceItem => Boolean(item));
  }

  private mapCriterionKeyToLabel(key: CriterionKey) {
    switch (key) {
      case 'taskAchievementOrResponse':
        return 'Task Achievement/Response';
      case 'coherenceCohesion':
        return 'Coherence and Cohesion';
      case 'lexicalResource':
        return 'Lexical Resource';
      case 'grammaticalRangeAccuracy':
        return 'Grammatical Range and Accuracy';
      default:
        return 'Criterion';
    }
  }

  private normalizeEssayText(value: string) {
    return value.trim().replace(/\s+/g, ' ');
  }

  private async evaluateWritingWithTimeout(
    input: {
      prompt: string;
      responseText: string;
      taskType: WritingTaskType;
      track: WritingTrack;
      deepFeedback?: boolean;
    },
    userId: string,
    plan: Awaited<ReturnType<WritingService['getUserPlan']>>
  ) {
    const timeoutMs = Math.max(5_000, env.writing.evaluationTimeoutMs);

    try {
      return await Promise.race([
        this.aiOrchestrationService.evaluateWriting(input, { userId, plan }),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error(`Writing evaluation timeout after ${timeoutMs}ms`)), timeoutMs);
        })
      ]);
    } catch (error) {
      this.log.warn(`Writing evaluation fallback triggered: ${error instanceof Error ? error.message : String(error)}`);
      return {
        model: 'timeout-fallback'
      } as Record<string, unknown>;
    }
  }

  private buildInlineSuggestions(taskType: WritingTaskType, track: WritingTrack) {
    if (taskType === 'task1' && track === 'academic') {
      return [
        'Start with a one-sentence overview before giving figures.',
        'Group similar trends instead of describing each line separately.',
        'Use comparison words such as whereas, while, and by contrast.'
      ];
    }

    if (taskType === 'task1' && track === 'general') {
      return [
        'Cover every bullet point explicitly in separate short paragraphs.',
        'Match tone to the situation (formal, semi-formal, or informal).',
        'End with a clear action request or next step.'
      ];
    }

    return [
      'State your position clearly in the introduction.',
      'Use one core idea per body paragraph with specific evidence.',
      'Proofread for article use, verb tense consistency, and punctuation.'
    ];
  }
}
