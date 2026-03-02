import Stripe from 'stripe';
import { Service } from 'typedi';

import { CSError } from '@errors/CSError';
import { CODES, HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { env } from '@env';
import { Types } from '@lib/db/mongooseCompat';
import { Coupon } from '@models/CouponModel';
import {
  Partner,
  PartnerAttributionTouch,
  PartnerAwardStatus,
  PartnerCode,
  PartnerCodeDocument,
  PartnerCodeSource,
  PartnerConversion,
  PartnerDocument,
  PartnerLedgerStatus,
  PartnerMember,
  PartnerPayoutBatch,
  PartnerPayoutItem,
  PartnerPayoutBatchStatus,
  PartnerStatus,
  PartnerTarget,
  PartnerTargetAward,
  PartnerType,
  ProcessedWebhookEvent
} from '@models/PartnerProgramModel';
import { UserModel } from '@models/UserModel';

import { FeatureFlagService } from './FeatureFlagService';
import { StripeService } from './StripeService';

type PartnerPortalStatus = {
  enabled: boolean;
  isPartner: boolean;
  status?: PartnerStatus;
  partnerType?: PartnerType;
  partnerId?: string;
  dashboardUrl?: string;
  registrationUrl?: string;
};

type TouchSource = {
  code: string;
  source: PartnerCodeSource;
  userId?: string;
  email?: string;
  strict?: boolean;
};

type CheckoutAttributionContext = {
  partner: PartnerDocument;
  partnerCode: PartnerCodeDocument;
  touchId?: string;
};

type CreatePayoutBatchInput = {
  periodStart: Date;
  periodEnd: Date;
  partnerIds?: string[];
  notes?: string;
};

type PayoutPreflightInputItem = {
  partnerId: Types.ObjectId;
  totalUsd: number;
  conversionCount: number;
  awardCount: number;
};

type PayoutOperationsStatus = 'all' | 'pending' | 'processing' | 'paid';
type PayoutOperationsSort = 'amount_desc' | 'amount_asc' | 'name_asc' | 'name_desc';

type PayoutOperationsAccumulator = {
  partnerId: string;
  attributedRevenueUsd: number;
  commissionUsd: number;
  bonusUsd: number;
  unpaidUsd: number;
  batchedUsd: number;
  paidUsd: number;
  conversionCount: number;
  commissionRateWeightedSum: number;
};

@Service()
export class PartnerProgramService {
  constructor(private readonly featureFlagService: FeatureFlagService) {}

  private normalizeCode(code: string): string {
    return code.trim().toUpperCase();
  }

  private now(): Date {
    return new Date();
  }

  private get registrationUrl(): string {
    return env.partnerPortal?.registrationUrl || 'http://localhost:3000/app/partner';
  }

  private get dashboardUrl(): string {
    return env.partnerPortal?.dashboardUrl || 'http://localhost:3000/app/partner';
  }

  public async isEnabled(): Promise<boolean> {
    return this.featureFlagService.isEnabled('partner_program');
  }

  public async assertEnabled(): Promise<void> {
    const enabled = await this.isEnabled();
    if (!enabled) {
      throw new CSError(
        HTTP_STATUS_CODES.SERVICE_UNAVAILABLE,
        CODES.NotImplemented,
        'Partner program is not enabled yet'
      );
    }
  }

  public async getPartnerPortalStatus(userId: string): Promise<PartnerPortalStatus> {
    const enabled = await this.isEnabled();
    if (!enabled) {
      return {
        enabled,
        isPartner: false,
        registrationUrl: this.registrationUrl,
        dashboardUrl: this.dashboardUrl
      };
    }

    const member = await PartnerMember.findOne({
      userId: new Types.ObjectId(userId),
      role: 'owner'
    });

    if (!member) {
      return {
        enabled,
        isPartner: false,
        registrationUrl: this.registrationUrl,
        dashboardUrl: this.dashboardUrl
      };
    }

    const partner = await Partner.findById(member.partnerId);
    if (!partner) {
      return {
        enabled,
        isPartner: false,
        registrationUrl: this.registrationUrl,
        dashboardUrl: this.dashboardUrl
      };
    }

    return {
      enabled,
      isPartner: partner.status === 'active' && member.status === 'active',
      status: partner.status,
      partnerType: partner.partnerType,
      partnerId: partner._id.toString(),
      registrationUrl: this.registrationUrl,
      dashboardUrl: this.dashboardUrl
    };
  }

  public async submitApplication(
    userId: string,
    payload: {
      partnerType: PartnerType;
      displayName: string;
      legalName?: string;
      contactEmail?: string;
      notes?: string;
    }
  ) {
    await this.assertEnabled();

    const existingMember = await PartnerMember.findOne({ userId: new Types.ObjectId(userId), role: 'owner' });
    if (existingMember) {
      throw new CSError(
        HTTP_STATUS_CODES.CONFLICT,
        CODES.UserAlreadyExists,
        'You already have a partner account or application'
      );
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      throw new CSError(HTTP_STATUS_CODES.NOT_FOUND, CODES.NotFound, 'User not found');
    }

    const partner = await Partner.create({
      partnerType: payload.partnerType,
      displayName: payload.displayName,
      legalName: payload.legalName,
      status: 'pending' satisfies PartnerStatus,
      ownerUserId: new Types.ObjectId(userId),
      contactEmail: payload.contactEmail || user.email,
      currency: 'USD',
      defaultCommissionRate: payload.partnerType === 'institute' ? 12 : 10,
      metadata: {
        notes: payload.notes
      },
      createdBy: new Types.ObjectId(userId)
    });

    await PartnerMember.create({
      partnerId: partner._id,
      userId: new Types.ObjectId(userId),
      role: 'owner',
      status: 'pending',
      joinedAt: this.now()
    });

    return {
      partnerId: partner._id.toString(),
      status: partner.status,
      partnerType: partner.partnerType,
      displayName: partner.displayName,
      submittedAt: partner.createdAt,
      registrationUrl: this.registrationUrl
    };
  }

  private async getOwnerMembership(
    userId: string,
    options?: { requireActive?: boolean }
  ): Promise<{ partner: PartnerDocument; member: any }> {
    await this.assertEnabled();

    const member = await PartnerMember.findOne({
      userId: new Types.ObjectId(userId),
      role: 'owner'
    });

    if (!member) {
      throw new CSError(HTTP_STATUS_CODES.FORBIDDEN, CODES.Forbidden, 'Partner account required');
    }

    const partner = await Partner.findById(member.partnerId);
    if (!partner) {
      throw new CSError(HTTP_STATUS_CODES.NOT_FOUND, CODES.NotFound, 'Partner not found');
    }

    if (options?.requireActive !== false) {
      if (partner.status !== 'active' || member.status !== 'active') {
        throw new CSError(
          HTTP_STATUS_CODES.FORBIDDEN,
          CODES.Forbidden,
          'Partner account is not active yet. Contact support if this is unexpected.'
        );
      }
    }

    return { partner, member };
  }

  public async getPartnerSelf(userId: string) {
    const status = await this.getPartnerPortalStatus(userId);

    if (!status.partnerId) {
      return {
        ...status,
        partner: null
      };
    }

    const partner = await Partner.findById(status.partnerId);
    return {
      ...status,
      partner
    };
  }

  public async listPartnerCodes(userId: string, limit: number = 50, offset: number = 0) {
    const { partner } = await this.getOwnerMembership(userId);
    const [codes, total] = await Promise.all([
      PartnerCode.find({ partnerId: partner._id }).sort({ createdAt: -1 }).skip(offset).limit(limit),
      PartnerCode.countDocuments({ partnerId: partner._id })
    ]);

    return {
      partnerId: partner._id.toString(),
      total,
      limit,
      offset,
      codes
    };
  }

  public async listPartnerConversions(userId: string, limit: number = 50, offset: number = 0) {
    const { partner } = await this.getOwnerMembership(userId);
    const [conversions, total] = await Promise.all([
      PartnerConversion.find({ partnerId: partner._id }).sort({ convertedAt: -1 }).skip(offset).limit(limit),
      PartnerConversion.countDocuments({ partnerId: partner._id })
    ]);

    return {
      partnerId: partner._id.toString(),
      total,
      limit,
      offset,
      conversions
    };
  }

  public async listPartnerTargets(userId: string) {
    const { partner } = await this.getOwnerMembership(userId);
    const targets = await PartnerTarget.find({ partnerId: partner._id }).sort({ createdAt: -1 });

    const now = this.now();
    const period = this.getMonthlyPeriod(now);

    const withProgress = await Promise.all(
      targets.map(async target => {
        const achieved = await this.computeTargetMetric(target.partnerId.toString(), target.metric, period.start, period.end);
        return {
          ...target.toObject(),
          currentPeriodProgress: {
            periodStart: period.start,
            periodEnd: period.end,
            achieved,
            threshold: target.thresholdValue,
            remaining: Math.max(0, target.thresholdValue - achieved)
          }
        };
      })
    );

    return {
      partnerId: partner._id.toString(),
      targets: withProgress
    };
  }

  public async listPartnerPayouts(userId: string, limit: number = 50, offset: number = 0) {
    const { partner } = await this.getOwnerMembership(userId);

    const [items, total] = await Promise.all([
      PartnerPayoutItem.find({ partnerId: partner._id }).sort({ createdAt: -1 }).skip(offset).limit(limit),
      PartnerPayoutItem.countDocuments({ partnerId: partner._id })
    ]);

    const batchIds = items.map(item => item.payoutBatchId.toString());
    const batches = await PartnerPayoutBatch.find({ _id: { $in: batchIds } });
    const batchesById = new Map(batches.map(batch => [batch._id.toString(), batch]));

    return {
      partnerId: partner._id.toString(),
      total,
      limit,
      offset,
      payouts: items.map(item => {
        const batchDoc = batchesById.get(item.payoutBatchId.toString()) as { toObject: () => unknown } | undefined;
        return {
          ...item.toObject(),
          batch: batchDoc ? batchDoc.toObject() : null
        };
      })
    };
  }

  public async getPartnerDashboard(userId: string) {
    const { partner } = await this.getOwnerMembership(userId);

    const [allConversions, allAwards, allPayoutItems, codes] = await Promise.all([
      PartnerConversion.find({ partnerId: partner._id }),
      PartnerTargetAward.find({ partnerId: partner._id }),
      PartnerPayoutItem.find({ partnerId: partner._id }),
      PartnerCode.find({ partnerId: partner._id, isActive: true })
    ]);

    const totalRevenue = allConversions.reduce((sum, item) => sum + item.netRevenueUsd, 0);
    const totalCommission = allConversions.reduce((sum, item) => sum + item.commissionAmountUsd, 0);
    const totalBonuses = allAwards.reduce((sum, item) => sum + item.bonusAmountUsd, 0);

    const currentMonth = this.getMonthlyPeriod(this.now());
    const monthlyConversions = allConversions.filter(
      item => item.convertedAt >= currentMonth.start && item.convertedAt <= currentMonth.end
    );

    const monthlyRevenue = monthlyConversions.reduce((sum, item) => sum + item.netRevenueUsd, 0);
    const monthlyCommission = monthlyConversions.reduce((sum, item) => sum + item.commissionAmountUsd, 0);

    const unpaidPayout = allPayoutItems
      .filter(item => item.status !== 'paid')
      .reduce((sum, item) => sum + item.totalUsd, 0);

    return {
      partner: {
        id: partner._id.toString(),
        partnerType: partner.partnerType,
        displayName: partner.displayName,
        status: partner.status,
        defaultCommissionRate: partner.defaultCommissionRate
      },
      lifetime: {
        conversions: allConversions.length,
        revenueUsd: this.roundToCents(totalRevenue),
        commissionUsd: this.roundToCents(totalCommission),
        bonusUsd: this.roundToCents(totalBonuses),
        totalEarningsUsd: this.roundToCents(totalCommission + totalBonuses)
      },
      thisMonth: {
        periodStart: currentMonth.start,
        periodEnd: currentMonth.end,
        conversions: monthlyConversions.length,
        revenueUsd: this.roundToCents(monthlyRevenue),
        commissionUsd: this.roundToCents(monthlyCommission)
      },
      payouts: {
        unpaidUsd: this.roundToCents(unpaidPayout),
        paidItems: allPayoutItems.filter(item => item.status === 'paid').length,
        pendingItems: allPayoutItems.filter(item => item.status !== 'paid').length
      },
      activeCodes: codes.map(code => ({
        id: code._id.toString(),
        code: code.code,
        attributionOnly: code.attributionOnly,
        commissionRateOverride: code.commissionRateOverride,
        validUntil: code.validUntil
      }))
    };
  }

  public async recordAttributionTouch(input: TouchSource): Promise<CheckoutAttributionContext | null> {
    await this.assertEnabled();

    const normalizedCode = this.normalizeCode(input.code);
    const codeDoc = await PartnerCode.findOne({ code: normalizedCode, isActive: true });

    if (!codeDoc) {
      if (input.strict) {
        throw new CSError(HTTP_STATUS_CODES.BAD_REQUEST, CODES.InvalidBody, 'Invalid partner code');
      }
      return null;
    }

    const partner = await Partner.findById(codeDoc.partnerId);
    const now = this.now();
    const isCodeWithinDateRange = codeDoc.validFrom <= now && (!codeDoc.validUntil || now <= codeDoc.validUntil);

    if (!partner || partner.status !== 'active' || !isCodeWithinDateRange) {
      if (input.strict) {
        throw new CSError(HTTP_STATUS_CODES.BAD_REQUEST, CODES.InvalidBody, 'Partner code is inactive or expired');
      }
      return null;
    }

    const touch = await PartnerAttributionTouch.create({
      partnerId: partner._id,
      partnerCodeId: codeDoc._id,
      userId: input.userId ? new Types.ObjectId(input.userId) : undefined,
      email: input.email,
      code: normalizedCode,
      source: input.source,
      touchedAt: now
    });

    return {
      partner,
      partnerCode: codeDoc,
      touchId: touch._id.toString()
    };
  }

  public async getLatestAttributionForUser(userId: string): Promise<CheckoutAttributionContext | null> {
    await this.assertEnabled();

    const touch = await PartnerAttributionTouch.findOne({ userId: new Types.ObjectId(userId) }).sort({ touchedAt: -1 });
    if (!touch) {
      return null;
    }

    const codeDoc = await PartnerCode.findById(touch.partnerCodeId);
    if (!codeDoc || !codeDoc.isActive) {
      return null;
    }

    const partner = await Partner.findById(codeDoc.partnerId);
    if (!partner || partner.status !== 'active') {
      return null;
    }

    return {
      partner,
      partnerCode: codeDoc,
      touchId: touch._id.toString()
    };
  }

  public async resolvePromotionCodeIdForCheckout(
    stripeService: StripeService,
    options: {
      partnerCodeDoc?: PartnerCodeDocument | null;
      couponCode?: string;
    }
  ): Promise<string | undefined> {
    const explicitCoupon = options.couponCode?.trim().toUpperCase();
    const partnerCode = options.partnerCodeDoc;

    if (partnerCode && !partnerCode.attributionOnly) {
      if (partnerCode.stripePromotionCodeId) {
        return partnerCode.stripePromotionCodeId;
      }

      const fallbackCode = explicitCoupon || partnerCode.linkedCouponCode;
      if (fallbackCode) {
        return stripeService.findPromotionCodeIdByCode(fallbackCode);
      }
    }

    if (explicitCoupon) {
      return stripeService.findPromotionCodeIdByCode(explicitCoupon);
    }

    return undefined;
  }

  private roundToCents(amount: number): number {
    return Math.round(amount * 100) / 100;
  }

  private getMonthlyPeriod(reference: Date): { start: Date; end: Date } {
    const start = new Date(reference.getFullYear(), reference.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(reference.getFullYear(), reference.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start, end };
  }

  private calculateProcessingFeeUsd(totalUsd: number): number {
    // Lightweight processing fee estimate for operational preview cards.
    return this.roundToCents(totalUsd * 0.002);
  }

  private async buildPayoutPreflight(items: PayoutPreflightInputItem[]) {
    const partnerIds = items.map(item => item.partnerId);
    const partners = (await Partner.find({ _id: { $in: partnerIds } }).select(
      '_id displayName status contactEmail'
    )) as Array<{
      _id: Types.ObjectId;
      displayName: string;
      status: PartnerStatus;
      contactEmail?: string;
    }>;
    const partnerById = new Map(partners.map(partner => [partner._id.toString(), partner]));

    const emailFrequency = new Map<string, number>();
    partners.forEach(partner => {
      const email = (partner.contactEmail || '').trim().toLowerCase();
      if (!email) {
        return;
      }
      emailFrequency.set(email, (emailFrequency.get(email) || 0) + 1);
    });

    const flaggedAccounts = items
      .map(item => {
        const partner = partnerById.get(item.partnerId.toString());
        if (!partner) {
          return null;
        }

        const riskFactors: string[] = [];
        if (partner.status !== 'active') {
          riskFactors.push('partner_not_active');
        }
        if (item.totalUsd >= 3000) {
          riskFactors.push('high_payout_amount');
        }
        if (item.conversionCount >= 120) {
          riskFactors.push('high_referral_velocity');
        }
        const normalizedEmail = (partner.contactEmail || '').trim().toLowerCase();
        if (normalizedEmail && (emailFrequency.get(normalizedEmail) || 0) > 1) {
          riskFactors.push('duplicate_contact_email');
        }

        if (riskFactors.length === 0) {
          return null;
        }

        return {
          partnerId: partner._id.toString(),
          partnerName: partner.displayName,
          amountUsd: this.roundToCents(item.totalUsd),
          status: riskFactors.includes('partner_not_active') ? 'blocked' : 'review_required',
          riskFactors
        };
      })
      .filter(Boolean) as Array<{
      partnerId: string;
      partnerName: string;
      amountUsd: number;
      status: 'blocked' | 'review_required';
      riskFactors: string[];
    }>;

    const flaggedAmountUsd = this.roundToCents(flaggedAccounts.reduce((sum, item) => sum + item.amountUsd, 0));

    return {
      flaggedAccounts,
      riskSummary: {
        flaggedCount: flaggedAccounts.length,
        flaggedAmountUsd
      }
    };
  }

  private async computeTargetMetric(partnerId: string, metric: string, periodStart: Date, periodEnd: Date): Promise<number> {
    if (metric === 'paid_conversions') {
      return PartnerConversion.countDocuments({
        partnerId: new Types.ObjectId(partnerId),
        convertedAt: { $gte: periodStart, $lte: periodEnd }
      });
    }

    const conversions = await PartnerConversion.find({
      partnerId: new Types.ObjectId(partnerId),
      convertedAt: { $gte: periodStart, $lte: periodEnd }
    });

    return conversions.reduce((sum, conversion) => sum + conversion.netRevenueUsd, 0);
  }

  public async evaluateTargetsForPartner(partnerId: string, referenceDate: Date = this.now()): Promise<number> {
    const period = this.getMonthlyPeriod(referenceDate);

    const targets = await PartnerTarget.find({
      partnerId: new Types.ObjectId(partnerId),
      isActive: true,
      startsAt: { $lte: period.end },
      $or: [{ endsAt: { $exists: false } }, { endsAt: null }, { endsAt: { $gte: period.start } }]
    });

    let createdAwards = 0;

    for (const target of targets) {
      const existingAward = await PartnerTargetAward.findOne({
        partnerTargetId: target._id,
        partnerId: target.partnerId,
        periodStart: period.start
      });

      if (existingAward) {
        continue;
      }

      const achieved = await this.computeTargetMetric(partnerId, target.metric, period.start, period.end);
      if (achieved < target.thresholdValue) {
        continue;
      }

      const award: Record<string, unknown> = {
        partnerId: target.partnerId,
        partnerTargetId: target._id,
        periodStart: period.start,
        periodEnd: period.end,
        metricAchieved: achieved,
        thresholdValue: target.thresholdValue,
        bonusAmountUsd: target.bonusAmountUsd,
        status: 'approved' satisfies PartnerAwardStatus,
        payoutStatus: 'unpaid' satisfies PartnerLedgerStatus,
        awardedAt: this.now(),
        metadata: {
          metric: target.metric,
          targetName: target.name
        }
      };

      if (target.commissionUpliftPercent && target.upliftDurationDays) {
        const upliftStartsAt = this.now();
        const upliftEndsAt = new Date(upliftStartsAt.getTime() + target.upliftDurationDays * 24 * 60 * 60 * 1000);

        award.commissionUpliftPercent = target.commissionUpliftPercent;
        award.upliftStartsAt = upliftStartsAt;
        award.upliftEndsAt = upliftEndsAt;
      }

      await PartnerTargetAward.create(award);
      createdAwards += 1;
    }

    return createdAwards;
  }

  public async reconcileTargets(
    referenceDate: Date = this.now(),
    options?: {
      partnerIds?: string[];
    }
  ): Promise<{ referenceDate: string; partnersScanned: number; awardsCreated: number }> {
    await this.assertEnabled();

    const activePartnerIds =
      options?.partnerIds && options.partnerIds.length
        ? options.partnerIds.filter(id => Types.ObjectId.isValid(id))
        : (await Partner.find({ status: 'active' }).select('_id')).map(item => item._id.toString());

    let awardsCreated = 0;
    for (const partnerId of activePartnerIds) {
      awardsCreated += await this.evaluateTargetsForPartner(partnerId, referenceDate);
    }

    return {
      referenceDate: referenceDate.toISOString(),
      partnersScanned: activePartnerIds.length,
      awardsCreated
    };
  }

  private async getActiveUpliftPercent(partnerId: string, atDate: Date): Promise<number> {
    const awards = await PartnerTargetAward.find({
      partnerId: new Types.ObjectId(partnerId),
      status: { $in: ['approved', 'paid'] },
      upliftStartsAt: { $lte: atDate },
      upliftEndsAt: { $gte: atDate }
    });

    return awards.reduce((max, award) => Math.max(max, award.commissionUpliftPercent || 0), 0);
  }

  public async isStripeEventProcessed(eventId: string): Promise<boolean> {
    const existing = await ProcessedWebhookEvent.findOne({ provider: 'stripe', eventId });
    return !!existing;
  }

  private async markStripeEventProcessed(event: {
    eventId: string;
    eventType: string;
    metadata?: Record<string, unknown>;
  }) {
    await ProcessedWebhookEvent.findOneAndUpdate(
      { provider: 'stripe', eventId: event.eventId },
      {
        $set: {
          eventType: event.eventType,
          processedAt: this.now(),
          metadata: event.metadata || {}
        },
        $setOnInsert: {
          provider: 'stripe',
          eventId: event.eventId
        }
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true
      }
    );
  }

  public async recordConversionFromInvoice(input: {
    eventId: string;
    eventType: string;
    invoice: Stripe.Invoice;
    metadata: {
      userId?: string;
      partnerId?: string;
      partnerCodeId?: string;
      partnerCode?: string;
    };
  }): Promise<{ created: boolean; reason?: string }> {
    await this.assertEnabled();

    if (await this.isStripeEventProcessed(input.eventId)) {
      return { created: false, reason: 'duplicate_event' };
    }

    const { userId, partnerId, partnerCodeId, partnerCode } = input.metadata;

    if (!userId || !partnerId || !partnerCodeId || !partnerCode) {
      await this.markStripeEventProcessed({
        eventId: input.eventId,
        eventType: input.eventType,
        metadata: {
          skipped: true,
          reason: 'missing_partner_metadata'
        }
      });
      return { created: false, reason: 'missing_partner_metadata' };
    }

    const existingConversion = await PartnerConversion.findOne({ userId: new Types.ObjectId(userId) });
    if (existingConversion) {
      await this.markStripeEventProcessed({
        eventId: input.eventId,
        eventType: input.eventType,
        metadata: {
          skipped: true,
          reason: 'already_converted',
          userId
        }
      });
      return { created: false, reason: 'already_converted' };
    }

    const partner = await Partner.findById(partnerId);
    const codeDoc = await PartnerCode.findById(partnerCodeId);

    if (!partner || partner.status !== 'active' || !codeDoc || !codeDoc.isActive) {
      await this.markStripeEventProcessed({
        eventId: input.eventId,
        eventType: input.eventType,
        metadata: {
          skipped: true,
          reason: 'partner_or_code_inactive',
          partnerId,
          partnerCodeId
        }
      });
      return { created: false, reason: 'partner_or_code_inactive' };
    }

    const invoiceId = input.invoice.id;
    if (!invoiceId) {
      await this.markStripeEventProcessed({
        eventId: input.eventId,
        eventType: input.eventType,
        metadata: {
          skipped: true,
          reason: 'invoice_id_missing'
        }
      });
      return { created: false, reason: 'invoice_id_missing' };
    }

    const amountPaidUsd = this.roundToCents((input.invoice.amount_paid || 0) / 100);
    const netRevenueUsd = amountPaidUsd;

    const upliftPercent = await this.getActiveUpliftPercent(partnerId, this.now());
    const baseCommissionRate = codeDoc.commissionRateOverride ?? partner.defaultCommissionRate;
    const commissionRate = Math.min(100, this.roundToCents(baseCommissionRate + upliftPercent));
    const commissionAmountUsd = this.roundToCents((netRevenueUsd * commissionRate) / 100);

    const rawInvoice = input.invoice as unknown as {
      subscription?: string | { id?: string };
      customer?: string | { id?: string };
    };

    await PartnerConversion.create({
      partnerId: partner._id,
      partnerCodeId: codeDoc._id,
      userId: new Types.ObjectId(userId),
      code: partnerCode,
      stripeInvoiceId: invoiceId,
      stripeSubscriptionId:
        typeof rawInvoice.subscription === 'string' ? rawInvoice.subscription : rawInvoice.subscription?.id,
      stripeCustomerId: typeof rawInvoice.customer === 'string' ? rawInvoice.customer : rawInvoice.customer?.id,
      amountPaidUsd,
      commissionRate,
      commissionAmountUsd,
      netRevenueUsd,
      payoutStatus: 'unpaid',
      metadata: {
        currency: input.invoice.currency?.toUpperCase(),
        billingReason: input.invoice.billing_reason,
        stripeEventId: input.eventId,
        stripeEventType: input.eventType,
        stripeEventCreatedAt: new Date().toISOString()
      },
      convertedAt: this.now()
    });

    await this.markStripeEventProcessed({
      eventId: input.eventId,
      eventType: input.eventType,
      metadata: {
        created: true,
        userId,
        partnerId,
        partnerCodeId
      }
    });

    await this.evaluateTargetsForPartner(partnerId, this.now());

    return { created: true };
  }

  public async listPartners(filters?: {
    limit?: number;
    offset?: number;
    partnerType?: PartnerType;
    status?: PartnerStatus;
  }) {
    await this.assertEnabled();

    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;

    const query: Record<string, unknown> = {};

    if (filters?.partnerType) {
      query.partnerType = filters.partnerType;
    }

    if (filters?.status) {
      query.status = filters.status;
    }

    const [partners, total] = await Promise.all([
      Partner.find(query).sort({ createdAt: -1 }).skip(offset).limit(limit),
      Partner.countDocuments(query)
    ]);

    return {
      total,
      limit,
      offset,
      partners
    };
  }

  public async listPartnerCodesForAdmin(partnerId: string, limit: number = 50, offset: number = 0) {
    await this.assertEnabled();
    if (!Types.ObjectId.isValid(partnerId)) {
      throw new CSError(HTTP_STATUS_CODES.BAD_REQUEST, CODES.InvalidBody, 'Invalid partnerId');
    }

    const [codes, total] = await Promise.all([
      PartnerCode.find({ partnerId: new Types.ObjectId(partnerId) }).sort({ createdAt: -1 }).skip(offset).limit(limit),
      PartnerCode.countDocuments({ partnerId: new Types.ObjectId(partnerId) })
    ]);

    return {
      partnerId,
      total,
      limit,
      offset,
      codes
    };
  }

  public async listPartnerTargetsForAdmin(partnerId: string, limit: number = 50, offset: number = 0) {
    await this.assertEnabled();
    if (!Types.ObjectId.isValid(partnerId)) {
      throw new CSError(HTTP_STATUS_CODES.BAD_REQUEST, CODES.InvalidBody, 'Invalid partnerId');
    }

    const [targets, total] = await Promise.all([
      PartnerTarget.find({ partnerId: new Types.ObjectId(partnerId) }).sort({ createdAt: -1 }).skip(offset).limit(limit),
      PartnerTarget.countDocuments({ partnerId: new Types.ObjectId(partnerId) })
    ]);

    return {
      partnerId,
      total,
      limit,
      offset,
      targets
    };
  }

  public async listPayoutBatches(limit: number = 50, offset: number = 0) {
    await this.assertEnabled();

    const [batches, total] = await Promise.all([
      PartnerPayoutBatch.find({}).sort({ createdAt: -1 }).skip(offset).limit(limit),
      PartnerPayoutBatch.countDocuments({})
    ]);

    return {
      total,
      limit,
      offset,
      batches
    };
  }

  public async getPayoutOperationsView(filters: {
    status?: PayoutOperationsStatus;
    sort?: PayoutOperationsSort;
    limit?: number;
    offset?: number;
  }) {
    await this.assertEnabled();

    const limit = Math.max(1, Math.min(200, filters.limit || 50));
    const offset = Math.max(0, filters.offset || 0);
    const status = (filters.status || 'all') as PayoutOperationsStatus;
    const sort = (filters.sort || 'amount_desc') as PayoutOperationsSort;

    const [conversionRows, awardRows] = await Promise.all([
      PartnerConversion.aggregate([
        {
          $group: {
            _id: {
              partnerId: '$partnerId',
              payoutStatus: '$payoutStatus'
            },
            attributedRevenueUsd: { $sum: '$netRevenueUsd' },
            commissionUsd: { $sum: '$commissionAmountUsd' },
            conversionCount: { $sum: 1 },
            commissionRateWeightedSum: {
              $sum: {
                $multiply: ['$commissionRate', '$commissionAmountUsd']
              }
            }
          }
        }
      ]),
      PartnerTargetAward.aggregate([
        {
          $group: {
            _id: {
              partnerId: '$partnerId',
              payoutStatus: '$payoutStatus'
            },
            bonusUsd: { $sum: '$bonusAmountUsd' }
          }
        }
      ])
    ]);

    const byPartner = new Map<string, PayoutOperationsAccumulator>();
    const getAccumulator = (partnerId: string): PayoutOperationsAccumulator => {
      const existing = byPartner.get(partnerId);
      if (existing) {
        return existing;
      }

      const created: PayoutOperationsAccumulator = {
        partnerId,
        attributedRevenueUsd: 0,
        commissionUsd: 0,
        bonusUsd: 0,
        unpaidUsd: 0,
        batchedUsd: 0,
        paidUsd: 0,
        conversionCount: 0,
        commissionRateWeightedSum: 0
      };
      byPartner.set(partnerId, created);
      return created;
    };

    for (const row of conversionRows as Array<{
      _id: { partnerId: Types.ObjectId; payoutStatus: PartnerLedgerStatus };
      attributedRevenueUsd: number;
      commissionUsd: number;
      conversionCount: number;
      commissionRateWeightedSum: number;
    }>) {
      const partnerId = row._id.partnerId.toString();
      const acc = getAccumulator(partnerId);
      const commission = this.roundToCents(row.commissionUsd || 0);

      acc.attributedRevenueUsd += this.roundToCents(row.attributedRevenueUsd || 0);
      acc.commissionUsd += commission;
      acc.conversionCount += row.conversionCount || 0;
      acc.commissionRateWeightedSum += row.commissionRateWeightedSum || 0;

      if (row._id.payoutStatus === 'unpaid') {
        acc.unpaidUsd += commission;
      } else if (row._id.payoutStatus === 'batched') {
        acc.batchedUsd += commission;
      } else {
        acc.paidUsd += commission;
      }
    }

    for (const row of awardRows as Array<{
      _id: { partnerId: Types.ObjectId; payoutStatus: PartnerLedgerStatus };
      bonusUsd: number;
    }>) {
      const partnerId = row._id.partnerId.toString();
      const acc = getAccumulator(partnerId);
      const bonus = this.roundToCents(row.bonusUsd || 0);

      acc.bonusUsd += bonus;

      if (row._id.payoutStatus === 'unpaid') {
        acc.unpaidUsd += bonus;
      } else if (row._id.payoutStatus === 'batched') {
        acc.batchedUsd += bonus;
      } else {
        acc.paidUsd += bonus;
      }
    }

    const partnerIds = Array.from(byPartner.keys());
    const partnerDocs = (await Partner.find({ _id: { $in: partnerIds } })) as Array<{
      _id: Types.ObjectId;
      displayName: string;
      partnerType: PartnerType;
      defaultCommissionRate: number;
      metadata?: Record<string, unknown>;
      contactEmail?: string;
    }>;
    const partnerById = new Map(partnerDocs.map(item => [item._id.toString(), item]));

    const rows = partnerIds
      .map(partnerId => {
        const acc = byPartner.get(partnerId)!;
        const partner = partnerById.get(partnerId);
        const avgRate =
          acc.commissionUsd > 0
            ? this.roundToCents(acc.commissionRateWeightedSum / acc.commissionUsd)
            : this.roundToCents(partner?.defaultCommissionRate || 0);
        const totalPayout = this.roundToCents(acc.unpaidUsd + acc.batchedUsd + acc.paidUsd);

        const derivedStatus: 'pending' | 'processing' | 'paid' = acc.unpaidUsd > 0 ? 'pending' : acc.batchedUsd > 0 ? 'processing' : 'paid';

        return {
          partnerId,
          partnerName: partner?.displayName || 'Unknown Partner',
          partnerType: partner?.partnerType || 'influencer',
          status: derivedStatus,
          paymentStatus: derivedStatus,
          paymentMethod:
            ((partner?.metadata as Record<string, unknown> | undefined)?.paymentMethod as string | undefined) || 'bank_transfer',
          attributedRevenueUsd: this.roundToCents(acc.attributedRevenueUsd),
          commissionRatePercent: avgRate,
          calculatedPayoutUsd: totalPayout,
          payoutBreakdown: {
            unpaidUsd: this.roundToCents(acc.unpaidUsd),
            processingUsd: this.roundToCents(acc.batchedUsd),
            paidUsd: this.roundToCents(acc.paidUsd)
          },
          conversionCount: acc.conversionCount,
          contactEmail: partner?.contactEmail
        };
      })
      .filter(row => (status === 'all' ? true : row.status === status));

    rows.sort((a, b) => {
      if (sort === 'amount_asc') {
        return a.calculatedPayoutUsd - b.calculatedPayoutUsd;
      }
      if (sort === 'name_asc') {
        return a.partnerName.localeCompare(b.partnerName);
      }
      if (sort === 'name_desc') {
        return b.partnerName.localeCompare(a.partnerName);
      }
      return b.calculatedPayoutUsd - a.calculatedPayoutUsd;
    });

    const paginatedRows = rows.slice(offset, offset + limit);

    const now = this.now();
    const currentMonth = this.getMonthlyPeriod(now);
    const previousMonthReference = new Date(currentMonth.start);
    previousMonthReference.setUTCMonth(previousMonthReference.getUTCMonth() - 1);
    const previousMonth = this.getMonthlyPeriod(previousMonthReference);

    const [currentPendingUsd, previousPendingUsd] = await Promise.all([
      this.calculateOutstandingUsd(currentMonth.start, currentMonth.end),
      this.calculateOutstandingUsd(previousMonth.start, previousMonth.end)
    ]);

    const currentPending = this.roundToCents(currentPendingUsd);
    const previousPending = this.roundToCents(previousPendingUsd);
    const pendingChangePercent =
      previousPending <= 0 ? (currentPending > 0 ? 100 : 0) : this.roundToCents(((currentPending - previousPending) / previousPending) * 100);

    const currentLtmStart = new Date(now);
    currentLtmStart.setUTCMonth(currentLtmStart.getUTCMonth() - 12);
    const previousLtmStart = new Date(currentLtmStart);
    previousLtmStart.setUTCMonth(previousLtmStart.getUTCMonth() - 12);

    const [ltmPaidUsd, previousLtmPaidUsd] = await Promise.all([
      this.calculatePaidUsd(currentLtmStart, now),
      this.calculatePaidUsd(previousLtmStart, currentLtmStart)
    ]);

    const totalPaidLtmUsd = this.roundToCents(ltmPaidUsd);
    const totalPaidChangePercent =
      previousLtmPaidUsd <= 0
        ? (ltmPaidUsd > 0 ? 100 : 0)
        : this.roundToCents(((ltmPaidUsd - previousLtmPaidUsd) / previousLtmPaidUsd) * 100);

    const nextBatchDate = currentMonth.end;
    const millisUntilNextBatch = Math.max(0, nextBatchDate.getTime() - now.getTime());
    const nextBatchCountdownDays = Math.ceil(millisUntilNextBatch / (1000 * 60 * 60 * 24));

    return {
      summary: {
        pendingPayoutUsd: this.roundToCents(
          rows
            .filter(item => item.status === 'pending' || item.status === 'processing')
            .reduce((sum, item) => sum + item.calculatedPayoutUsd, 0)
        ),
        pendingChangePercent,
        nextBatchDate,
        nextBatchCountdownDays,
        totalPaidLtmUsd,
        totalPaidChangePercent
      },
      rows: paginatedRows,
      total: rows.length,
      limit,
      offset
    };
  }

  public async getPayoutBatchDetail(batchId: string) {
    await this.assertEnabled();
    if (!Types.ObjectId.isValid(batchId)) {
      throw new CSError(HTTP_STATUS_CODES.BAD_REQUEST, CODES.InvalidBody, 'Invalid payout batch id');
    }

    const batch = await PartnerPayoutBatch.findById(batchId);
    if (!batch) {
      throw new CSError(HTTP_STATUS_CODES.NOT_FOUND, CODES.NotFound, 'Payout batch not found');
    }

    const items = await PartnerPayoutItem.find({ payoutBatchId: batch._id }).sort({ totalUsd: -1 });
    const partnerIds = items.map(item => item.partnerId.toString());
    const partners = (await Partner.find({ _id: { $in: partnerIds } }).select('_id displayName status')) as Array<{
      _id: Types.ObjectId;
      displayName: string;
      status: PartnerStatus;
    }>;
    const partnerById = new Map(partners.map(partner => [partner._id.toString(), partner]));

    const itemSummaries = items.map(item => ({
      ...item.toObject(),
      partner: (() => {
        const partner = partnerById.get(item.partnerId.toString());
        return partner
          ? {
              _id: partner._id.toString(),
              displayName: partner.displayName,
              status: partner.status
            }
          : null;
      })()
    }));

    const preflightBase = await this.buildPayoutPreflight(
      items.map(item => ({
        partnerId: item.partnerId,
        totalUsd: item.totalUsd,
        conversionCount: item.partnerConversionIds?.length || 0,
        awardCount: item.partnerAwardIds?.length || 0
      }))
    );

    return {
      batch,
      items: itemSummaries,
      preflight: {
        processingFeeUsd: this.calculateProcessingFeeUsd(batch.totals.totalUsd),
        flaggedAccounts: preflightBase.flaggedAccounts,
        riskSummary: preflightBase.riskSummary
      }
    };
  }

  public async previewPayoutBatch(input: CreatePayoutBatchInput) {
    await this.assertEnabled();

    if (input.periodEnd < input.periodStart) {
      throw new CSError(HTTP_STATUS_CODES.BAD_REQUEST, CODES.InvalidBody, 'periodEnd must be after periodStart');
    }

    const partnerObjectIds =
      input.partnerIds && input.partnerIds.length
        ? input.partnerIds.filter(id => Types.ObjectId.isValid(id)).map(id => new Types.ObjectId(id))
        : (await Partner.find({ status: 'active' }).select('_id')).map(partner => partner._id);

    const itemSummaries: PayoutPreflightInputItem[] = [];
    let totalCommission = 0;
    let totalBonus = 0;

    for (const partnerId of partnerObjectIds) {
      const [conversions, awards] = await Promise.all([
        PartnerConversion.find({
          partnerId,
          payoutStatus: 'unpaid',
          convertedAt: { $gte: input.periodStart, $lte: input.periodEnd }
        }),
        PartnerTargetAward.find({
          partnerId,
          payoutStatus: 'unpaid',
          awardedAt: { $gte: input.periodStart, $lte: input.periodEnd }
        })
      ]);

      if (!conversions.length && !awards.length) {
        continue;
      }

      const commissionUsd = this.roundToCents(conversions.reduce((sum, item) => sum + item.commissionAmountUsd, 0));
      const bonusUsd = this.roundToCents(awards.reduce((sum, item) => sum + item.bonusAmountUsd, 0));
      const totalUsd = this.roundToCents(commissionUsd + bonusUsd);

      totalCommission += commissionUsd;
      totalBonus += bonusUsd;

      itemSummaries.push({
        partnerId,
        totalUsd,
        conversionCount: conversions.length,
        awardCount: awards.length
      });
    }

    const totals = {
      commissionUsd: this.roundToCents(totalCommission),
      bonusUsd: this.roundToCents(totalBonus),
      totalUsd: this.roundToCents(totalCommission + totalBonus)
    };

    const preflightBase = await this.buildPayoutPreflight(itemSummaries);

    return {
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      partnerCount: itemSummaries.length,
      totals,
      preflight: {
        processingFeeUsd: this.calculateProcessingFeeUsd(totals.totalUsd),
        flaggedAccounts: preflightBase.flaggedAccounts,
        riskSummary: preflightBase.riskSummary
      }
    };
  }

  public async createPartner(input: {
    partnerType: PartnerType;
    displayName: string;
    ownerUserId: string;
    legalName?: string;
    contactEmail?: string;
    defaultCommissionRate?: number;
    activateNow?: boolean;
    notes?: string;
    actorUserId: string;
  }) {
    await this.assertEnabled();

    const owner = await UserModel.findById(input.ownerUserId);
    if (!owner) {
      throw new CSError(HTTP_STATUS_CODES.NOT_FOUND, CODES.NotFound, 'Owner user not found');
    }

    const existing = await PartnerMember.findOne({
      userId: new Types.ObjectId(input.ownerUserId),
      role: 'owner',
      status: { $in: ['pending', 'active'] }
    });

    if (existing) {
      throw new CSError(HTTP_STATUS_CODES.CONFLICT, CODES.UserAlreadyExists, 'Owner already has a partner account');
    }

    const status: PartnerStatus = input.activateNow ? 'active' : 'pending';
    const memberStatus = input.activateNow ? 'active' : 'pending';

    const partner = await Partner.create({
      partnerType: input.partnerType,
      displayName: input.displayName,
      legalName: input.legalName,
      status,
      ownerUserId: new Types.ObjectId(input.ownerUserId),
      contactEmail: input.contactEmail || owner.email,
      currency: 'USD',
      defaultCommissionRate: input.defaultCommissionRate ?? (input.partnerType === 'institute' ? 12 : 10),
      metadata: {
        notes: input.notes
      },
      createdBy: new Types.ObjectId(input.actorUserId),
      activatedAt: status === 'active' ? this.now() : undefined
    });

    await PartnerMember.create({
      partnerId: partner._id,
      userId: new Types.ObjectId(input.ownerUserId),
      role: 'owner',
      status: memberStatus,
      joinedAt: this.now(),
      invitedBy: new Types.ObjectId(input.actorUserId)
    });

    return partner;
  }

  public async updatePartner(
    partnerId: string,
    updates: {
      displayName?: string;
      legalName?: string;
      contactEmail?: string;
      status?: PartnerStatus;
      defaultCommissionRate?: number;
      notes?: string;
    }
  ) {
    await this.assertEnabled();

    const partner = await Partner.findById(partnerId);
    if (!partner) {
      throw new CSError(HTTP_STATUS_CODES.NOT_FOUND, CODES.NotFound, 'Partner not found');
    }

    if (typeof updates.displayName === 'string') {
      partner.displayName = updates.displayName;
    }

    if (typeof updates.legalName === 'string') {
      partner.legalName = updates.legalName;
    }

    if (typeof updates.contactEmail === 'string') {
      partner.contactEmail = updates.contactEmail;
    }

    if (typeof updates.defaultCommissionRate === 'number') {
      partner.defaultCommissionRate = updates.defaultCommissionRate;
    }

    if (typeof updates.status === 'string') {
      partner.status = updates.status;
      if (updates.status === 'active') {
        partner.activatedAt = this.now();
      }

      const memberStatus = updates.status === 'active' ? 'active' : updates.status === 'pending' ? 'pending' : 'disabled';
      await PartnerMember.updateMany({ partnerId: partner._id, role: 'owner' }, { $set: { status: memberStatus } });
    }

    if (typeof updates.notes === 'string') {
      partner.metadata = {
        ...(partner.metadata || {}),
        notes: updates.notes
      };
    }

    await partner.save();
    return partner;
  }

  public async createPartnerCode(
    partnerId: string,
    input: {
      code: string;
      description?: string;
      isActive?: boolean;
      attributionOnly?: boolean;
      linkedCouponCode?: string;
      stripePromotionCodeId?: string;
      commissionRateOverride?: number;
      validFrom?: Date;
      validUntil?: Date;
      actorUserId: string;
    }
  ) {
    await this.assertEnabled();

    const partner = await Partner.findById(partnerId);
    if (!partner) {
      throw new CSError(HTTP_STATUS_CODES.NOT_FOUND, CODES.NotFound, 'Partner not found');
    }

    const normalizedCode = this.normalizeCode(input.code);

    const existing = await PartnerCode.findOne({ code: normalizedCode });
    if (existing) {
      throw new CSError(HTTP_STATUS_CODES.CONFLICT, CODES.UserAlreadyExists, 'Partner code already exists');
    }

    const normalizedCouponCode = input.linkedCouponCode?.trim().toUpperCase();
    const linkedCoupon = normalizedCouponCode ? await Coupon.findOne({ code: normalizedCouponCode }) : null;

    const code = await PartnerCode.create({
      partnerId: partner._id,
      code: normalizedCode,
      description: input.description,
      isActive: input.isActive ?? true,
      attributionOnly: input.attributionOnly ?? false,
      couponId: linkedCoupon?._id,
      linkedCouponCode: linkedCoupon?.code,
      stripePromotionCodeId: input.stripePromotionCodeId,
      commissionRateOverride: input.commissionRateOverride,
      validFrom: input.validFrom || this.now(),
      validUntil: input.validUntil,
      createdBy: new Types.ObjectId(input.actorUserId)
    });

    return code;
  }

  public async updatePartnerCode(
    partnerId: string,
    codeId: string,
    updates: {
      description?: string;
      isActive?: boolean;
      attributionOnly?: boolean;
      linkedCouponCode?: string;
      stripePromotionCodeId?: string;
      commissionRateOverride?: number;
      validFrom?: Date;
      validUntil?: Date;
    }
  ) {
    await this.assertEnabled();

    const code = await PartnerCode.findOne({ _id: codeId, partnerId: new Types.ObjectId(partnerId) });
    if (!code) {
      throw new CSError(HTTP_STATUS_CODES.NOT_FOUND, CODES.NotFound, 'Partner code not found');
    }

    if (typeof updates.description === 'string') {
      code.description = updates.description;
    }

    if (typeof updates.isActive === 'boolean') {
      code.isActive = updates.isActive;
    }

    if (typeof updates.attributionOnly === 'boolean') {
      code.attributionOnly = updates.attributionOnly;
    }

    if (typeof updates.commissionRateOverride === 'number') {
      code.commissionRateOverride = updates.commissionRateOverride;
    }

    if (typeof updates.stripePromotionCodeId === 'string') {
      code.stripePromotionCodeId = updates.stripePromotionCodeId;
    }

    if (updates.validFrom) {
      code.validFrom = updates.validFrom;
    }

    if (updates.validUntil) {
      code.validUntil = updates.validUntil;
    }

    if (typeof updates.linkedCouponCode === 'string') {
      const normalizedCouponCode = updates.linkedCouponCode.trim().toUpperCase();
      const linkedCoupon = normalizedCouponCode ? await Coupon.findOne({ code: normalizedCouponCode }) : null;
      code.linkedCouponCode = linkedCoupon?.code;
      code.couponId = linkedCoupon?._id;
    }

    await code.save();
    return code;
  }

  public async createPartnerTarget(
    partnerId: string,
    input: {
      name: string;
      metric: 'paid_conversions' | 'net_revenue_usd';
      period?: 'monthly';
      thresholdValue: number;
      bonusAmountUsd: number;
      commissionUpliftPercent?: number;
      upliftDurationDays?: number;
      isActive?: boolean;
      startsAt?: Date;
      endsAt?: Date;
      actorUserId: string;
    }
  ) {
    await this.assertEnabled();

    const partner = await Partner.findById(partnerId);
    if (!partner) {
      throw new CSError(HTTP_STATUS_CODES.NOT_FOUND, CODES.NotFound, 'Partner not found');
    }

    return PartnerTarget.create({
      partnerId: partner._id,
      name: input.name,
      metric: input.metric,
      period: input.period || 'monthly',
      thresholdValue: input.thresholdValue,
      bonusAmountUsd: input.bonusAmountUsd,
      commissionUpliftPercent: input.commissionUpliftPercent,
      upliftDurationDays: input.upliftDurationDays,
      isActive: input.isActive ?? true,
      startsAt: input.startsAt || this.now(),
      endsAt: input.endsAt,
      createdBy: new Types.ObjectId(input.actorUserId)
    });
  }

  public async updatePartnerTarget(
    partnerId: string,
    targetId: string,
    updates: {
      name?: string;
      thresholdValue?: number;
      bonusAmountUsd?: number;
      commissionUpliftPercent?: number;
      upliftDurationDays?: number;
      isActive?: boolean;
      startsAt?: Date;
      endsAt?: Date;
    }
  ) {
    await this.assertEnabled();

    const target = await PartnerTarget.findOne({ _id: targetId, partnerId: new Types.ObjectId(partnerId) });
    if (!target) {
      throw new CSError(HTTP_STATUS_CODES.NOT_FOUND, CODES.NotFound, 'Partner target not found');
    }

    if (typeof updates.name === 'string') {
      target.name = updates.name;
    }

    if (typeof updates.thresholdValue === 'number') {
      target.thresholdValue = updates.thresholdValue;
    }

    if (typeof updates.bonusAmountUsd === 'number') {
      target.bonusAmountUsd = updates.bonusAmountUsd;
    }

    if (typeof updates.commissionUpliftPercent === 'number') {
      target.commissionUpliftPercent = updates.commissionUpliftPercent;
    }

    if (typeof updates.upliftDurationDays === 'number') {
      target.upliftDurationDays = updates.upliftDurationDays;
    }

    if (typeof updates.isActive === 'boolean') {
      target.isActive = updates.isActive;
    }

    if (updates.startsAt) {
      target.startsAt = updates.startsAt;
    }

    if (updates.endsAt) {
      target.endsAt = updates.endsAt;
    }

    await target.save();
    return target;
  }

  public async createPayoutBatch(input: CreatePayoutBatchInput & { actorUserId: string }) {
    await this.assertEnabled();

    if (input.periodEnd < input.periodStart) {
      throw new CSError(HTTP_STATUS_CODES.BAD_REQUEST, CODES.InvalidBody, 'periodEnd must be after periodStart');
    }

    const partnerObjectIds =
      input.partnerIds && input.partnerIds.length
        ? input.partnerIds.filter(id => Types.ObjectId.isValid(id)).map(id => new Types.ObjectId(id))
        : (await Partner.find({ status: 'active' }).select('_id')).map(partner => partner._id);

    const batch = await PartnerPayoutBatch.create({
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      status: 'draft' satisfies PartnerPayoutBatchStatus,
      partnerCount: 0,
      totals: {
        commissionUsd: 0,
        bonusUsd: 0,
        totalUsd: 0
      },
      createdBy: new Types.ObjectId(input.actorUserId),
      notes: input.notes
    });

    let partnerCount = 0;
    let totalCommission = 0;
    let totalBonus = 0;

    for (const partnerId of partnerObjectIds) {
      const [conversions, awards] = await Promise.all([
        PartnerConversion.find({
          partnerId,
          payoutStatus: 'unpaid',
          convertedAt: { $gte: input.periodStart, $lte: input.periodEnd }
        }),
        PartnerTargetAward.find({
          partnerId,
          payoutStatus: 'unpaid',
          awardedAt: { $gte: input.periodStart, $lte: input.periodEnd }
        })
      ]);

      if (!conversions.length && !awards.length) {
        continue;
      }

      const commissionUsd = this.roundToCents(conversions.reduce((sum, item) => sum + item.commissionAmountUsd, 0));
      const bonusUsd = this.roundToCents(awards.reduce((sum, item) => sum + item.bonusAmountUsd, 0));
      const totalUsd = this.roundToCents(commissionUsd + bonusUsd);

      await PartnerPayoutItem.create({
        payoutBatchId: batch._id,
        partnerId,
        partnerConversionIds: conversions.map(item => item._id),
        partnerAwardIds: awards.map(item => item._id),
        commissionUsd,
        bonusUsd,
        totalUsd,
        status: 'batched'
      });

      if (conversions.length > 0) {
        await PartnerConversion.updateMany(
          { _id: { $in: conversions.map(item => item._id) } },
          { $set: { payoutStatus: 'batched', payoutBatchId: batch._id } }
        );
      }

      if (awards.length > 0) {
        await PartnerTargetAward.updateMany(
          { _id: { $in: awards.map(item => item._id) } },
          { $set: { payoutStatus: 'batched', payoutBatchId: batch._id } }
        );
      }

      partnerCount += 1;
      totalCommission += commissionUsd;
      totalBonus += bonusUsd;
    }

    batch.partnerCount = partnerCount;
    batch.totals = {
      commissionUsd: this.roundToCents(totalCommission),
      bonusUsd: this.roundToCents(totalBonus),
      totalUsd: this.roundToCents(totalCommission + totalBonus)
    };

    await batch.save();

    return {
      batch,
      partnerCount,
      totals: batch.totals
    };
  }

  public async markPayoutBatchPaid(
    batchId: string,
    input: {
      externalReference?: string;
      notes?: string;
      actorUserId: string;
    }
  ) {
    await this.assertEnabled();

    const batch = await PartnerPayoutBatch.findById(batchId);
    if (!batch) {
      throw new CSError(HTTP_STATUS_CODES.NOT_FOUND, CODES.NotFound, 'Payout batch not found');
    }

    const items = await PartnerPayoutItem.find({ payoutBatchId: batch._id });

    const conversionIds = items.flatMap(item => item.partnerConversionIds || []).map(id => id.toString());
    const awardIds = items.flatMap(item => item.partnerAwardIds || []).map(id => id.toString());

    if (conversionIds.length > 0) {
      await PartnerConversion.updateMany(
        { _id: { $in: conversionIds } },
        {
          $set: {
            payoutStatus: 'paid',
            payoutBatchId: batch._id
          }
        }
      );
    }

    if (awardIds.length > 0) {
      await PartnerTargetAward.updateMany(
        { _id: { $in: awardIds } },
        {
          $set: {
            payoutStatus: 'paid',
            payoutBatchId: batch._id,
            status: 'paid'
          }
        }
      );
    }

    await PartnerPayoutItem.updateMany(
      { payoutBatchId: batch._id },
      {
        $set: {
          status: 'paid',
          paidAt: this.now()
        }
      }
    );

    batch.status = 'paid';
    batch.paidAt = this.now();
    batch.paidBy = new Types.ObjectId(input.actorUserId);

    if (input.externalReference) {
      batch.externalReference = input.externalReference;
    }

    if (input.notes) {
      batch.notes = input.notes;
    }

    await batch.save();
    return batch;
  }

  private async calculateOutstandingUsd(start: Date, end: Date): Promise<number> {
    const [conversion, award] = await Promise.all([
      PartnerConversion.aggregate([
        {
          $match: {
            payoutStatus: 'unpaid',
            convertedAt: { $gte: start, $lte: end }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$commissionAmountUsd' }
          }
        }
      ]),
      PartnerTargetAward.aggregate([
        {
          $match: {
            payoutStatus: 'unpaid',
            awardedAt: { $gte: start, $lte: end }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$bonusAmountUsd' }
          }
        }
      ])
    ]);

    return this.roundToCents((conversion[0]?.total || 0) + (award[0]?.total || 0));
  }

  private async calculatePaidUsd(start: Date, end: Date): Promise<number> {
    const [conversion, award] = await Promise.all([
      PartnerConversion.aggregate([
        {
          $match: {
            payoutStatus: 'paid',
            convertedAt: { $gte: start, $lte: end }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$commissionAmountUsd' }
          }
        }
      ]),
      PartnerTargetAward.aggregate([
        {
          $match: {
            payoutStatus: 'paid',
            awardedAt: { $gte: start, $lte: end }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$bonusAmountUsd' }
          }
        }
      ])
    ]);

    return this.roundToCents((conversion[0]?.total || 0) + (award[0]?.total || 0));
  }

  public async backfillFromInfluencerCoupons(actorUserId?: string) {
    const influencerCoupons = await Coupon.find({ isInfluencerCode: true, influencerId: { $exists: true } });
    let createdPartners = 0;
    let createdCodes = 0;

    for (const coupon of influencerCoupons) {
      const influencerId = coupon.influencerId?.toString();
      if (!influencerId) {
        continue;
      }

      let member = await PartnerMember.findOne({ userId: new Types.ObjectId(influencerId), role: 'owner' });
      let partner: PartnerDocument | null = null;

      if (!member) {
        const owner = await UserModel.findById(influencerId);
        if (!owner) {
          continue;
        }

        partner = await Partner.create({
          partnerType: 'influencer',
          displayName: `${owner.firstName} ${owner.lastName}`.trim() || owner.email,
          legalName: undefined,
          status: 'active',
          ownerUserId: owner._id,
          contactEmail: owner.email,
          currency: 'USD',
          defaultCommissionRate: coupon.influencerCommissionRate || 10,
          metadata: {
            notes: 'Backfilled from legacy influencer coupon'
          },
          createdBy: actorUserId ? new Types.ObjectId(actorUserId) : undefined,
          activatedAt: this.now()
        });

        member = await PartnerMember.create({
          partnerId: partner._id,
          userId: owner._id,
          role: 'owner',
          status: 'active',
          joinedAt: this.now(),
          invitedBy: actorUserId ? new Types.ObjectId(actorUserId) : undefined
        });

        createdPartners += 1;
      }

      if (!partner) {
        partner = await Partner.findById(member.partnerId);
      }

      if (!partner) {
        continue;
      }

      const existingCode = await PartnerCode.findOne({ code: coupon.code.toUpperCase() });
      if (existingCode) {
        continue;
      }

      await PartnerCode.create({
        partnerId: partner._id,
        code: coupon.code.toUpperCase(),
        isActive: coupon.isActive,
        description: coupon.description,
        attributionOnly: false,
        couponId: coupon._id,
        linkedCouponCode: coupon.code.toUpperCase(),
        commissionRateOverride: coupon.influencerCommissionRate,
        validFrom: coupon.validFrom || this.now(),
        validUntil: coupon.validUntil,
        createdBy: actorUserId ? new Types.ObjectId(actorUserId) : undefined,
        metadata: {
          backfilled: true
        }
      });

      createdCodes += 1;
    }

    return {
      scanned: influencerCoupons.length,
      createdPartners,
      createdCodes
    };
  }
}
