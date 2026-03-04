import { Service } from 'typedi';

import { CSError } from '@errors/CSError';
import { CODES, HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { Types } from '@lib/db/mongooseCompat';
import { AIUsageLogModel } from '@models/AIUsageLogModel';
import { AdminAuditLogModel } from '@models/AdminAuditLogModel';
import { ListeningAttemptModel } from '@models/ListeningAttemptModel';
import { ListeningTestModel } from '@models/ListeningTestModel';
import { ReadingAttemptModel } from '@models/ReadingAttemptModel';
import { ReadingTestModel } from '@models/ReadingTestModel';
import { SubscriptionModel } from '@models/SubscriptionModel';
import { UserModel } from '@models/UserModel';
import { UserProfile } from '@models/UserProfileModel';
import { WritingSubmissionModel } from '@models/WritingSubmissionModel';
import { WritingTaskModel } from '@models/WritingTaskModel';

import { AdminAccessService, AdminRole } from './AdminAccessService';
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

  public async listUsers(
    limit: number,
    offset: number,
    filters?: {
      query?: string;
      plan?: 'free' | 'starter' | 'premium' | 'pro' | 'team';
      status?: 'active' | 'idle' | 'unverified';
      country?: string;
      dateFrom?: string;
      dateTo?: string;
      flagged?: boolean;
    }
  ) {
    const query: Record<string, unknown> = {};
    if (filters?.plan) {
      query.subscriptionPlan = filters.plan;
    }

    if (filters?.query) {
      const escaped = filters.query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      query.$or = [{ email: regex }, { firstName: regex }, { lastName: regex }];
    }

    if (filters?.status === 'active') {
      query.lastLoginAt = { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) };
    } else if (filters?.status === 'idle') {
      query.$or = [...(((query.$or as Array<Record<string, unknown>>) || []) as Array<Record<string, unknown>>), {
        lastLoginAt: { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      }, {
        lastLoginAt: { $exists: false }
      }];
    } else if (filters?.status === 'unverified') {
      query.emailVerified = false;
    }

    if (filters?.flagged) {
      query.emailVerified = false;
    }

    if (filters?.dateFrom || filters?.dateTo) {
      query.createdAt = {};
      if (filters.dateFrom) {
        (query.createdAt as Record<string, unknown>).$gte = new Date(filters.dateFrom);
      }
      if (filters.dateTo) {
        (query.createdAt as Record<string, unknown>).$lte = new Date(filters.dateTo);
      }
    }

    if (filters?.country) {
      const profiles = await UserProfile.find({
        'studyGoals.targetCountry': new RegExp(filters.country, 'i')
      }).select('userId');
      const userIds = profiles.map(profile => profile.userId);
      if (userIds.length === 0) {
        return { users: [], total: 0, limit, offset };
      }
      query._id = { $in: userIds };
    }

    const [users, total] = await Promise.all([
      UserModel.find(query).sort({ createdAt: -1 }).skip(offset).limit(limit),
      UserModel.countDocuments(query)
    ]);

    return { users, total, limit, offset };
  }

  public async updateUserRoles(userId: string, roles: AdminRole[], actorUserId: string) {
    const user = await UserModel.findById(userId);
    if (!user) {
      throw new CSError(HTTP_STATUS_CODES.NOT_FOUND, CODES.NotFound, 'User not found');
    }

    user.adminRoles = [...roles];
    await user.save();

    await this.adminAccessService.audit({
      actorUserId,
      action: 'update-user-roles',
      targetType: 'user',
      targetId: userId,
      details: { roles }
    });

    return user;
  }

  public async listSubscriptions(
    limit: number,
    offset: number,
    filters?: {
      query?: string;
      status?: 'active' | 'canceled' | 'past_due' | 'incomplete';
      plan?: 'free' | 'starter' | 'premium' | 'pro' | 'team';
      renewalFrom?: string;
      renewalTo?: string;
    }
  ) {
    const query: Record<string, any> = {};
    if (filters?.status) {
      query.status = filters.status;
    }
    if (filters?.plan) {
      query.planType = filters.plan;
    }
    if (filters?.renewalFrom || filters?.renewalTo) {
      query.trialEndsAt = {};
      if (filters.renewalFrom) {
        (query.trialEndsAt as Record<string, unknown>).$gte = new Date(filters.renewalFrom);
      }
      if (filters.renewalTo) {
        (query.trialEndsAt as Record<string, unknown>).$lte = new Date(filters.renewalTo);
      }
    }

    const searchQuery = filters?.query?.trim();
    if (searchQuery) {
      const orConditions: Array<Record<string, unknown>> = [];

      if (Types.ObjectId.isValid(searchQuery)) {
        const objectId = new Types.ObjectId(searchQuery);
        orConditions.push({ _id: objectId });
        orConditions.push({ user: objectId });
      }

      const escaped = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      const matchingUsers = await UserModel.find({
        $or: [{ email: regex }, { firstName: regex }, { lastName: regex }]
      })
        .select('_id')
        .limit(200)
        .lean();

      const userIds = matchingUsers.map(user => user._id);
      if (userIds.length > 0) {
        orConditions.push({ user: { $in: userIds } });
      }

      if (orConditions.length === 0) {
        return { subscriptions: [], total: 0, limit, offset };
      }

      query.$or = orConditions;
    }

    const [subscriptions, total] = await Promise.all([
      SubscriptionModel.find(query)
        .populate('user', 'email firstName lastName')
        .sort({ updatedAt: -1 })
        .skip(offset)
        .limit(limit)
        .lean(),
      SubscriptionModel.countDocuments(query)
    ]);

    const normalized = subscriptions.map(subscription => {
      const rawUser = subscription.user as
        | { _id?: Types.ObjectId; email?: string; firstName?: string; lastName?: string }
        | Types.ObjectId
        | undefined;
      const populatedUser =
        rawUser && typeof rawUser === 'object' && !(rawUser instanceof Types.ObjectId) ? rawUser : undefined;
      const userId =
        populatedUser?._id
          ? populatedUser._id.toString()
          : rawUser instanceof Types.ObjectId
            ? rawUser.toString()
            : undefined;

      const userEmail = populatedUser?.email;
      const userName = [populatedUser?.firstName, populatedUser?.lastName].filter(Boolean).join(' ').trim() || undefined;

      return {
        ...subscription,
        userId,
        userEmail,
        userName
      };
    });

    return { subscriptions: normalized, total, limit, offset };
  }

  public async updateSubscriptionStatus(
    subscriptionId: string,
    status: 'active' | 'canceled' | 'past_due' | 'incomplete',
    actorUserId: string
  ) {
    if (!Types.ObjectId.isValid(subscriptionId)) {
      throw new CSError(HTTP_STATUS_CODES.BAD_REQUEST, CODES.InvalidBody, 'Invalid subscription id');
    }

    const subscription = await SubscriptionModel.findById(subscriptionId);
    if (!subscription) {
      throw new CSError(HTTP_STATUS_CODES.NOT_FOUND, CODES.NotFound, 'Subscription not found');
    }

    subscription.status = status;
    if (status === 'canceled') {
      subscription.planType = 'free';
    }
    await subscription.save();

    await UserModel.updateOne(
      { _id: subscription.user },
      {
        $set: {
          subscriptionPlan: subscription.planType
        }
      }
    );

    await this.adminAccessService.audit({
      actorUserId,
      action: 'update-subscription-status',
      targetType: 'subscription',
      targetId: subscriptionId,
      details: {
        status
      }
    });

    return subscription;
  }

  public async updateSubscriptionPlan(
    subscriptionId: string,
    planType: 'free' | 'starter' | 'premium' | 'pro' | 'team',
    actorUserId: string
  ) {
    if (!Types.ObjectId.isValid(subscriptionId)) {
      throw new CSError(HTTP_STATUS_CODES.BAD_REQUEST, CODES.InvalidBody, 'Invalid subscription id');
    }

    const subscription = await SubscriptionModel.findById(subscriptionId);
    if (!subscription) {
      throw new CSError(HTTP_STATUS_CODES.NOT_FOUND, CODES.NotFound, 'Subscription not found');
    }

    subscription.planType = planType;
    if (planType === 'free') {
      subscription.status = 'canceled';
    } else if (subscription.status === 'canceled') {
      subscription.status = 'active';
    }
    await subscription.save();

    await UserModel.updateOne(
      { _id: subscription.user },
      {
        $set: {
          subscriptionPlan: planType
        }
      }
    );

    await this.adminAccessService.audit({
      actorUserId,
      action: 'update-subscription-plan',
      targetType: 'subscription',
      targetId: subscriptionId,
      details: {
        planType
      }
    });

    return subscription;
  }

  public async logSubscriptionRefundNote(subscriptionId: string, note: string, actorUserId: string) {
    if (!Types.ObjectId.isValid(subscriptionId)) {
      throw new CSError(HTTP_STATUS_CODES.BAD_REQUEST, CODES.InvalidBody, 'Invalid subscription id');
    }

    const subscription = await SubscriptionModel.findById(subscriptionId);
    if (!subscription) {
      throw new CSError(HTTP_STATUS_CODES.NOT_FOUND, CODES.NotFound, 'Subscription not found');
    }

    await this.adminAccessService.audit({
      actorUserId,
      action: 'log-subscription-refund-note',
      targetType: 'subscription',
      targetId: subscriptionId,
      details: {
        note: note.trim().slice(0, 2000),
        userId: subscription.user.toString(),
        planType: subscription.planType,
        status: subscription.status
      }
    });

    return {
      logged: true
    };
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
      SubscriptionModel.countDocuments({ planType: { $in: ['starter', 'premium', 'pro', 'team'] }, status: 'active' }),
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

  public async listAuditLogs(
    limit: number,
    offset: number,
    filters?: {
      actorUserId?: string;
      action?: string;
      dateFrom?: string;
      dateTo?: string;
    }
  ) {
    const query: Record<string, unknown> = {};
    if (filters?.actorUserId) {
      query.actorUserId = filters.actorUserId;
    }
    if (filters?.action) {
      query.action = filters.action;
    }
    if (filters?.dateFrom || filters?.dateTo) {
      query.createdAt = {};
      if (filters.dateFrom) {
        (query.createdAt as Record<string, unknown>).$gte = new Date(filters.dateFrom);
      }
      if (filters.dateTo) {
        (query.createdAt as Record<string, unknown>).$lte = new Date(filters.dateTo);
      }
    }

    const [logs, total] = await Promise.all([
      AdminAuditLogModel.find(query).sort({ createdAt: -1 }).skip(offset).limit(limit),
      AdminAuditLogModel.countDocuments(query)
    ]);

    return {
      logs,
      total,
      limit,
      offset
    };
  }

  public async getAIUsageSummary(
    limit: number,
    filters?: {
      module?: string;
      dateFrom?: string;
      dateTo?: string;
      status?: string;
    }
  ) {
    const query: Record<string, unknown> = {};
    if (filters?.module) {
      query.module = filters.module;
    }
    if (filters?.status) {
      query.status = filters.status;
    }
    if (filters?.dateFrom || filters?.dateTo) {
      query.createdAt = {};
      if (filters.dateFrom) {
        (query.createdAt as Record<string, unknown>).$gte = new Date(filters.dateFrom);
      }
      if (filters.dateTo) {
        (query.createdAt as Record<string, unknown>).$lte = new Date(filters.dateTo);
      }
    }

    const [recentLogs, aggregate] = await Promise.all([
      AIUsageLogModel.find(query).sort({ createdAt: -1 }).limit(limit),
      AIUsageLogModel.aggregate([
        {
          $match: query
        },
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
