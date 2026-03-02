import 'reflect-metadata';

import request from 'supertest';
import { createExpressServer, useContainer } from 'routing-controllers';
import { Container } from 'typedi';

import { AdminFeatureFlagController } from '../../../../../src/api/controllers/AdminFeatureFlagController';
import { AdminAccessService } from '../../../../../src/api/services/AdminAccessService';
import { FeatureFlagService } from '../../../../../src/api/services/FeatureFlagService';
import { generateAccessToken } from '../../../../../src/lib/auth/token';

const superadminToken = generateAccessToken({
  sub: '507f1f77bcf86cd799439011',
  email: 'admin@example.com',
  plan: 'pro',
  roles: ['superadmin']
});

describe('AdminFeatureFlagController', () => {
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
      controllers: [AdminFeatureFlagController],
      defaultErrorHandler: false
    });

  it('supports listing and patching feature flags with superadmin gate', async () => {
    const featureFlagService = {
      listFlags: jest.fn().mockResolvedValue([
        { key: 'writing_module', enabled: true, rolloutPercentage: 100, description: 'Writing rollout' }
      ]),
      upsertFlag: jest.fn().mockResolvedValue({
        key: 'writing_module',
        enabled: false,
        rolloutPercentage: 25,
        description: 'Staged writing rollout'
      })
    } as unknown as FeatureFlagService;

    const adminAccessService = {
      assertHasRole: jest.fn()
    } as unknown as AdminAccessService;

    Container.set({ id: FeatureFlagService, value: featureFlagService });
    Container.set({ id: AdminAccessService, value: adminAccessService });

    const app = createApp();

    const listResponse = await request(app)
      .get('/api/v1/admin/feature-flags')
      .set('Authorization', `Bearer ${superadminToken}`)
      .set('Unique-Reference-Code', 'admin-flags-list-test');

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.success).toBe(true);
    expect(featureFlagService.listFlags).toHaveBeenCalledTimes(1);
    expect(adminAccessService.assertHasRole).toHaveBeenCalledWith(
      expect.objectContaining({ roles: ['superadmin'] }),
      ['superadmin']
    );

    const patchResponse = await request(app)
      .patch('/api/v1/admin/feature-flags/writing_module')
      .set('Authorization', `Bearer ${superadminToken}`)
      .set('Unique-Reference-Code', 'admin-flags-patch-test')
      .send({
        enabled: false,
        rolloutPercentage: 25,
        description: 'Staged writing rollout'
      });

    expect(patchResponse.status).toBe(200);
    expect(patchResponse.body.success).toBe(true);
    expect(patchResponse.body.message).toBe('Feature flag updated');
    expect(featureFlagService.upsertFlag).toHaveBeenCalledWith({
      key: 'writing_module',
      enabled: false,
      rolloutPercentage: 25,
      description: 'Staged writing rollout'
    });
  });
});
