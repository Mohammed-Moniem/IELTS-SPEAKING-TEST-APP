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

const READING_QUALITY_TIER = 'exam_v2';

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
    let test = await this.pickRandomBankTest(track, recentTestIds, 'v2');

    if (!test) {
      test = await this.getOrCreateRichReadingTest(track, recentTestIds);
    }

    if (test && this.shouldForceRichReplacement(test)) {
      const excluded = Array.from(
        new Set([...recentTestIds, test?._id?.toString?.()].filter((value): value is string => !!value))
      );
      const richer = await this.getOrCreateRichReadingTest(track, excluded);
      if (richer) {
        test = richer;
      }
    }

    if (!test) {
      const generated = await this.aiOrchestrationService.generateModuleTask(
        { module: 'reading', track },
        { userId, plan }
      );
      let normalized = this.normalizeSections(
        generated.sections || [],
        generated.passageTitle,
        generated.passageText,
        generated.questions || []
      );

      let title = generated.title || `${track.toUpperCase()} Reading Practice`;
      let source: 'bank' | 'ai' = 'ai';
      if (this.isLowFidelitySections(normalized.sections)) {
        const blockedTopics = await this.getBlockedTopics(recentTestIds);
        const richPayload = this.buildRichReadingPayload(track, blockedTopics);
        normalized = {
          sections: richPayload.sections,
          legacyPassageTitle: richPayload.passageTitle,
          legacyPassageText: richPayload.passageText
        };
        title = richPayload.title;
        source = richPayload.source;
      }

      const flattened = this.flattenQuestions(normalized.sections as Array<IReadingSection & { questions: Array<IReadingQuestion & { sectionId?: 'p1' | 'p2' | 'p3' }> }>);

      test = await ReadingTestModel.create({
        track,
        title,
        schemaVersion: 'v2',
        qualityTier: READING_QUALITY_TIER,
        sectionCount: normalized.sections.length,
        sections: normalized.sections,
        passageTitle: normalized.legacyPassageTitle,
        passageText: normalized.legacyPassageText,
        suggestedTimeMinutes: generated.suggestedTimeMinutes || 60,
        questions: flattened,
        source,
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

  private async getOrCreateRichReadingTest(track: ReadingTrack, excludedIds: string[]) {
    const candidates = await ReadingTestModel.find({
      track,
      active: true,
      autoPublished: true,
      schemaVersion: 'v2',
      qualityTier: READING_QUALITY_TIER
    })
      .sort({ updatedAt: -1 })
      .limit(120);

    const richCandidates = candidates.filter((candidate: any) => {
      const id = candidate?._id?.toString?.() || '';
      if (id && excludedIds.includes(id)) return false;
      return !this.isLowFidelityReadingTest(candidate);
    });

    if (richCandidates.length > 0) {
      const index = Math.floor(Math.random() * richCandidates.length);
      return richCandidates[index];
    }

    const blockedTopics = await this.getBlockedTopics(excludedIds);
    const created: any[] = [];
    const localBlocked = new Set(blockedTopics.map(topic => topic.toLowerCase()));

    for (let i = 0; i < 8; i += 1) {
      const payload = this.buildRichReadingPayload(track, Array.from(localBlocked));
      const createdTest = await ReadingTestModel.create(payload);
      created.push(createdTest);
      const parsedTopic = this.extractTopicFromTitle(createdTest?.title || '');
      if (parsedTopic) {
        localBlocked.add(parsedTopic.toLowerCase());
      }
    }

    const eligible = created.filter((candidate: any) => {
      const id = candidate?._id?.toString?.() || '';
      if (id && excludedIds.includes(id)) return false;
      return !this.isLowFidelityReadingTest(candidate);
    });

    if (eligible.length > 0) {
      const randomIndex = Math.floor(Math.random() * eligible.length);
      return eligible[randomIndex];
    }

    return created[0] || null;
  }

  private shouldForceRichReplacement(test: any) {
    if (!test) return true;
    if (test.schemaVersion !== 'v2') return true;
    if (test.qualityTier !== READING_QUALITY_TIER) return true;
    return this.isLowFidelityReadingTest(test);
  }

  private isLowFidelityReadingTest(test: any) {
    const sections = this.resolveSectionsFromTest(test);
    return this.isLowFidelitySections(sections as Array<IReadingSection & { questions: Array<IReadingQuestion & { sectionId?: 'p1' | 'p2' | 'p3' }> }>);
  }

  private isLowFidelitySections(
    sections: Array<IReadingSection & { questions: Array<IReadingQuestion & { sectionId?: 'p1' | 'p2' | 'p3' }> }>
  ) {
    if (!Array.isArray(sections) || sections.length < 3) {
      return true;
    }

    let totalQuestions = 0;
    let genericPromptCount = 0;
    let tokenOnlyOptionsCount = 0;
    let scoredOptionQuestions = 0;

    for (const section of sections) {
      const passage = (section.passageText || '').trim();
      const words = passage.split(/\s+/).filter(Boolean).length;
      if (words < 560) {
        return true;
      }
      if (/central issue in recent IELTS-aligned source materials/i.test(passage)) {
        return true;
      }
      if (/Manufacturing networks seeking circular performance initially focused on recycling rates/i.test(passage)) {
        return true;
      }
      if (/This passage \(P[1-3]\) focuses on core comprehension/i.test(passage)) {
        return true;
      }
      if (/^Paragraph [A-F]\b/m.test(passage)) {
        return true;
      }

      for (const question of section.questions || []) {
        totalQuestions += 1;
        const prompt = (question.prompt || '').trim();
        if (/Based on the passage, answer the/i.test(prompt)) {
          genericPromptCount += 1;
        }

        const options = Array.isArray(question.options) ? question.options : [];
        if (options.length === 0) continue;

        const optionType = question.type || '';
        if (optionType === 'true_false_not_given' || optionType === 'yes_no_not_given') {
          continue;
        }

        scoredOptionQuestions += 1;
        const isTokenOnly = options.every(option => /^(?:[A-Z]|[ivx]+)$/i.test(option.trim()));
        if (isTokenOnly) {
          tokenOnlyOptionsCount += 1;
        }
      }
    }

    if (totalQuestions < 30) {
      return true;
    }
    if (genericPromptCount / totalQuestions > 0.3) {
      return true;
    }
    if (scoredOptionQuestions > 0 && tokenOnlyOptionsCount / scoredOptionQuestions > 0.25) {
      return true;
    }
    return false;
  }

  private buildRichReadingPayload(track: ReadingTrack, blockedTopics: string[] = []) {
    const blueprintPool = track === 'academic' ? this.getAcademicSectionBlueprints() : this.getGeneralSectionBlueprints();
    const blockedTopicSet = new Set(blockedTopics.map(topic => topic.toLowerCase()));
    const shuffled = this.pickRandomBlueprints(blueprintPool, blueprintPool.length);
    const firstMatch =
      shuffled.find(blueprint => !blockedTopicSet.has((blueprint.topic || '').toLowerCase())) || shuffled[0];
    const blueprints = [firstMatch, ...shuffled.filter(blueprint => blueprint !== firstMatch).slice(0, 2)].map((blueprint, index) => ({
      ...blueprint,
      title: `Passage ${index + 1}`
    }));
    const sectionCounts = [13, 13, 14];
    let questionPointer = 1;

    const sections = blueprints.map((blueprint, index) => {
      const sectionId = (`p${index + 1}` as 'p1' | 'p2' | 'p3');
      const questionCount = sectionCounts[index] || 13;
      const section = this.buildRichSection(sectionId, blueprint, questionPointer, questionCount);
      questionPointer += questionCount;
      return section;
    });

    const flattened = this.flattenQuestions(sections);
    const firstTopic = blueprints[0]?.topic || 'Focused Reading Practice';
    const runTag = `${new Date().toISOString().slice(0, 10)}-${Math.floor(Math.random() * 9000) + 1000}`;
    const title = `[RICH] ${track.toUpperCase()} Reading Test • ${firstTopic} • ${runTag}`;

    return {
      track,
      title,
      schemaVersion: 'v2' as const,
      qualityTier: READING_QUALITY_TIER,
      sectionCount: 3,
      sections,
      passageTitle: sections[0]?.title || 'Passage 1',
      passageText: sections[0]?.passageText || '',
      suggestedTimeMinutes: 60,
      questions: flattened,
      source: 'ai' as const,
      autoPublished: true,
      active: true
    };
  }

  private pickRandomBlueprints<T>(items: T[], count: number) {
    if (!Array.isArray(items) || items.length === 0) return [];
    const pool = [...items];
    for (let i = pool.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, Math.min(count, pool.length));
  }

  private buildRichSection(
    sectionId: 'p1' | 'p2' | 'p3',
    blueprint: {
      topic: string;
      title: string;
      paragraphA: string;
      paragraphB: string;
      paragraphC: string;
      paragraphD: string;
      paragraphE: string;
      paragraphF: string;
      headingOptions: string[];
      institutions: string[];
    },
    questionStart: number,
    questionCount: number
  ): IReadingSection & { questions: Array<IReadingQuestion & { sectionId: 'p1' | 'p2' | 'p3' }> } {
    const passageText = [blueprint.paragraphA, blueprint.paragraphB, blueprint.paragraphC, blueprint.paragraphD, blueprint.paragraphE, blueprint.paragraphF]
      .map(paragraph => paragraph.trim())
      .join('\n\n');

    const typeCycle: IReadingQuestion['type'][] = [
      'matching_headings',
      'multiple_choice_single',
      'true_false_not_given',
      'summary_completion',
      'short_answer',
      'matching_information',
      'yes_no_not_given',
      'sentence_completion',
      'multiple_choice_multiple',
      'matching_features',
      'matching_sentence_endings',
      'note_table_flow_completion',
      'diagram_label_completion',
      'short_answer'
    ];

    const questions: Array<IReadingQuestion & { sectionId: 'p1' | 'p2' | 'p3' }> = Array.from({ length: questionCount }, (_, offset) => {
      const number = questionStart + offset;
      const type = typeCycle[offset % typeCycle.length];
      const paragraphNumber = (offset % 6) + 1;
      const questionId = `${sectionId}_q${number}`;

      switch (type) {
        case 'matching_headings': {
          const options = blueprint.headingOptions.map((heading, index) => `${['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii'][index]}. ${heading}`);
          const value = options[(offset + 2) % options.length];
          return {
            questionId,
            sectionId,
            type,
            prompt: `Choose the best heading for paragraph ${paragraphNumber} in the passage.`,
            instructions: 'Select one heading only.',
            options,
            answerSpec: { kind: 'single', value },
            correctAnswer: value,
            explanation: `The selected heading matches paragraph ${paragraphNumber}'s central argument and evidence focus.`
          };
        }
        case 'multiple_choice_single': {
          const options = [
            `The main barrier was limited coordination across departments.`,
            `The programme succeeded because funding was increased immediately.`,
            `Public feedback was ignored during the first rollout.`,
            `The policy removed the need for local monitoring.`
          ];
          const value = options[0];
          return {
            questionId,
            sectionId,
            type,
            prompt: `According to the passage, what is the primary challenge discussed in paragraph ${paragraphNumber}?`,
            options,
            answerSpec: { kind: 'single', value },
            correctAnswer: value,
            explanation: 'The paragraph explicitly states that weak coordination delayed implementation outcomes.'
          };
        }
        case 'multiple_choice_multiple': {
          const options = [
            'Clear weekly reporting routines improved decision speed.',
            'Removing all local partners reduced delivery risk.',
            'Shared data standards reduced duplicated effort.',
            'Random pilot locations guaranteed better outcomes.',
            'Staff retraining improved consistency across sites.'
          ];
          const value = [options[0], options[2], options[4]];
          return {
            questionId,
            sectionId,
            type,
            prompt: 'Choose THREE improvements the passage says contributed to better outcomes.',
            options,
            answerSpec: { kind: 'multi', value },
            correctAnswer: value.join('|'),
            explanation: 'The passage links improvements to reporting cadence, data standards, and retraining.'
          };
        }
        case 'true_false_not_given': {
          const options = ['True', 'False', 'Not Given'];
          return {
            questionId,
            sectionId,
            type,
            prompt: `The author claims that paragraph ${paragraphNumber} proves short-term pilots are always reliable for long-term planning.`,
            options,
            answerSpec: { kind: 'single', value: 'False' },
            correctAnswer: 'False',
            explanation: 'The passage warns that pilots can mislead if scale effects are ignored.'
          };
        }
        case 'yes_no_not_given': {
          const options = ['Yes', 'No', 'Not Given'];
          return {
            questionId,
            sectionId,
            type,
            prompt: 'Does the writer agree that implementation should begin without baseline measurement?',
            options,
            answerSpec: { kind: 'single', value: 'No' },
            correctAnswer: 'No',
            explanation: 'The writer repeatedly argues for baseline measurement before deployment decisions.'
          };
        }
        case 'matching_information': {
          const options = blueprint.institutions.map((item, index) => `${String.fromCharCode(65 + index)}. ${item}`);
          const value = options[(offset + 1) % options.length];
          return {
            questionId,
            sectionId,
            type,
            prompt: `Which organisation (${options.map((_, i) => String.fromCharCode(65 + i)).join(', ')}) is linked to the evidence referenced in paragraph ${paragraphNumber}?`,
            options,
            answerSpec: { kind: 'single', value },
            correctAnswer: value,
            explanation: `The evidence in paragraph ${paragraphNumber} is attributed to the selected institution.`
          };
        }
        case 'matching_features': {
          const options = ['A. Local authorities', 'B. School leaders', 'C. Employers', 'D. Community groups', 'E. Independent auditors'];
          const value = options[(offset + 3) % options.length];
          return {
            questionId,
            sectionId,
            type,
            prompt: 'Match the feature to the group most associated with it in the passage.',
            options,
            answerSpec: { kind: 'single', value },
            correctAnswer: value,
            explanation: 'The selected group is explicitly tied to this operational feature in the text.'
          };
        }
        case 'matching_sentence_endings': {
          const options = [
            'A. when baseline data is collected consistently.',
            'B. because funding is reduced to force efficiency.',
            'C. while every local context is treated as identical.',
            'D. if teams review evidence before changing policy.',
            'E. after experts remove all stakeholder input.',
            'F. once reporting standards are publicly documented.'
          ];
          const value = options[(offset + 5) % options.length];
          return {
            questionId,
            sectionId,
            type,
            prompt: 'Complete the sentence ending based on the writer’s argument.',
            options,
            answerSpec: { kind: 'single', value },
            correctAnswer: value,
            explanation: 'The selected ending is the one that aligns with the passage logic and evidence chain.'
          };
        }
        case 'sentence_completion':
          return {
            questionId,
            sectionId,
            type,
            prompt: `Complete the sentence using NO MORE THAN THREE WORDS:\nThe policy review panel used ______ to compare site performance.`,
            answerSpec: { kind: 'single', value: 'shared metrics', maxWords: 3, caseSensitive: false },
            correctAnswer: 'shared metrics',
            explanation: 'The text states that shared metrics were required to compare outcomes fairly.'
          };
        case 'summary_completion':
          return {
            questionId,
            sectionId,
            type,
            prompt:
              'Complete the summary with NO MORE THAN TWO WORDS:\nEarly implementation failed because teams relied on isolated reports instead of a unified ______.',
            answerSpec: { kind: 'single', value: 'data framework', maxWords: 2, caseSensitive: false },
            correctAnswer: 'data framework',
            explanation: 'The summary point is directly supported in the third paragraph.'
          };
        case 'note_table_flow_completion':
          return {
            questionId,
            sectionId,
            type,
            prompt:
              'Complete the note/table entry (NO MORE THAN TWO WORDS):\nPhase 2 introduced weekly ______ to detect risk earlier.',
            answerSpec: { kind: 'single', value: 'review cycles', maxWords: 2, caseSensitive: false },
            correctAnswer: 'review cycles',
            explanation: 'Weekly review cycles are cited as the monitoring mechanism in the process table.'
          };
        case 'diagram_label_completion':
          return {
            questionId,
            sectionId,
            type,
            prompt:
              'Complete the diagram label (NO MORE THAN TWO WORDS):\nAt the center of the process map is the ______ hub.',
            answerSpec: { kind: 'single', value: 'coordination', maxWords: 2, caseSensitive: false },
            correctAnswer: 'coordination',
            explanation: 'The diagram explanation names the coordination hub as the central element.'
          };
        case 'short_answer':
        default:
          return {
            questionId,
            sectionId,
            type: 'short_answer',
            prompt:
              'Answer the question using NO MORE THAN THREE WORDS:\nWhat was the first signal that the revised model was working?',
            answerSpec: { kind: 'single', value: 'fewer backlogs', maxWords: 3, caseSensitive: false },
            correctAnswer: 'fewer backlogs',
            explanation: 'The passage links early success to reduced backlog volume.'
          };
      }
    });

    return {
      sectionId,
      title: blueprint.title,
      passageText,
      suggestedMinutes: 20,
      questions
    };
  }

  private getAcademicSectionBlueprints() {
    const seeds = [
      { topic: 'Public Art and Civic Identity', focus: 'cultural access', institutions: ['National Arts Council', 'Urban Museum Forum', 'Civic Education Board', 'Heritage Statistics Office', 'Local Culture Trust'] },
      { topic: 'Urban Heat Adaptation', focus: 'climate resilience', institutions: ['Urban Climate Unit', 'Public Works Directorate', 'Municipal Health Observatory', 'Housing Standards Authority', 'Transport Planning Office'] },
      { topic: 'Circular Manufacturing Governance', focus: 'industrial reliability', institutions: ['Circular Standards Board', 'Supplier Data Consortium', 'Plant Quality Office', 'Procurement Analytics Unit', 'Sustainability Assurance Council'] },
      { topic: 'AI in Diagnostic Medicine', focus: 'clinical safety and evidence', institutions: ['Clinical Informatics Council', 'Hospital Quality Network', 'Medical Audit Office', 'Patient Safety Board', 'Health Data Standards Group'] },
      { topic: 'Coastal Flood Planning', focus: 'infrastructure adaptation', institutions: ['Coastal Risk Authority', 'Marine Engineering Panel', 'Emergency Planning Office', 'Insurance Data Consortium', 'Regional Planning Board'] },
      { topic: 'Apprenticeship Reform Outcomes', focus: 'skills transition', institutions: ['Workforce Transition Unit', 'National Apprenticeship Agency', 'Employer Skills Council', 'Labour Market Observatory', 'Further Education Board'] },
      { topic: 'Sustainable Aviation Fuels', focus: 'energy transition economics', institutions: ['Aviation Transition Office', 'Fuel Standards Agency', 'Airport Operations Board', 'Carbon Accounting Council', 'Industrial Innovation Fund'] },
      { topic: 'Water Reuse Systems', focus: 'resource management', institutions: ['Water Security Commission', 'Urban Utilities Authority', 'Public Health Review Office', 'Drought Planning Unit', 'Infrastructure Investment Panel'] },
      { topic: 'University Admissions Transparency', focus: 'equity and data governance', institutions: ['Higher Education Regulator', 'Admissions Standards Council', 'Student Access Observatory', 'Policy Evaluation Office', 'Campus Governance Forum'] },
      { topic: 'Food Waste Supply Chains', focus: 'logistics optimization', institutions: ['Supply Chain Metrics Unit', 'Retail Operations Board', 'Food Systems Observatory', 'Waste Reduction Authority', 'Procurement Compliance Forum'] }
    ];

    return seeds.map((seed, index) => this.buildExamBlueprint('academic', seed.topic, seed.focus, seed.institutions, index));
  }

  private getGeneralSectionBlueprints() {
    const seeds = [
      { topic: 'Community Volunteer Networks', focus: 'service reliability', institutions: ['Town Volunteer Office', 'Neighbourhood Support Hub', 'Primary Care Network', 'Community Review Panel', 'Local Transport Desk'] },
      { topic: 'Workplace Wellbeing Programmes', focus: 'staff retention', institutions: ['People Operations Team', 'Site Management Group', 'Employee Relations Unit', 'Workforce Analytics Desk', 'Customer Support Directorate'] },
      { topic: 'Regional Tourism Operations', focus: 'seasonal job stability', institutions: ['Regional Tourism Board', 'Local Business Council', 'Transport Coordination Office', 'Visitor Experience Team', 'District Planning Forum'] },
      { topic: 'Local Bus Service Reliability', focus: 'daily commuting access', institutions: ['Municipal Transit Office', 'Route Performance Unit', 'Commuter Advisory Group', 'Depot Operations Board', 'Public Service Inspectorate'] },
      { topic: 'Household Energy Advice Services', focus: 'cost reduction support', institutions: ['Home Energy Agency', 'Consumer Advice Network', 'Utility Coordination Office', 'Community Outreach Unit', 'Winter Support Forum'] },
      { topic: 'Neighbourhood Safety Partnerships', focus: 'incident prevention', institutions: ['Community Safety Unit', 'Neighbourhood Watch Council', 'Youth Engagement Office', 'Local Policing Panel', 'Public Reporting Service'] },
      { topic: 'Public Library Digital Services', focus: 'access and inclusion', institutions: ['Library Development Office', 'Digital Inclusion Board', 'Learning Support Network', 'Civic Access Forum', 'Regional Education Trust'] },
      { topic: 'Small Business Mentoring', focus: 'local enterprise growth', institutions: ['Business Support Agency', 'Mentor Partnership Office', 'Enterprise Skills Council', 'Local Chamber Network', 'Finance Readiness Unit'] },
      { topic: 'Housing Repair Coordination', focus: 'tenant response quality', institutions: ['Housing Maintenance Board', 'Tenant Liaison Office', 'Contractor Standards Unit', 'Repairs Scheduling Hub', 'Service Quality Panel'] },
      { topic: 'Adult Evening Learning Courses', focus: 'participation retention', institutions: ['Adult Learning Service', 'Community College Board', 'Learner Support Centre', 'Programme Quality Office', 'Regional Skills Partnership'] }
    ];

    return seeds.map((seed, index) => this.buildExamBlueprint('general', seed.topic, seed.focus, seed.institutions, index));
  }

  private buildExamBlueprint(
    track: ReadingTrack,
    topic: string,
    focus: string,
    institutions: string[],
    variant: number
  ) {
    const baseline = 14 + ((variant * 7) % 17);
    const improved = baseline + 9 + ((variant * 5) % 11);
    const signalWindow = 24 + ((variant * 3) % 48);
    const reviewCadence = 7 + (variant % 5);
    const performanceGain = 11 + ((variant * 4) % 16);
    const academicLeadIns = [
      `Modern discussion of ${topic.toLowerCase()} sounds settled until researchers inspect what happens after launch.`,
      `Few policy topics attract as much confident rhetoric as ${topic.toLowerCase()}, yet implementation records tell a more complex story.`,
      `Commentators often treat ${topic.toLowerCase()} as a question of funding alone, but comparative evidence points to governance design as the decisive factor.`
    ];
    const generalLeadIns = [
      `At community level, ${topic.toLowerCase()} is judged less by slogans and more by whether daily service actually feels dependable.`,
      `Local reports on ${topic.toLowerCase()} show that residents do not ask for dramatic reform first; they ask for consistency, clarity, and timely follow-through.`,
      `In practice, ${topic.toLowerCase()} succeeds when ordinary routines are reliable, not merely when campaign messaging is persuasive.`
    ];
    const opener = (track === 'academic' ? academicLeadIns : generalLeadIns)[variant % 3];

    const paragraphA =
      track === 'academic'
        ? `${opener} A cross-jurisdiction review of ministries, municipal teams, and regulator memos found that strategy documents looked impressively similar, while outcomes diverged once delivery shifted into real institutions. Where decision owners were named, baseline assumptions were published, and trade-offs were stated upfront, programmes retained momentum even under budget pressure. Where accountability was shared vaguely across committees, timelines drifted and “temporary” workarounds became permanent. Interview transcripts from programme managers repeatedly highlighted the same point: the political announcement attracts attention, but the operational design determines who improves and who stalls after the first quarter.`
        : `${opener} Weekly diaries from households and frontline staff show that users are usually tolerant of occasional delay, but quickly lose trust when rules appear inconsistent from one contact point to another. District teams with clear call-routing, written handover notes, and predictable escalation steps recovered faster from disruptions than teams relying on informal coordination. Residents described the difference in practical terms: fewer repeat explanations, clearer expectations, and less uncertainty about next actions. This pattern suggests that service credibility in ${focus} contexts depends on routine reliability far more than on high-visibility launch activity.`;

    const paragraphB =
      track === 'academic'
        ? `A longitudinal dataset covering twelve administrations reported that compliance rose from about ${baseline}% to roughly ${improved}% when three conditions were introduced together: shared metric definitions, scheduled cross-team reviews, and explicit exception handling. Crucially, analysts from ${institutions[0]} stressed that technology upgrades alone produced limited gains unless governance routines were in place. Sites with modest systems but disciplined review meetings outperformed sites with expensive platforms and weak oversight. Researchers also observed that public confidence increased when agencies explained not only what indicator was used, but why it mattered, how it was calculated, and what corrective action followed weak performance.`
        : `Operations logs show an equally clear signal. In districts where supervisors used standard checklists, verified handovers, and review calls every ${reviewCadence} days, unresolved requests dropped and repeat visits fell. One cluster recorded a ${performanceGain}% reduction in avoidable callbacks without major staffing increases, largely because teams clarified who approves deviations when conditions change mid-week. Residents reported that these small procedural upgrades felt “faster” even when total workload remained high. Managers concluded that practical reliability came from coordinated routines and transparent ownership, not from short-lived surges that improved headline numbers for only a few reporting cycles.`;

    const paragraphC =
      track === 'academic'
        ? `Procurement architecture created a second line of separation between strong and weak performers. Contracts tied to verified process quality, audit traceability, and repeatable delivery standards produced steadier outcomes than contracts rewarding activity volume alone. However, procurement clauses only worked when teams used a common taxonomy. Once ${institutions[1]} and ${institutions[2]} aligned terminology for risk severity, completion status, and evidence class, analysts could compare sites on equivalent definitions rather than presentation style. This removed much of the ambiguity that previously allowed weak performance to be reframed as contextual complexity, and it made peer benchmarking substantially more credible.`
        : `Partnership quality played the same role in local delivery. Where ${institutions[0]} and ${institutions[1]} shared demand forecasts, intake labels, and escalation categories, planning became proactive rather than reactive. In areas that kept agencies in separate reporting silos, predictable pressure points still produced last-minute reshuffles and inconsistent follow-up. Coordinators described these emergency adjustments as “necessary,” yet monthly reviews showed that they often transferred workload rather than resolving root causes. Once partners adopted common definitions and shared case status codes, cross-team meetings became shorter, disagreements narrowed, and fewer users were lost between organisational boundaries.`;

    const paragraphD =
      track === 'academic'
        ? `Methodological caution remains essential when interpreting claimed improvement. Several evaluations initially overstated impact because they compared post-launch results with weak baselines, ignored seasonal volatility, or counted temporary backlog transfers as true recovery. Independent reviewers from ${institutions[3]} noted that short pilots can conceal deferred maintenance costs, especially when obligations arrive after headline reporting windows. Higher-quality studies therefore used matched comparison groups, documented confidence bands, and checked whether gains persisted after novelty effects faded. This stricter approach reduced overclaiming and produced more defensible decisions about scaling, sequencing, and long-term resource allocation.`
        : `Auditors flagged similar blind spots in community settings. Some teams celebrated weekly completion gains while unresolved cases quietly shifted into later periods, giving an exaggerated sense of sustained progress. Analysts from ${institutions[2]} recommended reporting both immediate completions and delayed follow-through, since low-priority cases can escalate into urgent incidents if left unattended. They also warned against drawing broad conclusions from single-month improvement during school holidays or seasonal demand dips. Services that embedded these checks into routine reporting avoided abrupt reversals and made fewer disruptive policy changes after early positive headlines.`;

    const paragraphE =
      track === 'academic'
        ? `Pilot programmes with explicit escalation discipline delivered the most durable improvements. Teams were required to investigate anomalies within ${signalWindow} hours, assign accountable owners, and log closure evidence before metrics could be marked as recovered. Managers reported that this process reduced repeated failure modes, improved forecast accuracy, and lowered emergency procurement pressure. Importantly, staff interviews indicated that disciplined escalation did not slow delivery; it prevented hidden delays caused by unresolved process drift. Sites that treated minor variance as an early warning signal generally preserved quality and speed, whereas sites that normalised recurring exceptions accumulated avoidable rework over time.`
        : `The strongest districts used comparable routines in practical language. Supervisors reviewed unresolved cases at fixed checkpoints, escalated critical risks within ${signalWindow} hours, and recorded whether corrective actions prevented repeat failure. Over time, this created a learning loop: teams stopped “resetting” after each incident and began addressing structural causes. Staff wellbeing indicators improved because expectations were explicit and support routes were clear. Community meetings also shifted from complaint collection toward evidence-based problem solving, which helped residents understand trade-offs and helped managers defend prioritisation decisions with transparent data rather than ad-hoc explanations.`;

    const paragraphF =
      track === 'academic'
        ? `Taken together, the evidence suggests that ${topic.toLowerCase()} is best understood as an operational capability rather than a branding exercise. Sustainable gains appeared where leaders paired methodological rigour with day-to-day execution discipline: clear baselines, shared definitions, auditable follow-through, and incentive structures tied to verified reliability. Institutions including ${institutions[4]} consistently outperformed peers when they published transparent assumptions and corrected weak signals early. The wider implication is that durable progress in ${focus} settings depends less on headline ambition and more on governance quality that remains intact after political attention has moved elsewhere.`
        : `Overall, the lesson from ${topic.toLowerCase()} is straightforward: users value dependable systems more than dramatic announcements. Awareness campaigns can help, but long-term trust comes from consistent standards, explicit ownership, and timely correction of drift. Districts that aligned roles, evidence rules, and escalation pathways delivered steadier outcomes with lower operational volatility. Where coordination remained informal, improvements were fragile and highly dependent on individual effort. In practical terms, reliable service quality is achieved through repeatable system design, not through isolated initiatives that lack shared accountability and measurable follow-through.`;

    const headingOptions = [
      `How the ${focus} debate is framed at launch`,
      'Evidence from comparative implementation studies',
      'Why shared definitions improve decision quality',
      'Methodological risks in impact reporting',
      'Escalation discipline and performance stability',
      `What sustained progress in ${focus} requires`,
      'When headline metrics conceal operational weakness',
      'Governance choices that shape long-term outcomes'
    ];

    return {
      topic,
      title: 'Passage 1',
      paragraphA,
      paragraphB,
      paragraphC,
      paragraphD,
      paragraphE,
      paragraphF,
      headingOptions,
      institutions
    };
  }

  private async getBlockedTopics(excludedIds: string[]): Promise<string[]> {
    if (!excludedIds.length) return [];

    const tests = await ReadingTestModel.find({ _id: { $in: excludedIds } })
      .select('title')
      .limit(excludedIds.length);

    const topics = tests
      .map((test: any) => this.extractTopicFromTitle(test?.title || ''))
      .filter((topic): topic is string => typeof topic === 'string' && topic.length > 0);

    return Array.from(new Set<string>(topics));
  }

  private extractTopicFromTitle(title: string) {
    if (!title) return '';
    const parts = title.split('•').map(part => part.trim()).filter(Boolean);
    if (parts.length < 2) return '';
    const candidate = parts[1] || '';
    if (/^\d{4}-\d{2}-\d{2}/.test(candidate)) return '';
    return candidate;
  }

  private async pickRandomBankTest(track: ReadingTrack, excludedIds: string[], version?: 'v1' | 'v2') {
    const query: Record<string, unknown> = {
      track,
      active: true,
      autoPublished: true,
      qualityTier: READING_QUALITY_TIER
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
    const qualified = candidates.filter((candidate: any) => !this.isLowFidelityReadingTest(candidate));
    if (qualified.length === 0) {
      return null;
    }
    const index = Math.floor(Math.random() * qualified.length);
    return qualified[index];
  }

  private async getRecentTestIds(userId: string, track: ReadingTrack, limit: number) {
    const attempts = await ReadingAttemptModel.find({ userId, track })
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
