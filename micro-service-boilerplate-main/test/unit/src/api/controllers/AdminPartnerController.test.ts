import 'reflect-metadata';

import request from 'supertest';
import { createExpressServer, useContainer } from 'routing-controllers';
import { Container } from 'typedi';

import { AdminPartnerController } from '../../../../../src/api/controllers/AdminPartnerController';
import { AdminAccessService } from '../../../../../src/api/services/AdminAccessService';
import { PartnerProgramService } from '../../../../../src/api/services/PartnerProgramService';
import { generateAccessToken } from '../../../../../src/lib/auth/token';

const adminToken = generateAccessToken({
  sub: '507f1f77bcf86cd7994390fa',
  email: 'admin@example.com',
  plan: 'premium',
  roles: ['superadmin']
});

describe('AdminPartnerController', () => {
  beforeAll(() => {
    useContainer(Container);
  });

  afterEach(() => {
    Container.reset();
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  const createApp = () =>
    createExpressServer({
      routePrefix: '/api/v1',
      controllers: [AdminPartnerController],
      defaultErrorHandler: false
    });

  it('lists partner codes for selected partner', async () => {
    const partnerProgramService = {
      listPartnerCodesForAdmin: jest.fn().mockResolvedValue({
        partnerId: '507f1f77bcf86cd7994390aa',
        total: 1,
        limit: 10,
        offset: 0,
        codes: [{ _id: '507f1f77bcf86cd7994390bb', code: 'CREATOR10' }]
      })
    } as unknown as PartnerProgramService;

    const adminAccessService = {
      assertHasRole: jest.fn(),
      audit: jest.fn().mockResolvedValue(undefined)
    } as unknown as AdminAccessService;

    Container.set({ id: PartnerProgramService, value: partnerProgramService });
    Container.set({ id: AdminAccessService, value: adminAccessService });

    const app = createApp();
    const response = await request(app)
      .get('/api/v1/admin/partners/507f1f77bcf86cd7994390aa/codes?limit=10&offset=0')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Unique-Reference-Code', 'admin-partner-codes-test');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(partnerProgramService.listPartnerCodesForAdmin).toHaveBeenCalledWith('507f1f77bcf86cd7994390aa', 10, 0);
    expect(adminAccessService.assertHasRole).toHaveBeenCalled();
  });

  it('lists payout batches for operations panel', async () => {
    const partnerProgramService = {
      listPayoutBatches: jest.fn().mockResolvedValue({
        total: 1,
        limit: 20,
        offset: 0,
        batches: [{ _id: '507f1f77bcf86cd7994390cc', status: 'draft' }]
      })
    } as unknown as PartnerProgramService;

    const adminAccessService = {
      assertHasRole: jest.fn(),
      audit: jest.fn().mockResolvedValue(undefined)
    } as unknown as AdminAccessService;

    Container.set({ id: PartnerProgramService, value: partnerProgramService });
    Container.set({ id: AdminAccessService, value: adminAccessService });

    const app = createApp();
    const response = await request(app)
      .get('/api/v1/admin/partners/payout-batches?limit=20&offset=0')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Unique-Reference-Code', 'admin-partner-payouts-test');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(partnerProgramService.listPayoutBatches).toHaveBeenCalledWith(20, 0);
    expect(adminAccessService.assertHasRole).toHaveBeenCalled();
  });

  it('supports payout preflight preview and batch detail retrieval', async () => {
    const partnerProgramService = {
      previewPayoutBatch: jest.fn().mockResolvedValue({
        periodStart: '2026-02-01T00:00:00.000Z',
        periodEnd: '2026-02-29T23:59:59.999Z',
        partnerCount: 2,
        totals: {
          commissionUsd: 4200,
          bonusUsd: 250,
          totalUsd: 4450
        },
        preflight: {
          processingFeeUsd: 8.9,
          flaggedAccounts: [
            {
              partnerId: '507f1f77bcf86cd7994390af',
              partnerName: 'Alpha Influencer',
              amountUsd: 3200,
              status: 'review_required',
              riskFactors: ['high_payout_amount']
            }
          ],
          riskSummary: {
            flaggedCount: 1,
            flaggedAmountUsd: 3200
          }
        }
      }),
      getPayoutBatchDetail: jest.fn().mockResolvedValue({
        batch: {
          _id: '507f1f77bcf86cd7994390cc',
          status: 'draft'
        },
        items: [],
        preflight: {
          processingFeeUsd: 8.9,
          flaggedAccounts: [],
          riskSummary: {
            flaggedCount: 0,
            flaggedAmountUsd: 0
          }
        }
      })
    } as unknown as PartnerProgramService;

    const adminAccessService = {
      assertHasRole: jest.fn(),
      audit: jest.fn().mockResolvedValue(undefined)
    } as unknown as AdminAccessService;

    Container.set({ id: PartnerProgramService, value: partnerProgramService });
    Container.set({ id: AdminAccessService, value: adminAccessService });

    const app = createApp();

    const previewResponse = await request(app)
      .post('/api/v1/admin/partners/payout-batches/preview')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Unique-Reference-Code', 'admin-partner-payout-preview-test')
      .send({
        periodStart: '2026-02-01T00:00:00.000Z',
        periodEnd: '2026-02-29T23:59:59.999Z',
        partnerIds: ['507f1f77bcf86cd7994390af']
      });

    expect(previewResponse.status).toBe(200);
    expect(previewResponse.body.success).toBe(true);
    expect(partnerProgramService.previewPayoutBatch).toHaveBeenCalledWith({
      periodStart: new Date('2026-02-01T00:00:00.000Z'),
      periodEnd: new Date('2026-02-29T23:59:59.999Z'),
      partnerIds: ['507f1f77bcf86cd7994390af'],
      notes: undefined
    });

    const detailResponse = await request(app)
      .get('/api/v1/admin/partners/payout-batches/507f1f77bcf86cd7994390cc')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Unique-Reference-Code', 'admin-partner-payout-detail-test');

    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body.success).toBe(true);
    expect(partnerProgramService.getPayoutBatchDetail).toHaveBeenCalledWith('507f1f77bcf86cd7994390cc');
  });

  it('returns payout operations view payload with filters', async () => {
    const partnerProgramService = {
      getPayoutOperationsView: jest.fn().mockResolvedValue({
        summary: {
          pendingPayoutUsd: 124592,
          pendingChangePercent: 12.5,
          nextBatchDate: '2026-10-31T23:59:59.000Z',
          nextBatchCountdownDays: 4,
          totalPaidLtmUsd: 1200000,
          totalPaidChangePercent: 5.2
        },
        rows: [],
        total: 0,
        limit: 10,
        offset: 0
      })
    } as unknown as PartnerProgramService;

    const adminAccessService = {
      assertHasRole: jest.fn(),
      audit: jest.fn().mockResolvedValue(undefined)
    } as unknown as AdminAccessService;

    Container.set({ id: PartnerProgramService, value: partnerProgramService });
    Container.set({ id: AdminAccessService, value: adminAccessService });

    const app = createApp();
    const response = await request(app)
      .get('/api/v1/admin/partners/payout-operations-view?status=all&sort=amount_desc&limit=10&offset=0')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Unique-Reference-Code', 'admin-partner-payout-ops-view-test');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(partnerProgramService.getPayoutOperationsView).toHaveBeenCalledWith({
      status: 'all',
      sort: 'amount_desc',
      limit: 10,
      offset: 0
    });
    expect(adminAccessService.assertHasRole).toHaveBeenCalled();
  });
});
