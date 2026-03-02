jest.mock('@models/NotificationCampaignModel', () => ({
  NotificationCampaignModel: {
    findOneAndUpdate: jest.fn(),
    create: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
    findById: jest.fn()
  }
}));

jest.mock('@models/NotificationDeliveryModel', () => ({
  NotificationDeliveryModel: {
    insertMany: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
    aggregate: jest.fn()
  }
}));

jest.mock('@models/PartnerProgramModel', () => ({
  Partner: {
    find: jest.fn()
  },
  PartnerMember: {
    find: jest.fn()
  },
  PartnerAttributionTouch: {
    find: jest.fn()
  },
  PartnerConversion: {
    find: jest.fn()
  }
}));

jest.mock('@models/UserModel', () => ({
  UserModel: {
    find: jest.fn()
  }
}));

import { Types } from '@lib/db/mongooseCompat';
import { NotificationCampaignModel } from '@models/NotificationCampaignModel';
import { Partner, PartnerAttributionTouch, PartnerConversion, PartnerMember } from '@models/PartnerProgramModel';
import { UserModel } from '@models/UserModel';
import { NotificationCampaignService } from '@services/NotificationCampaignService';

const mockNotificationCampaignModel = NotificationCampaignModel as any;
const mockPartnerModel = Partner as any;
const mockPartnerMemberModel = PartnerMember as any;
const mockPartnerAttributionTouchModel = PartnerAttributionTouch as any;
const mockPartnerConversionModel = PartnerConversion as any;
const mockUserModel = UserModel as any;

const makeSelectQuery = <T>(result: T) => ({
  select: jest.fn().mockResolvedValue(result)
});

const makeFindChain = <T>(result: T) => ({
  sort: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  limit: jest.fn().mockResolvedValue(result)
});

const makeObjectId = () => new Types.ObjectId();

const makeCampaignDocument = (overrides?: Partial<any>) => ({
  _id: makeObjectId(),
  title: 'Campaign title',
  body: 'Campaign body',
  type: 'offer',
  data: {},
  audience: { kind: 'all_users' },
  status: 'draft',
  save: jest.fn().mockResolvedValue(undefined),
  ...overrides
});

describe('NotificationCampaignService', () => {
  let notificationService: { sendCampaignMessage: jest.Mock };
  let adminAccessService: { audit: jest.Mock };
  let service: NotificationCampaignService;

  beforeEach(() => {
    jest.clearAllMocks();
    notificationService = {
      sendCampaignMessage: jest.fn().mockResolvedValue({
        targetedUsers: 0,
        attempts: 0,
        sent: 0,
        failed: 0,
        skipped: 0,
        deliveries: []
      })
    };
    adminAccessService = {
      audit: jest.fn().mockResolvedValue(undefined)
    };
    service = new NotificationCampaignService(notificationService as any, adminAccessService as any);
    jest.spyOn(service, 'getCampaign').mockResolvedValue({
      campaign: { _id: makeObjectId() },
      deliveries: [],
      totalDeliveries: 0,
      breakdown: { byStatus: [], byChannel: [] }
    } as any);
  });

  it('resolves all users audience when sending now', async () => {
    const actorUserId = makeObjectId().toString();
    const campaignId = makeObjectId().toString();
    const recipientA = makeObjectId();
    const recipientB = makeObjectId();
    const campaign = makeCampaignDocument({ audience: { kind: 'all_users' } });

    mockNotificationCampaignModel.findOneAndUpdate.mockResolvedValue(campaign);
    mockUserModel.find.mockReturnValue(makeSelectQuery([{ _id: recipientA }, { _id: recipientB }]));

    await service.sendNow(campaignId, actorUserId);

    expect(notificationService.sendCampaignMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        userIds: [recipientA.toString(), recipientB.toString()],
        title: 'Campaign title',
        body: 'Campaign body',
        type: 'offer'
      })
    );
    expect(adminAccessService.audit).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId,
        action: 'notification-campaign-send-now'
      })
    );
    expect(campaign.save).toHaveBeenCalled();
  });

  it('resolves partner owners by partner type', async () => {
    const actorUserId = makeObjectId().toString();
    const campaignId = makeObjectId().toString();
    const partnerA = makeObjectId();
    const partnerB = makeObjectId();
    const ownerA = makeObjectId();
    const ownerB = makeObjectId();
    const campaign = makeCampaignDocument({
      audience: {
        kind: 'partner_owners_by_type',
        partnerType: 'influencer'
      }
    });

    mockNotificationCampaignModel.findOneAndUpdate.mockResolvedValue(campaign);
    mockPartnerModel.find.mockReturnValue(makeSelectQuery([{ _id: partnerA }, { _id: partnerB }]));
    mockPartnerMemberModel.find.mockReturnValue(makeSelectQuery([{ userId: ownerA }, { userId: ownerB }]));

    await service.sendNow(campaignId, actorUserId);

    expect(Partner.find).toHaveBeenCalledWith(
      expect.objectContaining({
        partnerType: 'influencer',
        status: 'active'
      })
    );
    expect(PartnerMember.find).toHaveBeenCalledWith(
      expect.objectContaining({
        role: 'owner',
        status: 'active',
        partnerId: { $in: [partnerA, partnerB] }
      })
    );
    expect(notificationService.sendCampaignMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        userIds: [ownerA.toString(), ownerB.toString()]
      })
    );
  });

  it('resolves attributed users with 90-day touch and conversion windows', async () => {
    const actorUserId = makeObjectId().toString();
    const campaignId = makeObjectId().toString();
    const partnerA = makeObjectId();
    const touchUserA = makeObjectId();
    const touchUserB = makeObjectId();
    const conversionUserB = touchUserB;
    const conversionUserC = makeObjectId();
    const campaign = makeCampaignDocument({
      audience: {
        kind: 'partner_attributed_users',
        partnerIds: [partnerA.toString()]
      }
    });

    mockNotificationCampaignModel.findOneAndUpdate.mockResolvedValue(campaign);
    mockPartnerAttributionTouchModel.find.mockReturnValue(
      makeSelectQuery([{ userId: touchUserA }, { userId: touchUserB }])
    );
    mockPartnerConversionModel.find.mockReturnValue(
      makeSelectQuery([{ userId: conversionUserB }, { userId: conversionUserC }])
    );

    await service.sendNow(campaignId, actorUserId);

    expect(PartnerAttributionTouch.find).toHaveBeenCalledWith(
      expect.objectContaining({
        touchedAt: { $gte: expect.any(Date) },
        partnerId: { $in: [partnerA] }
      })
    );
    expect(PartnerConversion.find).toHaveBeenCalledWith(
      expect.objectContaining({
        convertedAt: { $gte: expect.any(Date) },
        partnerId: { $in: [partnerA] }
      })
    );

    const calledWithUserIds = notificationService.sendCampaignMessage.mock.calls[0][0].userIds as string[];
    expect(new Set(calledWithUserIds)).toEqual(
      new Set([touchUserA.toString(), touchUserB.toString(), conversionUserC.toString()])
    );
  });

  it('unions and dedupes partner owners and attributed users', async () => {
    const actorUserId = makeObjectId().toString();
    const campaignId = makeObjectId().toString();
    const partnerA = makeObjectId();
    const ownerA = makeObjectId();
    const ownerB = makeObjectId();
    const attributedB = makeObjectId();
    const attributedC = makeObjectId();
    const campaign = makeCampaignDocument({
      audience: {
        kind: 'partner_owners_and_attributed',
        partnerIds: [partnerA.toString()]
      }
    });

    mockNotificationCampaignModel.findOneAndUpdate.mockResolvedValue(campaign);
    mockPartnerMemberModel.find.mockReturnValue(makeSelectQuery([{ userId: ownerA }, { userId: ownerB }]));
    mockPartnerAttributionTouchModel.find.mockReturnValue(makeSelectQuery([{ userId: ownerB }, { userId: attributedB }]));
    mockPartnerConversionModel.find.mockReturnValue(makeSelectQuery([{ userId: attributedC }]));

    await service.sendNow(campaignId, actorUserId);

    const calledWithUserIds = notificationService.sendCampaignMessage.mock.calls[0][0].userIds as string[];
    expect(new Set(calledWithUserIds)).toEqual(
      new Set([ownerA.toString(), ownerB.toString(), attributedB.toString(), attributedC.toString()])
    );
  });

  it('rejects send-now for already processed campaigns (idempotency safeguard)', async () => {
    const actorUserId = makeObjectId().toString();
    const campaignId = makeObjectId().toString();

    mockNotificationCampaignModel.findOneAndUpdate.mockResolvedValue(null);

    await expect(service.sendNow(campaignId, actorUserId)).rejects.toThrow(
      'Campaign is not dispatchable (already sent, cancelled, or processing)'
    );
    expect(notificationService.sendCampaignMessage).not.toHaveBeenCalled();
  });

  it('processes due scheduled campaigns and ignores failed dispatches', async () => {
    const campaignA = makeObjectId();
    const campaignB = makeObjectId();
    const dueCampaigns = [{ _id: campaignA }, { _id: campaignB }];

    mockNotificationCampaignModel.find.mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      select: jest.fn().mockResolvedValue(dueCampaigns)
    });

    const executeDispatchSpy = jest
      .spyOn(service as any, 'executeDispatch')
      .mockResolvedValueOnce({ _id: campaignA })
      .mockRejectedValueOnce(new Error('dispatch failed'));

    const result = await service.processDueCampaigns(20);

    expect(mockNotificationCampaignModel.find).toHaveBeenCalledWith({
      status: 'scheduled',
      scheduledAt: { $lte: expect.any(Date) }
    });
    expect(executeDispatchSpy).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ processed: 1, scanned: 2 });
  });

  it('lists campaigns with pagination and filters', async () => {
    const campaigns = [makeCampaignDocument(), makeCampaignDocument()];
    const findChain = makeFindChain(campaigns);

    mockNotificationCampaignModel.find.mockReturnValue(findChain);
    mockNotificationCampaignModel.countDocuments.mockResolvedValue(2);

    const result = await service.listCampaigns(10, 20, { status: 'scheduled', type: 'offer' });

    expect(NotificationCampaignModel.find).toHaveBeenCalledWith({
      status: 'scheduled',
      type: 'offer'
    });
    expect((findChain.sort as jest.Mock)).toHaveBeenCalledWith({ createdAt: -1 });
    expect((findChain.skip as jest.Mock)).toHaveBeenCalledWith(20);
    expect((findChain.limit as jest.Mock)).toHaveBeenCalledWith(10);
    expect(result.total).toBe(2);
    expect(result.campaigns).toEqual(campaigns);
  });
});
