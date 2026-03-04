import { Service } from 'typedi';

import { CSError } from '@errors/CSError';
import { CODES, HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { Types } from '@lib/db/mongooseCompat';
import { AdminAuditLogModel } from '@models/AdminAuditLogModel';
import { AIUsageLogModel } from '@models/AIUsageLogModel';
import { UserStats } from '@models/AchievementModel';
import { FullExamSessionModel } from '@models/FullExamSessionModel';
import { ListeningAttemptModel } from '@models/ListeningAttemptModel';
import { Partner, PartnerAttributionTouch, PartnerConversion } from '@models/PartnerProgramModel';
import { PracticeSessionModel } from '@models/PracticeSessionModel';
import { ReadingAttemptModel } from '@models/ReadingAttemptModel';
import { SubscriptionModel } from '@models/SubscriptionModel';
import { TestSimulationModel } from '@models/TestSimulationModel';
import { TopicModel } from '@models/TopicModel';
import { SubscriptionPlan, UserModel } from '@models/UserModel';
import { WritingSubmissionModel } from '@models/WritingSubmissionModel';
import { FeatureFlagService } from './FeatureFlagService';

type IELTSModule = 'speaking' | 'writing' | 'reading' | 'listening';
type ProgressRange = '7d' | '30d' | '90d';
type ProgressModule = 'all' | IELTSModule;
type AdminWindow = '1h' | '24h' | '7d';
type DeltaDirection = 'up' | 'down' | 'flat';
type AlertSeverity = 'critical' | 'warning' | 'info';

type UnifiedAttempt = {
  module: IELTSModule;
  itemId: string;
  title: string;
  subtitle?: string;
  status: string;
  score: number;
  durationSeconds: number;
  createdAt: Date;
  href: string;
};

const PLAN_MONTHLY_PRICE: Record<SubscriptionPlan, number> = {
  free: 0,
  starter: 9,
  premium: 24,
  pro: 49,
  team: 99
};

@Service()
export class WebViewService {
  constructor(private readonly featureFlagService: FeatureFlagService) {}

  public async getLearnerDashboardView(userId: string, plan: SubscriptionPlan, _headers?: IRequestHeaders) {
    const userObjectId = this.toObjectId(userId, 'Invalid user id');

    const [
      userStats,
      completedPractices,
      completedSimulations,
      writingSubmissions,
      readingAttempts,
      listeningAttempts,
      inProgressPractice,
      inProgressSimulation,
      inProgressExam,
      recentTopics,
      practiceCount,
      simulationCount,
      writingCount,
      readingCount,
      listeningCount
    ] = await Promise.all([
      UserStats.findOne({ userId: userObjectId }),
      PracticeSessionModel.find({ user: userObjectId, status: 'completed' })
        .sort({ createdAt: -1 })
        .limit(12)
        .lean(),
      TestSimulationModel.find({ user: userObjectId, status: 'completed' })
        .sort({ createdAt: -1 })
        .limit(12)
        .lean(),
      WritingSubmissionModel.find({ userId: userObjectId })
        .sort({ createdAt: -1 })
        .limit(12)
        .lean(),
      ReadingAttemptModel.find({ userId: userObjectId, status: 'completed' })
        .sort({ createdAt: -1 })
        .limit(12)
        .lean(),
      ListeningAttemptModel.find({ userId: userObjectId, status: 'completed' })
        .sort({ createdAt: -1 })
        .limit(12)
        .lean(),
      PracticeSessionModel.findOne({ user: userObjectId, status: 'in_progress' }).sort({ updatedAt: -1 }).lean(),
      TestSimulationModel.findOne({ user: userObjectId, status: 'in_progress' }).sort({ updatedAt: -1 }).lean(),
      FullExamSessionModel.findOne({ userId: userObjectId, status: 'in_progress' }).sort({ updatedAt: -1 }).lean(),
      TopicModel.find({}).sort({ updatedAt: -1 }).limit(6).lean(),
      PracticeSessionModel.countDocuments({ user: userObjectId, status: 'completed' }),
      TestSimulationModel.countDocuments({ user: userObjectId, status: 'completed' }),
      WritingSubmissionModel.countDocuments({ userId: userObjectId }),
      ReadingAttemptModel.countDocuments({ userId: userObjectId, status: 'completed' }),
      ListeningAttemptModel.countDocuments({ userId: userObjectId, status: 'completed' })
    ]);

    const speakingScores = [
      ...completedPractices.map(item => Number(item.feedback?.overallBand || 0)).filter(item => item > 0),
      ...completedSimulations.map(item => Number(item.overallBand || 0)).filter(item => item > 0)
    ];
    const writingScores = writingSubmissions.map(item => Number(item.overallBand || 0)).filter(item => item > 0);
    const readingScores = readingAttempts.map(item => Number(item.normalizedBand || 0)).filter(item => item > 0);
    const listeningScores = listeningAttempts.map(item => Number(item.normalizedBand || 0)).filter(item => item > 0);
    const allScores = [...speakingScores, ...writingScores, ...readingScores, ...listeningScores];

    const averageBand = allScores.length > 0 ? this.round(this.average(allScores), 1) : this.round(userStats?.averageScore || 0, 1);
    const testsCompleted = practiceCount + simulationCount + writingCount + readingCount + listeningCount;
    const nextGoalBand = this.nextBandStep(averageBand || 5);
    const currentStreak = userStats?.currentStreak || 0;

    const activity = [
      ...(completedPractices.map(item => ({
        module: 'speaking',
        itemId: item._id.toString(),
        title: item.topicTitle || 'Speaking practice',
        subtitle: `Part ${item.part}`,
        status: item.status,
        score: this.round(Number(item.feedback?.overallBand || 0), 1),
        durationSeconds: Number(item.timeSpent || 0),
        createdAt: new Date(item.createdAt),
        href: `/app/speaking/history/${item._id.toString()}`
      })) as UnifiedAttempt[]),
      ...(completedSimulations.map(item => ({
        module: 'speaking',
        itemId: item._id.toString(),
        title: 'Speaking simulation',
        subtitle: `${item.parts?.length || 0} parts`,
        status: item.status,
        score: this.round(Number(item.overallBand || 0), 1),
        durationSeconds: this.sumNumbers((item.parts || []).map(part => Number(part.timeSpent || 0))),
        createdAt: new Date(item.createdAt),
        href: `/app/speaking/history/${item._id.toString()}`
      })) as UnifiedAttempt[]),
      ...(writingSubmissions.map(item => ({
        module: 'writing',
        itemId: item._id.toString(),
        title: item.taskType === 'task1' ? 'Writing Task 1' : 'Writing Task 2',
        subtitle: item.track || 'academic',
        status: item.status,
        score: this.round(Number(item.overallBand || 0), 1),
        durationSeconds: Number(item.durationSeconds || 0),
        createdAt: new Date(item.createdAt),
        href: `/app/writing/history/${item._id.toString()}`
      })) as UnifiedAttempt[]),
      ...(readingAttempts.map(item => ({
        module: 'reading',
        itemId: item._id.toString(),
        title: 'Reading test',
        subtitle: item.track || 'academic',
        status: item.status,
        score: this.round(Number(item.normalizedBand || 0), 1),
        durationSeconds: Number(item.durationSeconds || 0),
        createdAt: new Date(item.createdAt),
        href: `/app/reading/history/${item._id.toString()}`
      })) as UnifiedAttempt[]),
      ...(listeningAttempts.map(item => ({
        module: 'listening',
        itemId: item._id.toString(),
        title: 'Listening test',
        subtitle: item.track || 'academic',
        status: item.status,
        score: this.round(Number(item.normalizedBand || 0), 1),
        durationSeconds: Number(item.durationSeconds || 0),
        createdAt: new Date(item.createdAt),
        href: `/app/listening/history/${item._id.toString()}`
      })) as UnifiedAttempt[])
    ]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 20);

    const resumeCard = (() => {
      if (inProgressExam) {
        const completedSections = (inProgressExam.sections || []).filter(section => section.status === 'completed').length;
        const totalSections = (inProgressExam.sections || []).length || 4;
        return {
          type: 'exam',
          examId: inProgressExam._id.toString(),
          title: `Resume exam #${inProgressExam._id.toString().slice(-4)}`,
          subtitle: `Continue ${inProgressExam.runtime?.currentModule || 'next'} section`,
          progressPercent: this.round((completedSections / totalSections) * 100, 1),
          href: '/app/tests'
        };
      }

      if (inProgressSimulation) {
        return {
          type: 'simulation',
          simulationId: inProgressSimulation._id.toString(),
          title: 'Resume speaking simulation',
          subtitle: `${inProgressSimulation.parts?.length || 0} parts`,
          progressPercent: 0,
          href: '/app/speaking'
        };
      }

      if (inProgressPractice) {
        return {
          type: 'practice',
          sessionId: inProgressPractice._id.toString(),
          title: inProgressPractice.topicTitle || 'Resume practice',
          subtitle: `Part ${inProgressPractice.part || 1}`,
          progressPercent: 0,
          href: '/app/speaking'
        };
      }

      return null;
    })();

    return {
      generatedAt: new Date().toISOString(),
      plan,
      kpis: {
        averageBand,
        currentStreak,
        testsCompleted,
        nextGoalBand
      },
      quickPractice: [
        {
          module: 'speaking',
          title: 'Speaking Simulation',
          description: 'AI-powered interview simulation across part 1, 2, and 3.',
          href: '/app/speaking'
        },
        {
          module: 'writing',
          title: 'Writing Task 1 & 2',
          description: 'Timed writing tasks with full rubric scoring and inline feedback.',
          href: '/app/writing'
        },
        {
          module: 'reading',
          title: 'Reading Comprehension',
          description: 'Timed reading passages with review-before-submit controls.',
          href: '/app/reading'
        },
        {
          module: 'listening',
          title: 'Listening Practice',
          description: 'Audio-driven timed questions with navigator and review states.',
          href: '/app/listening'
        }
      ],
      resume: resumeCard,
      recommended: recentTopics.map(topic => ({
        topicId: topic._id.toString(),
        slug: topic.slug,
        title: topic.title,
        description: topic.description,
        part: topic.part,
        difficulty: topic.difficulty
      })),
      activity
    };
  }

  public async getLearnerProgressView(userId: string, rangeInput: string, moduleInput: string) {
    const userObjectId = this.toObjectId(userId, 'Invalid user id');
    const { key: range, from, to } = this.resolveRange(rangeInput);
    const module = this.resolveProgressModule(moduleInput);

    const [practiceRows, simulationRows, writingRows, readingRows, listeningRows] = await Promise.all([
      PracticeSessionModel.find({ user: userObjectId, status: 'completed', createdAt: { $gte: from, $lte: to } })
        .sort({ createdAt: -1 })
        .lean(),
      TestSimulationModel.find({ user: userObjectId, status: 'completed', createdAt: { $gte: from, $lte: to } })
        .sort({ createdAt: -1 })
        .lean(),
      WritingSubmissionModel.find({ userId: userObjectId, createdAt: { $gte: from, $lte: to } })
        .sort({ createdAt: -1 })
        .lean(),
      ReadingAttemptModel.find({ userId: userObjectId, status: 'completed', createdAt: { $gte: from, $lte: to } })
        .sort({ createdAt: -1 })
        .lean(),
      ListeningAttemptModel.find({ userId: userObjectId, status: 'completed', createdAt: { $gte: from, $lte: to } })
        .sort({ createdAt: -1 })
        .lean()
    ]);

    const attempts: UnifiedAttempt[] = [
      ...practiceRows.map(item => ({
        module: 'speaking' as const,
        itemId: item._id.toString(),
        title: item.topicTitle || 'Speaking practice',
        subtitle: `Part ${item.part}`,
        status: item.status,
        score: this.round(Number(item.feedback?.overallBand || 0), 1),
        durationSeconds: Number(item.timeSpent || 0),
        createdAt: new Date(item.createdAt),
        href: `/app/speaking/history/${item._id.toString()}`
      })),
      ...simulationRows.map(item => ({
        module: 'speaking' as const,
        itemId: item._id.toString(),
        title: 'Speaking simulation',
        subtitle: `${item.parts?.length || 0} parts`,
        status: item.status,
        score: this.round(Number(item.overallBand || 0), 1),
        durationSeconds: this.sumNumbers((item.parts || []).map(part => Number(part.timeSpent || 0))),
        createdAt: new Date(item.createdAt),
        href: `/app/speaking/history/${item._id.toString()}`
      })),
      ...writingRows.map(item => ({
        module: 'writing' as const,
        itemId: item._id.toString(),
        title: item.taskType === 'task1' ? 'Writing Task 1' : 'Writing Task 2',
        subtitle: item.track || 'academic',
        status: item.status,
        score: this.round(Number(item.overallBand || 0), 1),
        durationSeconds: Number(item.durationSeconds || 0),
        createdAt: new Date(item.createdAt),
        href: `/app/writing/history/${item._id.toString()}`
      })),
      ...readingRows.map(item => ({
        module: 'reading' as const,
        itemId: item._id.toString(),
        title: 'Reading test',
        subtitle: item.track || 'academic',
        status: item.status,
        score: this.round(Number(item.normalizedBand || 0), 1),
        durationSeconds: Number(item.durationSeconds || 0),
        createdAt: new Date(item.createdAt),
        href: `/app/reading/history/${item._id.toString()}`
      })),
      ...listeningRows.map(item => ({
        module: 'listening' as const,
        itemId: item._id.toString(),
        title: 'Listening test',
        subtitle: item.track || 'academic',
        status: item.status,
        score: this.round(Number(item.normalizedBand || 0), 1),
        durationSeconds: Number(item.durationSeconds || 0),
        createdAt: new Date(item.createdAt),
        href: `/app/listening/history/${item._id.toString()}`
      }))
    ];

    const filteredAttempts = module === 'all' ? attempts : attempts.filter(item => item.module === module);
    const scoredAttempts = filteredAttempts.filter(item => item.score > 0);
    const overallBand = scoredAttempts.length > 0 ? this.round(this.average(scoredAttempts.map(item => item.score)), 1) : 0;

    const skillBreakdown = {
      speaking: this.averageOrZero(attempts.filter(item => item.module === 'speaking').map(item => item.score)),
      writing: this.averageOrZero(attempts.filter(item => item.module === 'writing').map(item => item.score)),
      reading: this.averageOrZero(attempts.filter(item => item.module === 'reading').map(item => item.score)),
      listening: this.averageOrZero(attempts.filter(item => item.module === 'listening').map(item => item.score))
    };

    const totalDurationSeconds = this.sumNumbers(filteredAttempts.map(item => item.durationSeconds));
    const targetBand = this.nextBandStep(overallBand || 5);
    const trend = this.buildTrendSeries(from, to, filteredAttempts, targetBand);

    return {
      range,
      module,
      totals: {
        overallBand,
        predictedScore: this.round(Math.min(9, overallBand + 0.5), 1),
        testsCompleted: filteredAttempts.length,
        studyHours: this.round(totalDurationSeconds / 3600, 1)
      },
      trend,
      skillBreakdown,
      attempts: filteredAttempts
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 50)
        .map(item => ({
          ...item,
          createdAt: item.createdAt.toISOString()
        }))
    };
  }

  public async getAdminOverviewView(windowInput: string) {
    const { key: window, from, to } = this.resolveWindow(windowInput);
    const windowMs = to.getTime() - from.getTime();
    const previousTo = new Date(from.getTime() - 1);
    const previousFrom = new Date(previousTo.getTime() - windowMs);

    const [
      activeUsers,
      previousActiveUsers,
      subscriptions,
      previousSubscriptions,
      featureFlags,
      aiLogs,
      previousAiLogs,
      auditLogs
    ] = await Promise.all([
      UserModel.countDocuments({ lastLoginAt: { $gte: from, $lte: to } }),
      UserModel.countDocuments({ lastLoginAt: { $gte: previousFrom, $lte: previousTo } }),
      SubscriptionModel.find({ status: 'active' }).select('planType').lean(),
      SubscriptionModel.find({ status: 'active', subscriptionDate: { $lte: previousTo } }).select('planType').lean(),
      this.featureFlagService.listFlags(),
      AIUsageLogModel.find({ createdAt: { $gte: from, $lte: to } }).select('createdAt status estimatedCostUsd').lean(),
      AIUsageLogModel.find({ createdAt: { $gte: previousFrom, $lte: previousTo } })
        .select('createdAt status estimatedCostUsd')
        .lean(),
      AdminAuditLogModel.find({ createdAt: { $gte: from, $lte: to } }).sort({ createdAt: -1 }).limit(10).lean()
    ]);

    const estimatedRevenueUsd = this.round(
      subscriptions.reduce((sum, subscription) => sum + PLAN_MONTHLY_PRICE[subscription.planType] * 4.348, 0),
      2
    );
    const previousEstimatedRevenueUsd = this.round(
      previousSubscriptions.reduce((sum, subscription) => sum + PLAN_MONTHLY_PRICE[subscription.planType] * 4.348, 0),
      2
    );
    const aiCostUsd = this.round(this.sumNumbers(aiLogs.map(log => Number(log.estimatedCostUsd || 0))), 2);
    const previousAiCostUsd = this.round(this.sumNumbers(previousAiLogs.map(log => Number(log.estimatedCostUsd || 0))), 2);
    const successCount = aiLogs.filter(log => log.status === 'success').length;
    const previousSuccessCount = previousAiLogs.filter(log => log.status === 'success').length;
    const platformHealthPercent = aiLogs.length > 0 ? this.round((successCount / aiLogs.length) * 100, 2) : 100;
    const previousPlatformHealthPercent =
      previousAiLogs.length > 0 ? this.round((previousSuccessCount / previousAiLogs.length) * 100, 2) : 100;

    const latencySeries = this.buildWindowSeries(window, from, aiLogs.map(item => new Date(item.createdAt)));

    return {
      window,
      kpis: {
        activeUsers,
        estimatedRevenueUsd,
        aiCostUsd,
        platformHealthPercent
      },
      kpiDeltas: {
        activeUsers: this.buildDelta(activeUsers, previousActiveUsers),
        estimatedRevenueUsd: this.buildDelta(estimatedRevenueUsd, previousEstimatedRevenueUsd),
        aiCostUsd: this.buildDelta(aiCostUsd, previousAiCostUsd),
        platformHealthPercent: this.buildDelta(platformHealthPercent, previousPlatformHealthPercent)
      },
      latencySeries,
      featureFlagSummary: featureFlags.slice(0, 8).map(flag => ({
        key: flag.key,
        enabled: flag.enabled,
        rolloutPercentage: flag.rolloutPercentage
      })),
      alerts: auditLogs.map(log => ({
        id: log._id.toString(),
        action: log.action,
        targetType: log.targetType,
        targetId: log.targetId,
        createdAt: new Date(log.createdAt).toISOString(),
        severity: this.classifyAlertSeverity(log.action, log.targetType, log.details || {}),
        details: typeof log.details === 'object' && log.details !== null ? (log.details as Record<string, unknown>) : undefined
      })),
      deployments: []
    };
  }

  public async getAdminAnalyticsView(rangeInput: string) {
    const { key: range, from, to } = this.resolveRange(rangeInput);

    const [
      practiceRows,
      simulationRows,
      writingRows,
      readingRows,
      listeningRows,
      aiLogs,
      activeSubscriptions,
      registerUsersRaw,
      attributionTouchesRaw,
      firstPracticeAggRaw,
      firstPaidCount,
      partnerRegisterUsersRaw,
      partnerCheckoutUsersRaw
    ] = await Promise.all([
      PracticeSessionModel.find({ status: 'completed', createdAt: { $gte: from, $lte: to } })
        .select('user createdAt')
        .lean(),
      TestSimulationModel.find({ status: 'completed', createdAt: { $gte: from, $lte: to } })
        .select('user createdAt')
        .lean(),
      WritingSubmissionModel.find({ createdAt: { $gte: from, $lte: to } })
        .select('userId createdAt')
        .lean(),
      ReadingAttemptModel.find({ status: 'completed', createdAt: { $gte: from, $lte: to } })
        .select('userId createdAt')
        .lean(),
      ListeningAttemptModel.find({ status: 'completed', createdAt: { $gte: from, $lte: to } })
        .select('userId createdAt')
        .lean(),
      AIUsageLogModel.find({ createdAt: { $gte: from, $lte: to } }).select('module status estimatedCostUsd inputTokens outputTokens').lean(),
      SubscriptionModel.find({ status: 'active' }).select('planType').lean(),
      UserModel.find({ createdAt: { $gte: from, $lte: to } }).select('_id createdAt lastLoginAt subscriptionPlan').lean(),
      PartnerAttributionTouch.find({ touchedAt: { $gte: from, $lte: to } }).select('userId source touchedAt').lean(),
      PracticeSessionModel.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: '$user', firstAt: { $min: '$createdAt' } } },
        { $match: { firstAt: { $gte: from, $lte: to } } },
        { $count: 'count' }
      ]),
      SubscriptionModel.countDocuments({
        planType: { $ne: 'free' },
        subscriptionDate: { $gte: from, $lte: to }
      }),
      PartnerAttributionTouch.distinct('userId', {
        source: 'register',
        touchedAt: { $gte: from, $lte: to },
        userId: { $exists: true, $ne: null }
      }),
      PartnerAttributionTouch.distinct('userId', {
        source: 'checkout',
        touchedAt: { $gte: from, $lte: to },
        userId: { $exists: true, $ne: null }
      })
    ]);
    const registerUsers = registerUsersRaw as Array<any>;
    const attributionTouches = attributionTouchesRaw as Array<any>;
    const firstPracticeAgg = firstPracticeAggRaw as Array<{ count?: number }>;
    const partnerRegisterUsers = partnerRegisterUsersRaw as Array<Types.ObjectId | string>;
    const partnerCheckoutUsers = partnerCheckoutUsersRaw as Array<Types.ObjectId | string>;
    const daysInRange = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1);

    const previousTo = new Date(from.getTime() - 1);
    const previousFrom = new Date(previousTo);
    previousFrom.setUTCDate(previousFrom.getUTCDate() - (daysInRange - 1));
    previousFrom.setUTCHours(0, 0, 0, 0);

    const [
      previousPracticeUsersRaw,
      previousSimulationUsersRaw,
      previousWritingUsersRaw,
      previousReadingUsersRaw,
      previousListeningUsersRaw,
      previousAiLogs,
      previousActiveSubscriptions
    ] = await Promise.all([
      PracticeSessionModel.distinct('user', { status: 'completed', createdAt: { $gte: previousFrom, $lte: previousTo } }),
      TestSimulationModel.distinct('user', { status: 'completed', createdAt: { $gte: previousFrom, $lte: previousTo } }),
      WritingSubmissionModel.distinct('userId', { createdAt: { $gte: previousFrom, $lte: previousTo } }),
      ReadingAttemptModel.distinct('userId', { status: 'completed', createdAt: { $gte: previousFrom, $lte: previousTo } }),
      ListeningAttemptModel.distinct('userId', { status: 'completed', createdAt: { $gte: previousFrom, $lte: previousTo } }),
      AIUsageLogModel.find({ createdAt: { $gte: previousFrom, $lte: previousTo } })
        .select('estimatedCostUsd inputTokens outputTokens')
        .lean(),
      SubscriptionModel.find({ status: 'active', subscriptionDate: { $lte: previousTo } }).select('planType').lean()
    ]);

    const previousDistinctUsers = new Set([
      ...(previousPracticeUsersRaw as Array<Types.ObjectId | string>).map(value => value.toString()),
      ...(previousSimulationUsersRaw as Array<Types.ObjectId | string>).map(value => value.toString()),
      ...(previousWritingUsersRaw as Array<Types.ObjectId | string>).map(value => value.toString()),
      ...(previousReadingUsersRaw as Array<Types.ObjectId | string>).map(value => value.toString()),
      ...(previousListeningUsersRaw as Array<Types.ObjectId | string>).map(value => value.toString())
    ]).size;

    const mergedActivities = [
      ...practiceRows.map(item => ({ userId: item.user.toString(), createdAt: new Date(item.createdAt) })),
      ...simulationRows.map(item => ({ userId: item.user.toString(), createdAt: new Date(item.createdAt) })),
      ...writingRows.map(item => ({ userId: item.userId.toString(), createdAt: new Date(item.createdAt) })),
      ...readingRows.map(item => ({ userId: item.userId.toString(), createdAt: new Date(item.createdAt) })),
      ...listeningRows.map(item => ({ userId: item.userId.toString(), createdAt: new Date(item.createdAt) }))
    ];

    const seriesMap = new Map<string, { users: Set<string>; submissions: number }>();
    const cursor = new Date(from);
    while (cursor <= to) {
      const key = cursor.toISOString().slice(0, 10);
      seriesMap.set(key, { users: new Set<string>(), submissions: 0 });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    for (const row of mergedActivities) {
      const key = row.createdAt.toISOString().slice(0, 10);
      const bucket = seriesMap.get(key);
      if (!bucket) continue;
      bucket.users.add(row.userId);
      bucket.submissions += 1;
    }

    const trafficSeries = Array.from(seriesMap.entries()).map(([date, bucket]) => ({
      date,
      activeUsers: bucket.users.size,
      submissions: bucket.submissions
    }));

    const aiByModule = new Map<string, { costUsd: number; requests: number }>();
    let totalAiCost = 0;
    let totalRequests = 0;
    let totalTokens = 0;

    for (const log of aiLogs) {
      const key = log.module;
      const existing = aiByModule.get(key) || { costUsd: 0, requests: 0 };
      existing.costUsd += Number(log.estimatedCostUsd || 0);
      existing.requests += 1;
      aiByModule.set(key, existing);

      totalAiCost += Number(log.estimatedCostUsd || 0);
      totalRequests += 1;
      totalTokens += Number(log.inputTokens || 0) + Number(log.outputTokens || 0);
    }

    const aiBreakdown = Array.from(aiByModule.entries())
      .map(([module, value]) => ({
        module,
        costUsd: this.round(value.costUsd, 4),
        requests: value.requests
      }))
      .sort((a, b) => b.costUsd - a.costUsd);

    const [partnerPerformance, apiHealth] = await Promise.all([
      this.buildPartnerPerformance(from, to),
      this.buildApiHealth(from, to)
    ]);

    const estimatedRevenueUsd = this.round(
      activeSubscriptions.reduce((sum, subscription) => sum + PLAN_MONTHLY_PRICE[subscription.planType] * 4.348, 0),
      2
    );
    const previousEstimatedRevenueUsd = this.round(
      previousActiveSubscriptions.reduce((sum, subscription) => sum + PLAN_MONTHLY_PRICE[subscription.planType] * 4.348, 0),
      2
    );
    const grossMarginPercent =
      estimatedRevenueUsd > 0 ? this.round(((estimatedRevenueUsd - totalAiCost) / estimatedRevenueUsd) * 100, 2) : 0;
    const distinctUsers = new Set(mergedActivities.map(row => row.userId)).size;
    const activeUsersDaily = this.round(distinctUsers / daysInRange, 2);
    const avgTokenCostUsd = totalTokens > 0 ? this.round(totalAiCost / totalTokens, 6) : 0;

    let previousTotalAiCost = 0;
    let previousTotalTokens = 0;
    for (const log of previousAiLogs) {
      previousTotalAiCost += Number(log.estimatedCostUsd || 0);
      previousTotalTokens += Number(log.inputTokens || 0) + Number(log.outputTokens || 0);
    }
    const previousActiveUsersDaily = this.round(previousDistinctUsers / daysInRange, 2);
    const previousAvgTokenCostUsd = previousTotalTokens > 0 ? this.round(previousTotalAiCost / previousTotalTokens, 6) : 0;
    const previousGrossMarginPercent =
      previousEstimatedRevenueUsd > 0
        ? this.round(((previousEstimatedRevenueUsd - previousTotalAiCost) / previousEstimatedRevenueUsd) * 100, 2)
        : 0;

    const registerCount = registerUsers.length;
    const attributionTouchCount = attributionTouches.length;
    const partnerRegisterCount = new Set(partnerRegisterUsers.map(item => item.toString())).size;
    const directRegisterCount = Math.max(0, registerCount - partnerRegisterCount);
    const visitCount = Math.max(registerCount, attributionTouchCount + directRegisterCount);
    const firstPracticeCount = Number(firstPracticeAgg[0]?.count || 0);

    const retentionCutoff = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
    const retentionEligibleUsers = registerUsers.filter(user => new Date(user.createdAt) <= retentionCutoff);
    const retainedUsers = retentionEligibleUsers.filter(user => {
      if (!user.lastLoginAt) return false;
      const createdAt = new Date(user.createdAt).getTime();
      const retentionBoundary = createdAt + 30 * 24 * 60 * 60 * 1000;
      return new Date(user.lastLoginAt).getTime() >= retentionBoundary;
    }).length;

    const funnel = [
      { key: 'visit', label: 'Visit', count: visitCount, conversionFromPreviousPercent: 100 },
      {
        key: 'register',
        label: 'Register',
        count: registerCount,
        conversionFromPreviousPercent: visitCount > 0 ? this.round((registerCount / visitCount) * 100, 2) : 0
      },
      {
        key: 'first_practice',
        label: 'First Practice',
        count: firstPracticeCount,
        conversionFromPreviousPercent: registerCount > 0 ? this.round((firstPracticeCount / registerCount) * 100, 2) : 0
      },
      {
        key: 'first_paid',
        label: 'First Paid',
        count: firstPaidCount,
        conversionFromPreviousPercent: firstPracticeCount > 0 ? this.round((firstPaidCount / firstPracticeCount) * 100, 2) : 0
      },
      {
        key: 'retained_30d',
        label: '30-Day Retention',
        count: retainedUsers,
        conversionFromPreviousPercent:
          retentionEligibleUsers.length > 0 ? this.round((retainedUsers / retentionEligibleUsers.length) * 100, 2) : 0
      }
    ];

    const planSlice = registerUsers.reduce(
      (acc, user) => {
        const key = (user.subscriptionPlan || 'free') as SubscriptionPlan;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      },
      { free: 0, starter: 0, premium: 0, pro: 0, team: 0 } as Record<SubscriptionPlan, number>
    );

    const moduleActivityByUser = new Map<string, Record<IELTSModule, number>>();
    const registerModuleActivity = (module: IELTSModule, userId: string) => {
      const current = moduleActivityByUser.get(userId) || { speaking: 0, writing: 0, reading: 0, listening: 0 };
      current[module] += 1;
      moduleActivityByUser.set(userId, current);
    };

    practiceRows.forEach(item => registerModuleActivity('speaking', item.user.toString()));
    simulationRows.forEach(item => registerModuleActivity('speaking', item.user.toString()));
    writingRows.forEach(item => registerModuleActivity('writing', item.userId.toString()));
    readingRows.forEach(item => registerModuleActivity('reading', item.userId.toString()));
    listeningRows.forEach(item => registerModuleActivity('listening', item.userId.toString()));

    const modulePreferenceSlice = { speaking: 0, writing: 0, reading: 0, listening: 0 };
    moduleActivityByUser.forEach(activity => {
      const preferred = (Object.entries(activity).sort((a, b) => b[1] - a[1])[0]?.[0] || 'speaking') as IELTSModule;
      modulePreferenceSlice[preferred] += 1;
    });

    const partnerCheckoutCount = new Set(partnerCheckoutUsers.map(item => item.toString())).size;
    const partnerManualCount = attributionTouches.filter(item => item.source === 'manual').length;
    const acquisitionChannelSlice = {
      direct: directRegisterCount,
      partner_register: partnerRegisterCount,
      partner_checkout: partnerCheckoutCount,
      partner_manual: partnerManualCount
    };

    return {
      range,
      kpis: {
        totalRevenueUsd: estimatedRevenueUsd,
        activeUsersDaily,
        avgTokenCostUsd,
        grossMarginPercent
      },
      kpiDeltas: {
        totalRevenueUsd: this.buildDelta(estimatedRevenueUsd, previousEstimatedRevenueUsd),
        activeUsersDaily: this.buildDelta(activeUsersDaily, previousActiveUsersDaily),
        avgTokenCostUsd: this.buildDelta(avgTokenCostUsd, previousAvgTokenCostUsd),
        grossMarginPercent: this.buildDelta(grossMarginPercent, previousGrossMarginPercent)
      },
      trafficSeries,
      aiExpenditure: {
        totalCostUsd: this.round(totalAiCost, 4),
        totalRequests,
        byModule: aiBreakdown
      },
      partnerPerformance,
      apiHealth,
      funnel,
      cohortSlices: {
        plan: planSlice,
        modulePreference: modulePreferenceSlice,
        acquisitionChannel: acquisitionChannelSlice
      }
    };
  }

  public async exportAdminAnalyticsPack(rangeInput: string, format: 'json' | 'csv') {
    const view = await this.getAdminAnalyticsView(rangeInput);
    const generatedAt = new Date().toISOString();

    if (format === 'json') {
      return {
        contentType: 'application/json',
        filename: `spokio-analytics-${view.range}-${generatedAt.slice(0, 10)}.json`,
        body: JSON.stringify(
          {
            generatedAt,
            range: view.range,
            data: view
          },
          null,
          2
        )
      };
    }

    const csvRows: string[] = [];
    const addRow = (cells: Array<string | number>) => {
      csvRows.push(cells.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','));
    };

    addRow(['section', 'key', 'value', 'extra']);
    addRow(['kpi', 'totalRevenueUsd', view.kpis.totalRevenueUsd, '']);
    addRow(['kpi', 'activeUsersDaily', view.kpis.activeUsersDaily, '']);
    addRow(['kpi', 'avgTokenCostUsd', view.kpis.avgTokenCostUsd, '']);
    addRow(['kpi', 'grossMarginPercent', view.kpis.grossMarginPercent, '']);
    view.funnel.forEach(stage => {
      addRow(['funnel', stage.key, stage.count, `${stage.conversionFromPreviousPercent}%`]);
    });
    Object.entries(view.cohortSlices.plan).forEach(([key, value]) => {
      addRow(['cohort_plan', key, Number(value), '']);
    });
    Object.entries(view.cohortSlices.modulePreference).forEach(([key, value]) => {
      addRow(['cohort_module', key, Number(value), '']);
    });
    Object.entries(view.cohortSlices.acquisitionChannel).forEach(([key, value]) => {
      addRow(['cohort_acquisition', key, Number(value), '']);
    });

    return {
      contentType: 'text/csv; charset=utf-8',
      filename: `spokio-analytics-${view.range}-${generatedAt.slice(0, 10)}.csv`,
      body: csvRows.join('\n')
    };
  }

  private async buildPartnerPerformance(from: Date, to: Date) {
    const [touchAgg, conversionAgg] = await Promise.all([
      PartnerAttributionTouch.aggregate([
        {
          $match: {
            touchedAt: { $gte: from, $lte: to }
          }
        },
        {
          $group: {
            _id: '$partnerId',
            touchCount: { $sum: 1 }
          }
        }
      ]),
      PartnerConversion.aggregate([
        {
          $match: {
            convertedAt: { $gte: from, $lte: to }
          }
        },
        {
          $group: {
            _id: '$partnerId',
            conversions: { $sum: 1 },
            commissionUsd: { $sum: '$commissionAmountUsd' },
            revenueUsd: { $sum: '$netRevenueUsd' }
          }
        }
      ])
    ]);

    const touchByPartner = new Map<string, number>(
      (touchAgg as Array<{ _id: Types.ObjectId; touchCount: number }>).map(item => [item._id.toString(), item.touchCount])
    );

    const conversionRows = conversionAgg as Array<{
      _id: Types.ObjectId;
      conversions: number;
      commissionUsd: number;
      revenueUsd: number;
    }>;
    const partnerIds = conversionRows.map(row => row._id.toString());
    const partners = await Partner.find({ _id: { $in: partnerIds } }).select('displayName').lean();
    const partnerById = new Map(partners.map(item => [item._id.toString(), item.displayName]));

    return conversionRows
      .map(row => {
        const partnerId = row._id.toString();
        const touches = touchByPartner.get(partnerId) || 0;
        const conversions = row.conversions || 0;
        const ratePercent = touches > 0 ? this.round((conversions / touches) * 100, 2) : 0;

        return {
          partnerId,
          partnerName: partnerById.get(partnerId) || 'Unknown Partner',
          touches,
          conversions,
          conversionRatePercent: ratePercent,
          revenueUsd: this.round(row.revenueUsd || 0, 2),
          commissionUsd: this.round(row.commissionUsd || 0, 2)
        };
      })
      .sort((a, b) => b.revenueUsd - a.revenueUsd)
      .slice(0, 20);
  }

  private async buildApiHealth(from: Date, to: Date) {
    const grouped = await AIUsageLogModel.aggregate([
      {
        $match: {
          createdAt: { $gte: from, $lte: to }
        }
      },
      {
        $group: {
          _id: '$module',
          total: { $sum: 1 },
          success: {
            $sum: {
              $cond: [{ $eq: ['$status', 'success'] }, 1, 0]
            }
          },
          blocked: {
            $sum: {
              $cond: [{ $eq: ['$status', 'blocked'] }, 1, 0]
            }
          },
          error: {
            $sum: {
              $cond: [{ $eq: ['$status', 'error'] }, 1, 0]
            }
          }
        }
      }
    ]);

    return (grouped as Array<{ _id: string; total: number; success: number; blocked: number; error: number }>)
      .map(item => ({
        module: item._id,
        total: item.total,
        successRatePercent: item.total > 0 ? this.round((item.success / item.total) * 100, 2) : 0,
        blockedCount: item.blocked,
        errorCount: item.error
      }))
      .sort((a, b) => b.total - a.total);
  }

  private buildDelta(current: number, previous: number) {
    const currentValue = Number.isFinite(current) ? current : 0;
    const previousValue = Number.isFinite(previous) ? previous : 0;

    let deltaPercent = 0;
    if (previousValue === 0) {
      deltaPercent = currentValue === 0 ? 0 : 100;
    } else {
      deltaPercent = this.round(((currentValue - previousValue) / Math.abs(previousValue)) * 100, 2);
    }

    let direction: DeltaDirection = 'flat';
    if (currentValue > previousValue) direction = 'up';
    if (currentValue < previousValue) direction = 'down';

    return {
      current: this.round(currentValue, 6),
      previous: this.round(previousValue, 6),
      deltaPercent,
      direction
    };
  }

  private classifyAlertSeverity(action: string, targetType: string, details: Record<string, unknown>): AlertSeverity {
    const actionText = `${action} ${targetType} ${JSON.stringify(details || {})}`.toLowerCase();

    const criticalSignals = ['error', 'failed', 'failure', 'rollback', 'security', 'auth', 'billing', 'payment', 'panic'];
    if (criticalSignals.some(signal => actionText.includes(signal))) {
      return 'critical';
    }

    const warningSignals = ['cancel', 'past_due', 'incomplete', 'review', 'blocked', 'suspend', 'degraded', 'warning'];
    if (warningSignals.some(signal => actionText.includes(signal))) {
      return 'warning';
    }

    return 'info';
  }

  private toObjectId(value: string, message: string) {
    if (!Types.ObjectId.isValid(value)) {
      throw new CSError(HTTP_STATUS_CODES.BAD_REQUEST, CODES.InvalidBody, message);
    }
    return new Types.ObjectId(value);
  }

  private resolveRange(input?: string) {
    const allowed: Record<ProgressRange, number> = {
      '7d': 7,
      '30d': 30,
      '90d': 90
    };
    const key = (input as ProgressRange) || '30d';
    const days = allowed[key] || allowed['30d'];

    const to = new Date();
    const from = new Date(to);
    from.setUTCDate(from.getUTCDate() - (days - 1));
    from.setUTCHours(0, 0, 0, 0);

    return { key: key in allowed ? key : '30d', from, to };
  }

  private resolveWindow(input?: string) {
    const allowed: Record<AdminWindow, number> = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000
    };
    const key = (input as AdminWindow) || '1h';
    const duration = allowed[key] || allowed['1h'];
    const to = new Date();
    const from = new Date(to.getTime() - duration);
    return { key: key in allowed ? key : '1h', from, to };
  }

  private resolveProgressModule(input?: string): ProgressModule {
    if (input === 'speaking' || input === 'writing' || input === 'reading' || input === 'listening' || input === 'all') {
      return input;
    }
    return 'all';
  }

  private buildTrendSeries(from: Date, to: Date, attempts: UnifiedAttempt[], targetBand: number) {
    const map = new Map<string, { total: number; count: number }>();
    const cursor = new Date(from);
    while (cursor <= to) {
      map.set(cursor.toISOString().slice(0, 10), { total: 0, count: 0 });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    for (const attempt of attempts) {
      const key = attempt.createdAt.toISOString().slice(0, 10);
      const bucket = map.get(key);
      if (!bucket) continue;
      if (attempt.score > 0) {
        bucket.total += attempt.score;
        bucket.count += 1;
      }
    }

    return Array.from(map.entries()).map(([date, bucket]) => ({
      date,
      score: bucket.count > 0 ? this.round(bucket.total / bucket.count, 2) : null,
      target: targetBand
    }));
  }

  private buildWindowSeries(window: AdminWindow, from: Date, events: Date[]) {
    const now = new Date();
    const bucketCount = window === '1h' ? 12 : window === '24h' ? 24 : 14;
    const bucketMs = Math.max(1, Math.floor((now.getTime() - from.getTime()) / bucketCount));

    const buckets = new Array(bucketCount).fill(0);

    for (const eventAt of events) {
      const index = Math.min(
        bucketCount - 1,
        Math.max(0, Math.floor((eventAt.getTime() - from.getTime()) / bucketMs))
      );
      buckets[index] += 1;
    }

    return buckets.map((value, index) => ({
      index,
      value
    }));
  }

  private average(values: number[]) {
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  private averageOrZero(values: number[]) {
    const filtered = values.filter(value => value > 0);
    return filtered.length > 0 ? this.round(this.average(filtered), 1) : 0;
  }

  private nextBandStep(value: number) {
    return this.round(Math.min(9, (Math.floor(value * 2) + 1) / 2), 1);
  }

  private sumNumbers(values: number[]) {
    return values.reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);
  }

  private round(value: number, decimals: number = 2) {
    if (!Number.isFinite(value)) {
      return 0;
    }
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  }
}
