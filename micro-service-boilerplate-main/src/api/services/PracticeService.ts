import { getPracticeQuestion } from '@api/data/practiceQuestions';
import { CSError } from '@errors/CSError';
import { CODES, HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { constructLogMessage } from '@lib/env/helpers';
import { Logger } from '@lib/logger';
import { PracticeSessionDocument, PracticeSessionModel } from '@models/PracticeSessionModel';
import { TestPreferenceModel } from '@models/TestPreferenceModel';
import { UserModel } from '@models/UserModel';
import { Service } from 'typedi';
import { FeedbackService } from './FeedbackService';
import { TopicService } from './TopicService';
import { UsageService } from './UsageService';

@Service()
export class PracticeService {
  private log = new Logger(__filename);

  constructor(
    private readonly topicService: TopicService,
    private readonly usageService: UsageService,
    private readonly feedbackService: FeedbackService
  ) {}

  public async startSession(userId: string, topicSlug: string, headers: IRequestHeaders) {
    const logMessage = constructLogMessage(__filename, 'startSession', headers);

    const user = await UserModel.findById(userId);
    if (!user) {
      throw new CSError(HTTP_STATUS_CODES.NOT_FOUND, CODES.NotFound, 'User not found');
    }

    await this.usageService.assertPracticeAllowance(userId, user.subscriptionPlan, headers);

    const topic = await this.topicService.getTopicBySlug(topicSlug, headers);
    if (!topic) {
      throw new CSError(HTTP_STATUS_CODES.NOT_FOUND, CODES.NotFound, 'Topic not found');
    }

    if (topic.isPremium && user.subscriptionPlan === 'free') {
      throw new CSError(HTTP_STATUS_CODES.FORBIDDEN, CODES.PremiumRequired, 'Upgrade required to access this topic');
    }

    // Try to get hardcoded question first (for backward compatibility)
    // If not found, use the topic's description as the question
    const questionData = getPracticeQuestion(topic.slug);
    const question = questionData?.question || topic.description;
    const timeLimit = questionData?.timeLimit || (topic.part === 2 ? 180 : 120);
    const tips = questionData?.tips || this.getDefaultTips(topic.part);

    // Increment usage counter IMMEDIATELY after passing allowance check
    // This prevents race conditions where multiple sessions can be started simultaneously
    await this.usageService.incrementPractice(userId);

    const session = await PracticeSessionModel.create({
      user: userId,
      topicId: topic.slug,
      topicTitle: topic.title,
      question: question,
      part: topic.part,
      category: topic.category,
      difficulty: topic.difficulty,
      status: 'in_progress',
      startedAt: new Date()
    });

    this.log.info(`${logMessage} :: Started session ${session._id}`);

    return {
      sessionId: session._id,
      topic,
      question: question,
      timeLimit: timeLimit,
      tips: tips
    };
  }

  private getDefaultTips(part: number): string[] {
    switch (part) {
      case 1:
        return [
          'Give specific details in your answer',
          'Keep your response natural and conversational',
          'Aim for 1-2 minutes of speaking',
          'Use examples from your own experience'
        ];
      case 2:
        return [
          'Use the preparation time to organize your thoughts',
          'Speak for the full 2 minutes if possible',
          'Include specific details and personal feelings',
          'Follow the bullet points provided in the cue card'
        ];
      case 3:
        return [
          'Give balanced arguments for different viewpoints',
          'Support your opinions with clear reasons',
          'Use examples to illustrate your points',
          'Think about broader implications and future trends'
        ];
      default:
        return [
          'Speak clearly and naturally',
          'Give detailed responses',
          'Use examples to support your points',
          'Stay focused on the question'
        ];
    }
  }

  public async completeSession(
    userId: string,
    sessionId: string,
    response: string | undefined,
    timeSpent: number | undefined,
    headers: IRequestHeaders
  ) {
    const logMessage = constructLogMessage(__filename, 'completeSession', headers);

    const session = (await PracticeSessionModel.findOne({
      _id: sessionId,
      user: userId
    })) as PracticeSessionDocument | null;
    if (!session) {
      throw new CSError(HTTP_STATUS_CODES.NOT_FOUND, CODES.NotFound, 'Practice session not found');
    }

    if (session.status === 'completed') {
      return session;
    }

    const preferences = await TestPreferenceModel.findOne({ user: userId }).lean<{ targetBand?: string }>();

    const feedback = await this.feedbackService.generatePracticeFeedback(
      session.question,
      response || '',
      preferences?.targetBand,
      headers
    );

    session.status = 'completed';
    session.userResponse = response;
    session.timeSpent = timeSpent;
    session.feedback = {
      overallBand: feedback.scores.overallBand,
      bandBreakdown: {
        pronunciation: feedback.scores.pronunciation,
        fluency: feedback.scores.fluency,
        lexicalResource: feedback.scores.lexicalResource,
        grammaticalRange: feedback.scores.grammaticalRange
      },
      summary: feedback.summary,
      strengths: feedback.strengths,
      improvements: feedback.improvements,
      generatedAt: new Date(),
      model: feedback.model
    };
    session.completedAt = new Date();
    await session.save();

    // Usage was already incremented at session start to prevent race conditions

    this.log.info(`${logMessage} :: Completed session ${sessionId}`);

    return session;
  }

  public async listSessions(
    userId: string,
    limit: number,
    offset: number,
    topicSlug: string | undefined,
    _headers: IRequestHeaders
  ) {
    const query: Record<string, any> = { user: userId };
    if (topicSlug) {
      query.topicId = topicSlug;
    }

    const sessions = await PracticeSessionModel.find(query).sort({ createdAt: -1 }).skip(offset).limit(limit);

    return sessions;
  }
}
