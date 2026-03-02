import 'reflect-metadata';

import request from 'supertest';
import { createExpressServer, useContainer } from 'routing-controllers';
import { Container } from 'typedi';

import { AdminUserController } from '../../../../../src/api/controllers/AdminUserController';
import { AdminAccessService } from '../../../../../src/api/services/AdminAccessService';
import { AdminService } from '../../../../../src/api/services/AdminService';
import { generateAccessToken } from '../../../../../src/lib/auth/token';

const superadminToken = generateAccessToken({
  sub: '507f1f77bcf86cd799439011',
  email: 'admin@example.com',
  plan: 'pro',
  roles: ['superadmin']
});

describe('AdminUserController', () => {
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
      controllers: [AdminUserController],
      defaultErrorHandler: false
    });

  it('supports role updates additively', async () => {
    const adminService = {
      listUsers: jest.fn().mockResolvedValue({
        users: [],
        total: 0,
        limit: 50,
        offset: 0
      }),
      updateUserRoles: jest.fn().mockResolvedValue({
        _id: '507f1f77bcf86cd799439012',
        adminRoles: ['support_agent']
      })
    } as unknown as AdminService;

    const adminAccessService = {
      assertHasRole: jest.fn()
    } as unknown as AdminAccessService;

    Container.set({ id: AdminService, value: adminService });
    Container.set({ id: AdminAccessService, value: adminAccessService });

    const app = createApp();
    const response = await request(app)
      .patch('/api/v1/admin/users/507f1f77bcf86cd799439012/roles')
      .set('Authorization', `Bearer ${superadminToken}`)
      .set('Unique-Reference-Code', 'admin-users-role-patch')
      .send({ roles: ['support_agent'] });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(adminService.updateUserRoles).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439012',
      ['support_agent'],
      '507f1f77bcf86cd799439011'
    );
  });

  it('passes additive user filters through to admin service', async () => {
    const adminService = {
      listUsers: jest.fn().mockResolvedValue({
        users: [],
        total: 0,
        limit: 25,
        offset: 0
      }),
      updateUserRoles: jest.fn()
    } as unknown as AdminService;

    const adminAccessService = {
      assertHasRole: jest.fn()
    } as unknown as AdminAccessService;

    Container.set({ id: AdminService, value: adminService });
    Container.set({ id: AdminAccessService, value: adminAccessService });

    const app = createApp();
    const response = await request(app)
      .get(
        '/api/v1/admin/users?limit=25&offset=0&query=sarah&plan=pro&status=active&country=Vietnam&from=2026-01-01&to=2026-02-20&flagged=true'
      )
      .set('Authorization', `Bearer ${superadminToken}`)
      .set('Unique-Reference-Code', 'admin-users-filter-query');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(adminService.listUsers).toHaveBeenCalledWith(25, 0, {
      query: 'sarah',
      plan: 'pro',
      status: 'active',
      country: 'Vietnam',
      dateFrom: '2026-01-01',
      dateTo: '2026-02-20',
      flagged: true
    });
  });
});
