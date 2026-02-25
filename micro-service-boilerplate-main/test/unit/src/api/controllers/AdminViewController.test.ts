import 'reflect-metadata';

import request from 'supertest';
import { createExpressServer, useContainer } from 'routing-controllers';
import { Container } from 'typedi';

import { AdminViewController } from '../../../../../src/api/controllers/AdminViewController';
import { AdminAccessService } from '../../../../../src/api/services/AdminAccessService';
import { WebViewService } from '../../../../../src/api/services/WebViewService';
import { generateAccessToken } from '../../../../../src/lib/auth/token';

const adminToken = generateAccessToken({
  sub: '507f1f77bcf86cd799439011',
  email: 'admin@example.com',
  plan: 'pro',
  roles: ['superadmin']
});

describe('AdminViewController', () => {
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
      controllers: [AdminViewController],
      defaultErrorHandler: false
    });

  it('returns admin overview view payload', async () => {
    const webViewService = {
      getAdminOverviewView: jest.fn().mockResolvedValue({
        window: '1h',
        kpis: {
          activeUsers: 12458,
          estimatedRevenueUsd: 45230,
          aiCostUsd: 2840,
          platformHealthPercent: 99.98
        },
        latencySeries: [],
        alerts: [],
        deployments: [],
        featureFlagSummary: []
      }),
      getAdminAnalyticsView: jest.fn()
    } as unknown as WebViewService;

    const adminAccessService = {
      assertHasRole: jest.fn()
    } as unknown as AdminAccessService;

    Container.set({ id: WebViewService, value: webViewService });
    Container.set({ id: AdminAccessService, value: adminAccessService });

    const app = createApp();
    const response = await request(app)
      .get('/api/v1/admin/overview-view?window=1h')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Unique-Reference-Code', 'admin-overview-view-test');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(webViewService.getAdminOverviewView).toHaveBeenCalledWith('1h');
    expect(adminAccessService.assertHasRole).toHaveBeenCalled();
  });

  it('returns admin analytics view payload', async () => {
    const webViewService = {
      getAdminOverviewView: jest.fn(),
      getAdminAnalyticsView: jest.fn().mockResolvedValue({
        range: '30d',
        kpis: {
          totalRevenueUsd: 24592,
          activeUsersDaily: 1842,
          avgTokenCostUsd: 0.042,
          grossMarginPercent: 68.4
        },
        trafficSeries: [],
        aiExpenditure: {
          totalCostUsd: 4200,
          totalRequests: 130,
          byModule: []
        },
        partnerPerformance: [],
        apiHealth: []
      })
    } as unknown as WebViewService;

    const adminAccessService = {
      assertHasRole: jest.fn()
    } as unknown as AdminAccessService;

    Container.set({ id: WebViewService, value: webViewService });
    Container.set({ id: AdminAccessService, value: adminAccessService });

    const app = createApp();
    const response = await request(app)
      .get('/api/v1/admin/analytics-view?range=30d')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Unique-Reference-Code', 'admin-analytics-view-test');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(webViewService.getAdminAnalyticsView).toHaveBeenCalledWith('30d');
    expect(adminAccessService.assertHasRole).toHaveBeenCalled();
  });
});
