import { Service } from 'typedi';

import { AIUsageLogModel } from '@models/AIUsageLogModel';
import { ListeningAttemptModel } from '@models/ListeningAttemptModel';
import { ListeningTestModel } from '@models/ListeningTestModel';
import { ReadingAttemptModel } from '@models/ReadingAttemptModel';
import { ReadingTestModel } from '@models/ReadingTestModel';
import { SubscriptionModel } from '@models/SubscriptionModel';
import { UserModel } from '@models/UserModel';
import { WritingSubmissionModel } from '@models/WritingSubmissionModel';
import { WritingTaskModel } from '@models/WritingTaskModel';

import { AdminAccessService } from './AdminAccessService';
import { FeatureFlagService } from './FeatureFlagService';

@Service()
export class AdminService {
  constructor(
    private readonly adminAccessService: AdminAccessService,
    private readonly featureFlagService: FeatureFlagService
  ) {}

  public async listContent(module: 'writing' | 'reading' | 'listening', limit: number, offset: number) {
    if (module === 'writing') {
      return WritingTaskModel.find({}).sort({ updatedAt: -1 }).skip(offset).limit(limit);
    }

    if (module === 'reading') {
      return ReadingTestModel.find({}).sort({ updatedAt: -1 }).skip(offset).limit(limit);
    }

    return ListeningTestModel.find({}).sort({ updatedAt: -1 }).skip(offset).limit(limit);
  }

  public async createContent(
    module: 'writing' | 'reading' | 'listening',
    payload: Record<string, unknown>,
    actorUserId: string
  ) {
    if (module === 'writing') {
      const created = await WritingTaskModel.create({ ...payload, createdBy: actorUserId, source: 'bank' });
      await this.adminAccessService.audit({
        actorUserId,
        action: 'create-content',
        targetType: 'writing-task',
        targetId: created._id.toString(),
        details: { module }
      });
      return created;
    }

    if (module === 'reading') {
      const created = await ReadingTestModel.create({ ...payload, createdBy: actorUserId, source: 'bank' });
      await this.adminAccessService.audit({
        actorUserId,
        action: 'create-content',
        targetType: 'reading-test',
        targetId: created._id.toString(),
        details: { module }
      });
      return created;
    }

    const created = await ListeningTestModel.create({ ...payload, createdBy: actorUserId, source: 'bank' });
    await this.adminAccessService.audit({
      actorUserId,
      action: 'create-content',
      targetType: 'listening-test',
      targetId: created._id.toString(),
      details: { module }
    });
    return created;
  }

  public async updateContent(
    module: 'writing' | 'reading' | 'listening',
    targetId: string,
    payload: Record<string, unknown>,
    actorUserId: string
  ) {
    const model = module === 'writing' ? WritingTaskModel : module === 'reading' ? ReadingTestModel : ListeningTestModel;

    const updated = await model.findByIdAndUpdate(targetId, { $set: payload }, { new: true, runValidators: true });

    await this.adminAccessService.audit({
      actorUserId,
      action: 'update-content',
      targetType: `${module}-content`,
      targetId,
      details: payload
    });

    return updated;
  }

  public async listUsers(limit: number, offset: number) {
    const [users, total] = await Promise.all([
      UserModel.find({}).sort({ createdAt: -1 }).skip(offset).limit(limit),
      UserModel.countDocuments({})
    ]);

    return { users, total, limit, offset };
  }

  public async listSubscriptions(limit: number, offset: number) {
    const [subscriptions, total] = await Promise.all([
      SubscriptionModel.find({}).sort({ updatedAt: -1 }).skip(offset).limit(limit),
      SubscriptionModel.countDocuments({})
    ]);

    return { subscriptions, total, limit, offset };
  }

  public async getAnalyticsSummary() {
    const [
      users,
      writingSubmissions,
      readingAttempts,
      listeningAttempts,
      activeSubscriptions,
      featureFlags
    ] = await Promise.all([
      UserModel.countDocuments({}),
      WritingSubmissionModel.countDocuments({}),
      ReadingAttemptModel.countDocuments({ status: 'completed' }),
      ListeningAttemptModel.countDocuments({ status: 'completed' }),
      SubscriptionModel.countDocuments({ planType: { $in: ['premium', 'pro'] }, status: 'active' }),
      this.featureFlagService.listFlags()
    ]);

    return {
      users,
      moduleActivity: {
        writingSubmissions,
        readingAttempts,
        listeningAttempts
      },
      activePaidSubscriptions: activeSubscriptions,
      featureFlags
    };
  }

  public async getAIUsageSummary(limit: number) {
    const [recentLogs, aggregate] = await Promise.all([
      AIUsageLogModel.find({}).sort({ createdAt: -1 }).limit(limit),
      AIUsageLogModel.aggregate([
        {
          $group: {
            _id: '$module',
            requestCount: { $sum: 1 },
            costUsd: { $sum: '$estimatedCostUsd' },
            tokenCount: { $sum: { $add: ['$inputTokens', '$outputTokens'] } },
            cacheHits: {
              $sum: {
                $cond: [{ $eq: ['$cacheHit', true] }, 1, 0]
              }
            }
          }
        },
        {
          $sort: { requestCount: -1 }
        }
      ])
    ]);

    return {
      aggregate,
      recentLogs
    };
  }
}
