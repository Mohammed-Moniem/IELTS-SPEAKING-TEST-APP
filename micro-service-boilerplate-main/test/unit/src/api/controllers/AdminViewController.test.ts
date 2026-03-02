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
        kpiDeltas: {
          activeUsers: { current: 12458, previous: 11000, deltaPercent: 13.25, direction: 'up' },
          estimatedRevenueUsd: { current: 45230, previous: 43110, deltaPercent: 4.92, direction: 'up' },
          aiCostUsd: { current: 2840, previous: 3010, deltaPercent: -5.65, direction: 'down' },
          platformHealthPercent: { current: 99.98, previous: 99.92, deltaPercent: 0.06, direction: 'up' }
        },
        latencySeries: [],
        alerts: [
          {
            id: 'alert-1',
            action: 'payment-failed',
            targetType: 'subscription',
            createdAt: '2026-02-27T12:00:00.000Z',
            severity: 'critical',
            details: { invoiceId: 'inv_1' }
          }
        ],
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
    expect(response.body.data.kpiDeltas.activeUsers.direction).toBe('up');
    expect(response.body.data.alerts[0].severity).toBe('critical');
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
        kpiDeltas: {
          totalRevenueUsd: { current: 24592, previous: 23010, deltaPercent: 6.87, direction: 'up' },
          activeUsersDaily: { current: 1842, previous: 1751, deltaPercent: 5.2, direction: 'up' },
          avgTokenCostUsd: { current: 0.042, previous: 0.046, deltaPercent: -8.7, direction: 'down' },
          grossMarginPercent: { current: 68.4, previous: 66.1, deltaPercent: 3.48, direction: 'up' }
        },
        trafficSeries: [],
        aiExpenditure: {
          totalCostUsd: 4200,
          totalRequests: 130,
          byModule: []
        },
        partnerPerformance: [],
        apiHealth: [],
        funnel: [],
        cohortSlices: {
          plan: { free: 0, premium: 0, pro: 0, team: 0 },
          modulePreference: { speaking: 0, writing: 0, reading: 0, listening: 0 },
          acquisitionChannel: { direct: 0, partner_register: 0, partner_checkout: 0, partner_manual: 0 }
        }
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
    expect(response.body.data.kpiDeltas.avgTokenCostUsd.direction).toBe('down');
  });
});
