import 'reflect-metadata';

import request from 'supertest';
import { createExpressServer, useContainer } from 'routing-controllers';
import { Container } from 'typedi';

import { AppConfigController } from '../../../../../src/api/controllers/AppConfigController';
import { FeatureFlagService } from '../../../../../src/api/services/FeatureFlagService';
import { PartnerProgramService } from '../../../../../src/api/services/PartnerProgramService';
import { UsageService } from '../../../../../src/api/services/UsageService';
import { WebViewService } from '../../../../../src/api/services/WebViewService';
import { generateAccessToken } from '../../../../../src/lib/auth/token';

const accessToken = generateAccessToken({
  sub: '507f1f77bcf86cd799439011',
  email: 'learner@example.com',
  plan: 'premium',
  roles: ['content_manager']
});

describe('AppConfigController', () => {
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
      controllers: [AppConfigController],
      defaultErrorHandler: false
    });

  it('returns web bootstrap config for authenticated users', async () => {
    const usageService = {
      getUsageSummary: jest.fn().mockResolvedValue({
        plan: 'premium',
        practiceCount: 1,
        testCount: 1
      })
    } as unknown as UsageService;

    const featureFlagService = {
      listFlags: jest.fn().mockResolvedValue([
        { key: 'writing_module', enabled: true, rolloutPercentage: 100 },
        { key: 'listening_module', enabled: false, rolloutPercentage: 0 }
      ])
    } as unknown as FeatureFlagService;

    const partnerProgramService = {
      getPartnerPortalStatus: jest.fn().mockResolvedValue({
        enabled: true,
        isPartner: true,
        status: 'active',
        partnerType: 'influencer',
        dashboardUrl: 'http://localhost:3000/app/partner',
        registrationUrl: 'http://localhost:3000/app/partner'
      })
    } as unknown as PartnerProgramService;

    const webViewService = {
      getLearnerDashboardView: jest.fn(),
      getLearnerProgressView: jest.fn()
    } as unknown as WebViewService;

    Container.set({ id: UsageService, value: usageService });
    Container.set({ id: FeatureFlagService, value: featureFlagService });
    Container.set({ id: PartnerProgramService, value: partnerProgramService });
    Container.set({ id: WebViewService, value: webViewService });

    const app = createApp();
    const response = await request(app)
      .get('/api/v1/app/config')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Unique-Reference-Code', 'app-config-test');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      roles: ['content_manager'],
      subscriptionPlan: 'premium',
      enabledFeatureFlags: ['writing_module'],
      partnerPortal: {
        isPartner: true,
        status: 'active',
        partnerType: 'influencer',
        dashboardUrl: 'http://localhost:3000/app/partner',
        registrationUrl: 'http://localhost:3000/app/partner'
      }
    });

    expect(usageService.getUsageSummary).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439011',
      'premium',
      expect.objectContaining({ urc: 'app-config-test' })
    );
    expect(partnerProgramService.getPartnerPortalStatus).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
  });

  it('returns learner dashboard view payload', async () => {
    const webViewService = {
      getLearnerDashboardView: jest.fn().mockResolvedValue({
        kpis: {
          averageBand: 6.5,
          streakDays: 4,
          testsCompleted: 12,
          nextGoalBand: 7
        },
        quickPractice: [],
        recommended: [],
        activity: []
      }),
      getLearnerProgressView: jest.fn()
    } as unknown as WebViewService;

    Container.set({ id: UsageService, value: { getUsageSummary: jest.fn() } as unknown as UsageService });
    Container.set({ id: FeatureFlagService, value: { listFlags: jest.fn().mockResolvedValue([]) } as unknown as FeatureFlagService });
    Container.set({
      id: PartnerProgramService,
      value: { getPartnerPortalStatus: jest.fn().mockResolvedValue({ isPartner: false }) } as unknown as PartnerProgramService
    });
    Container.set({ id: WebViewService, value: webViewService });

    const app = createApp();
    const response = await request(app)
      .get('/api/v1/app/dashboard-view')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Unique-Reference-Code', 'app-dashboard-view-test');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(webViewService.getLearnerDashboardView).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439011',
      'premium',
      expect.objectContaining({ urc: 'app-dashboard-view-test' })
    );
  });

  it('returns learner progress view payload with filters', async () => {
    const webViewService = {
      getLearnerDashboardView: jest.fn(),
      getLearnerProgressView: jest.fn().mockResolvedValue({
        range: '30d',
        module: 'all',
        totals: {
          overallBand: 6.5,
          predictedScore: 7,
          testsCompleted: 24,
          studyHours: 32
        },
        trend: [],
        skillBreakdown: {
          speaking: 6.5,
          writing: 6,
          reading: 7.5,
          listening: 8
        },
        attempts: []
      })
    } as unknown as WebViewService;

    Container.set({ id: UsageService, value: { getUsageSummary: jest.fn() } as unknown as UsageService });
    Container.set({ id: FeatureFlagService, value: { listFlags: jest.fn().mockResolvedValue([]) } as unknown as FeatureFlagService });
    Container.set({
      id: PartnerProgramService,
      value: { getPartnerPortalStatus: jest.fn().mockResolvedValue({ isPartner: false }) } as unknown as PartnerProgramService
    });
    Container.set({ id: WebViewService, value: webViewService });

    const app = createApp();
    const response = await request(app)
      .get('/api/v1/app/progress-view?range=30d&module=all')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Unique-Reference-Code', 'app-progress-view-test');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(webViewService.getLearnerProgressView).toHaveBeenCalledWith('507f1f77bcf86cd799439011', '30d', 'all');
  });
});
