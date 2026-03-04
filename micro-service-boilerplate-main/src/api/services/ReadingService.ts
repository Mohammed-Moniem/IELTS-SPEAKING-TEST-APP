import { Service } from 'typedi';

import { CSError } from '@errors/CSError';
import { CODES, HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { constructLogMessage } from '@lib/env/helpers';
import { Logger } from '@lib/logger';
import { ReadingAttemptModel } from '@models/ReadingAttemptModel';
import { IReadingQuestion, IReadingSection, ReadingTestModel } from '@models/ReadingTestModel';
import { UserModel } from '@models/UserModel';

import { AIOrchestrationService } from './AIOrchestrationService';
import { UsageService } from './UsageService';

type ReadingTrack = 'academic' | 'general';
type AnswerValue = string | string[] | Record<string, string>;

type ReadingAnswerInput = {
  questionId: string;
  sectionId?: 'p1' | 'p2' | 'p3';
  answer: AnswerValue;
};

type MarkedAnswer = {
  questionId: string;
  sectionId: 'p1' | 'p2' | 'p3';
  questionType: string;
  answer: AnswerValue;
  expectedAnswer: AnswerValue;
  isCorrect: boolean;
  pointsAwarded: number;
  maxPoints: number;
  feedbackHint: string;
};

@Service()
export class ReadingService {
  private readonly log = new Logger(__filename);

  constructor(
    private readonly aiOrchestrationService: AIOrchestrationService,
    private readonly usageService: UsageService
  ) {}

  public async startTest(userId: string, track: ReadingTrack, headers: IRequestHeaders) {
    const logMessage = constructLogMessage(__filename, 'startTest', headers);
    const plan = await this.getUserPlan(userId);

    await this.usageService.assertModuleAllowance(userId, plan, 'reading', headers);
    await this.usageService.incrementModuleUsage(userId, 'reading');

    const recentTestIds = await this.getRecentTestIds(userId, track, 20);
    let test =
      (await this.pickRandomBankTest(track, recentTestIds, 'v2')) ||
      (await this.pickRandomBankTest(track, [], 'v2')) ||
      (await this.pickRandomBankTest(track, recentTestIds)) ||
      (await this.pickRandomBankTest(track, []));

    if (!test) {
      const generated = await this.aiOrchestrationService.generateModuleTask(
        { module: 'reading', track },
        { userId, plan }
      );
      const normalized = this.normalizeSections(
        generated.sections || [],
        generated.passageTitle,
        generated.passageText,
        generated.questions || []
      );
      const flattened = this.flattenQuestions(normalized.sections);

      test = await ReadingTestModel.create({
        track,
        title: generated.title || `${track.toUpperCase()} Reading Practice`,
        schemaVersion: 'v2',
        sectionCount: normalized.sections.length,
        sections: normalized.sections,
        passageTitle: normalized.legacyPassageTitle,
        passageText: normalized.legacyPassageText,
        suggestedTimeMinutes: generated.suggestedTimeMinutes || 60,
        questions: flattened,
        source: 'ai',
        autoPublished: true,
        active: true
      });
    }

    const sections = this.resolveSectionsFromTest(test);
    const flattened = this.flattenQuestions(sections);

    const attempt = await ReadingAttemptModel.create({
      userId,
      testId: test._id,
      track,
      schemaVersion: 'v2',
      feedbackVersion: 'v2',
      deepFeedbackReady: false,
      status: 'in_progress'
    });

    this.log.info(`${logMessage} :: Started reading attempt ${attempt._id}`);

    return {
      attemptId: attempt._id,
      test: {
        testId: test._id,
        track: test.track,
        schemaVersion: 'v2',
        sectionCount: sections.length,
        sections,
        title: test.title,
        passageTitle: sections[0]?.title || test.passageTitle || '',
        passageText: sections[0]?.passageText || test.passageText || '',
        suggestedTimeMinutes: test.suggestedTimeMinutes || 60,
        questions: flattened
      }
    };
  }

  public async submitTest(
    userId: string,
    attemptId: string,
    answers: ReadingAnswerInput[],
    durationSeconds: number,
    headers: IRequestHeaders
  ) {
    const logMessage = constructLogMessage(__filename, 'submitTest', headers);

    const attempt = await ReadingAttemptModel.findOne({ _id: attemptId, userId });
    if (!attempt) {
      throw new CSError(HTTP_STATUS_CODES.NOT_FOUND, CODES.NotFound, 'Reading attempt not found');
    }

    if (attempt.status === 'completed') {
      return attempt;
    }

    const test = await ReadingTestModel.findById(attempt.testId);
    if (!test) {
      throw new CSError(HTTP_STATUS_CODES.NOT_FOUND, CODES.NotFound, 'Reading test not found');
    }

    const sections = this.resolveSectionsFromTest(test);
    const flattened = this.flattenQuestions(sections);
    const answerMap = new Map(answers.map(answer => [answer.questionId, answer.answer]));
    const markedAnswers: MarkedAnswer[] = flattened.map(question => {
      const submitted = answerMap.get(question.questionId);
      const expected = this.resolveExpectedAnswer(question);
      const isCorrect = this.evaluateAnswer(question, submitted, expected);
      return {
        questionId: question.questionId,
        sectionId: question.sectionId || 'p1',
        questionType: question.type,
        answer: submitted ?? '',
        expectedAnswer: expected,
        isCorrect,
        pointsAwarded: isCorrect ? 1 : 0,
        maxPoints: 1,
        feedbackHint: isCorrect
          ? 'Correct response.'
          : question.explanation || 'Review this question type and compare your response against the passage evidence.'
      };
    });

    const score = markedAnswers.reduce((sum, answer) => sum + answer.pointsAwarded, 0);
    const totalQuestions = markedAnswers.reduce((sum, answer) => sum + answer.maxPoints, 0);
    const sectionProgress = this.buildSectionProgress(sections, markedAnswers);
    const sectionStats = sectionProgress.map(section => ({
      sectionId: section.sectionId,
      score: section.correctCount,
      total: section.totalCount
    }));
    const questionTypeStats = this.buildQuestionTypeStats(markedAnswers);
    const incorrectTypes = questionTypeStats.filter(item => item.correct < item.total).map(item => item.type);

    const feedback = await this.aiOrchestrationService.evaluateObjectiveModule(
      {
        module: 'reading',
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

    attempt.schemaVersion = 'v2';
    attempt.feedbackVersion = 'v2';
    attempt.answers = markedAnswers as any;
    attempt.sectionProgress = sectionProgress;
    attempt.sectionStats = sectionStats;
    attempt.questionTypeStats = questionTypeStats;
    attempt.score = score;
    attempt.totalQuestions = totalQuestions;
    attempt.normalizedBand = feedback.normalizedBand;
    attempt.durationSeconds = Math.max(0, Math.round(durationSeconds || 0));
    attempt.feedback = {
      summary: feedback.feedback.summary,
      suggestions: feedback.feedback.suggestions,
      strengths: feedback.feedback.strengths,
      improvements: feedback.feedback.improvements
    };
    attempt.deepFeedbackReady = false;
    attempt.deepFeedback = {};
    attempt.model = feedback.model;
    attempt.status = 'completed';
    await attempt.save();

    void this.enrichDeepFeedback({
      attemptId: attempt._id.toString(),
      userId,
      track: test.track,
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

    this.log.info(`${logMessage} :: Completed reading attempt ${attempt._id}`);

    return attempt;
  }

  public async getAttempt(userId: string, attemptId: string) {
    const attempt = await ReadingAttemptModel.findOne({ _id: attemptId, userId }).populate('testId');
    if (!attempt) {
      throw new CSError(HTTP_STATUS_CODES.NOT_FOUND, CODES.NotFound, 'Reading attempt not found');
    }

    if (attempt.status === 'completed' && !attempt.deepFeedbackReady) {
      const test: any = attempt.testId as any;
      const sectionStats = (attempt.sectionStats || []) as Array<{ sectionId: 'p1' | 'p2' | 'p3'; score: number; total: number }>;
      const questionTypeStats = (attempt.questionTypeStats || []) as Array<{ type: string; correct: number; total: number }>;
      const mistakes = (attempt.answers || [])
        .filter((answer: any) => answer?.isCorrect === false)
        .slice(0, 24)
        .map((answer: any) => ({
          sectionId: answer?.sectionId || 'p1',
          questionId: answer?.questionId,
          type: answer?.questionType || 'unknown',
          userAnswer: answer?.answer,
          expectedAnswer: answer?.expectedAnswer || '',
          feedbackHint: answer?.feedbackHint
        }));
      void this.enrichDeepFeedback({
        attemptId: attempt._id.toString(),
        userId,
        track: attempt.track as ReadingTrack,
        score: attempt.score || 0,
        totalQuestions: attempt.totalQuestions || 0,
        sectionStats,
        questionTypeStats,
        testTitle: test?.title || '',
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
      track?: ReadingTrack;
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

    return ReadingAttemptModel.find(query).sort({ createdAt: -1 }).skip(offset).limit(limit);
  }

  private async enrichDeepFeedback(params: {
    attemptId: string;
    userId: string;
    track: ReadingTrack;
    score: number;
    totalQuestions: number;
    sectionStats: Array<{ sectionId: 'p1' | 'p2' | 'p3'; score: number; total: number }>;
    questionTypeStats: Array<{ type: string; correct: number; total: number }>;
    mistakes: Array<{
      sectionId: 'p1' | 'p2' | 'p3';
      questionId: string;
      type: string;
      userAnswer: AnswerValue;
      expectedAnswer: AnswerValue;
      feedbackHint?: string;
    }>;
    testTitle?: string;
  }) {
    const plan = await this.getUserPlan(params.userId);
    const deepFeedback = await this.aiOrchestrationService.generateReadingDeepFeedback(
      {
        track: params.track,
        score: params.score,
        totalQuestions: params.totalQuestions,
        sectionStats: params.sectionStats,
        questionTypeStats: params.questionTypeStats,
        mistakes: params.mistakes,
        testTitle: params.testTitle
      },
      { userId: params.userId, plan }
    );

    await ReadingAttemptModel.findOneAndUpdate(
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

  private resolveSectionsFromTest(test: any): Array<IReadingSection & { questions: Array<IReadingQuestion & { sectionId: 'p1' | 'p2' | 'p3' }> }> {
    const sections = Array.isArray(test.sections) ? test.sections : [];
    if (sections.length > 0) {
      return sections
        .filter((section: any) => section && typeof section === 'object')
        .slice(0, 3)
        .map((section: any, index: number) => {
          const sectionId = (section.sectionId || `p${index + 1}`) as 'p1' | 'p2' | 'p3';
          const questions = Array.isArray(section.questions) ? section.questions : [];
          return {
            sectionId,
            title: section.title || `Passage ${index + 1}`,
            passageText: section.passageText || '',
            suggestedMinutes: Number(section.suggestedMinutes || 20),
            questions: questions.map((question: any, questionIndex: number) => ({
              ...question,
              questionId: question.questionId || `${sectionId}_q${questionIndex + 1}`,
              sectionId
            }))
          };
        });
    }

    const legacyQuestions = Array.isArray(test.questions) ? test.questions : [];
    return [
      {
        sectionId: 'p1',
        title: test.passageTitle || 'Passage 1',
        passageText: test.passageText || '',
        suggestedMinutes: Math.max(1, Math.round((test.suggestedTimeMinutes || 60) / 3)),
        questions: legacyQuestions.map((question: any, index: number) => ({
          ...question,
          questionId: question.questionId || `p1_q${index + 1}`,
          sectionId: 'p1' as const
        }))
      }
    ];
  }

  private flattenQuestions(
    sections: Array<IReadingSection & { questions: Array<IReadingQuestion & { sectionId?: 'p1' | 'p2' | 'p3' }> }>
  ) {
    return sections.flatMap(section =>
      section.questions.map(question => ({
        questionId: question.questionId,
        sectionId: (question.sectionId || section.sectionId) as 'p1' | 'p2' | 'p3',
        groupId: question.groupId,
        type: question.type,
        prompt: question.prompt,
        instructions: question.instructions,
        options: question.options || [],
        answerSpec: question.answerSpec,
        explanation: question.explanation
      }))
    );
  }

  private normalizeSections(
    sections: any[],
    legacyPassageTitle?: string,
    legacyPassageText?: string,
    legacyQuestions?: IReadingQuestion[]
  ) {
    if (Array.isArray(sections) && sections.length > 0) {
      const normalized = sections
        .slice(0, 3)
        .map((section, sectionIndex) => {
          const sectionId = (section?.sectionId || `p${sectionIndex + 1}`) as 'p1' | 'p2' | 'p3';
          const questions = Array.isArray(section?.questions) ? section.questions : [];
          return {
            sectionId,
            title: section?.title || `Passage ${sectionIndex + 1}`,
            passageText: section?.passageText || '',
            suggestedMinutes: Number(section?.suggestedMinutes || 20),
            questions: questions.map((question: any, questionIndex: number) => ({
              questionId: question?.questionId || `${sectionId}_q${questionIndex + 1}`,
              groupId: question?.groupId,
              type: question?.type || 'short_answer',
              prompt: question?.prompt || '',
              instructions: question?.instructions,
              options: Array.isArray(question?.options) ? question.options : [],
              correctAnswer: question?.correctAnswer,
              answerSpec: question?.answerSpec,
              explanation: question?.explanation
            }))
          };
        })
        .filter(section => section.questions.length > 0);
      if (normalized.length > 0) {
        return {
          sections: normalized,
          legacyPassageTitle: normalized[0].title,
          legacyPassageText: normalized[0].passageText
        };
      }
    }

    return {
      sections: [
        {
          sectionId: 'p1' as const,
          title: legacyPassageTitle || 'Passage 1',
          passageText: legacyPassageText || '',
          suggestedMinutes: 20,
          questions:
            (legacyQuestions || []).map((question, index) => ({
              ...question,
              questionId: question.questionId || `p1_q${index + 1}`
            })) || []
        }
      ],
      legacyPassageTitle: legacyPassageTitle || 'Passage 1',
      legacyPassageText: legacyPassageText || ''
    };
  }

  private resolveExpectedAnswer(question: any): AnswerValue {
    if (question.answerSpec?.value != null) {
      return question.answerSpec.value as AnswerValue;
    }
    return (question.correctAnswer || '') as string;
  }

  private evaluateAnswer(question: any, submitted: AnswerValue | undefined, expected: AnswerValue) {
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

  private toArray(value: AnswerValue | undefined) {
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

  private toMap(value: AnswerValue | undefined, caseSensitive: boolean) {
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

  private toSingle(value: AnswerValue | undefined) {
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    if (value && typeof value === 'object') {
      return Object.values(value).join(', ');
    }
    return String(value || '');
  }

  private normalizeText(value: string, caseSensitive = false) {
    const normalized = value.trim().replace(/\s+/g, ' ');
    return caseSensitive ? normalized : normalized.toLowerCase();
  }

  private buildSectionProgress(sections: Array<IReadingSection>, markedAnswers: MarkedAnswer[]) {
    return sections.map(section => {
      const sectionAnswers = markedAnswers.filter(answer => answer.sectionId === section.sectionId);
      const answeredCount = sectionAnswers.filter(answer => this.toSingle(answer.answer).trim() !== '').length;
      const correctCount = sectionAnswers.filter(answer => answer.isCorrect).length;
      return {
        sectionId: section.sectionId,
        answeredCount,
        totalCount: section.questions.length,
        correctCount
      };
    });
  }

  private buildQuestionTypeStats(markedAnswers: MarkedAnswer[]) {
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

  private async pickRandomBankTest(track: ReadingTrack, excludedIds: string[], version?: 'v1' | 'v2') {
    const query: Record<string, unknown> = {
      track,
      active: true,
      autoPublished: true
    };
    if (version) {
      query.schemaVersion = version;
    }
    if (excludedIds.length > 0) {
      query._id = { $nin: excludedIds };
    }
    const candidates = await ReadingTestModel.find(query).sort({ updatedAt: -1 }).limit(320);
    if (!candidates || candidates.length === 0) {
      return null;
    }
    const index = Math.floor(Math.random() * candidates.length);
    return candidates[index];
  }

  private async getRecentTestIds(userId: string, track: ReadingTrack, limit: number) {
    const attempts = await ReadingAttemptModel.find({ userId, track, status: 'completed' })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('testId');
    const ids = attempts
      .map((attempt: any) => attempt.testId?.toString?.() || '')
      .filter((value: string) => value.length > 0);
    return Array.from(new Set(ids)) as string[];
  }

  private async getUserPlan(userId: string) {
    const user = await UserModel.findById(userId).select('subscriptionPlan');
    if (!user) {
      throw new CSError(HTTP_STATUS_CODES.NOT_FOUND, CODES.NotFound, 'User not found');
    }

    return user.subscriptionPlan;
  }
}
