import { Service } from 'typedi';

import { CSError } from '@errors/CSError';
import { CODES, HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { constructLogMessage } from '@lib/env/helpers';
import { Logger } from '@lib/logger';
import { ListeningAttemptModel } from '@models/ListeningAttemptModel';
import { ListeningSectionModel } from '@models/ListeningSectionModel';
import { ListeningTestModel } from '@models/ListeningTestModel';
import { UserModel } from '@models/UserModel';

import { AIOrchestrationService } from './AIOrchestrationService';
import { UsageService } from './UsageService';

type ListeningTrack = 'academic' | 'general';
type AnswerValue = string | string[] | Record<string, string>;

type ListeningAnswerInput = {
  questionId: string;
  sectionId?: string;
  answer: AnswerValue;
};

type MarkedAnswer = {
  questionId: string;
  sectionId: string;
  questionType: string;
  answer: AnswerValue;
  expectedAnswer: AnswerValue;
  isCorrect: boolean;
  feedbackHint: string;
};

@Service()
export class ListeningService {
  private readonly log = new Logger(__filename);

  constructor(
    private readonly aiOrchestrationService: AIOrchestrationService,
    private readonly usageService: UsageService
  ) {}

  public async startTest(userId: string, track: ListeningTrack, headers: IRequestHeaders) {
    const logMessage = constructLogMessage(__filename, 'startTest', headers);
    const plan = await this.getUserPlan(userId);

    await this.usageService.assertModuleAllowance(userId, plan, 'listening', headers);
    await this.usageService.incrementModuleUsage(userId, 'listening');

    const recentTestIds = await this.getRecentTestIds(userId, track, 20);

    /* --- Try v2 pipeline test first --- */
    let test = await this.pickV2PipelineTest(track, recentTestIds);

    /* --- Fall back to v1/AI generation --- */
    if (!test) {
      test = await ListeningTestModel.findOne({ track, active: true, autoPublished: true }).sort({ updatedAt: -1 });
    }

    if (!test) {
      const generated = await this.aiOrchestrationService.generateModuleTask(
        { module: 'listening', track },
        { userId, plan }
      );

      test = await ListeningTestModel.create({
        track,
        title: generated.title,
        sectionTitle: generated.sectionTitle,
        transcript: generated.transcript,
        audioUrl: generated.audioUrl || '',
        suggestedTimeMinutes: generated.suggestedTimeMinutes || 20,
        questions: generated.questions || [],
        source: 'ai',
        autoPublished: true,
        active: true
      });
    }

    /* --- Build response --- */
    const isV2 =
      test.schemaVersion === 'v2' &&
      Array.isArray(test.sectionRefs) &&
      test.sectionRefs.length > 0;

    if (isV2) {
      const sections = await ListeningSectionModel.find({
        _id: { $in: test.sectionRefs }
      }).sort({ sectionType: 1 });

      const flattenedQuestions = sections.flatMap(s =>
        s.questions.map(q => ({
          questionId: q.questionId,
          sectionId: s.sectionType,
          type: q.type,
          prompt: q.prompt,
          instructions: q.instructions,
          groupId: q.groupId,
          options: q.options || []
        }))
      );

      const attempt = await ListeningAttemptModel.create({
        userId,
        testId: test._id,
        track,
        schemaVersion: 'v2',
        feedbackVersion: 'v2',
        deepFeedbackReady: false,
        status: 'in_progress'
      });

      this.log.info(`${logMessage} :: Started listening attempt ${attempt._id} (v2)`);

      return {
        attemptId: attempt._id,
        test: {
          testId: test._id,
          track: test.track,
          schemaVersion: test.schemaVersion || 'v1',
          title: test.title,
          suggestedTimeMinutes: test.suggestedTimeMinutes,
          sections: sections.map(s => ({
            sectionId: s.sectionType,
            title: s.title,
            context: s.context,
            audioUrl: s.audioUrl,
            audioDurationSeconds: s.audioDurationSeconds,
            questions: s.questions.map(q => ({
              questionId: q.questionId,
              sectionId: s.sectionType,
              type: q.type,
              prompt: q.prompt,
              instructions: q.instructions,
              groupId: q.groupId,
              options: q.options || []
            }))
          })),
          questions: flattenedQuestions,
          sectionTitle: test.sectionTitle || '',
          transcript: test.transcript || '',
          audioUrl: test.audioUrl || ''
        }
      };
    }

    /* --- v1 fallback response --- */
    const attempt = await ListeningAttemptModel.create({
      userId,
      testId: test._id,
      track,
      status: 'in_progress'
    });

    this.log.info(`${logMessage} :: Started listening attempt ${attempt._id}`);

    return {
      attemptId: attempt._id,
      test: {
        testId: test._id,
        track: test.track,
        schemaVersion: test.schemaVersion || 'v1',
        title: test.title,
        sectionTitle: test.sectionTitle,
        transcript: test.transcript,
        audioUrl: test.audioUrl,
        suggestedTimeMinutes: test.suggestedTimeMinutes,
        questions: test.questions.map(q => ({
          questionId: q.questionId,
          sectionId: q.sectionId,
          type: q.type,
          prompt: q.prompt,
          options: q.options || []
        }))
      }
    };
  }

  public async submitTest(
    userId: string,
    attemptId: string,
    answers: ListeningAnswerInput[],
    durationSeconds: number,
    headers: IRequestHeaders
  ) {
    const logMessage = constructLogMessage(__filename, 'submitTest', headers);

    const attempt = await ListeningAttemptModel.findOne({ _id: attemptId, userId });
    if (!attempt) {
      throw new CSError(HTTP_STATUS_CODES.NOT_FOUND, CODES.NotFound, 'Listening attempt not found');
    }

    if (attempt.status === 'completed') {
      return attempt;
    }

    const test = await ListeningTestModel.findById(attempt.testId);
    if (!test) {
      throw new CSError(HTTP_STATUS_CODES.NOT_FOUND, CODES.NotFound, 'Listening test not found');
    }

    const isV2 =
      test.schemaVersion === 'v2' &&
      Array.isArray(test.sectionRefs) &&
      test.sectionRefs.length > 0;

    let allQuestions: Array<{
      questionId: string;
      sectionId: string;
      type: string;
      prompt: string;
      instructions?: string;
      groupId?: string;
      options?: string[];
      correctAnswer?: string;
      answerSpec?: any;
      explanation?: string;
    }> = [];

    if (isV2) {
      const sections = await ListeningSectionModel.find({
        _id: { $in: test.sectionRefs }
      }).sort({ sectionType: 1 });

      allQuestions = sections.flatMap(s =>
        s.questions.map(q => ({
          questionId: q.questionId,
          sectionId: s.sectionType,
          type: q.type,
          prompt: q.prompt,
          instructions: q.instructions,
          groupId: q.groupId,
          options: q.options || [],
          correctAnswer: q.correctAnswer,
          answerSpec: q.answerSpec,
          explanation: q.explanation
        }))
      );
    } else {
      allQuestions = test.questions.map(q => ({
        questionId: q.questionId,
        sectionId: q.sectionId || 's1',
        type: q.type,
        prompt: q.prompt,
        instructions: q.instructions,
        groupId: q.groupId,
        options: q.options || [],
        correctAnswer: q.correctAnswer,
        answerSpec: q.answerSpec,
        explanation: q.explanation
      }));
    }

    const answerMap = new Map(answers.map(answer => [answer.questionId, answer.answer]));
    const markedAnswers: MarkedAnswer[] = allQuestions.map(question => {
      const submitted = answerMap.get(question.questionId);
      const expected = this.resolveExpectedAnswer(question);
      const isCorrect = this.evaluateAnswer(question, submitted, expected);

      return {
        questionId: question.questionId,
        sectionId: question.sectionId || 's1',
        questionType: question.type,
        answer: submitted ?? '',
        expectedAnswer: expected,
        isCorrect,
        feedbackHint: isCorrect
          ? 'Correct response.'
          : question.explanation || 'Review this question type and listen again to the relevant section.'
      };
    });

    const score = markedAnswers.filter(item => item.isCorrect).length;
    const totalQuestions = markedAnswers.length;
    const sectionStats = this.buildSectionStats(allQuestions, markedAnswers);
    const questionTypeStats = this.buildQuestionTypeStats(markedAnswers);
    const incorrectTypes = questionTypeStats.filter(item => item.correct < item.total).map(item => item.type);

    const feedback = await this.aiOrchestrationService.evaluateObjectiveModule(
      {
        module: 'listening',
        score,
        totalQuestions,
        track: test.track,
        incorrectTopics: incorrectTypes
      },
      {
        userId,
        plan: await this.getUserPlan(userId)
      }
    );
    const normalizedEvaluation = this.normalizeObjectiveEvaluation(feedback, score, totalQuestions, incorrectTypes);

    attempt.schemaVersion = isV2 ? 'v2' : (test.schemaVersion as any) || 'v1';
    attempt.feedbackVersion = 'v2';
    attempt.answers = markedAnswers as any;
    attempt.sectionStats = sectionStats;
    attempt.questionTypeStats = questionTypeStats;
    attempt.score = score;
    attempt.totalQuestions = totalQuestions;
    attempt.normalizedBand = normalizedEvaluation.normalizedBand;
    attempt.durationSeconds = Math.max(0, Math.round(durationSeconds || 0));
    attempt.feedback = normalizedEvaluation.feedback;
    attempt.deepFeedbackReady = false;
    attempt.deepFeedback = {};
    attempt.model = normalizedEvaluation.model;
    attempt.status = 'completed';
    await attempt.save();

    void this.enrichDeepFeedback({
      attemptId: attempt._id.toString(),
      userId,
      track: test.track as ListeningTrack,
      score,
      totalQuestions,
      sectionStats,
      questionTypeStats,
      mistakes: markedAnswers
        .filter(answer => !answer.isCorrect)
        .slice(0, 24)
        .map(answer => ({
          sectionId: answer.sectionId,
          questionId: answer.questionId,
          type: answer.questionType,
          userAnswer: answer.answer,
          expectedAnswer: answer.expectedAnswer,
          feedbackHint: answer.feedbackHint
        }))
    }).catch(error => {
      this.log.warn(`${logMessage} :: deep feedback enrichment failed for ${attempt._id}`, {
        error: error?.message
      });
    });

    this.log.info(`${logMessage} :: Completed listening attempt ${attempt._id}`);

    return attempt;
  }

  public async saveProgress(
    userId: string,
    attemptId: string,
    payload: {
      answers?: ListeningAnswerInput[];
      durationSeconds?: number;
      activeSectionId?: string;
      activeQuestionIndex?: number;
      flaggedQuestionIds?: string[];
      isPaused?: boolean;
    },
    headers: IRequestHeaders
  ) {
    const logMessage = constructLogMessage(__filename, 'saveProgress', headers);
    const attempt = await ListeningAttemptModel.findOne({ _id: attemptId, userId });
    if (!attempt) {
      throw new CSError(HTTP_STATUS_CODES.NOT_FOUND, CODES.NotFound, 'Listening attempt not found');
    }

    if (attempt.status === 'completed') {
      throw new CSError(HTTP_STATUS_CODES.BAD_REQUEST, CODES.InvalidBody, 'Cannot update a completed listening attempt');
    }

    const previousWorkspace = (attempt.workspaceState || {}) as Record<string, unknown>;
    const answersMap: Record<string, AnswerValue> = payload.answers
      ? payload.answers.reduce<Record<string, AnswerValue>>((acc, answer) => {
          acc[answer.questionId] = answer.answer;
          return acc;
        }, {})
      : ((previousWorkspace.answers as Record<string, AnswerValue>) || {});

    attempt.workspaceState = {
      answers: answersMap,
      activeSectionId:
        payload.activeSectionId || (previousWorkspace.activeSectionId as string | undefined),
      activeQuestionIndex:
        typeof payload.activeQuestionIndex === 'number'
          ? payload.activeQuestionIndex
          : (previousWorkspace.activeQuestionIndex as number | undefined),
      flaggedQuestionIds:
        payload.flaggedQuestionIds || (previousWorkspace.flaggedQuestionIds as string[] | undefined) || [],
      isPaused:
        typeof payload.isPaused === 'boolean' ? payload.isPaused : (previousWorkspace.isPaused as boolean | undefined) || false,
      durationSeconds:
        typeof payload.durationSeconds === 'number'
          ? payload.durationSeconds
          : (previousWorkspace.durationSeconds as number | undefined) || attempt.durationSeconds || 0,
      updatedAt: new Date()
    };

    if (typeof payload.durationSeconds === 'number') {
      attempt.durationSeconds = Math.max(0, Math.round(payload.durationSeconds));
    }

    await attempt.save();
    this.log.info(`${logMessage} :: Saved in-progress state for listening attempt ${attempt._id}`);
    return attempt;
  }

  public async getAttempt(userId: string, attemptId: string) {
    const attempt = await ListeningAttemptModel.findOne({ _id: attemptId, userId }).populate('testId');
    if (!attempt) {
      throw new CSError(HTTP_STATUS_CODES.NOT_FOUND, CODES.NotFound, 'Listening attempt not found');
    }

    if (attempt.status === 'completed' && !attempt.deepFeedbackReady) {
      const sectionStats = (attempt.sectionStats || []) as Array<{ sectionId: string; score: number; total: number }>;
      const questionTypeStats = (attempt.questionTypeStats || []) as Array<{ type: string; correct: number; total: number }>;
      const mistakes = (attempt.answers || [])
        .filter((answer: any) => answer?.isCorrect === false)
        .slice(0, 24)
        .map((answer: any) => ({
          sectionId: answer?.sectionId || 's1',
          questionId: answer?.questionId,
          type: answer?.questionType || 'unknown',
          userAnswer: answer?.answer,
          expectedAnswer: answer?.expectedAnswer || '',
          feedbackHint: answer?.feedbackHint
        }));
      void this.enrichDeepFeedback({
        attemptId: attempt._id.toString(),
        userId,
        track: attempt.track as ListeningTrack,
        score: attempt.score || 0,
        totalQuestions: attempt.totalQuestions || 0,
        sectionStats,
        questionTypeStats,
        mistakes
      }).catch(() => undefined);
    }

    return attempt;
  }

  public async getHistory(
    userId: string,
    limit: number,
    offset: number,
    filters?: {
      track?: ListeningTrack;
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

    return ListeningAttemptModel.find(query).sort({ createdAt: -1 }).skip(offset).limit(limit);
  }

  /* ------------------------------------------------------------------ */
  /*  Deep feedback enrichment                                          */
  /* ------------------------------------------------------------------ */

  private async enrichDeepFeedback(params: {
    attemptId: string;
    userId: string;
    track: ListeningTrack;
    score: number;
    totalQuestions: number;
    sectionStats: Array<{ sectionId: string; score: number; total: number }>;
    questionTypeStats: Array<{ type: string; correct: number; total: number }>;
    mistakes: Array<{
      sectionId: string;
      questionId: string;
      type: string;
      userAnswer: AnswerValue;
      expectedAnswer: AnswerValue;
      feedbackHint?: string;
    }>;
  }) {
    const plan = await this.getUserPlan(params.userId);
    const deepFeedback = await this.aiOrchestrationService.generateListeningDeepFeedback(
      {
        track: params.track,
        score: params.score,
        totalQuestions: params.totalQuestions,
        sectionStats: params.sectionStats,
        questionTypeStats: params.questionTypeStats,
        mistakes: params.mistakes
      },
      { userId: params.userId, plan }
    );

    await ListeningAttemptModel.findOneAndUpdate(
      { _id: params.attemptId, userId: params.userId, status: 'completed' },
      {
        $set: {
          feedbackVersion: 'v2',
          deepFeedbackReady: true,
          deepFeedback
        }
      }
    );
  }

  /* ------------------------------------------------------------------ */
  /*  V2 pipeline test selection                                        */
  /* ------------------------------------------------------------------ */

  private async pickV2PipelineTest(track: ListeningTrack, excludedIds: string[]) {
    const query: Record<string, unknown> = {
      schemaVersion: 'v2',
      qualityTier: 'gen_v1',
      active: true,
      track
    };
    if (excludedIds.length > 0) {
      query._id = { $nin: excludedIds };
    }
    const candidates = await ListeningTestModel.find(query).sort({ updatedAt: -1 }).limit(120);
    if (!candidates || candidates.length === 0) {
      return null;
    }
    const index = Math.floor(Math.random() * candidates.length);
    return candidates[index];
  }

  private async getRecentTestIds(userId: string, track: ListeningTrack, limit: number): Promise<string[]> {
    const recent = await ListeningAttemptModel.find({ userId, track })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('testId');
    return recent.map(a => a.testId?.toString()).filter(Boolean) as string[];
  }

  /* ------------------------------------------------------------------ */
  /*  Answer evaluation helpers                                         */
  /* ------------------------------------------------------------------ */

  private resolveExpectedAnswer(question: any): AnswerValue {
    if (question.answerSpec?.value != null) {
      return question.answerSpec.value as AnswerValue;
    }
    return (question.correctAnswer || '') as string;
  }

  private evaluateAnswer(question: any, submitted: AnswerValue | undefined, expected: AnswerValue): boolean {
    const kind = question.answerSpec?.kind || this.inferAnswerKind(expected);
    const caseSensitive = !!question.answerSpec?.caseSensitive;

    if (kind === 'multi') {
      const submittedSet = new Set(this.toArray(submitted).map(item => this.normalizeText(item, caseSensitive)));
      const expectedSet = new Set(this.toArray(expected).map(item => this.normalizeText(item, caseSensitive)));
      if (submittedSet.size !== expectedSet.size) return false;
      for (const value of expectedSet) {
        if (!submittedSet.has(value)) return false;
      }
      return true;
    }

    if (kind === 'ordered') {
      const submittedArray = this.toArray(submitted).map(item => this.normalizeText(item, caseSensitive));
      const expectedArray = this.toArray(expected).map(item => this.normalizeText(item, caseSensitive));
      if (submittedArray.length !== expectedArray.length) return false;
      return submittedArray.every((value, index) => value === expectedArray[index]);
    }

    if (kind === 'map') {
      const submittedMap = this.toMap(submitted, caseSensitive);
      const expectedMap = this.toMap(expected, caseSensitive);
      const expectedKeys = Object.keys(expectedMap);
      if (Object.keys(submittedMap).length !== expectedKeys.length) return false;
      return expectedKeys.every(key => submittedMap[key] === expectedMap[key]);
    }

    const submittedSingle = this.toSingle(submitted);
    const expectedRaw = this.toSingle(expected);
    const expectedAlternatives = expectedRaw
      .split('|')
      .map((item: string) => this.normalizeText(item, caseSensitive))
      .filter(Boolean);
    const normalizedSubmitted = this.normalizeText(submittedSingle, caseSensitive);
    if (expectedAlternatives.length > 0) {
      return expectedAlternatives.includes(normalizedSubmitted);
    }
    return normalizedSubmitted === this.normalizeText(expectedRaw, caseSensitive);
  }

  private inferAnswerKind(expected: AnswerValue): 'single' | 'multi' | 'ordered' | 'map' {
    if (Array.isArray(expected)) {
      return 'multi';
    }
    if (expected && typeof expected === 'object') {
      return 'map';
    }
    return 'single';
  }

  private toArray(value: AnswerValue | undefined): string[] {
    if (Array.isArray(value)) {
      return value.map(item => String(item));
    }
    if (typeof value === 'string') {
      return value
        .split(/[;,]/)
        .map(item => item.trim())
        .filter(Boolean);
    }
    return [];
  }

  private toMap(value: AnswerValue | undefined, caseSensitive: boolean): Record<string, string> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return Object.fromEntries(
        Object.entries(value).map(([key, entry]) => [
          this.normalizeText(String(key), caseSensitive),
          this.normalizeText(String(entry), caseSensitive)
        ])
      );
    }
    if (typeof value === 'string') {
      return value
        .split(/[,\n;]/)
        .map(item => item.trim())
        .filter(Boolean)
        .reduce<Record<string, string>>((acc, pair) => {
          const [rawKey, rawValue] = pair.split(/[:=]/);
          if (!rawKey || !rawValue) return acc;
          acc[this.normalizeText(rawKey, caseSensitive)] = this.normalizeText(rawValue, caseSensitive);
          return acc;
        }, {});
    }
    return {};
  }

  private toSingle(value: AnswerValue | undefined): string {
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    if (value && typeof value === 'object') {
      return Object.values(value).join(', ');
    }
    return String(value || '');
  }

  private normalizeText(value: string, caseSensitive = false): string {
    const normalized = value.trim().replace(/\s+/g, ' ');
    return caseSensitive ? normalized : normalized.toLowerCase();
  }

  /* ------------------------------------------------------------------ */
  /*  Stats builders                                                    */
  /* ------------------------------------------------------------------ */

  private buildSectionStats(
    questions: Array<{ sectionId: string }>,
    markedAnswers: MarkedAnswer[]
  ): Array<{ sectionId: string; score: number; total: number }> {
    const sectionIds = Array.from(new Set(questions.map(q => q.sectionId || 's1')));
    return sectionIds.map(sectionId => {
      const sectionAnswers = markedAnswers.filter(a => a.sectionId === sectionId);
      return {
        sectionId,
        score: sectionAnswers.filter(a => a.isCorrect).length,
        total: sectionAnswers.length
      };
    });
  }

  private buildQuestionTypeStats(markedAnswers: MarkedAnswer[]): Array<{ type: string; correct: number; total: number }> {
    const stats = new Map<string, { type: string; correct: number; total: number }>();
    markedAnswers.forEach(answer => {
      const current = stats.get(answer.questionType) || { type: answer.questionType, correct: 0, total: 0 };
      current.total += 1;
      if (answer.isCorrect) {
        current.correct += 1;
      }
      stats.set(answer.questionType, current);
    });
    return Array.from(stats.values());
  }

  /* ------------------------------------------------------------------ */
  /*  Objective evaluation normalizer                                   */
  /* ------------------------------------------------------------------ */

  private normalizeObjectiveEvaluation(
    raw: unknown,
    score: number,
    totalQuestions: number,
    incorrectTypes: string[]
  ): {
    normalizedBand: number;
    model: string;
    feedback: {
      summary: string;
      suggestions: string[];
      strengths: string[];
      improvements: string[];
    };
  } {
    const payload = (raw || {}) as Record<string, any>;
    const feedback = (payload.feedback || {}) as Record<string, any>;
    const defaultSummary = `You answered ${score} out of ${totalQuestions}.`;

    const summary = this.readNonEmptyString(feedback.summary) || this.readNonEmptyString(payload.summary) || defaultSummary;
    const strengths = this.readStringArray(feedback.strengths, [
      'Completed the section under timed conditions.',
      'Demonstrated persistence across question types.'
    ]);
    const improvements = this.readStringArray(
      feedback.improvements,
      incorrectTypes.length > 0 ? [`Focus on ${incorrectTypes.join(', ')}.`] : ['Maintain consistency under time pressure.']
    );
    const suggestions = this.readStringArray(feedback.suggestions, [
      'Review error patterns before your next attempt.',
      'Practice timed listening sets to improve pacing and prediction skills.'
    ]);
    const normalizedBand = this.resolveBand(payload.normalizedBand, score, totalQuestions);
    const model = this.readNonEmptyString(payload.model) || 'fallback-local';

    return {
      normalizedBand,
      model,
      feedback: {
        summary,
        suggestions,
        strengths,
        improvements
      }
    };
  }

  /* ------------------------------------------------------------------ */
  /*  Utility helpers                                                   */
  /* ------------------------------------------------------------------ */

  private readNonEmptyString(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private readStringArray(value: unknown, fallback: string[]): string[] {
    if (!Array.isArray(value)) return fallback;
    const cleaned = value
      .map(item => (typeof item === 'string' ? item.trim() : ''))
      .filter(item => item.length > 0);
    return cleaned.length > 0 ? cleaned : fallback;
  }

  private resolveBand(rawBand: unknown, score: number, totalQuestions: number): number {
    if (typeof rawBand === 'number' && Number.isFinite(rawBand)) {
      return Number(Math.min(9, Math.max(0, rawBand)).toFixed(1));
    }
    if (totalQuestions <= 0) return 0;
    const mapped = 9 * (score / totalQuestions);
    return Number(Math.min(9, Math.max(0, mapped)).toFixed(1));
  }

  private async getUserPlan(userId: string) {
    const user = await UserModel.findById(userId).select('subscriptionPlan');
    if (!user) {
      throw new CSError(HTTP_STATUS_CODES.NOT_FOUND, CODES.NotFound, 'User not found');
    }

    return user.subscriptionPlan;
  }
}
