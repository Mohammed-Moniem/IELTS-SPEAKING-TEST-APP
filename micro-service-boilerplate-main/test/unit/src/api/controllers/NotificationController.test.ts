import 'reflect-metadata';

import request from 'supertest';
import { createExpressServer, useContainer } from 'routing-controllers';
import { Container } from 'typedi';

import { NotificationController } from '../../../../../src/api/controllers/NotificationController';
import { NotificationService } from '../../../../../src/api/services/NotificationService';
import { generateAccessToken } from '../../../../../src/lib/auth/token';
import { env } from '../../../../../src/env';

const testUserId = '507f1f77bcf86cd799439011';
const accessToken = generateAccessToken({
  sub: testUserId,
  email: 'learner@example.com',
  plan: 'free',
  roles: []
});

const adminAccessToken = generateAccessToken({
  sub: testUserId,
  email: 'admin@example.com',
  plan: 'pro',
  roles: ['superadmin']
});

describe('NotificationController', () => {
  beforeAll(() => {
    useContainer(Container);
  });

  afterEach(() => {
    Container.reset();
    jest.restoreAllMocks();
    jest.clearAllMocks();
    env.push.broadcastAllowedEmails = [];
  });

  const createApp = () =>
    createExpressServer({
      routePrefix: '/api/v1',
      controllers: [NotificationController],
      defaultErrorHandler: false
    });

  it('registers and unregisters web push endpoints', async () => {
    const mockService = {
      getNotificationSettings: jest.fn().mockResolvedValue({}),
      updateNotificationSettings: jest.fn().mockResolvedValue({}),
      registerDeviceToken: jest.fn().mockResolvedValue(undefined),
      removeDeviceToken: jest.fn().mockResolvedValue(undefined),
      registerWebDeviceToken: jest.fn().mockResolvedValue(undefined),
      removeWebDeviceToken: jest.fn().mockResolvedValue(undefined),
      notifySystemMessage: jest.fn().mockResolvedValue(undefined)
    } as unknown as NotificationService;

    Container.set({ id: NotificationService, value: mockService });
    const app = createApp();

    const registerResponse = await request(app)
      .post('/api/v1/notifications/device/web')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Unique-Reference-Code', 'notifications-web-register')
      .send({
        token: 'fcm-web-token',
        provider: 'fcm',
        locale: 'en-US',
        timezoneOffsetMinutes: -120
      });

    expect(registerResponse.status).toBe(202);
    expect(registerResponse.body.success).toBe(true);
    expect((mockService as any).registerWebDeviceToken).toHaveBeenCalledWith(testUserId, {
      token: 'fcm-web-token',
      locale: 'en-US',
      timezoneOffsetMinutes: -120,
      userAgent: undefined
    });

    const removeResponse = await request(app)
      .delete('/api/v1/notifications/device/web')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Unique-Reference-Code', 'notifications-web-unregister')
      .send({ token: 'fcm-web-token' });

    expect(removeResponse.status).toBe(202);
    expect(removeResponse.body.success).toBe(true);
    expect((mockService as any).removeWebDeviceToken).toHaveBeenCalledWith(testUserId, 'fcm-web-token');
  });

  it('keeps broadcast allow-list behavior intact', async () => {
    env.push.broadcastAllowedEmails = ['admin@example.com'];
    const mockService = {
      getNotificationSettings: jest.fn().mockResolvedValue({}),
      updateNotificationSettings: jest.fn().mockResolvedValue({}),
      registerDeviceToken: jest.fn().mockResolvedValue(undefined),
      removeDeviceToken: jest.fn().mockResolvedValue(undefined),
      registerWebDeviceToken: jest.fn().mockResolvedValue(undefined),
      removeWebDeviceToken: jest.fn().mockResolvedValue(undefined),
      notifySystemMessage: jest.fn().mockResolvedValue(undefined)
    } as unknown as NotificationService;

    Container.set({ id: NotificationService, value: mockService });
    const app = createApp();

    const forbidden = await request(app)
      .post('/api/v1/notifications/broadcast')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Unique-Reference-Code', 'notifications-broadcast-forbidden')
      .send({
        title: 'Maintenance',
        body: 'Service update',
        type: 'system'
      });

    expect(forbidden.status).toBe(403);
    expect(forbidden.body.success).toBe(false);
    expect((mockService as any).notifySystemMessage).not.toHaveBeenCalled();

    const allowed = await request(app)
      .post('/api/v1/notifications/broadcast')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .set('Unique-Reference-Code', 'notifications-broadcast-allowed')
      .send({
        title: 'Offer',
        body: 'Premium discount',
        type: 'offer'
      });

    expect(allowed.status).toBe(202);
    expect(allowed.body.success).toBe(true);
    expect((mockService as any).notifySystemMessage).toHaveBeenCalledWith({
      userIds: undefined,
      title: 'Offer',
      body: 'Premium discount',
      type: 'offer',
      data: undefined
    });
  });
});
