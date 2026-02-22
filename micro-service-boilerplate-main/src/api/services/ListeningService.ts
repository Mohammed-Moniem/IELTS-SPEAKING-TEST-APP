import { Service } from 'typedi';

import { CSError } from '@errors/CSError';
import { CODES, HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { constructLogMessage } from '@lib/env/helpers';
import { Logger } from '@lib/logger';
import { ListeningAttemptModel } from '@models/ListeningAttemptModel';
import { ListeningTestModel } from '@models/ListeningTestModel';
import { UserModel } from '@models/UserModel';

import { AIOrchestrationService } from './AIOrchestrationService';
import { UsageService } from './UsageService';

@Service()
export class ListeningService {
  private readonly log = new Logger(__filename);

  constructor(
    private readonly aiOrchestrationService: AIOrchestrationService,
    private readonly usageService: UsageService
  ) {}

  public async startTest(userId: string, track: 'academic' | 'general', headers: IRequestHeaders) {
    const logMessage = constructLogMessage(__filename, 'startTest', headers);
    const plan = await this.getUserPlan(userId);

    await this.usageService.assertModuleAllowance(userId, plan, 'listening', headers);
    await this.usageService.incrementModuleUsage(userId, 'listening');

    let test = await ListeningTestModel.findOne({ track, active: true, autoPublished: true }).sort({ updatedAt: -1 });
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
        title: test.title,
        sectionTitle: test.sectionTitle,
        transcript: test.transcript,
        audioUrl: test.audioUrl,
        suggestedTimeMinutes: test.suggestedTimeMinutes,
        questions: test.questions.map(q => ({
          questionId: q.questionId,
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
    answers: Array<{ questionId: string; answer: string }>,
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

    const answerMap = new Map(answers.map(answer => [answer.questionId, answer.answer]));
    const markedAnswers = test.questions.map(question => {
      const submitted = answerMap.get(question.questionId) || '';
      const expected = (question.correctAnswer || '').trim().toLowerCase();
      const normalized = submitted.trim().toLowerCase();

      return {
        questionId: question.questionId,
        answer: submitted,
        isCorrect: normalized === expected
      };
    });

    const score = markedAnswers.filter(item => item.isCorrect).length;
    const incorrectTopics = test.questions.filter(question => {
      const match = markedAnswers.find(answer => answer.questionId === question.questionId);
      return !match?.isCorrect;
    });

    const feedback = await this.aiOrchestrationService.evaluateObjectiveModule(
      {
        module: 'listening',
        score,
        totalQuestions: test.questions.length,
        track: test.track,
        incorrectTopics: incorrectTopics.map(q => q.type)
      },
      {
        userId,
        plan: await this.getUserPlan(userId)
      }
    );

    attempt.answers = markedAnswers;
    attempt.score = score;
    attempt.totalQuestions = test.questions.length;
    attempt.normalizedBand = feedback.normalizedBand;
    attempt.durationSeconds = Math.max(0, Math.round(durationSeconds || 0));
    attempt.feedback = {
      summary: feedback.feedback.summary,
      suggestions: feedback.feedback.suggestions,
      strengths: feedback.feedback.strengths,
      improvements: feedback.feedback.improvements
    };
    attempt.model = feedback.model;
    attempt.status = 'completed';
    await attempt.save();

    this.log.info(`${logMessage} :: Completed listening attempt ${attempt._id}`);

    return attempt;
  }

  public async getAttempt(userId: string, attemptId: string) {
    const attempt = await ListeningAttemptModel.findOne({ _id: attemptId, userId }).populate('testId');
    if (!attempt) {
      throw new CSError(HTTP_STATUS_CODES.NOT_FOUND, CODES.NotFound, 'Listening attempt not found');
    }

    return attempt;
  }

  public async getHistory(userId: string, limit: number, offset: number) {
    return ListeningAttemptModel.find({ userId }).sort({ createdAt: -1 }).skip(offset).limit(limit);
  }

  private async getUserPlan(userId: string) {
    const user = await UserModel.findById(userId).select('subscriptionPlan');
    if (!user) {
      throw new CSError(HTTP_STATUS_CODES.NOT_FOUND, CODES.NotFound, 'User not found');
    }

    return user.subscriptionPlan;
  }
}
