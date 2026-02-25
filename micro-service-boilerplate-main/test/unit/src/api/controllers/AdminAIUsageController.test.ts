import 'reflect-metadata';

import request from 'supertest';
import { createExpressServer, useContainer } from 'routing-controllers';
import { Container } from 'typedi';

import { AdminAIUsageController } from '../../../../../src/api/controllers/AdminAIUsageController';
import { AdminAccessService } from '../../../../../src/api/services/AdminAccessService';
import { AdminService } from '../../../../../src/api/services/AdminService';
import { generateAccessToken } from '../../../../../src/lib/auth/token';

const adminToken = generateAccessToken({
  sub: '507f1f77bcf86cd799439011',
  email: 'admin@example.com',
  plan: 'pro',
  roles: ['superadmin']
});

describe('AdminAIUsageController', () => {
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
      controllers: [AdminAIUsageController],
      defaultErrorHandler: false
    });

  it('passes additive filters to AI usage summary service', async () => {
    const adminService = {
      getAIUsageSummary: jest.fn().mockResolvedValue({
        aggregate: [],
        recentLogs: []
      })
    } as unknown as AdminService;

    const adminAccessService = {
      assertHasRole: jest.fn()
    } as unknown as AdminAccessService;

    Container.set({ id: AdminService, value: adminService });
    Container.set({ id: AdminAccessService, value: adminAccessService });

    const app = createApp();
    const response = await request(app)
      .get('/api/v1/admin/ai-usage?limit=10&module=writing&status=ok&dateFrom=2026-01-01&dateTo=2026-01-31')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Unique-Reference-Code', 'admin-ai-usage-filters');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(adminService.getAIUsageSummary).toHaveBeenCalledWith(10, {
      module: 'writing',
      dateFrom: '2026-01-01',
      dateTo: '2026-01-31',
      status: 'ok'
    });
  });
});
