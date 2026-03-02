import 'reflect-metadata';

import request from 'supertest';
import { createExpressServer, useContainer } from 'routing-controllers';
import { Container } from 'typedi';

import { AdminSubscriptionController } from '../../../../../src/api/controllers/AdminSubscriptionController';
import { CSError } from '../../../../../src/api/errors/CSError';
import { CODES, HTTP_STATUS_CODES } from '../../../../../src/api/errors/errorCodeConstants';
import { AdminAccessService } from '../../../../../src/api/services/AdminAccessService';
import { AdminService } from '../../../../../src/api/services/AdminService';
import { generateAccessToken } from '../../../../../src/lib/auth/token';

const supportToken = generateAccessToken({
  sub: '507f1f77bcf86cd799439011',
  email: 'support@example.com',
  plan: 'pro',
  roles: ['support_agent']
});

const superAdminToken = generateAccessToken({
  sub: '507f1f77bcf86cd799439012',
  email: 'admin@example.com',
  plan: 'pro',
  roles: ['superadmin']
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
      .get('/api/v1/admin/subscriptions?limit=20&offset=0&query=user@example.com&status=active&plan=pro&renewalFrom=2026-03-01&renewalTo=2026-04-01')
      .set('Authorization', `Bearer ${supportToken}`)
      .set('Unique-Reference-Code', 'admin-subscriptions-filter-query');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(adminService.listSubscriptions).toHaveBeenCalledWith(20, 0, {
      query: 'user@example.com',
      status: 'active',
      plan: 'pro',
      renewalFrom: '2026-03-01',
      renewalTo: '2026-04-01'
    });
  });

  it('updates subscription status for superadmin', async () => {
    const adminService = {
      listSubscriptions: jest.fn(),
      updateSubscriptionStatus: jest.fn().mockResolvedValue({
        _id: '507f1f77bcf86cd799439031',
        status: 'active'
      })
    } as unknown as AdminService;

    const adminAccessService = {
      assertHasRole: jest.fn()
    } as unknown as AdminAccessService;

    Container.set({ id: AdminService, value: adminService });
    Container.set({ id: AdminAccessService, value: adminAccessService });

    const app = createApp();
    const response = await request(app)
      .patch('/api/v1/admin/subscriptions/507f1f77bcf86cd799439031/status')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .set('Unique-Reference-Code', 'admin-subscriptions-patch-status-test')
      .send({ status: 'active' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(adminService.updateSubscriptionStatus).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439031',
      'active',
      '507f1f77bcf86cd799439012'
    );
  });

  it('updates subscription plan for superadmin', async () => {
    const adminService = {
      listSubscriptions: jest.fn(),
      updateSubscriptionPlan: jest.fn().mockResolvedValue({
        _id: '507f1f77bcf86cd799439031',
        planType: 'team'
      })
    } as unknown as AdminService;

    const adminAccessService = {
      assertHasRole: jest.fn()
    } as unknown as AdminAccessService;

    Container.set({ id: AdminService, value: adminService });
    Container.set({ id: AdminAccessService, value: adminAccessService });

    const app = createApp();
    const response = await request(app)
      .patch('/api/v1/admin/subscriptions/507f1f77bcf86cd799439031/plan')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .set('Unique-Reference-Code', 'admin-subscriptions-patch-plan-test')
      .send({ planType: 'team' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(adminService.updateSubscriptionPlan).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439031',
      'team',
      '507f1f77bcf86cd799439012'
    );
  });

  it('logs refund note for superadmin', async () => {
    const adminService = {
      listSubscriptions: jest.fn(),
      logSubscriptionRefundNote: jest.fn().mockResolvedValue({ logged: true })
    } as unknown as AdminService;

    const adminAccessService = {
      assertHasRole: jest.fn()
    } as unknown as AdminAccessService;

    Container.set({ id: AdminService, value: adminService });
    Container.set({ id: AdminAccessService, value: adminAccessService });

    const app = createApp();
    const response = await request(app)
      .post('/api/v1/admin/subscriptions/507f1f77bcf86cd799439031/refund-note')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .set('Unique-Reference-Code', 'admin-subscriptions-refund-note-test')
      .send({ note: 'Refund approved by finance due to duplicate charge.' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(adminService.logSubscriptionRefundNote).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439031',
      'Refund approved by finance due to duplicate charge.',
      '507f1f77bcf86cd799439012'
    );
  });

  it('blocks support role from subscription mutations', async () => {
    const adminService = {
      listSubscriptions: jest.fn(),
      updateSubscriptionStatus: jest.fn()
    } as unknown as AdminService;

    const adminAccessService = {
      assertHasRole: jest.fn().mockImplementation(() => {
        throw new CSError(HTTP_STATUS_CODES.FORBIDDEN, CODES.Forbidden, 'forbidden');
      })
    } as unknown as AdminAccessService;

    Container.set({ id: AdminService, value: adminService });
    Container.set({ id: AdminAccessService, value: adminAccessService });

    const app = createApp();
    const response = await request(app)
      .patch('/api/v1/admin/subscriptions/507f1f77bcf86cd799439031/status')
      .set('Authorization', `Bearer ${supportToken}`)
      .set('Unique-Reference-Code', 'admin-subscriptions-status-forbidden-test')
      .send({ status: 'active' });

    expect(response.status).toBe(403);
    expect(adminService.updateSubscriptionStatus).not.toHaveBeenCalled();
  });
});
