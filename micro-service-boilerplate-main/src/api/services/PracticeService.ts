import { getPracticeQuestion } from '@api/data/practiceQuestions';
import { CSError } from '@errors/CSError';
import { CODES, HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { constructLogMessage } from '@lib/env/helpers';
import { Logger } from '@lib/logger';
import { UserStats } from '@models/AchievementModel';
import { PracticeSessionDocument, PracticeSessionModel } from '@models/PracticeSessionModel';
import { TestPreferenceModel } from '@models/TestPreferenceModel';
import { UserModel } from '@models/UserModel';
import { Service } from 'typedi';
import { emitToUser } from '../../loaders/SocketIOLoader';
import { achievementTracker } from './AchievementTracker';
import { FeedbackService } from './FeedbackService';
import { PointsService } from './PointsService';
import { ReferralService } from './ReferralService';
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

    const preferences = await TestPreferenceModel.findOne({ user: userId }).lean();

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

    // Track achievement progress
    try {
      const sessionDate = new Date();
      await achievementTracker.trackPracticeCompletion(userId, {
        score: feedback.scores.overallBand,
        partNumber: session.part,
        duration: timeSpent,
        topicId: session.topicId
      });

      // Track time-based achievements (morning/night/weekend)
      await achievementTracker.trackTimeBased(userId, sessionDate);

      // Track seasonal achievements
      await achievementTracker.trackSeasonalPractice(userId, sessionDate);

      // Track speed achievements if completed quickly
      if (timeSpent) {
        const targetDurations: { [key: number]: number } = {
          1: 300, // Part 1: 5 minutes
          2: 180, // Part 2: 3 minutes (2 min talk + prep)
          3: 300 // Part 3: 5 minutes
        };

        const targetDuration = targetDurations[session.part];
        if (targetDuration && timeSpent <= targetDuration) {
          await achievementTracker.trackSpeedCompletion(userId, {
            partNumber: session.part,
            duration: timeSpent,
            targetDuration
          });
        }
      }

      // Track topic mastery if score is high
      if (feedback.scores.overallBand >= 8.0 && session.topicId) {
        await achievementTracker.trackTopicMastery(userId, {
          topicKey: session.topicId.toString(),
          topicName: 'Practice Topic', // You can enhance this with actual topic name
          score: feedback.scores.overallBand
        });
      }
    } catch (error: any) {
      this.log.error(`${logMessage} :: Error tracking achievements:`, error);
      // Don't fail the request if achievement tracking fails
    }

    // Grant practice points (Phase 2: Gamification)
    try {
      // Calculate score improvement
      const userStats = await UserStats.findOne({ userId });
      let scoreImprovement = 0;
      if (userStats && userStats.averageScore > 0) {
        scoreImprovement = feedback.scores.overallBand - userStats.averageScore;
      }

      // Check streak status
      const now = new Date();
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      const today = new Date(now);
      today.setHours(0, 0, 0, 0);

      let isStreakActive = false;
      let streakDays = 0;

      if (userStats && userStats.lastPracticeDate) {
        const lastPractice = new Date(userStats.lastPracticeDate);
        lastPractice.setHours(0, 0, 0, 0);

        // Streak continues if last practice was today or yesterday
        if (lastPractice.getTime() === yesterday.getTime() || lastPractice.getTime() === today.getTime()) {
          isStreakActive = true;
          streakDays = userStats.currentStreak || 1;
        }
      }

      // Grant points
      const pointsResult = await PointsService.grantPracticePoints(userId, sessionId, {
        scoreImprovement: scoreImprovement > 0 ? scoreImprovement : undefined,
        isStreakActive,
        streakDays: isStreakActive ? streakDays : undefined
      });

      // Emit socket event for real-time UI update
      emitToUser(userId, 'points:granted', {
        points: pointsResult.points,
        breakdown: pointsResult.breakdown,
        source: 'practice',
        sessionId
      });

      this.log.info(`${logMessage} :: Granted ${pointsResult.points} points to user ${userId}`, {
        breakdown: pointsResult.breakdown
      });
    } catch (error: any) {
      this.log.error(`${logMessage} :: Error granting practice points:`, error);
      // Don't fail the request if points grant fails
    }

    // Grant referral points if this is referee's first session (Phase 2: Gamification)
    try {
      const referralService = new ReferralService();
      await referralService.grantReferralPoints(userId);
    } catch (error: any) {
      this.log.error(`${logMessage} :: Error granting referral points:`, error);
      // Don't fail the request if referral points fail
    }

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
