import 'reflect-metadata';

import request from 'supertest';
import { createExpressServer, useContainer } from 'routing-controllers';
import { Container } from 'typedi';

import { AdminAuditLogController } from '../../../../../src/api/controllers/AdminAuditLogController';
import { AdminAccessService } from '../../../../../src/api/services/AdminAccessService';
import { AdminService } from '../../../../../src/api/services/AdminService';
import { generateAccessToken } from '../../../../../src/lib/auth/token';

const adminToken = generateAccessToken({
  sub: '507f1f77bcf86cd799439011',
  email: 'admin@example.com',
  plan: 'pro',
  roles: ['superadmin']
});

describe('AdminAuditLogController', () => {
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
      controllers: [AdminAuditLogController],
      defaultErrorHandler: false
    });

  it('returns filtered audit logs', async () => {
    const adminService = {
      listAuditLogs: jest.fn().mockResolvedValue({
        logs: [{ _id: '1', action: 'update-user-roles' }],
        total: 1,
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
      .get('/api/v1/admin/audit-logs?limit=20&offset=0&action=update-user-roles')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Unique-Reference-Code', 'admin-audit-list');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(adminService.listAuditLogs).toHaveBeenCalledWith(20, 0, {
      actorUserId: undefined,
      action: 'update-user-roles',
      dateFrom: undefined,
      dateTo: undefined
    });
  });
});
