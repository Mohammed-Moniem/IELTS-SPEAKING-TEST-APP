import 'reflect-metadata';

import request from 'supertest';
import { createExpressServer, useContainer } from 'routing-controllers';
import { Container } from 'typedi';

import { AdminSubscriptionController } from '../../../../../src/api/controllers/AdminSubscriptionController';
import { AdminAccessService } from '../../../../../src/api/services/AdminAccessService';
import { AdminService } from '../../../../../src/api/services/AdminService';
import { generateAccessToken } from '../../../../../src/lib/auth/token';

const supportToken = generateAccessToken({
  sub: '507f1f77bcf86cd799439011',
  email: 'support@example.com',
  plan: 'pro',
  roles: ['support_agent']
});

describe('AdminSubscriptionController', () => {
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
      controllers: [AdminSubscriptionController],
      defaultErrorHandler: false
    });

  it('passes additive subscription filters through to admin service', async () => {
    const adminService = {
      listSubscriptions: jest.fn().mockResolvedValue({
        subscriptions: [],
        total: 0,
        limit: 20,
        offset: 0
      })
    } as unknown as AdminService;

    const adminAccessService = {
      assertHasRole: jest.fn()
    } as unknown as AdminAccessService;

    Container.set({ id: AdminService, value: adminService });
    Container.set({ id: AdminAccessService, value: adminAccessService });

    const app = createApp();
    const response = await request(app)
      .get('/api/v1/admin/subscriptions?limit=20&offset=0&status=active&plan=pro&renewalFrom=2026-03-01&renewalTo=2026-04-01')
      .set('Authorization', `Bearer ${supportToken}`)
      .set('Unique-Reference-Code', 'admin-subscriptions-filter-query');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(adminService.listSubscriptions).toHaveBeenCalledWith(20, 0, {
      status: 'active',
      plan: 'pro',
      renewalFrom: '2026-03-01',
      renewalTo: '2026-04-01'
    });
  });
});
