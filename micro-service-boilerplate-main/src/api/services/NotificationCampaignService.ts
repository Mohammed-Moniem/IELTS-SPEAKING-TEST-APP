import { Service } from 'typedi';

import { CSError } from '@errors/CSError';
import { CODES, HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { Types } from '@lib/db/mongooseCompat';
import {
  NotificationCampaignAudienceDto,
  CreateNotificationCampaignDto
} from '@dto/NotificationCampaignDto';
import {
  NotificationCampaignModel,
  NotificationCampaignStatus,
  NotificationCampaignType
} from '@models/NotificationCampaignModel';
import { NotificationDeliveryModel } from '@models/NotificationDeliveryModel';
import { Partner, PartnerAttributionTouch, PartnerConversion, PartnerMember } from '@models/PartnerProgramModel';
import { UserModel } from '@models/UserModel';
import { env } from '@env';

import { AdminAccessService } from './AdminAccessService';
import { NotificationService } from './NotificationService';

const PARTNER_ATTRIBUTION_LOOKBACK_DAYS = 90;
const URL_PATTERN = /(https?:\/\/[^\s)]+)/gi;

@Service()
export class NotificationCampaignService {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly adminAccessService: AdminAccessService
  ) {}

  private toObjectId(id: string) {
    return new Types.ObjectId(id);
  }

  private normalizeObjectIds(ids: string[] = []): Types.ObjectId[] {
    return ids.filter(id => Types.ObjectId.isValid(id)).map(id => new Types.ObjectId(id));
  }

  private assertAudienceConfig(audience: NotificationCampaignAudienceDto) {
    if (audience.kind === 'partner_owners_by_ids' && (!audience.partnerIds || audience.partnerIds.length === 0)) {
      throw new CSError(
        HTTP_STATUS_CODES.BAD_REQUEST,
        CODES.InvalidBody,
        'partnerIds are required for partner_owners_by_ids audience'
      );
    }

    if (audience.kind === 'partner_owners_by_type' && !audience.partnerType) {
      throw new CSError(
        HTTP_STATUS_CODES.BAD_REQUEST,
        CODES.InvalidBody,
        'partnerType is required for partner_owners_by_type audience'
      );
    }
  }

  private async resolvePartnerScope(audience: NotificationCampaignAudienceDto): Promise<Types.ObjectId[] | null> {
    if (audience.partnerIds?.length) {
      return this.normalizeObjectIds(audience.partnerIds);
    }

    if (audience.partnerType) {
      const partners = await Partner.find({
        partnerType: audience.partnerType,
        status: 'active'
      }).select('_id');

      return partners.map(partner => partner._id);
    }

    return null;
  }

  private async resolvePartnerOwnerUserIds(
    audience: NotificationCampaignAudienceDto,
    partnerScope: Types.ObjectId[] | null
  ): Promise<string[]> {
    const query: Record<string, unknown> = {
      role: 'owner',
      status: 'active'
    };

    if (partnerScope && partnerScope.length > 0) {
      query.partnerId = { $in: partnerScope };
    } else if (audience.kind === 'partner_owners_by_ids') {
      return [];
    }

    const members = await PartnerMember.find(query).select('userId');
    return members.map(member => member.userId.toString());
  }

  private async resolveAttributedUserIds(
    audience: NotificationCampaignAudienceDto,
    partnerScope: Types.ObjectId[] | null
  ): Promise<string[]> {
    const cutoff = new Date(Date.now() - PARTNER_ATTRIBUTION_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
    const partnerFilter = partnerScope && partnerScope.length > 0 ? { $in: partnerScope } : undefined;
    if (audience.kind === 'partner_owners_by_ids' && !partnerFilter) {
      return [];
    }

    const touchQuery: Record<string, unknown> = {
      touchedAt: { $gte: cutoff },
      userId: { $exists: true, $ne: null }
    };

    const conversionQuery: Record<string, unknown> = {
      convertedAt: { $gte: cutoff },
      userId: { $exists: true, $ne: null }
    };

    if (partnerFilter) {
      touchQuery.partnerId = partnerFilter;
      conversionQuery.partnerId = partnerFilter;
    }

    const [touches, conversions] = await Promise.all([
      PartnerAttributionTouch.find(touchQuery).select('userId'),
      PartnerConversion.find(conversionQuery).select('userId')
    ]);

    const users = new Set<string>();
    touches.forEach(touch => {
      if (touch.userId) users.add(touch.userId.toString());
    });
    conversions.forEach(conversion => {
      if (conversion.userId) users.add(conversion.userId.toString());
    });

    return Array.from(users);
  }

  private async resolveAudienceUserIds(audience: NotificationCampaignAudienceDto): Promise<string[]> {
    this.assertAudienceConfig(audience);
    const partnerScope = await this.resolvePartnerScope(audience);

    switch (audience.kind) {
      case 'all_users': {
        const users = await UserModel.find({}).select('_id');
        return users.map(user => user._id.toString());
      }
      case 'all_partner_owners':
      case 'partner_owners_by_ids':
      case 'partner_owners_by_type':
        return this.resolvePartnerOwnerUserIds(audience, partnerScope);
      case 'partner_attributed_users':
        return this.resolveAttributedUserIds(audience, partnerScope);
      case 'partner_owners_and_attributed': {
        const [owners, attributed] = await Promise.all([
          this.resolvePartnerOwnerUserIds(audience, partnerScope),
          this.resolveAttributedUserIds(audience, partnerScope)
        ]);

        return Array.from(new Set([...owners, ...attributed]));
      }
      default:
        return [];
    }
  }

  private extractCandidateLinks(input: {
    title?: string;
    body?: string;
    data?: Record<string, unknown>;
  }): string[] {
    const values: string[] = [];
    if (input.title) values.push(input.title);
    if (input.body) values.push(input.body);
    if (input.data) values.push(JSON.stringify(input.data));

    const matches = values.flatMap(value => value.match(URL_PATTERN) || []);
    return Array.from(new Set(matches.map(link => link.trim())));
  }

  private isValidHttpUrl(value: string): boolean {
    try {
      const parsed = new URL(value);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }

  private async executeDispatch(campaignId: string) {
    const campaign = await NotificationCampaignModel.findOneAndUpdate(
      {
        _id: this.toObjectId(campaignId),
        status: { $in: ['draft', 'scheduled', 'failed'] }
      },
      {
        $set: {
          status: 'processing' satisfies NotificationCampaignStatus
        }
      },
      { new: true }
    );

    if (!campaign) {
      return null;
    }

    try {
      const userIds = await this.resolveAudienceUserIds(campaign.audience as any);

      const sendResult = await this.notificationService.sendCampaignMessage({
        userIds,
        title: campaign.title,
        body: campaign.body,
        type: campaign.type as NotificationCampaignType,
        data: campaign.data || {}
      });

      if (sendResult.deliveries.length > 0) {
        const docs = sendResult.deliveries
          .filter(item => Types.ObjectId.isValid(item.userId))
          .map(item => ({
            campaignId: campaign._id,
            userId: this.toObjectId(item.userId),
            channel: item.channel,
            provider: item.provider,
            token: item.token,
            tokenHash: item.tokenHash,
            status: item.status,
            providerMessageId: item.providerMessageId,
            errorCode: item.errorCode,
            errorMessage: item.errorMessage,
            deliveredAt: item.status === 'sent' ? new Date() : undefined
          }));

        if (docs.length > 0) {
          await NotificationDeliveryModel.insertMany(docs, { ordered: false });
        }
      }

      campaign.status = 'sent';
      campaign.sentAt = new Date();
      campaign.lastError = undefined;
      campaign.deliverySummary = {
        targetedUsers: sendResult.targetedUsers,
        attempts: sendResult.attempts,
        sent: sendResult.sent,
        failed: sendResult.failed,
        skipped: sendResult.skipped
      };
      await campaign.save();

      return campaign;
    } catch (error) {
      campaign.status = 'failed';
      campaign.lastError = error instanceof Error ? error.message : JSON.stringify(error);
      await campaign.save();
      throw error;
    }
  }

  public async createCampaign(input: CreateNotificationCampaignDto, actorUserId: string) {
    this.assertAudienceConfig(input.audience);

    const mode = input.mode || (input.scheduledAt ? 'scheduled' : 'immediate');
    const fallbackImmediateIfSchedulerUnavailable =
      input.fallbackImmediateIfSchedulerUnavailable ?? env.push.campaignFallbackImmediateDefault;

    let status: NotificationCampaignStatus = mode === 'immediate' ? 'draft' : 'scheduled';
    let scheduledAt: Date | undefined;

    if (mode === 'scheduled') {
      if (!input.scheduledAt) {
        throw new CSError(HTTP_STATUS_CODES.BAD_REQUEST, CODES.InvalidBody, 'scheduledAt is required for scheduled mode');
      }

      scheduledAt = new Date(input.scheduledAt);
      if (Number.isNaN(scheduledAt.getTime())) {
        throw new CSError(HTTP_STATUS_CODES.BAD_REQUEST, CODES.InvalidBody, 'scheduledAt must be a valid ISO date');
      }
    }

    const campaign = await NotificationCampaignModel.create({
      title: input.title,
      body: input.body,
      type: input.type,
      data: input.data || {},
      audience: {
        kind: input.audience.kind,
        partnerType: input.audience.partnerType,
        partnerIds: this.normalizeObjectIds(input.audience.partnerIds)
      },
      status,
      scheduledAt,
      timezone: 'UTC',
      fallbackImmediateIfSchedulerUnavailable,
      createdByUserId: this.toObjectId(actorUserId)
    });

    await this.adminAccessService.audit({
      actorUserId,
      action: 'notification-campaign-create',
      targetType: 'notification-campaign',
      targetId: campaign._id.toString(),
      details: {
        mode,
        type: input.type,
        audience: input.audience
      }
    });

    const shouldFallbackSend = mode === 'scheduled' && fallbackImmediateIfSchedulerUnavailable && !env.push.campaignSchedulerEnabled;
    if (mode === 'immediate' || shouldFallbackSend) {
      await this.sendNow(campaign._id.toString(), actorUserId, true);
    }

    return this.getCampaign(campaign._id.toString());
  }

  public async preflightCampaign(input: CreateNotificationCampaignDto) {
    this.assertAudienceConfig(input.audience);

    const userIds = await this.resolveAudienceUserIds(input.audience);
    const uniqueUserIds = Array.from(new Set(userIds));
    const objectIds = uniqueUserIds.filter(id => Types.ObjectId.isValid(id)).map(id => this.toObjectId(id));

    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const messagedInLast24h = objectIds.length
      ? await NotificationDeliveryModel.distinct('userId', {
          userId: { $in: objectIds },
          status: 'sent',
          createdAt: { $gte: cutoff }
        })
      : [];

    const detectedLinks = this.extractCandidateLinks({
      title: input.title,
      body: input.body,
      data: input.data
    });
    const invalidLinks = detectedLinks.filter(link => !this.isValidHttpUrl(link));

    const isScheduled = (input.mode || (input.scheduledAt ? 'scheduled' : 'immediate')) === 'scheduled';
    const fallbackImmediateIfSchedulerUnavailable =
      input.fallbackImmediateIfSchedulerUnavailable ?? env.push.campaignFallbackImmediateDefault;
    const scheduleReady = !isScheduled || env.push.campaignSchedulerEnabled || fallbackImmediateIfSchedulerUnavailable;

    const warnings: string[] = [];
    if (messagedInLast24h.length > 0) {
      warnings.push(`${messagedInLast24h.length} targeted users already received a push in the last 24 hours.`);
    }
    if (!scheduleReady) {
      warnings.push('Scheduler is disabled and fallback immediate send is also disabled.');
    }
    if (invalidLinks.length > 0) {
      warnings.push('One or more links failed URL validation.');
    }

    const estimatedPartnerCount = (() => {
      switch (input.audience.kind) {
        case 'all_partner_owners':
          return undefined;
        case 'partner_owners_by_ids':
        case 'partner_attributed_users':
        case 'partner_owners_and_attributed':
          return input.audience.partnerIds?.length || 0;
        case 'partner_owners_by_type':
          return undefined;
        default:
          return 0;
      }
    })();

    return {
      audienceEstimate: {
        targetedUsers: uniqueUserIds.length,
        targetedPartners: estimatedPartnerCount
      },
      safety: {
        frequencyCapOk: messagedInLast24h.length < uniqueUserIds.length || uniqueUserIds.length === 0,
        linkValidationOk: invalidLinks.length === 0,
        scheduleReady,
        warnings
      },
      diagnostics: {
        linksDetected: detectedLinks,
        invalidLinks,
        usersWithRecentMessages: messagedInLast24h.length
      }
    };
  }

  public async listCampaigns(
    limit: number = 50,
    offset: number = 0,
    filters?: { status?: NotificationCampaignStatus; type?: NotificationCampaignType }
  ) {
    const query: Record<string, unknown> = {};
    if (filters?.status) {
      query.status = filters.status;
    }
    if (filters?.type) {
      query.type = filters.type;
    }

    const [campaigns, total] = await Promise.all([
      NotificationCampaignModel.find(query).sort({ createdAt: -1 }).skip(offset).limit(limit),
      NotificationCampaignModel.countDocuments(query)
    ]);

    return {
      campaigns,
      total,
      limit,
      offset
    };
  }

  public async getCampaign(campaignId: string) {
    if (!Types.ObjectId.isValid(campaignId)) {
      throw new CSError(HTTP_STATUS_CODES.BAD_REQUEST, CODES.InvalidBody, 'Invalid campaign id');
    }

    const campaign = await NotificationCampaignModel.findById(campaignId);
    if (!campaign) {
      throw new CSError(HTTP_STATUS_CODES.NOT_FOUND, CODES.NotFound, 'Campaign not found');
    }

    const [deliveries, totalDeliveries, statusBreakdown, channelBreakdown] = await Promise.all([
      NotificationDeliveryModel.find({ campaignId: campaign._id }).sort({ createdAt: -1 }).limit(200),
      NotificationDeliveryModel.countDocuments({ campaignId: campaign._id }),
      NotificationDeliveryModel.aggregate([
        { $match: { campaignId: campaign._id } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      NotificationDeliveryModel.aggregate([
        { $match: { campaignId: campaign._id } },
        { $group: { _id: '$channel', count: { $sum: 1 } } }
      ])
    ]);

    return {
      campaign,
      deliveries,
      totalDeliveries,
      breakdown: {
        byStatus: statusBreakdown,
        byChannel: channelBreakdown
      }
    };
  }

  public async cancelCampaign(campaignId: string, actorUserId: string) {
    if (!Types.ObjectId.isValid(campaignId)) {
      throw new CSError(HTTP_STATUS_CODES.BAD_REQUEST, CODES.InvalidBody, 'Invalid campaign id');
    }

    const campaign = await NotificationCampaignModel.findOneAndUpdate(
      {
        _id: this.toObjectId(campaignId),
        status: { $in: ['draft', 'scheduled'] }
      },
      {
        $set: {
          status: 'cancelled',
          cancelledAt: new Date(),
          cancelledByUserId: this.toObjectId(actorUserId)
        }
      },
      { new: true }
    );

    if (!campaign) {
      throw new CSError(
        HTTP_STATUS_CODES.BAD_REQUEST,
        CODES.InvalidBody,
        'Only draft or scheduled campaigns can be cancelled'
      );
    }

    await this.adminAccessService.audit({
      actorUserId,
      action: 'notification-campaign-cancel',
      targetType: 'notification-campaign',
      targetId: campaign._id.toString()
    });

    return this.getCampaign(campaign._id.toString());
  }

  public async sendNow(campaignId: string, actorUserId: string, skipAudit = false) {
    if (!Types.ObjectId.isValid(campaignId)) {
      throw new CSError(HTTP_STATUS_CODES.BAD_REQUEST, CODES.InvalidBody, 'Invalid campaign id');
    }

    const dispatched = await this.executeDispatch(campaignId);
    if (!dispatched) {
      throw new CSError(
        HTTP_STATUS_CODES.BAD_REQUEST,
        CODES.InvalidBody,
        'Campaign is not dispatchable (already sent, cancelled, or processing)'
      );
    }

    if (!skipAudit) {
      await this.adminAccessService.audit({
        actorUserId,
        action: 'notification-campaign-send-now',
        targetType: 'notification-campaign',
        targetId: campaignId
      });
    }

    return this.getCampaign(campaignId);
  }

  public async processDueCampaigns(limit: number = 50) {
    const dueCampaigns = await NotificationCampaignModel.find({
      status: 'scheduled',
      scheduledAt: { $lte: new Date() }
    })
      .sort({ scheduledAt: 1 })
      .limit(limit)
      .select('_id');

    let processed = 0;
    for (const campaign of dueCampaigns) {
      try {
        await this.executeDispatch(campaign._id.toString());
        processed += 1;
      } catch {
        // errors already captured in campaign status by executeDispatch
      }
    }

    return {
      processed,
      scanned: dueCampaigns.length
    };
  }
}
