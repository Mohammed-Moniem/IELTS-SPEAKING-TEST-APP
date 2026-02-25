import 'reflect-metadata';

import request from 'supertest';
import { createExpressServer, useContainer } from 'routing-controllers';
import { Container } from 'typedi';

import { AdminNotificationCampaignController } from '../../../../../src/api/controllers/AdminNotificationCampaignController';
import { AuthMiddleware } from '../../../../../src/api/middlewares/AuthMiddleware';
import { AdminAccessService } from '../../../../../src/api/services/AdminAccessService';
import { NotificationCampaignService } from '../../../../../src/api/services/NotificationCampaignService';
import { generateAccessToken } from '../../../../../src/lib/auth/token';

const testUserId = '507f1f77bcf86cd799439011';
const superadminToken = generateAccessToken({
  sub: testUserId,
  email: 'admin@example.com',
  plan: 'pro',
  roles: ['superadmin']
});

const learnerToken = generateAccessToken({
  sub: testUserId,
  email: 'learner@example.com',
  plan: 'free',
  roles: []
});

describe('AdminNotificationCampaignController', () => {
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
      controllers: [AdminNotificationCampaignController],
      middlewares: [AuthMiddleware],
      defaultErrorHandler: false
    });

  it('creates campaign for superadmin', async () => {
    const mockService = {
      createCampaign: jest.fn().mockResolvedValue({
        campaign: {
          _id: '507f1f77bcf86cd799439099',
          status: 'draft'
        }
      }),
      preflightCampaign: jest.fn().mockResolvedValue({
        audienceEstimate: {
          targetedUsers: 120
        },
        safety: {
          frequencyCapOk: true,
          linkValidationOk: true,
          scheduleReady: true,
          warnings: []
        }
      }),
      listCampaigns: jest.fn(),
      getCampaign: jest.fn(),
      cancelCampaign: jest.fn(),
      sendNow: jest.fn()
    } as unknown as NotificationCampaignService;

    Container.set({ id: NotificationCampaignService, value: mockService });
    Container.set({ id: AdminAccessService, value: new AdminAccessService() });

    const app = createApp();
    const response = await request(app)
      .post('/api/v1/admin/notifications/campaigns')
      .set('Authorization', `Bearer ${superadminToken}`)
      .set('Unique-Reference-Code', 'admin-notification-create')
      .send({
        title: 'New offer',
        body: 'Enroll with discount',
        type: 'offer',
        mode: 'immediate',
        audience: {
          kind: 'all_users'
        }
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect((mockService as any).createCampaign).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'New offer',
        type: 'offer'
      }),
      testUserId
    );

    const preflight = await request(app)
      .post('/api/v1/admin/notifications/campaigns/preflight')
      .set('Authorization', `Bearer ${superadminToken}`)
      .set('Unique-Reference-Code', 'admin-notification-preflight')
      .send({
        title: 'Preflight offer',
        body: 'Preview this audience and safety checks',
        type: 'offer',
        mode: 'scheduled',
        scheduledAt: '2026-12-20T12:00:00.000Z',
        audience: {
          kind: 'all_users'
        }
      });

    expect(preflight.status).toBe(200);
    expect(preflight.body.success).toBe(true);
    expect((mockService as any).preflightCampaign).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Preflight offer',
        mode: 'scheduled'
      })
    );
  });

  it('blocks non-admin users from campaign management routes', async () => {
    const mockService = {
      createCampaign: jest.fn(),
      preflightCampaign: jest.fn(),
      listCampaigns: jest.fn(),
      getCampaign: jest.fn(),
      cancelCampaign: jest.fn(),
      sendNow: jest.fn()
    } as unknown as NotificationCampaignService;

    Container.set({ id: NotificationCampaignService, value: mockService });
    Container.set({ id: AdminAccessService, value: new AdminAccessService() });

    const app = createApp();
    const response = await request(app)
      .get('/api/v1/admin/notifications/campaigns')
      .set('Authorization', `Bearer ${learnerToken}`)
      .set('Unique-Reference-Code', 'admin-notification-list-forbidden');

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect((mockService as any).listCampaigns).not.toHaveBeenCalled();

    const preflightResponse = await request(app)
      .post('/api/v1/admin/notifications/campaigns/preflight')
      .set('Authorization', `Bearer ${learnerToken}`)
      .set('Unique-Reference-Code', 'admin-notification-preflight-forbidden')
      .send({
        title: 'Blocked',
        body: 'Blocked',
        type: 'system',
        audience: {
          kind: 'all_users'
        }
      });

    expect(preflightResponse.status).toBe(403);
    expect((mockService as any).preflightCampaign).not.toHaveBeenCalled();
  });
});
