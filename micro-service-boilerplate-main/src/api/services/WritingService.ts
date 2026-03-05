import { Service } from 'typedi';

import { env } from '@env';
import { CSError } from '@errors/CSError';
import { CODES, HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { constructLogMessage } from '@lib/env/helpers';
import { getPgPool } from '@lib/db/pgClient';
import { Logger } from '@lib/logger';
import { UserModel } from '@models/UserModel';
import {
  IWritingBandUpgradeExamples,
  IWritingCriterionFeedback,
  IWritingEvidenceItem,
  IWritingOverallFeedback,
  WritingSubmissionModel
} from '@models/WritingSubmissionModel';
import { WritingTaskDocument, WritingTaskModel } from '@models/WritingTaskModel';

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

type WritingTaskSnapshot = {
  taskId: string;
  track: WritingTrack;
  taskType: WritingTaskType;
  title: string;
  prompt: string;
  instructions: string[];
  suggestedTimeMinutes: number;
  minimumWords: number;
  tags: string[];
};

type WritingTaskRecord = WritingTaskSnapshot & {
  _id: string;
  source?: 'bank' | 'ai';
  active?: boolean;
  autoPublished?: boolean;
};

@Service()
export class WritingService {
  private readonly log = new Logger(__filename);
  private readonly detailCache = new Map<string, DetailCacheEntry>();
  private readonly taskSnapshotCache = new Map<string, { expiresAt: number; snapshot: WritingTaskSnapshot }>();
  private deepBackfillInProgress = false;
  private deepBackfillScheduled = false;
  private readonly generatedTaskHistory = new Map<
    string,
    { expiresAt: number; taskIds: string[]; promptFingerprints: string[] }
  >();
  private readonly GENERATED_TASK_HISTORY_TTL_MS = 1000 * 60 * 60 * 24 * 30;
  private readonly TASK_SNAPSHOT_CACHE_TTL_MS = 1000 * 60 * 30;

  constructor(
    private readonly aiOrchestrationService: AIOrchestrationService,
    private readonly usageService: UsageService
  ) {}

  public async generateTask(
    userId: string,
    input: { track: WritingTrack; taskType: WritingTaskType; excludeTaskIds?: string[] },
    headers: IRequestHeaders
  ) {
    const logMessage = constructLogMessage(__filename, 'generateTask', headers);
    const plan = await this.getUserPlan(userId);

    // Block writing task generation as soon as the user reaches plan allowance.
    await this.usageService.assertModuleAllowance(userId, plan, 'writing', headers);

    const seenTaskIds = await this.getSeenTaskIds(userId, input.track, input.taskType);
    const recentlyGeneratedTaskIds = this.getRecentlyGeneratedTaskIds(userId, input.track, input.taskType);
    const recentlyGeneratedFingerprints = this.getRecentlyGeneratedFingerprints(userId, input.track, input.taskType);
    const requestExcludedTaskIds = (input.excludeTaskIds || []).map(value => `${value || ''}`.trim()).filter(Boolean);
    const excludedTaskIds = new Set<string>([
      ...seenTaskIds,
      ...recentlyGeneratedTaskIds,
      ...requestExcludedTaskIds
    ]);
    const fallbackContent = this.buildFallbackTaskContent(input.track, input.taskType, recentlyGeneratedFingerprints);

    const baseTaskFilter = {
      track: input.track,
      taskType: input.taskType,
      active: true,
      autoPublished: true,
      title: { $exists: true, $nin: ['', null] },
      prompt: { $exists: true, $nin: ['', null] }
    };
    const bankTaskFilter = { ...baseTaskFilter, source: 'bank' as const };

    let task = await this.pickRandomTask(bankTaskFilter, excludedTaskIds, recentlyGeneratedFingerprints);
    if (!task) {
      task = await this.pickRandomTask(baseTaskFilter, excludedTaskIds, recentlyGeneratedFingerprints);
    }

    if (!task) {
      const generated = await this.aiOrchestrationService.generateModuleTask(
        {
          module: 'writing',
          track: input.track,
          hints: [input.taskType, `seed-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`]
        },
        { userId, plan }
      );
      const resolvedTaskType = input.taskType;
      const hasGeneratedTitle = typeof generated.title === 'string' && generated.title.trim().length > 0;
      const hasGeneratedPrompt = typeof generated.prompt === 'string' && generated.prompt.trim().length > 0;
      const candidateTitle = hasGeneratedTitle ? generated.title.trim() : fallbackContent.title;
      const candidatePrompt = hasGeneratedPrompt ? generated.prompt.trim() : fallbackContent.prompt;
      const candidateFingerprint = this.buildTaskPromptFingerprint(candidateTitle, candidatePrompt, input.track, input.taskType);
      const shouldRotateFallback = recentlyGeneratedFingerprints.has(candidateFingerprint);
      const resolvedFallback = shouldRotateFallback
        ? this.buildFallbackTaskContent(input.track, input.taskType, recentlyGeneratedFingerprints)
        : fallbackContent;
      const generatedInstructions = Array.isArray(generated.instructions)
        ? generated.instructions.map(instruction => `${instruction ?? ''}`.trim()).filter(Boolean)
        : [];

      task = await WritingTaskModel.create({
        track: input.track,
        taskType: resolvedTaskType,
        title: shouldRotateFallback ? resolvedFallback.title : candidateTitle,
        prompt: shouldRotateFallback ? resolvedFallback.prompt : candidatePrompt,
        instructions: generatedInstructions.length > 0 ? generatedInstructions : resolvedFallback.instructions,
        suggestedTimeMinutes:
          typeof generated.suggestedTimeMinutes === 'number' && generated.suggestedTimeMinutes > 0
            ? generated.suggestedTimeMinutes
            : resolvedFallback.suggestedTimeMinutes,
        minimumWords:
          typeof generated.minimumWords === 'number' && generated.minimumWords > 0
            ? generated.minimumWords
            : resolvedFallback.minimumWords,
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

      if (typeof (task as { save?: unknown }).save === 'function') {
        await (task as unknown as { save: () => Promise<unknown> }).save();
      }
    }

    this.log.info(`${logMessage} :: Generated writing task ${task._id}`);
    this.rememberGeneratedTask(userId, input.track, input.taskType, String(task._id), task.title || '', task.prompt || '');

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

  private async pickRandomTask(
    filter: Record<string, unknown>,
    excludedTaskIds: Set<string>,
    excludedFingerprints: Set<string>
  ): Promise<WritingTaskRecord | WritingTaskDocument | null> {
    const localExcludedIds = new Set<string>(excludedTaskIds);

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const candidates = await this.fetchRandomTaskCandidates(filter, Array.from(localExcludedIds), 64);
      if (!candidates.length) {
        return null;
      }

      for (const picked of candidates) {
        const fingerprint = this.buildTaskPromptFingerprint(
          picked.title || '',
          picked.prompt || '',
          picked.track as WritingTrack,
          picked.taskType as WritingTaskType
        );
        if (!excludedFingerprints.has(fingerprint)) {
          return picked;
        }
        localExcludedIds.add(String(picked._id));
      }
    }

    return null;
  }

  private async fetchRandomTaskCandidates(
    filter: Record<string, unknown>,
    excludedTaskIds: string[],
    limit: number
  ): Promise<WritingTaskRecord[]> {
    const track = filter.track as WritingTrack | undefined;
    const taskType = filter.taskType as WritingTaskType | undefined;
    if (!track || !taskType) return [];

    const params: any[] = [track, taskType];
    let sql = `
      SELECT id, data, created_at, updated_at
      FROM writing_tasks
      WHERE data->>'track' = $1
        AND data->>'taskType' = $2
        AND COALESCE((data->>'active')::boolean, false) = true
        AND COALESCE((data->>'autoPublished')::boolean, false) = true
        AND COALESCE(data->>'title', '') <> ''
        AND COALESCE(data->>'prompt', '') <> ''
    `;

    if (typeof filter.source === 'string' && filter.source.trim().length > 0) {
      params.push(filter.source);
      sql += ` AND data->>'source' = $${params.length}`;
    }

    const exclusionList = excludedTaskIds.filter(Boolean);
    if (exclusionList.length > 0) {
      params.push(exclusionList);
      sql += ` AND id <> ALL($${params.length}::text[])`;
    }

    params.push(Math.max(1, Math.min(500, limit)));
    sql += ` ORDER BY RANDOM() LIMIT $${params.length}`;

    const rows = await getPgPool().query(sql, params);
    return rows.rows.map(row => this.mapTaskRow(row)).filter(task => this.hasRenderableTask(task));
  }

  private mapTaskRow(row: { id: string; data: Record<string, any> }): WritingTaskRecord {
    const data = row.data || {};
    return {
      _id: row.id,
      taskId: row.id,
      track: (data.track || 'academic') as WritingTrack,
      taskType: (data.taskType || 'task2') as WritingTaskType,
      title: `${data.title || ''}`.trim(),
      prompt: `${data.prompt || ''}`.trim(),
      instructions: Array.isArray(data.instructions) ? data.instructions.map(entry => `${entry ?? ''}`.trim()).filter(Boolean) : [],
      suggestedTimeMinutes:
        typeof data.suggestedTimeMinutes === 'number' && data.suggestedTimeMinutes > 0
          ? data.suggestedTimeMinutes
          : data.taskType === 'task2'
            ? 40
            : 20,
      minimumWords:
        typeof data.minimumWords === 'number' && data.minimumWords > 0
          ? data.minimumWords
          : data.taskType === 'task2'
            ? 250
            : 150,
      tags: Array.isArray(data.tags) ? data.tags.map(entry => `${entry}`) : [],
      source: data.source === 'ai' ? 'ai' : 'bank',
      active: Boolean(data.active),
      autoPublished: Boolean(data.autoPublished)
    };
  }

  private async getSeenTaskIds(userId: string, track: WritingTrack, taskType: WritingTaskType): Promise<Set<string>> {
    const rows = await getPgPool().query(
      `
        SELECT data->>'taskId' AS task_id
        FROM writing_submissions
        WHERE data->>'userId' = $1
          AND data->>'track' = $2
          AND data->>'taskType' = $3
          AND COALESCE(data->>'taskId', '') <> ''
        ORDER BY created_at DESC
        LIMIT 5000
      `,
      [userId, track, taskType]
    );

    return new Set<string>(rows.rows.map(row => `${row.task_id || ''}`.trim()).filter(Boolean));
  }

  private getGeneratedTaskHistoryKey(userId: string, track: WritingTrack, taskType: WritingTaskType) {
    return `${userId}:${track}:${taskType}`;
  }

  private getRecentlyGeneratedTaskIds(userId: string, track: WritingTrack, taskType: WritingTaskType): Set<string> {
    const key = this.getGeneratedTaskHistoryKey(userId, track, taskType);
    const entry = this.generatedTaskHistory.get(key);
    if (!entry) return new Set();
    if (entry.expiresAt < Date.now()) {
      this.generatedTaskHistory.delete(key);
      return new Set();
    }
    return new Set(entry.taskIds);
  }

  private getRecentlyGeneratedFingerprints(userId: string, track: WritingTrack, taskType: WritingTaskType): Set<string> {
    const key = this.getGeneratedTaskHistoryKey(userId, track, taskType);
    const entry = this.generatedTaskHistory.get(key);
    if (!entry) return new Set();
    if (entry.expiresAt < Date.now()) {
      this.generatedTaskHistory.delete(key);
      return new Set();
    }
    return new Set(entry.promptFingerprints || []);
  }

  private rememberGeneratedTask(
    userId: string,
    track: WritingTrack,
    taskType: WritingTaskType,
    taskId: string,
    title: string,
    prompt: string
  ) {
    const key = this.getGeneratedTaskHistoryKey(userId, track, taskType);
    const existing = this.generatedTaskHistory.get(key);
    const isFresh = existing?.expiresAt && existing.expiresAt > Date.now();
    const currentIds = isFresh ? existing.taskIds : [];
    const currentFingerprints = isFresh ? existing.promptFingerprints || [] : [];
    const next = [taskId, ...currentIds.filter(id => id !== taskId)].slice(0, 3000);
    const promptFingerprint = this.buildTaskPromptFingerprint(title, prompt, track, taskType);
    const nextFingerprints = [promptFingerprint, ...currentFingerprints.filter(fp => fp !== promptFingerprint)].slice(
      0,
      3000
    );
    this.generatedTaskHistory.set(key, {
      taskIds: next,
      promptFingerprints: nextFingerprints,
      expiresAt: Date.now() + this.GENERATED_TASK_HISTORY_TTL_MS
    });
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
      taskSnapshot: this.toTaskSnapshot(task),
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

    let submission = await this.fetchSubmissionByIdSql(userId, submissionId);

    if (!submission) {
      throw new CSError(HTTP_STATUS_CODES.NOT_FOUND, CODES.NotFound, 'Writing submission not found');
    }

    if (this.shouldEnrichDeepFeedback(submission)) {
      try {
        const doc = await WritingSubmissionModel.findOne({
          _id: submissionId,
          userId
        });
        if (doc) {
          await this.enrichSubmissionDeepFeedback(doc);
          const refreshed = await this.fetchSubmissionByIdSql(userId, submissionId);
          if (refreshed) {
            submission = refreshed;
          }
        }
      } catch (error) {
        this.log.warn(
          `Lazy deep feedback enrichment failed for ${submissionId}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
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
    const history = await this.fetchHistorySql(userId, limit, offset, filters);
    this.scheduleDeepFeedbackBackfill();

    return history;
  }

  private shouldEnrichDeepFeedback(submission: any): boolean {
    if (!env.writing.deepFeedbackV2Enabled) return false;
    return submission?.feedbackVersion !== 'v2' || submission?.deepFeedbackReady !== true;
  }

  private toTaskSnapshot(task: {
    _id?: unknown;
    taskId?: unknown;
    track?: unknown;
    taskType?: unknown;
    title?: unknown;
    prompt?: unknown;
    instructions?: unknown;
    suggestedTimeMinutes?: unknown;
    minimumWords?: unknown;
    tags?: unknown;
  }): WritingTaskSnapshot {
    const resolvedTaskType = (task.taskType === 'task1' ? 'task1' : 'task2') as WritingTaskType;
    return {
      taskId: String(task.taskId || task._id || ''),
      track: (task.track === 'general' ? 'general' : 'academic') as WritingTrack,
      taskType: resolvedTaskType,
      title: `${task.title || ''}`.trim(),
      prompt: `${task.prompt || ''}`.trim(),
      instructions: Array.isArray(task.instructions) ? task.instructions.map(entry => `${entry ?? ''}`.trim()).filter(Boolean) : [],
      suggestedTimeMinutes:
        typeof task.suggestedTimeMinutes === 'number' && task.suggestedTimeMinutes > 0
          ? task.suggestedTimeMinutes
          : resolvedTaskType === 'task2'
            ? 40
            : 20,
      minimumWords:
        typeof task.minimumWords === 'number' && task.minimumWords > 0
          ? task.minimumWords
          : resolvedTaskType === 'task2'
            ? 250
            : 150,
      tags: Array.isArray(task.tags) ? task.tags.map(entry => `${entry}`) : []
    };
  }

  private mapSubmissionRow(row: {
    id: string;
    data: Record<string, any>;
    created_at: Date | string;
    updated_at: Date | string;
  }) {
    const payload = { ...(row.data || {}) };
    payload._id = row.id;
    if (!payload.createdAt && row.created_at) {
      payload.createdAt = row.created_at instanceof Date ? row.created_at.toISOString() : new Date(row.created_at).toISOString();
    }
    if (!payload.updatedAt && row.updated_at) {
      payload.updatedAt = row.updated_at instanceof Date ? row.updated_at.toISOString() : new Date(row.updated_at).toISOString();
    }
    return payload;
  }

  private resolveSubmissionTaskId(submission: Record<string, any>): string {
    const raw = submission.taskId;
    if (!raw) return '';
    if (typeof raw === 'string') return raw;
    if (typeof raw === 'object') {
      const rawTask = raw as Record<string, unknown>;
      return `${rawTask.taskId || rawTask._id || ''}`.trim();
    }
    return `${raw}`.trim();
  }

  private async fetchTaskSnapshotsByIds(taskIds: string[]): Promise<Map<string, WritingTaskSnapshot>> {
    const ids = Array.from(new Set(taskIds.filter(Boolean)));
    if (!ids.length) return new Map();

    const output = new Map<string, WritingTaskSnapshot>();
    const missing: string[] = [];

    ids.forEach(id => {
      const cacheKey = `${id}`;
      const cached = this.taskSnapshotCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        output.set(id, cached.snapshot);
        return;
      }
      this.taskSnapshotCache.delete(cacheKey);
      missing.push(id);
    });

    if (!missing.length) return output;

    const rows = await getPgPool().query(`SELECT id, data FROM writing_tasks WHERE id = ANY($1::text[])`, [missing]);

    rows.rows.forEach(row => {
      const snapshot = this.toTaskSnapshot(this.mapTaskRow(row));
      output.set(row.id, snapshot);
      this.taskSnapshotCache.set(row.id, {
        snapshot,
        expiresAt: Date.now() + this.TASK_SNAPSHOT_CACHE_TTL_MS
      });
    });
    return output;
  }

  private attachTaskSnapshots(submissions: Array<Record<string, any>>, snapshots: Map<string, WritingTaskSnapshot>) {
    submissions.forEach(submission => {
      const existingSnapshot = submission.taskSnapshot && typeof submission.taskSnapshot === 'object'
        ? (submission.taskSnapshot as WritingTaskSnapshot)
        : null;

      const taskId = this.resolveSubmissionTaskId(submission) || existingSnapshot?.taskId || '';
      const resolvedSnapshot = existingSnapshot || snapshots.get(taskId);
      if (!resolvedSnapshot) return;

      submission.taskSnapshot = resolvedSnapshot;
      submission.taskId = resolvedSnapshot;
      if (!submission.track) submission.track = resolvedSnapshot.track;
      if (!submission.taskType) submission.taskType = resolvedSnapshot.taskType;
    });
  }

  private async fetchSubmissionByIdSql(userId: string, submissionId: string): Promise<Record<string, any> | null> {
    const result = await getPgPool().query(
      `
        SELECT id, data, created_at, updated_at
        FROM writing_submissions
        WHERE id = $1
          AND data->>'userId' = $2
        LIMIT 1
      `,
      [submissionId, userId]
    );

    const row = result.rows[0];
    if (!row) return null;

    const submission = this.mapSubmissionRow(row);
    const taskId = this.resolveSubmissionTaskId(submission);
    if (taskId) {
      const snapshots = await this.fetchTaskSnapshotsByIds([taskId]);
      this.attachTaskSnapshots([submission], snapshots);
    }
    return submission;
  }

  private async fetchHistorySql(
    userId: string,
    limit: number,
    offset: number,
    filters?: {
      track?: WritingTrack;
      from?: string;
      to?: string;
    }
  ): Promise<Record<string, any>[]> {
    const params: any[] = [userId];
    let sql = `
      SELECT id, data, created_at, updated_at
      FROM writing_submissions
      WHERE data->>'userId' = $1
    `;

    if (filters?.track) {
      params.push(filters.track);
      sql += ` AND data->>'track' = $${params.length}`;
    }

    if (filters?.from) {
      const fromDate = new Date(filters.from);
      if (!Number.isNaN(fromDate.getTime())) {
        params.push(fromDate.toISOString());
        sql += ` AND created_at >= $${params.length}::timestamptz`;
      }
    }

    if (filters?.to) {
      const toDate = new Date(filters.to);
      if (!Number.isNaN(toDate.getTime())) {
        params.push(toDate.toISOString());
        sql += ` AND created_at <= $${params.length}::timestamptz`;
      }
    }

    params.push(Math.max(1, Math.min(200, limit)));
    const limitParam = `$${params.length}`;
    params.push(Math.max(0, offset));
    const offsetParam = `$${params.length}`;

    sql += ` ORDER BY created_at DESC LIMIT ${limitParam} OFFSET ${offsetParam}`;

    const rows = await getPgPool().query(sql, params);
    const submissions = rows.rows.map(row => this.mapSubmissionRow(row));

    const taskIds = submissions.map(item => this.resolveSubmissionTaskId(item)).filter(Boolean);
    const snapshots = await this.fetchTaskSnapshotsByIds(taskIds);
    this.attachTaskSnapshots(submissions, snapshots);
    return submissions;
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

  private hasRenderableTask(task: unknown) {
    if (!task || typeof task !== 'object') return false;
    const candidate = task as { title?: string; prompt?: string };
    return Boolean(candidate.title?.trim() && candidate.prompt?.trim());
  }

  private buildTaskPromptFingerprint(title: string, prompt: string, track: WritingTrack, taskType: WritingTaskType) {
    const normalized = `${track}|${taskType}|${(title || '').trim().toLowerCase()}|${(prompt || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')}`;
    return normalized;
  }

  private pickFallbackVariant<T extends { title: string; prompt: string }>(
    variants: T[],
    track: WritingTrack,
    taskType: WritingTaskType,
    excludedFingerprints?: Set<string>
  ): T {
    const shuffled = [...variants].sort(() => Math.random() - 0.5);
    for (const variant of shuffled) {
      const fingerprint = this.buildTaskPromptFingerprint(variant.title, variant.prompt, track, taskType);
      if (!excludedFingerprints?.has(fingerprint)) {
        return variant;
      }
    }
    return shuffled[0] || variants[0];
  }

  private buildFallbackTaskContent(track: WritingTrack, taskType: WritingTaskType, excludedFingerprints?: Set<string>) {
    if (taskType === 'task1' && track === 'academic') {
      return this.pickFallbackVariant(
        [
          {
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
          },
          {
            title: 'Academic Task 1 Bar Chart',
            prompt:
              'The bar chart compares the percentage of graduates employed in six sectors in 2010 and 2025. Summarize the information by selecting and reporting the main features, and make comparisons where relevant.',
            instructions: [
              'Write at least 150 words.',
              'Highlight the biggest rises and falls.',
              'Use concise comparisons rather than listing all numbers.'
            ],
            suggestedTimeMinutes: 20,
            minimumWords: 150
          },
          {
            title: 'Academic Task 1 Table',
            prompt:
              'The table shows average monthly household spending in four categories across three cities in 2015 and 2025. Summarize the information by selecting and reporting the main features, and make comparisons where relevant.',
            instructions: [
              'Write at least 150 words.',
              'Group similar figures into clear comparison points.',
              'Provide a brief overall summary before details.'
            ],
            suggestedTimeMinutes: 20,
            minimumWords: 150
          }
        ],
        track,
        taskType,
        excludedFingerprints
      );
    }

    if (taskType === 'task1' && track === 'general') {
      return this.pickFallbackVariant(
        [
          {
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
          },
          {
            title: 'General Task 1 Semi-Formal Letter',
            prompt:
              'A training center where you attend evening IELTS classes has changed its schedule. Write a letter to the coordinator. In your letter: explain your concern, describe how this affects you, and suggest a practical solution.',
            instructions: [
              'Write at least 150 words.',
              'Keep a polite, semi-formal tone.',
              'Cover all requested points clearly.'
            ],
            suggestedTimeMinutes: 20,
            minimumWords: 150
          },
          {
            title: 'General Task 1 Informal Letter',
            prompt:
              'A friend is planning to move to your city for IELTS preparation. Write a letter to your friend. In your letter: recommend an area to live in, suggest two study resources, and explain how to manage study with daily life.',
            instructions: [
              'Write at least 150 words.',
              'Use a friendly, natural tone.',
              'Organize ideas in clear paragraphs.'
            ],
            suggestedTimeMinutes: 20,
            minimumWords: 150
          }
        ],
        track,
        taskType,
        excludedFingerprints
      );
    }

    if (track === 'academic') {
      return this.pickFallbackVariant(
        [
          {
            title: 'Academic Task 2 Opinion Essay',
            prompt:
              'Some people believe governments should invest more in public libraries, while others think digital learning platforms are a better use of public money. Discuss both views and give your own opinion.',
            instructions: [
              'Write at least 250 words.',
              'Present a clear position and support it with specific examples.',
              'Use cohesive devices to connect your argument logically.'
            ],
            suggestedTimeMinutes: 40,
            minimumWords: 250
          },
          {
            title: 'Academic Task 2 Discussion Essay',
            prompt:
              'Some people believe university education should be free for everyone, while others think students should pay for their own studies. Discuss both views and give your own opinion.',
            instructions: [
              'Write at least 250 words.',
              'Give balanced treatment to both sides before your conclusion.',
              'Support your claims with concrete examples.'
            ],
            suggestedTimeMinutes: 40,
            minimumWords: 250
          },
          {
            title: 'Academic Task 2 Problem-Solution Essay',
            prompt:
              'Many cities face increasing traffic congestion despite better transport systems. What are the main causes of this problem, and what solutions can be implemented?',
            instructions: [
              'Write at least 250 words.',
              'Explain causes and solutions in separate, well-developed paragraphs.',
              'Use specific examples to show practical impact.'
            ],
            suggestedTimeMinutes: 40,
            minimumWords: 250
          }
        ],
        track,
        taskType,
        excludedFingerprints
      );
    }

    return this.pickFallbackVariant(
      [
        {
          title: 'General Task 2 Opinion Essay',
          prompt:
            'Some people believe governments should invest more in public libraries, while others think digital learning platforms are a better use of public money. Discuss both views and give your own opinion.',
          instructions: [
            'Write at least 250 words.',
            'Present a clear position and support it with specific examples.',
            'Use cohesive devices to connect your argument logically.'
          ],
          suggestedTimeMinutes: 40,
          minimumWords: 250
        },
        {
          title: 'General Task 2 Advantages-Disadvantages Essay',
          prompt:
            'Many people now choose remote work instead of office-based jobs. What are the advantages and disadvantages of this trend?',
          instructions: [
            'Write at least 250 words.',
            'Discuss both advantages and disadvantages in balance.',
            'Use examples from real life or common situations.'
          ],
          suggestedTimeMinutes: 40,
          minimumWords: 250
        },
        {
          title: 'General Task 2 Discussion Essay',
          prompt:
            'Some people think social media improves communication, while others believe it harms real relationships. Discuss both views and give your own opinion.',
          instructions: [
            'Write at least 250 words.',
            'Develop both sides before stating your final position.',
            'Maintain clear paragraph structure and linking.'
          ],
          suggestedTimeMinutes: 40,
          minimumWords: 250
        }
      ],
      track,
      taskType,
      excludedFingerprints
    );
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
